from __future__ import annotations

"""
AI Studio — CLI Client
----------------------
A dedicated CLI client for the AI Studio FastAPI backend.
This allows you to run automation batches from the terminal while 
leveraging the central queue, workflow builder, and UI gallery.

Usage:
  1. Ensure the server is running: 
     cd Backend && python3 -m uvicorn main:app
     
  2. Run a batch of jobs from a CSV/JSON file:
     python3 cli.py --mode jobs --jobs ../Jobs/keqing.csv
     
  3. Run a dynamic randomized batch:
     python3 cli.py --mode dynamic --count 5 --dict demodictionary.json
"""

import argparse
import logging
import time
import sys
from pathlib import Path
from typing import Optional

import httpx

# --- Configuration ---
# Match the default port and host of the FastAPI server
BASE_URL = "http://localhost:8000"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def check_server() -> bool:
    """Verify the FastAPI server is running and reachable."""
    try:
        resp = httpx.get(f"{BASE_URL}/health", timeout=2.0)
        return resp.status_code == 200
    except Exception:
        return False

def run_jobs_mode(file_path: str):
    """
    Uploads a job file (CSV or JSON) to the backend for processing.
    The backend will parse the file and enqueue all enabled jobs.
    """
    path = Path(file_path)
    if not path.exists():
        logger.error(f"❌ File not found: {file_path}")
        return

    logger.info(f"📤 Uploading batch file: {path.name}...")
    
    with open(path, "rb") as f:
        # We use the upload endpoint which is platform-agnostic
        files = {"file": (path.name, f)}
        try:
            resp = httpx.post(f"{BASE_URL}/api/batch/csv/upload", files=files, timeout=60.0)
            resp.raise_for_status()
            data = resp.json()
            batch_id = data["batch_id"]
            
            logger.info(f"✅ Batch submitted successfully!")
            logger.info(f"🆔 Batch ID: {batch_id}")
            logger.info(f"📈 Tasks enqueued: {data['total']}")
            
            # Start tracking progress
            track_batch(batch_id)
            
        except httpx.HTTPStatusError as e:
            logger.error(f"❌ Server returned error: {e.response.text}")
        except Exception as e:
            logger.error(f"❌ Failed to submit batch: {e}")

def run_dynamic_mode(count: int, dict_file: str):
    """
    Sends a request to the backend to generate a dynamic batch 
    using randomized templates from the specified dictionary.
    """
    logger.info(f"🎲 Requesting dynamic batch: {count} images using {dict_file}...")
    
    payload = {
        "name": f"CLI Dynamic: {dict_file}",
        "count": count,
        "dict_file": dict_file
    }
    
    try:
        resp = httpx.post(f"{BASE_URL}/api/batch/dynamic", json=payload, timeout=60.0)
        resp.raise_for_status()
        data = resp.json()
        batch_id = data["batch_id"]
        
        logger.info(f"✅ Dynamic batch enqueued!")
        logger.info(f"🆔 Batch ID: {batch_id}")
        
        # Start tracking progress
        track_batch(batch_id)
        
    except httpx.HTTPStatusError as e:
        logger.error(f"❌ Server returned error: {e.response.text}")
    except Exception as e:
        logger.error(f"❌ Failed to submit dynamic batch: {e}")

def track_batch(batch_id: str):
    """
    Polls the backend for progress updates on a specific batch 
    until all tasks reach a terminal state (COMPLETED or FAILED).
    """
    logger.info("⏱️  Tracking progress (Ctrl+C to stop tracking, job will continue on server)...")
    last_completed = -1
    
    try:
        while True:
            resp = httpx.get(f"{BASE_URL}/api/batches/{batch_id}")
            resp.raise_for_status()
            data = resp.json()
            
            status = data["status"]
            completed = data["completed"]
            failed = data["failed"]
            total = data["total_tasks"]
            
            # Only log if progress has changed
            if completed != last_completed or failed > 0:
                logger.info(f"📊 Progress: {completed}/{total} completed | {failed} failed")
                last_completed = completed
            
            if status in ("COMPLETED", "FAILED"):
                logger.info(f"🏁 Batch finished with status: {status}")
                if failed > 0:
                    logger.warning(f"⚠️  Note: {failed} tasks failed. Check server logs for details.")
                break
                
            time.sleep(3)
    except KeyboardInterrupt:
        logger.info("\n👋 Stopped tracking progress. The server will continue processing the batch in the background.")
    except Exception as e:
        logger.error(f"❌ Error during tracking: {e}")

def main():
    global BASE_URL
    parser = argparse.ArgumentParser(description="AI Studio CLI Client")
    parser.add_argument("--mode", type=str, choices=["jobs", "dynamic"], default="jobs", 
                        help="Mode: 'jobs' for file-based batch, 'dynamic' for random templates")
    parser.add_argument("--jobs", type=str, default="../Jobs/jobs.csv", help="Path to jobs CSV/JSON")
    parser.add_argument("--dict", type=str, default="demodictionary.json", help="Dictionary file for dynamic mode")
    parser.add_argument("--count", type=int, default=1, help="Number of images to generate (dynamic mode only)")
    parser.add_argument("--url", type=str, default=BASE_URL, help=f"Backend API URL (default: {BASE_URL})")
    
    args = parser.parse_args()

    # Update global base URL if user provided one
    BASE_URL = args.url.rstrip("/")

    if not check_server():
        logger.error(f"❌ Connection Failed: Could not reach the API at {BASE_URL}")
        logger.info("💡 Ensure the backend server is running in another terminal:")
        logger.info("   cd Backend && python3 -m uvicorn main:app")
        sys.exit(1)

    try:
        if args.mode == "jobs":
            run_jobs_mode(args.jobs)
        elif args.mode == "dynamic":
            run_dynamic_mode(args.count, args.dict)
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    main()
