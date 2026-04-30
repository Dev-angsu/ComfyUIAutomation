import logging
import os
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from core.database import get_db, User, ImageCollection, SavedImage
from core.auth import get_current_user
from models.schemas import (
    ImageCollectionCreate, ImageCollectionResponse, 
    SavedImageCreate, SavedImageResponse, SavedImageUpdate
)
from adapters.comfy_client import comfy_adapter
from config import settings

router = APIRouter(prefix="/api/collections", tags=["Image Collections"])
logger = logging.getLogger(__name__)

# Directory to store collection images permanently
COLLECTIONS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "collections_data")

def ensure_collections_dir(user_id: int):
    user_dir = os.path.join(COLLECTIONS_DIR, str(user_id))
    if not os.path.exists(user_dir):
        os.makedirs(user_dir, exist_ok=True)
    return user_dir

def _make_saved_image_response(img: SavedImage) -> SavedImageResponse:
    url = f"/api/images/{img.filename}?type=collection"
    return SavedImageResponse(
        id=img.id,
        collection_id=img.collection_id,
        user_id=img.user_id,
        filename=img.filename,
        subfolder=img.subfolder,
        type=img.type,
        positive_prompt=img.positive_prompt,
        negative_prompt=img.negative_prompt,
        width=img.width,
        height=img.height,
        steps=img.steps,
        seed=img.seed,
        workflow=img.workflow,
        is_liked=img.is_liked,
        created_at=img.created_at,
        url=url
    )

@router.get("/", response_model=List[ImageCollectionResponse])
async def get_collections(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    collections = db.query(ImageCollection).filter(ImageCollection.user_id == user.id).all()
    
    # Manually build response to include images with URLs
    result = []
    for col in collections:
        # Get images for this collection, liked first, then by date
        images = db.query(SavedImage).filter(SavedImage.collection_id == col.id).order_by(
            desc(SavedImage.is_liked), desc(SavedImage.created_at)
        ).all()
        
        col_res = ImageCollectionResponse(
            id=col.id,
            name=col.name,
            user_id=col.user_id,
            created_at=col.created_at,
            images=[_make_saved_image_response(img) for img in images]
        )
        result.append(col_res)
    
    return result

@router.post("/", response_model=ImageCollectionResponse)
async def create_collection(
    col: ImageCollectionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_col = ImageCollection(name=col.name, user_id=user.id)
    db.add(new_col)
    db.commit()
    db.refresh(new_col)
    return ImageCollectionResponse(
        id=new_col.id,
        name=new_col.name,
        user_id=new_col.user_id,
        created_at=new_col.created_at,
        images=[]
    )

@router.delete("/{collection_id}")
async def delete_collection(
    collection_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    col = db.query(ImageCollection).filter(ImageCollection.id == collection_id, ImageCollection.user_id == user.id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # Delete associated image files
    images = db.query(SavedImage).filter(SavedImage.collection_id == col.id).all()
    user_dir = ensure_collections_dir(user.id)
    for img in images:
        file_path = os.path.join(user_dir, img.filename)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                logger.error(f"Failed to delete file {file_path}: {e}")
    
    db.delete(col)
    db.commit()
    return {"message": "Collection deleted"}

@router.post("/save", response_model=SavedImageResponse)
async def save_image_to_collection(
    data: SavedImageCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Fetch image bytes from ComfyUI
    try:
        image_bytes = await comfy_adapter.get_image_bytes(
            data.filename, data.subfolder or "", data.type or "output"
        )
    except Exception as e:
        logger.error(f"Failed to fetch image bytes from ComfyUI: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch image from ComfyUI")
    
    # 2. Save image permanently
    user_dir = ensure_collections_dir(user.id)
    # Ensure unique filename to avoid overwriting (though ComfyUI filenames are usually unique)
    # We'll just use the original filename for now as requested
    file_path = os.path.join(user_dir, data.filename)
    
    with open(file_path, "wb") as f:
        f.write(image_bytes)
    
    # 3. Create DB record
    new_img = SavedImage(
        collection_id=data.collection_id,
        user_id=user.id,
        filename=data.filename,
        subfolder=None, # In collection, we store it flat in user dir
        type="collection",
        positive_prompt=data.positive_prompt,
        negative_prompt=data.negative_prompt,
        width=data.width,
        height=data.height,
        steps=data.steps,
        seed=data.seed,
        workflow=data.workflow,
        is_liked=data.is_liked
    )
    db.add(new_img)
    db.commit()
    db.refresh(new_img)
    
    return _make_saved_image_response(new_img)

@router.post("/save-bulk", response_model=List[SavedImageResponse])
async def save_images_to_collection_bulk(
    data: List[SavedImageCreate],
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_dir = ensure_collections_dir(user.id)
    results = []
    
    for item in data:
        # Check if image already exists in this collection to avoid duplicates
        existing = db.query(SavedImage).filter(
            SavedImage.collection_id == item.collection_id,
            SavedImage.user_id == user.id,
            SavedImage.filename == item.filename
        ).first()
        
        if existing:
            continue

        try:
            # 1. Fetch image bytes from ComfyUI
            image_bytes = await comfy_adapter.get_image_bytes(
                item.filename, item.subfolder or "", item.type or "output"
            )
            
            # 2. Save image permanently
            file_path = os.path.join(user_dir, item.filename)
            with open(file_path, "wb") as f:
                f.write(image_bytes)
            
            # 3. Create DB record
            new_img = SavedImage(
                collection_id=item.collection_id,
                user_id=user.id,
                filename=item.filename,
                subfolder=None, # In collection, we store it flat in user dir
                type="collection",
                positive_prompt=item.positive_prompt,
                negative_prompt=item.negative_prompt,
                width=item.width,
                height=item.height,
                steps=item.steps,
                seed=item.seed,
                workflow=item.workflow,
                is_liked=item.is_liked
            )
            db.add(new_img)
            results.append(new_img)
        except Exception as e:
            logger.error(f"Failed to save image {item.filename} in bulk: {e}")
            # Continue with other images
            continue
            
    db.commit()
    # Refresh to get IDs
    for img in results:
        db.refresh(img)
        
    return [_make_saved_image_response(img) for img in results]

@router.patch("/images/{image_id}", response_model=SavedImageResponse)
async def update_saved_image(
    image_id: int,
    updates: SavedImageUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    img = db.query(SavedImage).filter(SavedImage.id == image_id, SavedImage.user_id == user.id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    
    if updates.is_liked is not None:
        img.is_liked = updates.is_liked
    if updates.collection_id is not None:
        img.collection_id = updates.collection_id
        
    db.commit()
    db.refresh(img)
    return _make_saved_image_response(img)

@router.delete("/images/{image_id}")
async def delete_saved_image(
    image_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    img = db.query(SavedImage).filter(SavedImage.id == image_id, SavedImage.user_id == user.id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Delete file
    user_dir = ensure_collections_dir(user.id)
    file_path = os.path.join(user_dir, img.filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            logger.error(f"Failed to delete file {file_path}: {e}")
            
    db.delete(img)
    db.commit()
    return {"message": "Image removed from collection"}

@router.post("/images/delete-bulk")
async def delete_saved_images_bulk(
    image_ids: List[int],
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    images = db.query(SavedImage).filter(
        SavedImage.id.in_(image_ids), 
        SavedImage.user_id == user.id
    ).all()
    
    user_dir = ensure_collections_dir(user.id)
    deleted_count = 0
    
    for img in images:
        # Delete file
        file_path = os.path.join(user_dir, img.filename)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                logger.error(f"Failed to delete file {file_path}: {e}")
        
        db.delete(img)
        deleted_count += 1
        
    db.commit()
    return {"message": f"Successfully removed {deleted_count} images from collection", "deleted_count": deleted_count}
