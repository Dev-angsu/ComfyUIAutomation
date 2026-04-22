"""
AI Studio — Application Configuration
--------------------------------------
Uses pydantic-settings to load from .env file or environment variables.
All tunable constants are externalized here; no magic strings in the code.
"""

import uuid
from pydantic_settings import BaseSettings, SettingsConfigDict

# Reverse Compatibility

# ==========================================
# Configuration Section
# ==========================================
SERVER_ADDRESS = "127.0.0.1:8188"
CLIENT_ID = str(uuid.uuid4())

# Prompt Defaults
DEFAULT_POSITIVE_PREFIX = ["masterpiece", "best quality", "score_7", "highres", "year 2025", "newest"]
DEFAULT_NEGATIVE_PROMPT = "worst quality, low quality, score_1, score_2, score_3, blurry, jpeg artifacts, sepia,long neck, out of frame, extra fingers, mutated hands, monochrome, bad anatomy, watermark, missing limbs, disfigured, ugly"

# Generation Defaults
DEFAULT_WIDTH = 1024
DEFAULT_HEIGHT = 1024

# KSampler Settings
KSAMPLER_STEPS = 30
KSAMPLER_CFG = 4.0
KSAMPLER_SAMPLER_NAME = "er_sde"
KSAMPLER_SCHEDULER = "simple"
KSAMPLER_DENOISE = 1.0

# Models & Outputs
MODEL_UNET_NAME = "anima-preview3-base.safetensors"
MODEL_VAE_NAME = "qwen_image_vae.safetensors"
MODEL_CLIP_NAME = "qwen_3_06b_base.safetensors"
DEFAULT_OUTPUT_FILENAME_PREFIX = "ComfyUI_Auto"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── ComfyUI Connection ─────────────────────────────────────────────────
    comfy_server: str = "127.0.0.1:8188"
    # SaveImage node ID in the base workflow JSON
    comfy_output_node_id: str = "46"
    # Unique client ID for WebSocket identification — generated fresh each restart
    client_id: str = str(uuid.uuid4())

    # ── CORS / Frontend ────────────────────────────────────────────────────
    frontend_url: str = "http://localhost:3000"

    # ── Jobs Directory ─────────────────────────────────────────────────────
    # Relative to the Backend/ working directory
    jobs_dir: str = "../Jobs"

    # ── Prompt Defaults ────────────────────────────────────────────────────
    default_positive_prefix: str = (
        "masterpiece, best quality, score_7, highres, year 2025, newest"
    )
    default_negative_prompt: str = (
        "worst quality, low quality, score_1, score_2, score_3, blurry, jpeg artifacts, "
        "sepia, long neck, out of frame, extra fingers, mutated hands, monochrome, "
        "bad anatomy, watermark, missing limbs, disfigured, ugly"
    )

    # ── KSampler Defaults ──────────────────────────────────────────────────
    ksampler_steps: int = 30
    ksampler_cfg: float = 4.0
    ksampler_sampler_name: str = "er_sde"
    ksampler_scheduler: str = "simple"
    ksampler_denoise: float = 1.0

    # ── Model Defaults ─────────────────────────────────────────────────────
    default_unet: str = "anima-preview3-base.safetensors"
    default_vae: str = "qwen_image_vae.safetensors"
    default_clip: str = "qwen_3_06b_base.safetensors"
    default_output_prefix: str = "ComfyUI_Auto"

    # ── Image Defaults ─────────────────────────────────────────────────────
    default_width: int = 1024
    default_height: int = 1024

    # ── Database (Phase 2 — configured now, activated later) ───────────────
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "ai_studio"
    db_user: str = "postgres"
    db_password: str = "2526"

    # ── Redis (Phase 2 — configured now, activated later) ──────────────────
    redis_url: str = "redis://default@127.0.0.1:6379"

    @property
    def comfy_http_base(self) -> str:
        return f"http://{self.comfy_server}"

    @property
    def comfy_ws_url(self) -> str:
        return f"ws://{self.comfy_server}/ws?clientId={self.client_id}"

    @property
    def positive_prefix_list(self) -> list[str]:
        return [t.strip() for t in self.default_positive_prefix.split(",") if t.strip()]


# Singleton — import this everywhere
settings = Settings()