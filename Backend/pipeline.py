import copy
import random
import json
import csv
import os
import logging
import websocket
from config import (
    SERVER_ADDRESS, CLIENT_ID, DEFAULT_WIDTH, DEFAULT_HEIGHT,
    KSAMPLER_STEPS, KSAMPLER_CFG, KSAMPLER_SAMPLER_NAME, KSAMPLER_SCHEDULER,
    KSAMPLER_DENOISE, MODEL_UNET_NAME, MODEL_VAE_NAME, MODEL_CLIP_NAME,
    DEFAULT_OUTPUT_FILENAME_PREFIX
)
from client import get_images
from prompts import build_positive_prompt, build_negative_prompt, build_dynamic_prompt

logger = logging.getLogger(__name__)

def generate_image(ws, base_workflow, positive_prompt, negative_prompt, width=DEFAULT_WIDTH, height=DEFAULT_HEIGHT, output_prefix=DEFAULT_OUTPUT_FILENAME_PREFIX):
    """Prepares a unique workflow and queues it for execution."""
    workflow = copy.deepcopy(base_workflow)
    
    workflow["11"]["inputs"]["text"] = positive_prompt
    workflow["12"]["inputs"]["text"] = negative_prompt
    seed = random.randint(0, 2**32 - 1)
    logger.info(f"Seeded with: {seed}")
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
                cleaned_row = {k: v.strip() for k, v in row.items() if v and v.strip()}
                jobs.append(cleaned_row)
        return jobs
    else:
        raise ValueError(f"Unsupported file format: {ext}. Please use .json or .csv")

def run_pipeline(jobs_filepath):
    """Automated pipeline to process multiple image generation tasks sequentially."""
    jobs = load_jobs(jobs_filepath)
    if not jobs:
        logger.warning("No jobs found. Exiting.")
        return

    with open("example.json", "r") as f:
        base_workflow = json.load(f)

    ws = websocket.WebSocket()
    ws.connect(f"ws://{SERVER_ADDRESS}/ws?clientId={CLIENT_ID}")

    for i, job in enumerate(jobs, 1):
        enabled = str(job.get('enabled', 'true')).strip().lower()
        if enabled in ['false', '0', 'no', 'f', 'disabled']:
            logger.info(f"--- Skipping Job {i}/{len(jobs)} (Disabled) ---")
            continue
            
        num_images = int(job.get('num_images', 1))
        logger.info(f"--- Starting Job {i}/{len(jobs)} ---")
        
        character_name = job.get("character", "").strip()
        filename_prefix = character_name if character_name else DEFAULT_OUTPUT_FILENAME_PREFIX

        try:
            valid_keys = {"subject", "character", "series", "artist", "general_tags", "natural_language"}
            prompt_kwargs = {k: v for k, v in job.items() if k in valid_keys}
            
            pos_prompt = build_positive_prompt(**prompt_kwargs)
            neg_prompt = build_negative_prompt()
            
            logger.info(f"Positive Prompt: {pos_prompt}")
            logger.info(f"Generating {num_images} image(s) for job {i}...")
            
            for img_idx in range(num_images):
                logger.info(f"Queuing image {img_idx + 1}/{num_images} for job {i}...")
                try:
                    images = generate_image(ws, base_workflow, pos_prompt, neg_prompt, output_prefix=filename_prefix)
                    for image in images:
                        logger.info(f"Success! Image saved as: {image['filename']}")
                except Exception as e:
                    logger.error(f"Failed to generate image {img_idx + 1} for job {i} (Character: '{character_name}'). Error: {e}. Skipping to next image/job...")
                    continue
        except Exception as e:
            logger.error(f"Failed to prepare job {i}. Error: {e}. Skipping to next job...")
            continue
    
    ws.close()
    logger.info("Pipeline finished.")

def run_dynamic_pipeline(count=1, dict_filepath="dictionaries.json"):
    """Automated pipeline to generate multiple random images based on templates."""
    if not os.path.exists(dict_filepath):
        logger.error(f"Dictionary file not found: {dict_filepath}")
        return
        
    with open(dict_filepath, 'r', encoding='utf-8') as f:
        dynamic_config = json.load(f)
        
    templates = dynamic_config.get("DYNAMIC_TEMPLATES", [])
    dictionary = dynamic_config.get("DYNAMIC_DICTIONARY", {})

    with open("example.json", "r") as f:
        base_workflow = json.load(f)

    ws = websocket.WebSocket()
    ws.connect(f"ws://{SERVER_ADDRESS}/ws?clientId={CLIENT_ID}")

    logger.info(f"Starting Dynamic Pipeline: Generating {count} images...")
    for i in range(1, count + 1):
        logger.info(f"--- Starting Dynamic Job {i}/{count} ---")
        try:
            pos_prompt, char_name = build_dynamic_prompt(templates, dictionary)
            neg_prompt = build_negative_prompt()
            filename_prefix = char_name if char_name else DEFAULT_OUTPUT_FILENAME_PREFIX
            
            logger.info(f"Positive Prompt: {pos_prompt}")
            images = generate_image(ws, base_workflow, pos_prompt, neg_prompt, output_prefix=filename_prefix)
            for image in images:
                logger.info(f"Success! Image saved as: {image['filename']}")
        except Exception as e:
            logger.error(f"Job {i} failed during execution. Error: {e}. Skipping to next job...")
            continue
    
    ws.close()
    logger.info("Dynamic Pipeline finished.")