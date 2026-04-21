"""
AI Studio — Pydantic Schemas (Data Transfer Objects)
------------------------------------------------------
All request/response models for the FastAPI API.
Follows Interface Segregation Principle: components receive only what they need.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ── Enumerations ────────────────────────────────────────────────────────────────

class TaskStatus(str, Enum):
    QUEUED = "QUEUED"
    EXECUTING = "EXECUTING"
    DONE = "DONE"
    ERROR = "ERROR"


class BatchType(str, Enum):
    MANUAL = "MANUAL"
    CSV = "CSV"
    DYNAMIC = "DYNAMIC"


class BatchStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


# ── Shared Sub-models ───────────────────────────────────────────────────────────

class GenerationParams(BaseModel):
    """
    Shared generation parameters for all job types.
    All fields are optional — callers can override only what they need.
    """
    width: int = Field(default=1024, ge=64, le=2048, description="Image width in pixels")
    height: int = Field(default=1024, ge=64, le=2048, description="Image height in pixels")
    batch_count: int = Field(default=1, ge=1, le=8, description="Number of images per job")
    seed: Optional[int] = Field(default=None, description="Specific seed (-1 = random)")
    steps: Optional[int] = Field(default=None, ge=1, le=150)
    cfg: Optional[float] = Field(default=None, ge=0.0, le=30.0)
    sampler_name: Optional[str] = None
    scheduler: Optional[str] = None
    denoise: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    unet: Optional[str] = Field(default=None, description="UNET model filename")
    vae: Optional[str] = Field(default=None, description="VAE model filename")
    clip: Optional[str] = Field(default=None, description="CLIP model filename")


# ── Request DTOs ────────────────────────────────────────────────────────────────

class GenerationRequest(BaseModel):
    """Manual single-job request from the Studio viewport."""
    positive_prompt: str = Field(..., min_length=1, description="The positive prompt string")
    negative_prompt: Optional[str] = Field(default=None, description="Override negative prompt (uses default if omitted)")
    params: GenerationParams = Field(default_factory=GenerationParams)
    output_prefix: Optional[str] = Field(default="ComfyUI_Auto", description="Filename prefix for saved images")


class JobRow(BaseModel):
    """Single row in a CSV/JSON job batch."""
    enabled: bool = True
    subject: str = "1girl"
    character: str = ""
    series: str = ""
    artist: str = ""
    general_tags: str = ""
    natural_language: str = ""
    num_images: int = Field(default=1, ge=1, le=50)
    params: GenerationParams = Field(default_factory=GenerationParams)


class CSVBatchRequest(BaseModel):
    """Batch submission from the Batch Manager (pre-parsed rows)."""
    name: str = Field(default="CSV Batch")
    jobs: list[JobRow]
    global_params: GenerationParams = Field(default_factory=GenerationParams)


class DynamicBatchRequest(BaseModel):
    """Dynamic template batch from the Dynamic Batch view."""
    name: str = Field(default="Dynamic Batch")
    count: int = Field(default=1, ge=1, le=500, description="Number of images to generate")
    dict_file: Optional[str] = Field(default=None, description="Dictionary JSON filename in Jobs dir (default: demodictionary.json)")
    template_index: Optional[int] = Field(default=None, description="Specific template index (None = random each time)")
    params: GenerationParams = Field(default_factory=GenerationParams)


# ── Response DTOs ───────────────────────────────────────────────────────────────

class TaskEnqueuedResponse(BaseModel):
    """Returned immediately when a single task is enqueued."""
    task_id: str
    status: TaskStatus = TaskStatus.QUEUED
    message: str = "Task enqueued successfully"


class BatchEnqueuedResponse(BaseModel):
    """Returned when a batch of tasks is enqueued."""
    batch_id: str
    task_ids: list[str]
    total: int
    status: BatchStatus = BatchStatus.PENDING


class TaskStatusResponse(BaseModel):
    """Current state of a single generation task."""
    id: str
    status: TaskStatus
    type: Optional[str] = None
    batch_id: Optional[str] = None
    positive_prompt: Optional[str] = None
    negative_prompt: Optional[str] = None
    seed: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    comfy_prompt_id: Optional[str] = None
    images: Optional[list[dict[str, Any]]] = None
    error: Optional[str] = None
    last_event: Optional[dict[str, Any]] = None


class ImageInfo(BaseModel):
    """A single image reference from ComfyUI outputs. Platform-agnostic."""
    filename: str
    subfolder: str = ""
    type: str = "output"
    url: str = Field(description="Proxy URL via /api/images/{filename}")


class GalleryPage(BaseModel):
    """Paginated image gallery response."""
    images: list[ImageInfo]
    total: int
    page: int
    page_size: int
    has_more: bool


class DictionariesResponse(BaseModel):
    """Full dictionary data for populating UI dropdowns."""
    categories: dict[str, list[str]]  # e.g. {"ARTIST": ["wlop", ...], "CHARACTER": [...]}
    templates: list[str]


class ModelList(BaseModel):
    """Available model files and sampler options from ComfyUI."""
    unet: list[str]
    vae: list[str]
    clip: list[str]
    sampler_names: list[str]
    schedulers: list[str]


class GenerationResult(BaseModel):
    """
    Standardized output from any generation pipeline.
    Liskov Substitution: all pipeline variants return this same shape.
    """
    task_id: str
    prompt_id: str
    seed: int
    images: list[ImageInfo]
    positive_prompt: str
    negative_prompt: str


class BatchStatusResponse(BaseModel):
    """Aggregated status for a batch of tasks."""
    batch_id: str
    name: str
    type: BatchType
    status: BatchStatus
    total_tasks: int
    completed: int
    failed: int
    tasks: list[TaskStatusResponse]


class QueueStatusResponse(BaseModel):
    """Current queue depth and worker status."""
    queued: int
    executing: int
    completed: int
    total: int
