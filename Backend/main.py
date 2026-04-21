from __future__ import annotations

"""
AI Studio — FastAPI Application Entry Point
--------------------------------------------
Wires together all components:
  - CORS middleware (restricted to Next.js frontend)
  - Lifespan: starts ComfyUI WS listener + generation worker on startup
  - Routers: generate, dictionaries, gallery, models, websockets
  - OpenAPI docs at /docs and /redoc

Run with:
  uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from adapters.comfy_client import comfy_adapter
from api import dictionaries, gallery, generate, models_list
from api import websockets as ws_routes
from config import settings
from workers.queue_worker import generation_worker

# ── Logging ────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("api_server.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)


# ── Lifespan Context ───────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup/shutdown lifecycle.
    Startup:  launch ComfyUI WS listener + queue worker as background tasks.
    Shutdown: gracefully cancel both tasks.
    """
    logger.info("=" * 60)
    logger.info("  AI Studio API starting up")
    logger.info(f"  ComfyUI server : {settings.comfy_server}")
    logger.info(f"  Frontend CORS  : {settings.frontend_url}")
    logger.info(f"  Jobs directory : {settings.jobs_dir}")
    logger.info("=" * 60)

    # Start the persistent ComfyUI WebSocket listener
    await comfy_adapter.start_ws_listener()

    # Start the generation queue worker (single-consumer coroutine)
    worker_task = asyncio.create_task(
        generation_worker(),
        name="generation_worker",
    )

    logger.info("✅ All background tasks running — API ready")

    yield  # Application runs here

    # ── Graceful shutdown ──────────────────────────────────────────────────────
    logger.info("Shutting down AI Studio API...")
    await comfy_adapter.stop_ws_listener()

    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass

    logger.info("✅ Shutdown complete")


# ── FastAPI Application ────────────────────────────────────────────────────────

app = FastAPI(
    title="AI Studio API",
    description=(
        "Backend API for the AI Studio — a professional web interface "
        "for local ComfyUI image generation. "
        "Supports single jobs, CSV batches, dynamic template generation, "
        "real-time progress via WebSocket, and gallery browsing."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ── Middleware ─────────────────────────────────────────────────────────────────

# CORS — restrict to Next.js frontend only
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gzip compression for JSON responses (gallery pages can be large)
app.add_middleware(GZipMiddleware, minimum_size=1000)


# ── Routers ────────────────────────────────────────────────────────────────────

app.include_router(generate.router)
app.include_router(dictionaries.router)
app.include_router(gallery.router)
app.include_router(models_list.router)
app.include_router(ws_routes.router)


# ── Core Endpoints ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health_check() -> dict:
    """
    Simple health check endpoint.
    The frontend can poll this to show a 'Backend Online' indicator.
    """
    return {
        "status": "ok",
        "service": "AI Studio API",
        "comfy_server": settings.comfy_server,
        "version": "1.0.0",
    }


@app.get("/", tags=["System"])
async def root() -> dict:
    return {
        "message": "AI Studio API is running",
        "docs": "/docs",
        "health": "/health",
    }
