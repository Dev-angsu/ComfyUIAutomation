from __future__ import annotations

"""
AI Studio — In-Memory Task Store & Generation Queue Worker
-----------------------------------------------------------
Phase 1 implementation: no Redis/DB — pure asyncio in-memory state.
Phase 2 will swap this module for Redis-backed queuing (same interface).

Components:
  - InMemoryTaskStore   — stores task state + pub/sub subscriptions
  - InMemoryBatchStore  — tracks batch-level aggregation
  - generation_queue    — asyncio.Queue feeding the worker
  - enqueue_generation_task() — public API for routes to submit jobs
  - generation_worker() — single-consumer coroutine (one task at a time)
"""

import asyncio
import logging
import random
from typing import Any, Optional

from adapters.comfy_client import comfy_adapter
from config import settings
from core.prompt_engine import build_negative_prompt
from core.workflow_builder import ComfyWorkflowBuilder
from models.schemas import BatchStatus, TaskStatus

logger = logging.getLogger(__name__)


# ── In-Memory Task Store ──────────────────────────────────────────────────────

class InMemoryTaskStore:
    """
    Thread-safe (asyncio-safe) store for generation tasks and their WS subscribers.

    Design note: In Phase 2 this is replaced by Redis + PostgreSQL.
    The public interface stays identical so callers don't need to change.
    """

    def __init__(self) -> None:
        self._tasks: dict[str, dict[str, Any]] = {}
        # Per-task subscriber queues (one per connected WS client)
        self._subscribers: dict[str, list[asyncio.Queue]] = {}

    # ── Task CRUD ──────────────────────────────────────────────────────────────

    def create_task(self, task_id: str, initial_data: dict[str, Any]) -> None:
        self._tasks[task_id] = {
            **initial_data,
            "id": task_id,
            "status": TaskStatus.QUEUED,
        }

    def update_task(self, task_id: str, **kwargs: Any) -> None:
        if task_id in self._tasks:
            self._tasks[task_id].update(kwargs)

    def get_task(self, task_id: str) -> Optional[dict[str, Any]]:
        return self._tasks.get(task_id)

    def get_all_tasks(self) -> list[dict[str, Any]]:
        return list(self._tasks.values())

    def get_tasks_by_batch(self, batch_id: str) -> list[dict[str, Any]]:
        return [t for t in self._tasks.values() if t.get("batch_id") == batch_id]

    def get_queue_stats(self) -> dict[str, int]:
        statuses = [t["status"] for t in self._tasks.values()]
        return {
            "queued": statuses.count(TaskStatus.QUEUED),
            "executing": statuses.count(TaskStatus.EXECUTING),
            "completed": statuses.count(TaskStatus.DONE),
            "failed": statuses.count(TaskStatus.ERROR),
            "total": len(statuses),
        }

    # ── Pub/Sub for WebSocket streaming ────────────────────────────────────────

    def subscribe(self, task_id: str) -> asyncio.Queue:
        """Create a subscriber queue for a task's progress events."""
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.setdefault(task_id, []).append(q)
        return q

    def unsubscribe(self, task_id: str, queue: asyncio.Queue) -> None:
        """Remove a specific subscriber queue (called on WS disconnect)."""
        subs = self._subscribers.get(task_id, [])
        try:
            subs.remove(queue)
        except ValueError:
            pass
        if not subs:
            self._subscribers.pop(task_id, None)

    async def publish(self, task_id: str, event: dict[str, Any]) -> None:
        """Broadcast an event to all subscribers of this task_id."""
        for q in self._subscribers.get(task_id, []):
            await q.put(event)


# ── In-Memory Batch Store ─────────────────────────────────────────────────────

class InMemoryBatchStore:
    """Tracks batch-level metadata (aggregates multiple tasks)."""

    def __init__(self) -> None:
        self._batches: dict[str, dict[str, Any]] = {}

    def create_batch(self, batch_id: str, data: dict[str, Any]) -> None:
        self._batches[batch_id] = {**data, "id": batch_id, "status": BatchStatus.PENDING}

    def update_batch(self, batch_id: str, **kwargs: Any) -> None:
        if batch_id in self._batches:
            self._batches[batch_id].update(kwargs)

    def get_batch(self, batch_id: str) -> Optional[dict[str, Any]]:
        return self._batches.get(batch_id)

    def get_all_batches(self) -> list[dict[str, Any]]:
        return list(self._batches.values())


# ── Module-level singletons ───────────────────────────────────────────────────

task_store = InMemoryTaskStore()
batch_store = InMemoryBatchStore()
generation_queue: asyncio.Queue = asyncio.Queue()


# ── Public Enqueue API ────────────────────────────────────────────────────────

async def enqueue_generation_task(task_id: str, task_data: dict[str, Any]) -> None:
    """
    Create a task record and add it to the processing queue.
    Called by API routes after validating the request.
    """
    task_store.create_task(task_id, task_data)
    await generation_queue.put(task_id)
    logger.info(f"Enqueued task: {task_id} (type={task_data.get('type', 'MANUAL')})")


# ── Worker Internals ──────────────────────────────────────────────────────────

async def _run_single_task(task_id: str) -> None:
    """
    Process one generation task end-to-end:
      1. Build ComfyUI workflow via Builder Pattern
      2. Submit to ComfyUI via Adapter
      3. Wait for WS completion event (Observer Pattern)
      4. Retrieve image filenames from history
      5. Update task state and notify WS subscribers
    """
    task = task_store.get_task(task_id)
    if not task:
        logger.error(f"Task {task_id} not found in store — skipping")
        return

    # Transition to EXECUTING
    task_store.update_task(task_id, status=TaskStatus.EXECUTING)
    await task_store.publish(task_id, {
        "type": "status_change",
        "status": TaskStatus.EXECUTING,
    })

    try:
        # ── 1. Resolve seed ────────────────────────────────────────────────────
        seed = task.get("seed") or random.randint(0, 2**32 - 1)

        # ── 2. Build workflow (Builder Pattern) ────────────────────────────────
        workflow = (
            ComfyWorkflowBuilder()
            .set_positive_prompt(task["positive_prompt"])
            .set_negative_prompt(task.get("negative_prompt") or build_negative_prompt())
            .set_dimensions(
                task.get("width", settings.default_width),
                task.get("height", settings.default_height),
            )
            .set_seed(seed)
            .set_sampler(
                steps=task.get("steps") or settings.ksampler_steps,
                cfg=task.get("cfg") or settings.ksampler_cfg,
                sampler_name=task.get("sampler_name") or settings.ksampler_sampler_name,
                scheduler=task.get("scheduler") or settings.ksampler_scheduler,
                denoise=task.get("denoise") or settings.ksampler_denoise,
            )
            .set_models(
                unet=task.get("unet") or settings.default_unet,
                vae=task.get("vae") or settings.default_vae,
                clip=task.get("clip") or settings.default_clip,
            )
            .set_output_prefix(task.get("output_prefix") or settings.default_output_prefix)
            .build()
        )

        # ── 3. Register progress callback BEFORE queuing to avoid missing events
        prompt_id_holder: list[str] = []  # mutable container for closure

        async def on_progress(pid: str, event: dict) -> None:
            """Closure routes ComfyUI events to our task_id subscriber."""
            task_store.update_task(task_id, last_event=event)
            await task_store.publish(task_id, event)

        # ── 4. Submit workflow to ComfyUI (Adapter Pattern) ───────────────────
        prompt_id = await comfy_adapter.queue_prompt(workflow)
        prompt_id_holder.append(prompt_id)

        task_store.update_task(task_id, comfy_prompt_id=prompt_id, seed=seed)

        # Register callback keyed by prompt_id (ComfyUI's identifier)
        comfy_adapter.register_progress_callback(prompt_id, on_progress)

        logger.info(f"Task {task_id} → ComfyUI prompt_id: {prompt_id}")

        # ── 5. Wait for completion (up to 10 minutes) ─────────────────────────
        success = await comfy_adapter.wait_for_completion(prompt_id, timeout=600.0)

        if success:
            # ── 6. Fetch generated image filenames from ComfyUI history ───────
            history = await comfy_adapter.get_history(prompt_id)
            images: list[dict] = []

            if prompt_id in history:
                outputs = history[prompt_id].get("outputs", {})
                save_node_output = outputs.get(settings.comfy_output_node_id, {})
                raw_images = save_node_output.get("images", [])

                for img in raw_images:
                    fname = img["filename"]
                    subfolder = img.get("subfolder", "")
                    img_type = img.get("type", "output")
                    images.append({
                        "filename": fname,
                        "subfolder": subfolder,
                        "type": img_type,
                        "url": f"/api/images/{fname}?subfolder={subfolder}&type={img_type}",
                    })

            task_store.update_task(
                task_id,
                status=TaskStatus.DONE,
                images=images,
                seed=seed,
            )
            await task_store.publish(task_id, {
                "type": "completed",
                "images": images,
                "seed": seed,
                "task_id": task_id,
            })

            # Update parent batch progress
            batch_id = task.get("batch_id")
            if batch_id:
                _update_batch_progress(batch_id)

            logger.info(
                f"✅ Task {task_id} done. "
                f"Images: {[img['filename'] for img in images]}"
            )
        else:
            _fail_task(task_id, "Generation timed out after 10 minutes")

    except Exception as exc:
        logger.exception(f"Task {task_id} raised an exception: {exc}")
        _fail_task(task_id, str(exc))

    finally:
        # Always clean up the callback registration
        pid = task_store.get_task(task_id) or {}
        if resolved_pid := pid.get("comfy_prompt_id"):
            comfy_adapter.unregister_progress_callback(resolved_pid)


def _fail_task(task_id: str, reason: str) -> None:
    """Mark a task as ERROR and fire an error event synchronously."""
    task_store.update_task(task_id, status=TaskStatus.ERROR, error=reason)
    # Schedule the async publish without awaiting (we may be in an except block)
    asyncio.create_task(
        task_store.publish(task_id, {"type": "error", "message": reason, "task_id": task_id})
    )
    logger.error(f"Task {task_id} failed: {reason}")


def _update_batch_progress(batch_id: str) -> None:
    """Recalculate and persist batch status based on its tasks."""
    tasks = task_store.get_tasks_by_batch(batch_id)
    if not tasks:
        return

    total = len(tasks)
    done = sum(1 for t in tasks if t["status"] == TaskStatus.DONE)
    failed = sum(1 for t in tasks if t["status"] == TaskStatus.ERROR)

    if done + failed == total:
        status = BatchStatus.COMPLETED if failed == 0 else BatchStatus.FAILED
    else:
        status = BatchStatus.PROCESSING

    batch_store.update_batch(batch_id, status=status, completed=done, failed=failed)


# ── Main Worker Coroutine ─────────────────────────────────────────────────────

async def generation_worker() -> None:
    """
    Single-consumer background coroutine.
    Processes tasks from the generation_queue one at a time.

    Single-consumer design ensures the local GPU isn't overwhelmed.
    In Phase 2 this becomes a Redis BLPOP-based worker.
    """
    logger.info("🚀 Generation worker started — waiting for tasks...")

    while True:
        task_id: str = await generation_queue.get()
        try:
            logger.info(f"▶️  Worker picked up task: {task_id}")
            await _run_single_task(task_id)
        except Exception as exc:
            logger.exception(f"Worker top-level error on task {task_id}: {exc}")
        finally:
            generation_queue.task_done()
