from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from core.database import get_db, SavedPrompt, PromptCollection
from core.auth import get_current_user
from models.schemas import (
    SavedPromptCreate, SavedPromptUpdate, SavedPromptResponse,
    PromptCollectionCreate, PromptCollectionResponse
)

router = APIRouter(prefix="/api/prompts", tags=["Prompts Zone"])

# ── Collections ───────────────────────────────────────────────────────────────

@router.get("/collections", response_model=List[PromptCollectionResponse])
async def get_collections(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return db.query(PromptCollection).filter(PromptCollection.user_id == current_user.id).all()

@router.post("/collections", response_model=PromptCollectionResponse)
async def create_collection(
    collection: PromptCollectionCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_collection = PromptCollection(**collection.dict(), user_id=current_user.id)
    db.add(db_collection)
    db.commit()
    db.refresh(db_collection)
    return db_collection

@router.delete("/collections/{collection_id}")
async def delete_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_collection = db.query(PromptCollection).filter(
        PromptCollection.id == collection_id,
        PromptCollection.user_id == current_user.id
    ).first()
    if not db_collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    db.delete(db_collection)
    db.commit()
    return {"message": "Collection deleted"}

# ── Prompts ───────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[SavedPromptResponse])
async def get_prompts(
    collection_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(SavedPrompt).filter(SavedPrompt.user_id == current_user.id)
    if collection_id is not None:
        query = query.filter(SavedPrompt.collection_id == collection_id)
    
    # Sort by liked first, then by created_at desc
    return query.order_by(SavedPrompt.is_liked.desc(), SavedPrompt.created_at.desc()).all()

@router.post("/", response_model=SavedPromptResponse)
async def create_prompt(
    prompt: SavedPromptCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_prompt = SavedPrompt(**prompt.dict(), user_id=current_user.id)
    db.add(db_prompt)
    db.commit()
    db.refresh(db_prompt)
    return db_prompt

@router.patch("/{prompt_id}", response_model=SavedPromptResponse)
async def update_prompt(
    prompt_id: int,
    prompt_update: SavedPromptUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_prompt = db.query(SavedPrompt).filter(
        SavedPrompt.id == prompt_id,
        SavedPrompt.user_id == current_user.id
    ).first()
    if not db_prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    update_data = prompt_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_prompt, key, value)
    
    db.commit()
    db.refresh(db_prompt)
    return db_prompt

@router.delete("/{prompt_id}")
async def delete_prompt(
    prompt_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_prompt = db.query(SavedPrompt).filter(
        SavedPrompt.id == prompt_id,
        SavedPrompt.user_id == current_user.id
    ).first()
    if not db_prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    db.delete(db_prompt)
    db.commit()
    return {"message": "Prompt deleted"}
