import uuid

# ==========================================
# Configuration Section
# ==========================================
SERVER_ADDRESS = "127.0.0.1:8188"
CLIENT_ID = str(uuid.uuid4())

# Prompt Defaults
DEFAULT_POSITIVE_PREFIX = ["masterpiece", "best quality", "score_7", "safe", "highres", "year 2025", "newest"]
DEFAULT_NEGATIVE_PROMPT = "worst quality, low quality, score_1, score_2, score_3, blurry, jpeg artifacts, sepia"

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