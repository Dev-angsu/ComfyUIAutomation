import websocket
import uuid
import json
import requests
import copy
import random
import csv
import os
import argparse

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
# ==========================================

def queue_prompt(prompt):
    p = {"prompt": prompt, "client_id": CLIENT_ID}
    data = json.dumps(p).encode('utf-8')
    req = requests.post(f"http://{SERVER_ADDRESS}/prompt", data=data)
    return req.json()

def get_images(ws, prompt):
    prompt_id = queue_prompt(prompt)['prompt_id']
    print(f"Queued prompt ID: {prompt_id}")
    
    while True:
        out = ws.recv()
        if isinstance(out, str):
            message = json.loads(out)
            if message['type'] == 'executing':
                data = message['data']
                # Node None means the whole prompt finished
                if data['node'] is None and data['prompt_id'] == prompt_id:
                    break
        else:
            continue

    # Fetch history
    history_res = requests.get(f"http://{SERVER_ADDRESS}/history/{prompt_id}").json()
    
    if prompt_id not in history_res:
        print(f"Error: Prompt {prompt_id} not found in history. It might have crashed.")
        return []

    history = history_res[prompt_id]
    
    # DEBUG: See what nodes actually gave output
    print("Nodes with output:", list(history.get('outputs', {}).keys()))

    if 'outputs' in history and '46' in history['outputs']:
        return history['outputs']['46']['images']
    else:
        print("Warning: Node 46 did not produce any output. Check ComfyUI console for errors.")
        return []

def build_positive_prompt(subject="1girl", character="", series="", artist="", general_tags="", natural_language=""):
    """
    Builds a prompt following the rules from prompting.txt:
    [quality/meta/year/safety tags] [1girl/1boy/1other etc] [character] [series] [artist] [general tags]
    """
    # Recommended prefix setup from rules
    tags = list(DEFAULT_POSITIVE_PREFIX)
    
    if subject: tags.append(subject)
    if character: tags.append(character)
    if series: tags.append(series)
    if artist: tags.append(f"@{artist}")  # Artist tags must be prefixed with @
    if general_tags: tags.append(general_tags)
    
    prompt = ", ".join(tags)
    
    # Allow mixing tags and natural language combinations (min. 2 sentences recommended)
    if natural_language:
        prompt = f"{prompt}. {natural_language}"
        
    return prompt

def build_negative_prompt(extra_tags=""):
    """Builds a negative prompt based on recommended defaults from prompting.txt."""
    base = DEFAULT_NEGATIVE_PROMPT
    if extra_tags:
        return f"{base}, {extra_tags}"
    return base

def generate_image(ws, base_workflow, positive_prompt, negative_prompt, width=DEFAULT_WIDTH, height=DEFAULT_HEIGHT, output_prefix=DEFAULT_OUTPUT_FILENAME_PREFIX):
    """Prepares a unique workflow and queues it for execution."""
    workflow = copy.deepcopy(base_workflow)
    
    # Modify parameters for this specific run
    workflow["11"]["inputs"]["text"] = positive_prompt
    workflow["12"]["inputs"]["text"] = negative_prompt
    seed=random.randint(0, 2**32 - 1)
    print(f"Seeded with: {seed}")
    workflow["19"]["inputs"]["seed"] = seed
    workflow["19"]["inputs"]["steps"] = KSAMPLER_STEPS
    workflow["19"]["inputs"]["cfg"] = KSAMPLER_CFG
    workflow["19"]["inputs"]["sampler_name"] = KSAMPLER_SAMPLER_NAME
    workflow["19"]["inputs"]["scheduler"] = KSAMPLER_SCHEDULER
    workflow["19"]["inputs"]["denoise"] = KSAMPLER_DENOISE
    
    workflow["28"]["inputs"]["width"] = width
    workflow["28"]["inputs"]["height"] = height
    
    workflow["44"]["inputs"]["unet_name"] = MODEL_UNET_NAME
    workflow["15"]["inputs"]["vae_name"] = MODEL_VAE_NAME
    workflow["45"]["inputs"]["clip_name"] = MODEL_CLIP_NAME
    
    workflow["46"]["inputs"]["filename_prefix"] = output_prefix
    
    return get_images(ws, workflow)

def load_jobs(filepath):
    """Loads job configurations from a JSON or CSV file."""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Job file not found: {filepath}")
        
    _, ext = os.path.splitext(filepath)
    
    if ext.lower() == '.json':
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    elif ext.lower() == '.csv':
        jobs = []
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Remove empty fields so default kwargs work correctly
                cleaned_row = {k: v.strip() for k, v in row.items() if v and v.strip()}
                jobs.append(cleaned_row)
        return jobs
    else:
        raise ValueError(f"Unsupported file format: {ext}. Please use .json or .csv")

def run_pipeline(jobs_filepath):
    """Automated pipeline to process multiple image generation tasks sequentially."""
    # 1. Load jobs from external file
    jobs = load_jobs(jobs_filepath)
    if not jobs:
        print("No jobs found. Exiting.")
        return

    # 2. Load the base workflow
    with open("example.json", "r") as f:
        base_workflow = json.load(f)

    # 3. Connect to WebSocket
    ws = websocket.WebSocket()
    ws.connect(f"ws://{SERVER_ADDRESS}/ws?clientId={CLIENT_ID}")

    # 4. Execute pipeline sequentially
    for i, job in enumerate(jobs, 1):
        # Check if the job is enabled
        enabled = str(job.get('enabled', 'true')).strip().lower()
        if enabled in ['false', '0', 'no', 'f', 'disabled']:
            print(f"\n--- Skipping Job {i}/{len(jobs)} (Disabled) ---")
            continue
            
        # Get number of images to generate (default to 1)
        num_images = int(job.get('num_images', 1))
        
        print(f"\n--- Starting Job {i}/{len(jobs)} ---")
        
        # Determine filename prefix
        character_name = job.get("character", "").strip()
        filename_prefix = character_name if character_name else DEFAULT_OUTPUT_FILENAME_PREFIX

        # Filter kwargs to prevent TypeError if extra columns exist in the CSV/JSON
        valid_keys = {"subject", "character", "series", "artist", "general_tags", "natural_language"}
        prompt_kwargs = {k: v for k, v in job.items() if k in valid_keys}
        
        pos_prompt = build_positive_prompt(**prompt_kwargs)
        neg_prompt = build_negative_prompt()
        
        print(f"Positive Prompt:\n{pos_prompt}")
        print(f"Generating {num_images} image(s) for job {i}...")
        
        for img_idx in range(num_images):
            print(f"  -> Queuing image {img_idx + 1}/{num_images} for job {i}...")
            images = generate_image(ws, base_workflow, pos_prompt, neg_prompt, output_prefix=filename_prefix)
            
            for image in images:
                print(f"     Success! Image saved as: {image['filename']}")
                print(f"     Download URL: http://{SERVER_ADDRESS}/view?filename={image['filename']}&type=output")
    
    ws.close()
    print("\nPipeline finished.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run ComfyUI Automated Image Generation Pipeline")
    parser.add_argument("--jobs", type=str, default="jobs.json", help="Path to the jobs JSON or CSV file")
    args = parser.parse_args()
    
    try:
        run_pipeline(args.jobs)
    except Exception as e:
        print(f"Pipeline failed: {e}")