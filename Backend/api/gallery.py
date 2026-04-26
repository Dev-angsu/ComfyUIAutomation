from __future__ import annotations

"""
AI Studio — Gallery & Image Proxy API Routes
----------------------------------------------
Endpoints:
  GET /api/gallery              — Paginated image list from ComfyUI history
  GET /api/images/{filename}    — Platform-agnostic image proxy (ComfyUI /view)
  GET /api/gallery/task/{task_id} — Images for a specific task

Design note: Phase 1 reads directly from ComfyUI's /history endpoint.
Phase 2 will replace this with a PostgreSQL query against the images table,
enabling filtering, favorites, soft-deletes, and metadata search.
The proxy endpoint (/api/images) stays unchanged in both phases.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import Response
from core.auth import get_current_user
from core.database import User
from adapters.comfy_client import comfy_adapter
from config import settings
from models.schemas import GalleryPage, ImageInfo
from workers.queue_worker import task_store

router = APIRouter(prefix="/api", tags=["Gallery"])
logger = logging.getLogger(__name__)


def _make_image_info(
    img: dict,
    positive: Optional[str] = None,
    negative: Optional[str] = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    steps: Optional[int] = None,
    seed: Optional[int] = None,
    workflow: Optional[str] = None
) -> ImageInfo:
    """Build a platform-agnostic ImageInfo from a ComfyUI history image dict."""
    fname = img["filename"]
    subfolder = img.get("subfolder", "")
    img_type = img.get("type", "output")
    url = f"/api/images/{fname}?subfolder={subfolder}&type={img_type}"
    return ImageInfo(
        filename=fname,
        subfolder=subfolder,
        type=img_type,
        url=url,
        positive_prompt=positive,
        negative_prompt=negative,
        width=width,
        height=height,
        steps=steps,
        seed=seed,
        workflow=workflow
    )


def _extract_from_history(record: dict) -> dict:
    """
    Fallback: Extract generation metadata from the ComfyUI prompt graph.
    Used when the local task_store (in-memory) is lost after a restart.
    """
    res = {}
    try:
        # ComfyUI history structure: record['prompt'] = [count, workflow_dict, extra]
        prompt_data = record.get("prompt")
        if not prompt_data:
            return res

        workflow = prompt_data[1] if isinstance(prompt_data, list) and len(prompt_data) > 1 else prompt_data
        if not isinstance(workflow, dict):
            return res

        # Map our known node IDs (from core.workflow_builder)
        # Positive Prompt (Node 11)
        pos_node = workflow.get("11", {})
        if pos_node.get("class_type") == "CLIPTextEncode":
            res["positive_prompt"] = pos_node.get("inputs", {}).get("text")

        # Negative Prompt (Node 12)
        neg_node = workflow.get("12", {})
        if neg_node.get("class_type") == "CLIPTextEncode":
            res["negative_prompt"] = neg_node.get("inputs", {}).get("text")

        # Dimensions (Node 28)
        latent_node = workflow.get("28", {})
        if latent_node.get("class_type") == "EmptyLatentImage":
            res["width"] = latent_node.get("inputs", {}).get("width")
            res["height"] = latent_node.get("inputs", {}).get("height")

        # Sampler / Steps (Node 19)
        ksampler_node = workflow.get("19", {})
        if ksampler_node.get("class_type") == "KSampler":
            res["steps"] = ksampler_node.get("inputs", {}).get("steps")
            res["seed"] = ksampler_node.get("inputs", {}).get("seed")

    except Exception as e:
        logger.debug(f"Metadata extraction failed: {e}")

    return res


# ── Full Gallery (from ComfyUI history) ───────────────────────────────────────

async def _get_all_images_metadata(user_id: int) -> list[ImageInfo]:
    """Helper to fetch and map all images from ComfyUI history with metadata."""
    try:
        history = await comfy_adapter.get_full_history()
    except Exception as exc:
        logger.error(f"Failed to fetch ComfyUI history: {exc}")
        return []

    all_images: list[ImageInfo] = []
    # Only get tasks for this user
    user_tasks = task_store.get_all_tasks(user_id=user_id)
    task_map = {
        t.get("comfy_prompt_id"): t 
        for t in user_tasks 
        if t.get("comfy_prompt_id")
    }

    user_subfolder_prefix = f"users/{user_id}"

    for prompt_id, record in history.items():
        task = task_map.get(prompt_id)
        
        outputs = record.get("outputs", {})
        save_output = outputs.get(settings.comfy_output_node_id, {})
        
        # Check if ANY image in this record belongs to the user's subfolder
        # or if we have a task record for it.
        belongs_to_user = False
        images_in_record = save_output.get("images", [])
        
        if task:
            belongs_to_user = True
        else:
            # Fallback: check subfolder strings
            for img in images_in_record:
                sub = img.get("subfolder", "").replace("\\", "/")
                if sub == user_subfolder_prefix or sub.startswith(f"{user_subfolder_prefix}/"):
                    belongs_to_user = True
                    break
        
        if not belongs_to_user:
            continue

        if task:
            pos = task.get("positive_prompt")
            neg = task.get("negative_prompt")
            w = task.get("width")
            h = task.get("height")
            s = task.get("steps")
            sd = task.get("seed")
            wf = task.get("workflow")
        else:
            meta = _extract_from_history(record)
            pos = meta.get("positive_prompt")
            neg = meta.get("negative_prompt")
            w = meta.get("width")
            h = meta.get("height")
            s = meta.get("steps")
            sd = meta.get("seed")
            wf = None

        for img in images_in_record:
            # Only include images that are actually in the user's subfolder
            sub = img.get("subfolder", "").replace("\\", "/")
            is_in_user_folder = sub == user_subfolder_prefix or sub.startswith(f"{user_subfolder_prefix}/")
            if is_in_user_folder or task:
                all_images.append(_make_image_info(img, pos, neg, w, h, s, sd, wf))

    all_images.reverse()
    return all_images


@router.get(
    "/gallery",
    response_model=GalleryPage,
    summary="Paginated image gallery from ComfyUI history",
)
async def get_gallery(
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=20, ge=1, le=1000, description="Images per page"),
    user: User = Depends(get_current_user)
) -> GalleryPage:
    """
    Phase 1: Reads directly from ComfyUI's /history endpoint.
    Phase 2: Replaced by PostgreSQL paginated query.
    """
    all_images = await _get_all_images_metadata(user_id=user.id)
    if not all_images and page == 1:
        # Check if it was an error or just empty
        # We don't raise here to allow empty gallery UI
        pass

    total = len(all_images)
    start = (page - 1) * page_size
    end = start + page_size
    page_images = all_images[start:end]

    return GalleryPage(
        images=page_images,
        total=total,
        page=page,
        page_size=page_size,
        has_more=end < total,
    )


@router.get(
    "/gallery/all",
    response_model=list[ImageInfo],
    summary="Get ALL images metadata (no pagination)",
)
async def get_all_gallery_images(user: User = Depends(get_current_user)) -> list[ImageInfo]:
    """Returns every image in the gallery history. Use for bulk downloads."""
    return await _get_all_images_metadata(user_id=user.id)


# ── Images for a Specific Task ────────────────────────────────────────────────

@router.get(
    "/gallery/task/{task_id}",
    summary="Get images produced by a specific task",
)
async def get_task_images(task_id: str, user: User = Depends(get_current_user)) -> dict:
    """Returns images for a completed task from the in-memory task store."""
    task = task_store.get_task(task_id)
    if not task or task.get("user_id") != user.id:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found")

    raw_images: list[dict] = task.get("images") or []
    pos = task.get("positive_prompt")
    neg = task.get("negative_prompt")
    w = task.get("width")
    h = task.get("height")
    s = task.get("steps")
    sd = task.get("seed")
    wf = task.get("workflow")
    
    images = [_make_image_info(img, pos, neg, w, h, s, sd, wf) for img in raw_images]

    return {
        "task_id": task_id,
        "status": task.get("status"),
        "seed": task.get("seed"),
        "images": [img.model_dump() for img in images],
        "positive_prompt": task.get("positive_prompt"),
    }


# ── Platform-Agnostic Image Proxy ─────────────────────────────────────────────

@router.get(
    "/images/{filename}",
    summary="Proxy an image from ComfyUI (platform-agnostic)",
    responses={
        200: {"content": {"image/png": {}, "image/jpeg": {}, "image/webp": {}}},
        400: {"description": "Invalid filename"},
        502: {"description": "Could not fetch from ComfyUI"},
    },
)
async def proxy_image(
    filename: str,
    subfolder: str = Query(default="", description="ComfyUI subfolder"),
    type: str = Query(default="output", description="ComfyUI image type (output/input/temp)"),
    token: Optional[str] = Query(default=None),
) -> Response:
    """
    Fetches image bytes from ComfyUI's /view endpoint and streams them to the client.
    Validates that the subfolder belongs to the user if it's an output image.
    Supports both Authorization header and 'token' query parameter for <img> tags.
    """
    from core.auth import SECRET_KEY, ALGORITHM, oauth2_scheme
    from core.database import SessionLocal, User as UserMod
    from jose import jwt
    from fastapi import Request

    user = None
    
    # 1. Try token from query param (highest priority for <img> tags)
    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username: str = payload.get("sub")
            with SessionLocal() as db:
                user = db.query(UserMod).filter(UserMod.username == username).first()
            if user:
                logger.debug(f"Resolved user {user.username} from token for {filename}")
            else:
                logger.warning(f"Valid token for {username} but user not found in DB")
        except Exception as e:
            logger.warning(f"Failed to decode image proxy token: {e}")
            pass
    
    # 2. If no user yet, no other choice (we can't easily call Depends() here)
    if not user:
        logger.warning(f"Unauthorized image proxy request for {filename} (no valid token)")
        raise HTTPException(status_code=401, detail="Authentication required")

    # Security: Ensure user only accesses their own output folder
    if type == "output":
        user_prefix = f"users/{user.id}"
        # Normalize slashes for Windows compatibility
        normalized_subfolder = subfolder.replace("\\", "/")
        is_authorized = normalized_subfolder == user_prefix or normalized_subfolder.startswith(f"{user_prefix}/")
        if not is_authorized:
             logger.warning(f"Unauthorized image access attempt by user {user.id} ({user.username}) for subfolder {subfolder} (expected prefix {user_prefix})")
             raise HTTPException(status_code=403, detail="Unauthorized access to this image")

    # Prevent path traversal attacks
    if any(c in filename for c in ("..", "/", "\\", "\x00")):
        raise HTTPException(status_code=400, detail="Invalid filename")

    # Sanitize subfolder similarly
    if subfolder and any(c in subfolder for c in ("..", "\x00")):
        raise HTTPException(status_code=400, detail="Invalid subfolder")

    try:
        image_bytes = await comfy_adapter.get_image_bytes(filename, subfolder, type)
    except Exception as exc:
        logger.error(f"Image proxy error for '{filename}': {exc}")
        raise HTTPException(
            status_code=502,
            detail=f"Could not fetch '{filename}' from ComfyUI at {settings.comfy_server}",
        )

    # Determine MIME type from extension
    lower = filename.lower()
    if lower.endswith(".jpg") or lower.endswith(".jpeg"):
        media_type = "image/jpeg"
    elif lower.endswith(".webp"):
        media_type = "image/webp"
    elif lower.endswith(".gif"):
        media_type = "image/gif"
    else:
        media_type = "image/png"

    return Response(
        content=image_bytes,
        media_type=media_type,
        headers={
            # Allow frontend to cache images — they're immutable once generated
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    )
