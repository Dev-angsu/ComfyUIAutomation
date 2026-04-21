from __future__ import annotations
from typing import Any, Optional

"""
AI Studio — ComfyUI Workflow Builder
--------------------------------------
Builder Pattern implementation for constructing ComfyUI workflow JSON.

Encapsulates all node ID knowledge. If the ComfyUI workflow changes
(Node 11 becomes Node 42), only this class needs updating — not the callers.

Usage:
    workflow = (
        ComfyWorkflowBuilder()
        .set_positive_prompt("masterpiece, 1girl, ...")
        .set_negative_prompt("worst quality, ...")
        .set_dimensions(1024, 1024)
        .set_seed(42)
        .set_sampler(steps=30, cfg=4.0)
        .set_models(unet="model.safetensors")
        .build()
    )
"""

import copy
import json
import logging
from pathlib import Path

from config import settings

logger = logging.getLogger(__name__)

# Default base workflow path — example.json sits in the Backend/ root
_BASE_WORKFLOW_PATH = Path(__file__).parent.parent / "example.json"

# Node ID map — single source of truth for all node references
_NODES = {
    "positive_prompt": "11",   # CLIPTextEncode (Positive)
    "negative_prompt": "12",   # CLIPTextEncode (Negative)
    "ksampler": "19",          # KSampler
    "latent_image": "28",      # EmptyLatentImage
    "vae_loader": "15",        # VAELoader
    "unet_loader": "44",       # UNETLoader (Diffusion Model)
    "clip_loader": "45",       # CLIPLoader
    "save_image": "46",        # SaveImage
}


class ComfyWorkflowBuilder:
    """
    Fluent Builder for ComfyUI workflow JSON dictionaries.

    Isolates brittle node-key manipulation from business logic.
    Each setter returns `self` for method chaining.
    Calling `.build()` returns a deep copy of the fully constructed dict.
    """

    def __init__(self, base_workflow_path: Optional[str] = None) -> None:
        path = Path(base_workflow_path) if base_workflow_path else _BASE_WORKFLOW_PATH

        if not path.exists():
            raise FileNotFoundError(
                f"Base workflow not found at: {path}. "
                "Ensure example.json is present in the Backend/ directory."
            )

        with open(path, "r", encoding="utf-8") as f:
            self._workflow: dict = json.load(f)

        # Work on a deep copy to avoid mutating the loaded original
        self._workflow = copy.deepcopy(self._workflow)

    # ── Prompt ─────────────────────────────────────────────────────────────────

    def set_positive_prompt(self, text: str) -> "ComfyWorkflowBuilder":
        """Sets the CLIPTextEncode node for positive conditioning."""
        self._workflow[_NODES["positive_prompt"]]["inputs"]["text"] = text
        return self

    def set_negative_prompt(self, text: str) -> "ComfyWorkflowBuilder":
        """Sets the CLIPTextEncode node for negative conditioning."""
        self._workflow[_NODES["negative_prompt"]]["inputs"]["text"] = text
        return self

    # ── Sampler ────────────────────────────────────────────────────────────────

    def set_seed(self, seed: int) -> "ComfyWorkflowBuilder":
        """Sets the KSampler seed value."""
        self._workflow[_NODES["ksampler"]]["inputs"]["seed"] = seed
        return self

    def set_sampler(
        self,
        steps: Optional[int] = None,
        cfg: Optional[float] = None,
        sampler_name: Optional[str] = None,
        scheduler: Optional[str] = None,
        denoise: Optional[float] = None,
    ) -> "ComfyWorkflowBuilder":
        """Configures KSampler parameters. Pass only the values you want to override."""
        node = self._workflow[_NODES["ksampler"]]["inputs"]
        if steps is not None:
            node["steps"] = steps
        if cfg is not None:
            node["cfg"] = cfg
        if sampler_name is not None:
            node["sampler_name"] = sampler_name
        if scheduler is not None:
            node["scheduler"] = scheduler
        if denoise is not None:
            node["denoise"] = denoise
        return self

    # ── Image Dimensions ───────────────────────────────────────────────────────

    def set_dimensions(
        self,
        width: int,
        height: int,
        batch_size: int = 1,
    ) -> "ComfyWorkflowBuilder":
        """Sets the EmptyLatentImage dimensions and batch size."""
        node = self._workflow[_NODES["latent_image"]]["inputs"]
        node["width"] = width
        node["height"] = height
        node["batch_size"] = batch_size
        return self

    # ── Models ─────────────────────────────────────────────────────────────────

    def set_models(
        self,
        unet: Optional[str] = None,
        vae: Optional[str] = None,
        clip: Optional[str] = None,
    ) -> "ComfyWorkflowBuilder":
        """
        Overrides model filenames. Only provided arguments are changed;
        others remain at the base workflow defaults.
        """
        if unet:
            self._workflow[_NODES["unet_loader"]]["inputs"]["unet_name"] = unet
        if vae:
            self._workflow[_NODES["vae_loader"]]["inputs"]["vae_name"] = vae
        if clip:
            self._workflow[_NODES["clip_loader"]]["inputs"]["clip_name"] = clip
        return self

    # ── Output ─────────────────────────────────────────────────────────────────

    def set_output_prefix(self, prefix: str) -> "ComfyWorkflowBuilder":
        """Sets the SaveImage node's filename prefix."""
        self._workflow[_NODES["save_image"]]["inputs"]["filename_prefix"] = prefix
        return self

    # ── Build ──────────────────────────────────────────────────────────────────

    def build(self) -> dict:
        """
        Returns a deep copy of the fully configured workflow dictionary.
        The builder instance remains reusable after calling build().
        """
        return copy.deepcopy(self._workflow)

    def apply_defaults(self) -> "ComfyWorkflowBuilder":
        """
        Apply all settings-derived defaults. Useful for ensuring a fresh
        builder has sane values even if callers don't specify overrides.
        """
        import random as _random

        return (
            self.set_sampler(
                steps=settings.ksampler_steps,
                cfg=settings.ksampler_cfg,
                sampler_name=settings.ksampler_sampler_name,
                scheduler=settings.ksampler_scheduler,
                denoise=settings.ksampler_denoise,
            )
            .set_seed(_random.randint(0, 2**32 - 1))
            .set_dimensions(settings.default_width, settings.default_height)
            .set_models(
                unet=settings.default_unet,
                vae=settings.default_vae,
                clip=settings.default_clip,
            )
            .set_output_prefix(settings.default_output_prefix)
        )
