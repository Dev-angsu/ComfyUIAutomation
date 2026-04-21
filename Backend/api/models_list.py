from __future__ import annotations

"""
AI Studio — Model Listing API Routes
---------------------------------------
Endpoints:
  GET /api/models    — Available UNET/VAE/CLIP models + sampler options
  GET /api/comfy/status — ComfyUI server reachability + queue info
"""

import logging

from fastapi import APIRouter, HTTPException

from adapters.comfy_client import comfy_adapter
from config import settings
from models.schemas import ModelList

router = APIRouter(prefix="/api", tags=["Models"])
logger = logging.getLogger(__name__)


@router.get(
    "/models",
    response_model=ModelList,
    summary="List available models and sampler options from ComfyUI",
)
async def get_models() -> ModelList:
    """
    Interrogates ComfyUI's /object_info endpoint to discover:
    - Available UNET (diffusion model) files
    - Available VAE files
    - Available CLIP model files
    - Supported sampler names and scheduler types

    The frontend uses this to populate the Model Selection dropdowns.
    Results reflect whatever ComfyUI has loaded — no hardcoding required.
    """
    try:
        models = await comfy_adapter.get_models()
        samplers = await comfy_adapter.get_samplers()
    except Exception as exc:
        logger.error(f"Failed to fetch models from ComfyUI: {exc}")
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach ComfyUI at {settings.comfy_server}. "
                   "Is it running? Check your COMFY_SERVER env setting.",
        )

    return ModelList(
        unet=models.get("unet", []),
        vae=models.get("vae", []),
        clip=models.get("clip", []),
        sampler_names=samplers.get("sampler_names", []),
        schedulers=samplers.get("schedulers", []),
    )


@router.get(
    "/comfy/status",
    summary="ComfyUI server connectivity and queue status",
)
async def get_comfy_status() -> dict:
    """
    Health-check + live queue info from ComfyUI.
    Used by the bottom panel to show how many prompts are pending on ComfyUI side.
    """
    try:
        queue_data = await comfy_adapter.get_queue_status()
        return {
            "online": True,
            "server": settings.comfy_server,
            "queue_running": len(queue_data.get("queue_running", [])),
            "queue_pending": len(queue_data.get("queue_pending", [])),
        }
    except Exception as exc:
        logger.warning(f"ComfyUI unreachable: {exc}")
        return {
            "online": False,
            "server": settings.comfy_server,
            "error": str(exc),
        }
