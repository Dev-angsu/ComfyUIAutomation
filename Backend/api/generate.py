from __future__ import annotations
from typing import Any, Optional

"""
AI Studio — Generation API Routes
-----------------------------------
Endpoints:
  POST /api/generate           — Single manual job (Studio)
  POST /api/batch/csv          — Pre-parsed CSV job list
  POST /api/batch/csv/upload   — Raw CSV file upload
  POST /api/batch/dynamic      — Dynamic template batch
  GET  /api/tasks/{task_id}    — Task status
  GET  /api/tasks              — All tasks (with optional batch filter)
  GET  /api/queue              — Queue depth stats
  GET  /api/batches/{batch_id} — Batch status aggregate
"""

import json
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from adapters.job_parsers import JobLoader
from config import settings
from core.prompt_engine import build_negative_prompt, build_positive_prompt, build_dynamic_prompt
from models.schemas import (
    AppSettings,
    BatchEnqueuedResponse,
    BatchStatusResponse,
    BatchType,
    CSVBatchRequest,
    DynamicBatchRequest,
    GenerationParams,
    GenerationRequest,
    QueueStatusResponse,
    TaskEnqueuedResponse,
    TaskStatus,
    TaskStatusResponse,
)
from workers.queue_worker import (
    batch_store,
    enqueue_generation_task,
    generation_queue,
    task_store,
)

router = APIRouter(prefix="/api", tags=["Generation"])
logger = logging.getLogger(__name__)


# ── Helper ─────────────────────────────────────────────────────────────────────

def _build_task_data(
    job_type: str,
    positive_prompt: str,
    negative_prompt: str,
    params: GenerationParams,
    output_prefix: str,
    batch_id: Optional[str] = None,
) -> dict:
    """Construct a normalized task dict ready for the queue worker."""
    return {
        "type": job_type,
        "batch_id": batch_id,
        "positive_prompt": positive_prompt,
        "negative_prompt": negative_prompt,
        "width": params.width,
        "height": params.height,
        "seed": params.seed,
        "steps": params.steps,
        "cfg": params.cfg,
        "sampler_name": params.sampler_name,
        "scheduler": params.scheduler,
        "denoise": params.denoise,
        "unet": params.unet,
        "vae": params.vae,
        "clip": params.clip,
        "output_prefix": output_prefix,
    }


# ── Single Manual Generation ───────────────────────────────────────────────────

@router.post(
    "/generate",
    response_model=TaskEnqueuedResponse,
    summary="Queue a single manual generation job",
)
async def generate_single(req: GenerationRequest) -> TaskEnqueuedResponse:
    """
    Manual single-job request from the Studio viewport.
    Returns immediately with a task_id — connect to WS /ws/progress/{task_id} for live updates.
    """
    task_id = str(uuid.uuid4())
    neg = req.negative_prompt or build_negative_prompt()

    task_data = _build_task_data(
        job_type=BatchType.MANUAL,
        positive_prompt=req.positive_prompt,
        negative_prompt=neg,
        params=req.params,
        output_prefix=req.output_prefix or settings.default_output_prefix,
    )

    await enqueue_generation_task(task_id, task_data)
    logger.info(f"Manual task enqueued: {task_id}")
    return TaskEnqueuedResponse(task_id=task_id)


# ── CSV Batch (parsed payload) ─────────────────────────────────────────────────

@router.post(
    "/batch/csv",
    response_model=BatchEnqueuedResponse,
    summary="Queue a batch from pre-parsed job rows",
)
async def run_csv_batch(req: CSVBatchRequest) -> BatchEnqueuedResponse:
    """
    Accepts a JSON payload of job rows (e.g. from the Batch Manager table).
    Dispatches each enabled row as individual tasks under a shared batch_id.
    """
    batch_id = str(uuid.uuid4())
    task_ids: list[str] = []

    batch_store.create_batch(batch_id, {
        "name": req.name,
        "type": BatchType.CSV,
        "total_tasks": 0,
    })

    for job in req.jobs:
        if not job.enabled:
            continue

        pos = build_positive_prompt(
            subject=job.subject,
            character=job.character,
            series=job.series,
            artist=job.artist,
            general_tags=job.general_tags,
            natural_language=job.natural_language,
        )
        neg = build_negative_prompt()

        # Merge per-row params with global override
        effective_params = GenerationParams(
            width=job.params.width or req.global_params.width,
            height=job.params.height or req.global_params.height,
            seed=job.params.seed or req.global_params.seed,
            steps=job.params.steps or req.global_params.steps,
            cfg=job.params.cfg or req.global_params.cfg,
            sampler_name=job.params.sampler_name or req.global_params.sampler_name,
            scheduler=job.params.scheduler or req.global_params.scheduler,
            denoise=job.params.denoise or req.global_params.denoise,
            unet=job.params.unet or req.global_params.unet,
            vae=job.params.vae or req.global_params.vae,
            clip=job.params.clip or req.global_params.clip,
        )

        for _ in range(job.num_images):
            task_id = str(uuid.uuid4())
            task_data = _build_task_data(
                job_type=BatchType.CSV,
                positive_prompt=pos,
                negative_prompt=neg,
                params=effective_params,
                output_prefix=job.character or settings.default_output_prefix,
                batch_id=batch_id,
            )
            await enqueue_generation_task(task_id, task_data)
            task_ids.append(task_id)

    batch_store.update_batch(batch_id, total_tasks=len(task_ids))
    logger.info(f"CSV batch {batch_id} enqueued: {len(task_ids)} tasks")

    return BatchEnqueuedResponse(
        batch_id=batch_id,
        task_ids=task_ids,
        total=len(task_ids),
    )


# ── CSV Batch (file upload) ────────────────────────────────────────────────────

@router.post(
    "/batch/csv/upload",
    response_model=BatchEnqueuedResponse,
    summary="Upload a .csv file and queue all enabled rows",
)
async def upload_csv_batch(
    file: UploadFile = File(..., description=".csv or .json job file"),
    global_params_json: str = Form(default="{}", description="JSON-encoded GenerationParams overrides"),
) -> BatchEnqueuedResponse:
    """
    Drag-and-drop CSV upload from the Batch Manager UI.
    Platform-agnostic: file bytes are parsed in memory, nothing written to disk.
    """
    content = await file.read()
    filename = file.filename or "jobs.csv"

    try:
        raw_jobs = JobLoader.from_upload(content, filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        params_data = json.loads(global_params_json)
        global_params = GenerationParams(**params_data)
    except Exception:
        global_params = GenerationParams()

    batch_id = str(uuid.uuid4())
    task_ids: list[str] = []

    batch_store.create_batch(batch_id, {
        "name": f"Upload: {filename}",
        "type": BatchType.CSV,
        "total_tasks": 0,
    })

    valid_prompt_keys = {"subject", "character", "series", "artist", "general_tags", "natural_language"}

    for raw_job in raw_jobs:
        # Skip disabled rows (handles string 'false', '0', 'no', etc.)
        enabled_val = str(raw_job.get("enabled", "true")).strip().lower()
        if enabled_val in ("false", "0", "no", "f", "disabled"):
            continue

        num_images = max(1, int(raw_job.get("num_images", 1)))
        prompt_kwargs = {k: v for k, v in raw_job.items() if k in valid_prompt_keys}

        pos = build_positive_prompt(**prompt_kwargs)
        neg = build_negative_prompt()
        prefix = raw_job.get("character") or settings.default_output_prefix

        for _ in range(num_images):
            task_id = str(uuid.uuid4())
            task_data = _build_task_data(
                job_type=BatchType.CSV,
                positive_prompt=pos,
                negative_prompt=neg,
                params=global_params,
                output_prefix=prefix,
                batch_id=batch_id,
            )
            await enqueue_generation_task(task_id, task_data)
            task_ids.append(task_id)

    batch_store.update_batch(batch_id, total_tasks=len(task_ids))
    logger.info(f"Uploaded CSV batch {batch_id}: {len(task_ids)} tasks from '{filename}'")

    return BatchEnqueuedResponse(
        batch_id=batch_id,
        task_ids=task_ids,
        total=len(task_ids),
    )


# ── Dynamic Template Batch ─────────────────────────────────────────────────────

@router.post(
    "/batch/dynamic",
    response_model=BatchEnqueuedResponse,
    summary="Queue a dynamic template batch",
)
async def run_dynamic_batch(req: DynamicBatchRequest) -> BatchEnqueuedResponse:
    """
    Generates `count` images using random template substitutions from a dictionary file.
    Each image gets a freshly randomized prompt from the template pool.
    """
    dict_file = req.dict_file or "demodictionary.json"
    dict_path = Path(settings.jobs_dir) / dict_file

    if not dict_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Dictionary file not found: '{dict_file}' in {settings.jobs_dir}",
        )

    with open(dict_path, "r", encoding="utf-8") as f:
        dynamic_config = json.load(f)

    templates: list[str] = dynamic_config.get("DYNAMIC_TEMPLATES", [])
    dictionary: dict = dynamic_config.get("DYNAMIC_DICTIONARY", {})

    if not templates:
        raise HTTPException(
            status_code=400,
            detail=f"No DYNAMIC_TEMPLATES found in '{dict_file}'",
        )

    batch_id = str(uuid.uuid4())
    task_ids: list[str] = []

    batch_store.create_batch(batch_id, {
        "name": req.name,
        "type": BatchType.DYNAMIC,
        "total_tasks": req.count,
    })

    for _ in range(req.count):
        task_id = str(uuid.uuid4())
        pos, char_name = build_dynamic_prompt(
            templates, dictionary, template_index=req.template_index
        )
        neg = build_negative_prompt()
        task_data = _build_task_data(
            job_type=BatchType.DYNAMIC,
            positive_prompt=pos,
            negative_prompt=neg,
            params=req.params,
            output_prefix=char_name or settings.default_output_prefix,
            batch_id=batch_id,
        )
        await enqueue_generation_task(task_id, task_data)
        task_ids.append(task_id)

    logger.info(f"Dynamic batch {batch_id}: {req.count} tasks queued")

    return BatchEnqueuedResponse(
        batch_id=batch_id,
        task_ids=task_ids,
        total=len(task_ids),
    )


# ── Task Status ────────────────────────────────────────────────────────────────

@router.get(
    "/tasks/{task_id}",
    response_model=TaskStatusResponse,
    summary="Get status of a single task",
)
async def get_task_status(task_id: str) -> TaskStatusResponse:
    task = task_store.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found")

    return TaskStatusResponse(
        id=task["id"],
        status=task["status"],
        type=task.get("type"),
        batch_id=task.get("batch_id"),
        positive_prompt=task.get("positive_prompt"),
        negative_prompt=task.get("negative_prompt"),
        seed=task.get("seed"),
        width=task.get("width"),
        height=task.get("height"),
        comfy_prompt_id=task.get("comfy_prompt_id"),
        images=task.get("images"),
        error=task.get("error"),
        last_event=task.get("last_event"),
    )


@router.get(
    "/tasks",
    summary="List all tasks (optionally filter by batch_id)",
)
async def list_tasks(batch_id: Optional[str] = None) -> dict:
    if batch_id:
        tasks = task_store.get_tasks_by_batch(batch_id)
    else:
        tasks = task_store.get_all_tasks()

    return {"tasks": tasks, "total": len(tasks)}


# ── Queue Stats ────────────────────────────────────────────────────────────────

@router.get(
    "/queue",
    response_model=QueueStatusResponse,
    summary="Current queue depth and worker stats",
)
async def get_queue_status() -> QueueStatusResponse:
    stats = task_store.get_queue_stats()
    return QueueStatusResponse(**stats)


# ── Batch Status ───────────────────────────────────────────────────────────────

@router.get(
    "/batches/{batch_id}",
    response_model=BatchStatusResponse,
    summary="Aggregate status of a batch",
)
async def get_batch_status(batch_id: str) -> BatchStatusResponse:
    batch = batch_store.get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail=f"Batch '{batch_id}' not found")

    tasks = task_store.get_tasks_by_batch(batch_id)
    task_responses = [
        TaskStatusResponse(
            id=t["id"],
            status=t["status"],
            type=t.get("type"),
            batch_id=t.get("batch_id"),
            positive_prompt=t.get("positive_prompt"),
            seed=t.get("seed"),
            images=t.get("images"),
            error=t.get("error"),
        )
        for t in tasks
    ]

    done = sum(1 for t in tasks if t["status"] == TaskStatus.DONE)
    failed = sum(1 for t in tasks if t["status"] == TaskStatus.ERROR)

    return BatchStatusResponse(
        batch_id=batch_id,
        name=batch.get("name", ""),
        type=batch.get("type", BatchType.MANUAL),
        status=batch.get("status", "PENDING"),
        total_tasks=batch.get("total_tasks", len(tasks)),
        completed=done,
        failed=failed,
        tasks=task_responses,
    )


@router.get("/batches", summary="List all batches")
async def list_batches() -> dict:
    return {"batches": batch_store.get_all_batches()}


@router.get(
    "/config",
    response_model=AppSettings,
    summary="Get default application settings",
)
async def get_app_config() -> AppSettings:
    """
    Returns the current defaults from config.py (or .env).
    The frontend uses this to initialize its global state.
    """
    return AppSettings(
        default_width=settings.default_width,
        default_height=settings.default_height,
        ksampler_steps=settings.ksampler_steps,
        ksampler_cfg=settings.ksampler_cfg,
        ksampler_sampler_name=settings.ksampler_sampler_name,
        ksampler_scheduler=settings.ksampler_scheduler,
        ksampler_denoise=settings.ksampler_denoise,
        default_unet=settings.default_unet,
        default_vae=settings.default_vae,
        default_clip=settings.default_clip,
    )
