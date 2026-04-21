# AI Studio — Job Execution Documentation

This document explains how to run generation jobs in the new architecture and the key differences between the original CLI-only script and the current FastAPI-based system.

## 1. Architecture Overview

### Original Approach (CLI-Only)
The old approach used `app.py` as a monolithic script. When you ran it, it:
1.  Parsed your CSV/JSON file.
2.  Directly connected to ComfyUI.
3.  Sent a single job and waited (blocking) for it to finish.
4.  **Limitation**: You couldn't easily have a Web UI, multiple jobs at once, or a persistent gallery.

### Modern Approach (Client-Server)
The new system uses a **FastAPI Backend** as the "Brain".
*   **Server (`main.py`)**: Runs continuously, manages a background **Job Queue**, and maintains a persistent connection to ComfyUI.
*   **Clients**: Can be the **Web UI** (Next.js), **CLI Script** (`app.py`), or even **cURL**.
*   **Benefit**: You can queue up 50 jobs via CLI, then go to the Web UI to see them processing in real-time.

---

## 2. How to Run Jobs

### Step 1: Start the Backend
The backend must be running to process any jobs. In your terminal, run:
```bash
cd Backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
```
*Wait for the message: `✅ All background tasks running — API ready`.*

### Step 2: Submit Jobs
You have three ways to trigger generations:

#### A. Using the CLI Client (`app.py`)
Run the CLI just like before, but ensure the server is running in another terminal tab.
```bash
python3 Backend/app.py --mode jobs --jobs Jobs/keqing.csv
```
*Note: The refactored `app.py` acts as a client that sends your files to the server.*

#### B. Using the Interactive UI (Phase 3)
Once the Next.js frontend is built, you will simply drag-and-drop your CSV files or use the viewport controls.

#### C. Using the API (cURL / Postman)
You can submit a single job via a simple POST request:
```bash
curl -X POST http://localhost:8000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"positive_prompt": "masterpiece, 1girl, Fern", "params": {"steps": 30}}'
```

---

## 3. Key Differences

| Feature | CLI approach (Old) | FastAPI Backend (New) |
| :--- | :--- | :--- |
| **Execution** | Synchronous (Script waits) | Asynchronous (Server queues job) |
| **Concurrency** | One script at a time | Multiple clients can submit concurrently |
| **Visibility** | Logs only | Real-time Progress (WebSockets) + Web Gallery |
| **Stability** | Script crash = job lost | Worker handles retries and reconnections |
| **Platform** | Tied to local filesystem | Platform-agnostic (works via HTTP/WS) |
| **Output** | Hardcoded file paths | Proxy-based image delivery |

---

## 4. Why the CLI script changed
The `app.py` script was updated to be an **API Client**. Instead of doing the heavy lifting locally, it now tells the Server what to do.

**Why this is better:**
1.  **Single Source of Truth**: Prompt building logic is now centralized in `core/prompt_engine.py`. Changes there affect both CLI and UI.
2.  **Queue Management**: The server ensures jobs are processed one-by-one, preventing ComfyUI from being overwhelmed if multiple scripts are started.
3.  **UI Sync**: Jobs started via CLI now show up in your Web Gallery automatically!
