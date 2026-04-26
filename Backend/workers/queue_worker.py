import asyncio
import logging
import random
import json
from datetime import datetime
from typing import Any, Optional
from adapters.comfy_client import comfy_adapter
from config import settings
from core.prompt_engine import build_negative_prompt
from core.workflow_builder import ComfyWorkflowBuilder
from core.database import SessionLocal, Task, Batch
from models.schemas import BatchStatus, TaskStatus

logger = logging.getLogger(__name__)


# ── Database-Backed Task Store ────────────────────────────────────────────────

class TaskStore:
    """
    Store for generation tasks, backed by SQLite, with in-memory WS subscriptions.
    """

    def __init__(self) -> None:
        # Per-task subscriber queues (one per connected WS client)
        self._subscribers: dict[str, list[asyncio.Queue]] = {}

    # ── Task CRUD ──────────────────────────────────────────────────────────────

    def create_task(self, task_id: str, initial_data: dict[str, Any]) -> None:
        with SessionLocal() as db:
            images_json = json.dumps(initial_data.get("images", []))
            new_task = Task(
                id=task_id,
                status=TaskStatus.QUEUED,
                type=initial_data.get("type"),
                batch_id=initial_data.get("batch_id"),
                positive_prompt=initial_data.get("positive_prompt"),
                negative_prompt=initial_data.get("negative_prompt"),
                seed=initial_data.get("seed"),
                width=initial_data.get("width") or settings.default_width,
                height=initial_data.get("height") or settings.default_height,
                steps=initial_data.get("steps") or settings.ksampler_steps,
                cfg=initial_data.get("cfg") or settings.ksampler_cfg,
                sampler_name=initial_data.get("sampler_name") or settings.ksampler_sampler_name,
                scheduler=initial_data.get("scheduler") or settings.ksampler_scheduler,
                denoise=initial_data.get("denoise") or settings.ksampler_denoise,
                workflow=initial_data.get("workflow") or "anima.json",
                user_id=initial_data.get("user_id"),
                images_json=images_json
            )
            db.add(new_task)
            db.commit()

    def update_task(self, task_id: str, **kwargs: Any) -> None:
        with SessionLocal() as db:
            task = db.query(Task).filter(Task.id == task_id).first()
            if task:
                if "images" in kwargs:
                    kwargs["images_json"] = json.dumps(kwargs.pop("images"))
                
                for key, value in kwargs.items():
                    setattr(task, key, value)
                db.commit()

    def get_task(self, task_id: str) -> Optional[dict[str, Any]]:
        with SessionLocal() as db:
            task = db.query(Task).filter(Task.id == task_id).first()
            if not task:
                return None
            return self._to_dict(task)

    def delete_task(self, task_id: str) -> bool:
        with SessionLocal() as db:
            task = db.query(Task).filter(Task.id == task_id).first()
            if task:
                db.delete(task)
                db.commit()
                self._subscribers.pop(task_id, None)
                return True
            return False

    def clear_all_tasks(self, user_id: Optional[int] = None) -> None:
        with SessionLocal() as db:
            query = db.query(Task)
            if user_id:
                query = query.filter(Task.user_id == user_id)
            query.delete()
            db.commit()
            # Note: subscribers are harder to clear selectively, but they are transient anyway
            if not user_id:
                self._subscribers.clear()
        logger.info(f"Task store cleared (user_id={user_id})")

    def get_all_tasks(self, user_id: Optional[int] = None) -> list[dict[str, Any]]:
        with SessionLocal() as db:
            query = db.query(Task)
            if user_id:
                query = query.filter(Task.user_id == user_id)
            tasks = query.all()
            return [self._to_dict(t) for t in tasks]

    def get_tasks_by_batch(self, batch_id: str) -> list[dict[str, Any]]:
        with SessionLocal() as db:
            tasks = db.query(Task).filter(Task.batch_id == batch_id).all()
            return [self._to_dict(t) for t in tasks]

    def get_queue_stats(self, user_id: Optional[int] = None) -> dict[str, int]:
        with SessionLocal() as db:
            query = db.query(Task)
            if user_id:
                query = query.filter(Task.user_id == user_id)
            tasks = query.all()
            statuses = [t.status for t in tasks]
            return {
                "queued": statuses.count(TaskStatus.QUEUED),
                "executing": statuses.count(TaskStatus.EXECUTING),
                "completed": statuses.count(TaskStatus.DONE),
                "failed": statuses.count(TaskStatus.ERROR),
                "total": len(statuses),
            }

    def _to_dict(self, task: Task) -> dict[str, Any]:
        return {
            "id": task.id,
            "status": task.status,
            "type": task.type,
            "batch_id": task.batch_id,
            "positive_prompt": task.positive_prompt,
            "negative_prompt": task.negative_prompt,
            "seed": task.seed,
            "width": task.width,
            "height": task.height,
            "steps": task.steps,
            "cfg": task.cfg,
            "sampler_name": task.sampler_name,
            "scheduler": task.scheduler,
            "denoise": task.denoise,
            "workflow": task.workflow,
            "comfy_prompt_id": task.comfy_prompt_id,
            "images": json.loads(task.images_json) if task.images_json else [],
            "error": task.error,
            "user_id": task.user_id,
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        }

    # ── Pub/Sub for WebSocket streaming ────────────────────────────────────────

    def subscribe(self, task_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.setdefault(task_id, []).append(q)
        return q

    def unsubscribe(self, task_id: str, queue: asyncio.Queue) -> None:
        subs = self._subscribers.get(task_id, [])
        try:
            subs.remove(queue)
        except ValueError:
            pass
        if not subs:
            self._subscribers.pop(task_id, None)

    async def publish(self, task_id: str, event: dict[str, Any]) -> None:
        for q in self._subscribers.get(task_id, []):
            await q.put(event)


# ── Database-Backed Batch Store ───────────────────────────────────────────────

class BatchStore:
    def create_batch(self, batch_id: str, data: dict[str, Any]) -> None:
        with SessionLocal() as db:
            new_batch = Batch(
                id=batch_id,
                name=data.get("name"),
                type=data.get("type"),
                status=BatchStatus.PENDING,
                total_tasks=data.get("total_tasks", 0),
                user_id=data.get("user_id")
            )
            db.add(new_batch)
            db.commit()

    def update_batch(self, batch_id: str, **kwargs: Any) -> None:
        with SessionLocal() as db:
            batch = db.query(Batch).filter(Batch.id == batch_id).first()
            if batch:
                for key, value in kwargs.items():
                    setattr(batch, key, value)
                db.commit()

    def get_batch(self, batch_id: str) -> Optional[dict[str, Any]]:
        with SessionLocal() as db:
            batch = db.query(Batch).filter(Batch.id == batch_id).first()
            if not batch:
                return None
            return {
                "id": batch.id,
                "name": batch.name,
                "type": batch.type,
                "status": batch.status,
                "total_tasks": batch.total_tasks,
                "completed": batch.completed,
                "failed": batch.failed,
                "user_id": batch.user_id,
            }

    def get_all_batches(self, user_id: Optional[int] = None) -> list[dict[str, Any]]:
        with SessionLocal() as db:
            query = db.query(Batch)
            if user_id:
                query = query.filter(Batch.user_id == user_id)
            batches = query.all()
            return [
                {
                    "id": b.id,
                    "name": b.name,
                    "type": b.type,
                    "status": b.status,
                    "total_tasks": b.total_tasks,
                    "completed": b.completed,
                    "failed": b.failed,
                    "user_id": b.user_id,
                }
                for b in batches
            ]


# ── Fair Round-Robin Queue ────────────────────────────────────────────────────

class FairQueue:
    """
    Asynchronous queue that alternates between users to ensure fairness.
    Prevents one user from blocking others with large batches.
    """
    def __init__(self):
        # user_id -> list of task_id
        self._queues: dict[int, list[str]] = {}
        self._users: list[int] = [] # Order of users for round-robin
        self._current_user_idx = 0
        self._condition = asyncio.Condition()

    async def put(self, user_id: int, task_id: str) -> None:
        async with self._condition:
            if user_id not in self._queues:
                self._queues[user_id] = []
                self._users.append(user_id)
            
            self._queues[user_id].append(task_id)
            self._condition.notify_all()

    async def get(self) -> str:
        async with self._condition:
            while not self._users:
                await self._condition.wait()
            
            # Find next user who actually has tasks
            while True:
                user_id = self._users[self._current_user_idx]
                user_queue = self._queues[user_id]
                
                if user_queue:
                    task_id = user_queue.pop(0)
                    # Move pointer to next user for next request
                    self._current_user_idx = (self._current_user_idx + 1) % len(self._users)
                    return task_id
                else:
                    # Cleanup empty user queue
                    self._users.pop(self._current_user_idx)
                    del self._queues[user_id]
                    
                    if not self._users:
                        self._current_user_idx = 0
                        # Wait if we just emptied the last user queue
                        while not self._users:
                            await self._condition.wait()
                    else:
                        self._current_user_idx %= len(self._users)

    def task_done(self):
        # Compatibility with standard asyncio.Queue if needed
        pass

# ── Module-level singletons ───────────────────────────────────────────────────

task_store = TaskStore()
batch_store = BatchStore()
generation_queue = FairQueue()


# ── Public Enqueue API ────────────────────────────────────────────────────────

async def enqueue_generation_task(task_id: str, task_data: dict[str, Any]) -> None:
    task_store.create_task(task_id, task_data)
    user_id = task_data.get("user_id", 0)
    await generation_queue.put(user_id, task_id)
    logger.info(f"Enqueued task: {task_id} (user_id={user_id})")


# ── Worker Internals ──────────────────────────────────────────────────────────

async def _run_single_task(task_id: str) -> None:
    task = task_store.get_task(task_id)
    if not task:
        logger.error(f"Task {task_id} not found in store — skipping")
        return

    # Transition to EXECUTING
    started_at = datetime.utcnow()
    task_store.update_task(task_id, status=TaskStatus.EXECUTING, started_at=started_at)
    await task_store.publish(task_id, {
        "type": "status_change",
        "status": TaskStatus.EXECUTING,
        "started_at": started_at.isoformat(),
    })

    try:
        # ── 1. Resolve seed ────────────────────────────────────────────────────
        seed = task.get("seed") or random.randint(0, 2**32 - 1)

        # ── 2. Build output prefix with user-specific folder ───────────────────
        user_id = task.get("user_id") or "anonymous"
        base_prefix = task.get("output_prefix") or settings.default_output_prefix
        # PREPEND user folder: users/{user_id}/{prefix}
        user_prefix = f"users/{user_id}/{base_prefix}"

        # ── 3. Build workflow (Builder Pattern) ────────────────────────────────
        workflow_name = task.get("workflow")
        workflow = (
            ComfyWorkflowBuilder(workflow_name)
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
            .set_output_prefix(user_prefix)
            .build()
        )

        # ── 4. Register progress callback
        async def on_progress(pid: str, event: dict) -> None:
            await task_store.publish(task_id, event)

        # ── 5. Submit workflow to ComfyUI
        prompt_id = await comfy_adapter.queue_prompt(workflow)
        task_store.update_task(task_id, comfy_prompt_id=prompt_id, seed=seed)
        comfy_adapter.register_progress_callback(prompt_id, on_progress)

        logger.info(f"Task {task_id} (user {user_id}) → ComfyUI prompt_id: {prompt_id}")

        # ── 6. Wait for completion
        success = await comfy_adapter.wait_for_completion(prompt_id, timeout=600.0)

        if success:
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

            completed_at = datetime.utcnow()
            task_store.update_task(
                task_id,
                status=TaskStatus.DONE,
                images=images,
                seed=seed,
                completed_at=completed_at,
            )
            await task_store.publish(task_id, {
                "type": "completed",
                "images": images,
                "seed": seed,
                "task_id": task_id,
                "completed_at": completed_at.isoformat(),
            })

            batch_id = task.get("batch_id")
            if batch_id:
                _update_batch_progress(batch_id)

            logger.info(f"✅ Task {task_id} done for user {user_id}")
        else:
            _fail_task(task_id, "Generation timed out after 10 minutes")

    except Exception as exc:
        logger.exception(f"Task {task_id} raised an exception: {exc}")
        _fail_task(task_id, str(exc))

    finally:
        pid = task_store.get_task(task_id) or {}
        if resolved_pid := pid.get("comfy_prompt_id"):
            comfy_adapter.unregister_progress_callback(resolved_pid)


def _fail_task(task_id: str, reason: str) -> None:
    completed_at = datetime.utcnow()
    task_store.update_task(task_id, status=TaskStatus.ERROR, error=reason, completed_at=completed_at)
    asyncio.create_task(
        task_store.publish(task_id, {
            "type": "error", 
            "message": reason, 
            "task_id": task_id,
            "completed_at": completed_at.isoformat()
        })
    )
    logger.error(f"Task {task_id} failed: {reason}")


def _update_batch_progress(batch_id: str) -> None:
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


async def generation_worker() -> None:
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
