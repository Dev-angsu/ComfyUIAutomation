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

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from adapters.comfy_client import comfy_adapter
from config import settings
from models.schemas import GalleryPage, ImageInfo
from workers.queue_worker import task_store

router = APIRouter(prefix="/api", tags=["Gallery"])
logger = logging.getLogger(__name__)


def _make_image_info(img: dict) -> ImageInfo:
    """Build a platform-agnostic ImageInfo from a ComfyUI history image dict."""
    fname = img["filename"]
    subfolder = img.get("subfolder", "")
    img_type = img.get("type", "output")
    url = f"/api/images/{fname}?subfolder={subfolder}&type={img_type}"
    return ImageInfo(filename=fname, subfolder=subfolder, type=img_type, url=url)


# ── Full Gallery (from ComfyUI history) ───────────────────────────────────────

@router.get(
    "/gallery",
    response_model=GalleryPage,
    summary="Paginated image gallery from ComfyUI history",
)
async def get_gallery(
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=20, ge=1, le=100, description="Images per page"),
) -> GalleryPage:
    """
    Phase 1: Reads directly from ComfyUI's /history endpoint.
    Phase 2: Replaced by PostgreSQL paginated query (same response shape).
    """
    try:
        history = await comfy_adapter.get_full_history()
    except Exception as exc:
        logger.error(f"Failed to fetch ComfyUI history: {exc}")
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach ComfyUI at {settings.comfy_server}: {exc}",
        )

    all_images: list[ImageInfo] = []

    for prompt_id, record in history.items():
        outputs = record.get("outputs", {})
        save_output = outputs.get(settings.comfy_output_node_id, {})
        for img in save_output.get("images", []):
            all_images.append(_make_image_info(img))

    # Sort newest-first (ComfyUI prefixes filenames with sequential counters)
    all_images.sort(key=lambda x: x.filename, reverse=True)

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


# ── Images for a Specific Task ────────────────────────────────────────────────

@router.get(
    "/gallery/task/{task_id}",
    summary="Get images produced by a specific task",
)
async def get_task_images(task_id: str) -> dict:
    """Returns images for a completed task from the in-memory task store."""
    task = task_store.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found")

    raw_images: list[dict] = task.get("images") or []
    images = [_make_image_info(img) for img in raw_images]

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
) -> Response:
    """
    Fetches image bytes from ComfyUI's /view endpoint and streams them to the client.

    Platform-agnostic by design:
      - ComfyUI runs on Windows (F:\\...\\output)
      - This app runs on macOS
      - The frontend runs in the browser
      - None of them share a filesystem — everything goes through HTTP.

    Security: path traversal prevention built in.
    """
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
