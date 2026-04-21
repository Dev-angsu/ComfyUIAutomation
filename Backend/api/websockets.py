from __future__ import annotations

"""
AI Studio — WebSocket API Routes
----------------------------------
Endpoints:
  WS /ws/progress/{task_id}   — Real-time generation progress for a task
  WS /ws/batch/{batch_id}     — Batch-level progress updates

Observer Pattern implementation:
  - Publisher:  workers/queue_worker.py → task_store.publish(task_id, event)
  - Subscriber: This WS handler → task_store.subscribe(task_id) → sends to client

Event shapes sent to Next.js:
  { "type": "status_change", "status": "EXECUTING" }
  { "type": "executing",     "node": "11" }
  { "type": "progress",      "value": 5, "max": 30, "pct": 16 }
  { "type": "completed",     "images": [...], "seed": 12345 }
  { "type": "error",         "message": "..." }
  { "type": "ping" }          (keepalive, every 15s of no activity)
"""

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from models.schemas import TaskStatus
from workers.queue_worker import batch_store, task_store

router = APIRouter(tags=["WebSockets"])
logger = logging.getLogger(__name__)

# How long to wait for an event before sending a keepalive ping
_PING_INTERVAL_SECONDS = 15.0


# ── Task-level Progress Stream ─────────────────────────────────────────────────

@router.websocket("/ws/progress/{task_id}")
async def websocket_task_progress(websocket: WebSocket, task_id: str) -> None:
    """
    Real-time progress stream for a single generation task.

    Connect immediately after enqueuing a task. Receive events as the
    worker processes it through ComfyUI. Automatically closes when the
    terminal event (completed / error) is received.

    Multiple clients can connect to the same task_id simultaneously
    (e.g. two browser tabs watching the same generation).
    """
    await websocket.accept()
    logger.info(f"WS connected for task: {task_id}")

    task = task_store.get_task(task_id)
    if not task:
        await websocket.send_json({"type": "error", "message": f"Task '{task_id}' not found"})
        await websocket.close(code=4004)
        return

    # Fast-path: task already completed before client connected
    current_status = task.get("status")

    if current_status == TaskStatus.DONE:
        await websocket.send_json({
            "type": "completed",
            "images": task.get("images", []),
            "seed": task.get("seed"),
            "task_id": task_id,
        })
        await websocket.close()
        return

    if current_status == TaskStatus.ERROR:
        await websocket.send_json({
            "type": "error",
            "message": task.get("error", "Task failed"),
            "task_id": task_id,
        })
        await websocket.close()
        return

    # Subscribe to the task's progress event queue
    queue = task_store.subscribe(task_id)

    try:
        while True:
            try:
                event: dict = await asyncio.wait_for(
                    queue.get(), timeout=_PING_INTERVAL_SECONDS
                )
                await websocket.send_json(event)

                # Terminal events: close cleanly
                if event.get("type") in ("completed", "error"):
                    logger.info(f"Task {task_id} terminal event — closing WS")
                    break

            except asyncio.TimeoutError:
                # No activity — send keepalive so browser doesn't drop the connection
                await websocket.send_json({"type": "ping"})

    except WebSocketDisconnect:
        logger.info(f"WS client disconnected from task: {task_id}")
    except Exception as exc:
        logger.error(f"WS error on task {task_id}: {exc}")
    finally:
        task_store.unsubscribe(task_id, queue)
        logger.debug(f"WS cleanup done for task: {task_id}")


# ── Batch-level Progress Stream ────────────────────────────────────────────────

@router.websocket("/ws/batch/{batch_id}")
async def websocket_batch_progress(websocket: WebSocket, batch_id: str) -> None:
    """
    Polls batch progress and pushes updates to the connected client.

    Phase 1: Uses polling against the in-memory task store (every 2 seconds).
    Phase 2: Redis Pub/Sub channel ws:batch:{batch_id} will replace polling.

    Emits:
      { "type": "batch_progress", "completed": 5, "total": 50, "failed": 0, "pct": 10 }
      { "type": "batch_complete", "completed": 50, "failed": 0 }
    """
    await websocket.accept()
    logger.info(f"WS connected for batch: {batch_id}")

    batch = batch_store.get_batch(batch_id)
    if not batch:
        await websocket.send_json({
            "type": "error",
            "message": f"Batch '{batch_id}' not found",
        })
        await websocket.close(code=4004)
        return

    try:
        while True:
            tasks = task_store.get_tasks_by_batch(batch_id)
            total = len(tasks)
            done = sum(1 for t in tasks if t["status"] == TaskStatus.DONE)
            failed = sum(1 for t in tasks if t["status"] == TaskStatus.ERROR)
            pct = int((done / max(total, 1)) * 100)

            await websocket.send_json({
                "type": "batch_progress",
                "batch_id": batch_id,
                "completed": done,
                "failed": failed,
                "total": total,
                "pct": pct,
            })

            # Terminal: all tasks resolved
            if done + failed >= total and total > 0:
                await websocket.send_json({
                    "type": "batch_complete",
                    "batch_id": batch_id,
                    "completed": done,
                    "failed": failed,
                    "total": total,
                })
                break

            # Poll every 2 seconds
            await asyncio.sleep(2.0)

    except WebSocketDisconnect:
        logger.info(f"WS client disconnected from batch: {batch_id}")
    except Exception as exc:
        logger.error(f"WS batch error on {batch_id}: {exc}")
