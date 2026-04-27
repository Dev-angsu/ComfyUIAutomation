from __future__ import annotations

"""
AI Studio — ComfyUI Async Adapter (Facade Pattern)
----------------------------------------------------
Wraps all ComfyUI network interactions behind a clean async interface.

Design Patterns applied:
  - Adapter/Facade: Hides the complexity of ComfyUI's REST + WebSocket protocol
  - Observer: WebSocket listener broadcasts events to registered callbacks
  - Dependency Inversion: FastAPI routes depend on this abstraction,
    not on raw httpx/websockets calls

Platform-agnostic: images are fetched via ComfyUI's /view HTTP endpoint,
so it doesn't matter if ComfyUI runs on Windows, Linux, or a remote machine.

Future extensibility: Create a RunPodAdapter with the same method signatures
to switch AI backends without changing any route code.
"""

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any, Optional

import httpx
import websockets
from websockets.exceptions import ConnectionClosed

from config import settings

logger = logging.getLogger(__name__)

# Type alias for the progress callback signature
ProgressCallback = Callable[[str, dict[str, Any]], Awaitable[None]]


class ComfyUIAdapter:
    """
    Async Adapter/Facade over the ComfyUI REST API and WebSocket.

    Responsibilities:
      1. queue_prompt()       — submit a workflow via POST /prompt
      2. get_history()        — poll /history/{prompt_id} for results
      3. get_full_history()   — fetch all /history for gallery
      4. get_models()         — list available model files
      5. get_samplers()       — list sampler names and schedulers
      6. get_image_bytes()    — proxy /view endpoint (platform-agnostic)
      7. WS listener loop     — forward ComfyUI events to registered callbacks
    """

    def __init__(self) -> None:
        self._ws_task: Optional[asyncio.Task] = None
        # progress_callbacks: prompt_id → async callback function
        self._progress_callbacks: dict[str, ProgressCallback] = {}
        # completion_futures: prompt_id → asyncio.Future (resolved when done or failed)
        self._completion_futures: dict[str, asyncio.Future[bool]] = {}

    # ── REST Methods ──────────────────────────────────────────────────────────

    async def queue_prompt(self, workflow: dict) -> str:
        """
        Submit a ComfyUI workflow and return the assigned prompt_id.
        Raises httpx.HTTPStatusError on ComfyUI rejection.
        """
        payload = {"prompt": workflow, "client_id": settings.client_id}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.comfy_http_base}/prompt",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        prompt_id: str = data["prompt_id"]
        logger.info(f"ComfyUI accepted prompt → prompt_id: {prompt_id}")
        return prompt_id

    async def get_history(self, prompt_id: str) -> dict:
        """Fetch output metadata for a specific completed prompt."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{settings.comfy_http_base}/history/{prompt_id}"
            )
            resp.raise_for_status()
            return resp.json()

    async def get_full_history(self) -> dict:
        """
        Fetch ALL history from ComfyUI.
        Used by the Gallery endpoint (Phase 1 — no DB).
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{settings.comfy_http_base}/history")
            resp.raise_for_status()
            return resp.json()

    async def get_models(self) -> dict[str, list[str]]:
        """
        Fetch available model lists by interrogating ComfyUI's /object_info endpoint.
        Returns {'unet': [...], 'vae': [...], 'clip': [...]}.
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{settings.comfy_http_base}/object_info")
            resp.raise_for_status()
            info = resp.json()

        models: dict[str, list[str]] = {"unet": [], "vae": [], "clip": []}

        try:
            if "UNETLoader" in info:
                models["unet"] = (
                    info["UNETLoader"]["input"]["required"]["unet_name"][0]
                )
        except (KeyError, IndexError, TypeError):
            pass

        try:
            if "VAELoader" in info:
                models["vae"] = (
                    info["VAELoader"]["input"]["required"]["vae_name"][0]
                )
        except (KeyError, IndexError, TypeError):
            pass

        try:
            if "CLIPLoader" in info:
                models["clip"] = (
                    info["CLIPLoader"]["input"]["required"]["clip_name"][0]
                )
        except (KeyError, IndexError, TypeError):
            pass

        return models

    async def get_samplers(self) -> dict[str, list[str]]:
        """Fetch available sampler names and scheduler types from ComfyUI."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{settings.comfy_http_base}/object_info")
            resp.raise_for_status()
            info = resp.json()

        result: dict[str, list[str]] = {"sampler_names": [], "schedulers": []}

        try:
            if "KSampler" in info:
                ks_inputs = info["KSampler"]["input"]["required"]
                result["sampler_names"] = ks_inputs.get("sampler_name", [[]])[0]
                result["schedulers"] = ks_inputs.get("scheduler", [[]])[0]
        except (KeyError, IndexError, TypeError):
            pass

        return result

    async def get_image_bytes(
        self,
        filename: str,
        subfolder: str = "",
        img_type: str = "output",
    ) -> bytes:
        """
        Platform-agnostic image proxy.
        Fetches binary image data from ComfyUI's /view endpoint.
        Works regardless of whether ComfyUI runs on Windows, Linux, or remotely.
        """
        params = {"filename": filename, "subfolder": subfolder, "type": img_type}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(
                f"{settings.comfy_http_base}/view",
                params=params,
            )
            resp.raise_for_status()
            return resp.content

    async def get_queue_status(self) -> dict:
        """Fetch the current ComfyUI queue (running + pending)."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{settings.comfy_http_base}/queue")
            resp.raise_for_status()
            return resp.json()

    async def is_reachable(self) -> bool:
        """
        Check if the ComfyUI server is reachable via REST API.
        Used by the worker to decide if it should pause.
        """
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                # system_stats is a fast, no-side-effect endpoint
                resp = await client.get(f"{settings.comfy_http_base}/system_stats")
                return resp.status_code == 200
        except Exception:
            return False

    # ── WebSocket Observer ────────────────────────────────────────────────────

    def register_progress_callback(
        self,
        prompt_id: str,
        callback: ProgressCallback,
    ) -> None:
        """
        Register an async callback for a specific prompt_id.
        The callback receives (prompt_id, event_dict) on each WS event.
        Observer Pattern: attach subscribers to the event stream.
        """
        self._progress_callbacks[prompt_id] = callback
        self._completion_futures[prompt_id] = asyncio.Future()
        logger.debug(f"Registered progress callback for prompt_id: {prompt_id}")

    def unregister_progress_callback(self, prompt_id: str) -> None:
        """Detach subscriber. Call after task completes to free memory."""
        self._progress_callbacks.pop(prompt_id, None)
        self._completion_futures.pop(prompt_id, None)
        logger.debug(f"Unregistered callback for prompt_id: {prompt_id}")

    async def wait_for_completion(
        self,
        prompt_id: str,
        timeout: float = 600.0,
    ) -> bool:
        """
        Async wait until the generation for prompt_id is marked complete.
        Returns True on success, False on timeout.
        Raises ConnectionClosed if the WebSocket connection is lost.
        """
        fut = self._completion_futures.get(prompt_id)
        if not fut:
            return False
        try:
            return await asyncio.wait_for(fut, timeout=timeout)
        except asyncio.TimeoutError:
            logger.warning(f"Timeout waiting for prompt_id: {prompt_id}")
            return False
        except (ConnectionClosed, asyncio.CancelledError):
            # Pass through connection/cancellation issues to the worker
            raise

    async def start_ws_listener(self) -> None:
        """Start the persistent ComfyUI WebSocket listener as a background task."""
        self._ws_task = asyncio.create_task(
            self._ws_listener_loop(),
            name="comfy_ws_listener",
        )
        logger.info("ComfyUI WebSocket listener task created")

    async def stop_ws_listener(self) -> None:
        """Gracefully cancel the WebSocket listener on app shutdown."""
        if self._ws_task and not self._ws_task.done():
            self._ws_task.cancel()
            try:
                await self._ws_task
            except asyncio.CancelledError:
                pass
        logger.info("ComfyUI WebSocket listener stopped")

    async def _ws_listener_loop(self) -> None:
        """
        Persistent WebSocket connection with automatic reconnect.
        Forwards all incoming messages to registered callbacks.
        """
        while True:
            try:
                logger.info(f"Connecting to ComfyUI WS: {settings.comfy_ws_url}")
                async with websockets.connect(
                    settings.comfy_ws_url,
                    max_size=None,       # Don't limit message size (binary preview frames)
                    ping_interval=20,    # Keep-alive pings
                    ping_timeout=20,
                ) as ws:
                    logger.info("✅ ComfyUI WebSocket connected")
                    async for raw_msg in ws:
                        if isinstance(raw_msg, bytes):
                            # Binary preview frames — skip
                            continue
                        try:
                            msg = json.loads(raw_msg)
                            await self._handle_ws_message(msg)
                        except json.JSONDecodeError:
                            pass

            except asyncio.CancelledError:
                logger.info("WS listener cancelled — shutting down")
                return
            except ConnectionClosed as e:
                logger.warning(f"ComfyUI WS closed ({e}). Reconnecting in 5s...")
                # Signal failure to all waiting tasks so they can re-enqueue
                for fut in list(self._completion_futures.values()):
                    if not fut.done():
                        fut.set_exception(e)
            except Exception as e:
                logger.warning(f"ComfyUI WS error ({type(e).__name__}: {e}). Reconnecting in 5s...")
                for fut in list(self._completion_futures.values()):
                    if not fut.done():
                        fut.set_exception(e)

            await asyncio.sleep(5)

    async def _handle_ws_message(self, msg: dict) -> None:
        """
        Route a parsed WebSocket message to the correct callback.
        Observer notification: Publisher (this method) → Subscribers (callbacks).
        """
        msg_type: str = msg.get("type", "")
        data: dict = msg.get("data", {})
        prompt_id: Optional[str] = data.get("prompt_id")

        if not prompt_id:
            return  # System message with no prompt context

        callback = self._progress_callbacks.get(prompt_id)
        if not callback:
            return  # No subscriber for this prompt_id

        if msg_type == "executing":
            node = data.get("node")
            if node is None:
                # node=None means the entire workflow finished
                logger.info(f"ComfyUI completed prompt_id: {prompt_id}")
                fut = self._completion_futures.get(prompt_id)
                if fut and not fut.done():
                    fut.set_result(True)
                await callback(prompt_id, {"type": "completed"})
            else:
                await callback(prompt_id, {"type": "executing", "node": node})

        elif msg_type == "progress":
            value = data.get("value", 0)
            maximum = data.get("max", 1)
            pct = int((value / max(maximum, 1)) * 100)
            await callback(prompt_id, {
                "type": "progress",
                "value": value,
                "max": maximum,
                "pct": pct,
            })

        elif msg_type == "execution_error":
            error_msg = data.get("exception_message", "Unknown ComfyUI error")
            logger.error(f"ComfyUI execution error for {prompt_id}: {error_msg}")
            fut = self._completion_futures.get(prompt_id)
            if fut and not fut.done():
                fut.set_result(False)  # Unblock the waiter but indicate failure
            await callback(prompt_id, {
                "type": "error",
                "message": error_msg,
            })


# ── Module-level singleton ────────────────────────────────────────────────────
# Import this everywhere; FastAPI routes use the same adapter instance.
comfy_adapter = ComfyUIAdapter()
