# Master Product Requirements Document (PRD): AI Studio

## 1. Executive Summary

The **AI Studio** is a professional-grade web application designed to interface with a local Image Diffusion model (powered by ComfyUI). It transforms an existing Python-based automation script into a fully-fledged, modular Web GUI. By leveraging **Next.js** for the frontend and **FastAPI** for the backend, the application provides a sleek, highly controllable environment for crafting complex prompts, managing batch generation jobs, and observing real-time AI execution, all without requiring users to write code or interact with a CLI.

## 2. Product Objectives

- **Democratize Prompt Engineering:** Provide a visual builder that seamlessly merges natural language with strict Danbooru/Gelbooru tag schemas without manual syntax memorization.
- **Orchestrate Workflows:** Move from single-script execution to a robust queue-based system capable of handling manual tasks, dynamic template generation, and large-scale CSV batch processing.
- **Professional UX:** Deliver a high-performance, dark-themed, 3-pane interface akin to industry-standard creative tools (Figma, VS Code), breaking away from generic "AI chat" layouts.
- **Future-Proof Architecture:** Ensure the system adheres to SOLID principles and Clean Architecture, allowing easy swapping of the underlying AI engine (e.g., from local ComfyUI to cloud-based RunPod) via adapter patterns.

---

## 3. Functional Requirements

### 3.1 Prompt Engineering & Control (The Studio)

- **Hybrid Prompt Builder:** The UI must support both Natural Language inputs and Tokenized Tag inputs.
- **Dynamic Dropdowns:** The system must read from `dictionaries.json` (Artists, Styles, Viewpoints, Characters, Places, Poses, Settings, etc.) and render them as searchable, tokenized comboboxes.
- **Template Support:** Users must be able to select or build `DYNAMIC_TEMPLATES` (e.g., `1girl, CHARACTER, @ARTIST, STYLE...`) where variables are mapped to UI dropdowns.
- **Tag Auto-Completion:** Text inputs for tags must auto-suggest standardized Danbooru/Gelbooru tags and "score tags" (e.g., `score_9`, `best quality`).
- **Live Preview:** The UI must display a read-only preview of the exact synthesized prompt string that will be sent to the backend.

### 3.2 Job & Queue Management

- **Single/Manual Generation:** Users can trigger a single job with explicit parameters directly from the Studio viewport.
- **Dynamic Batch Generation:** Users can specify a `count` (e.g., 50) and a `dictionary_name`. The system will automatically generate randomized prompts based on the selected dynamic templates and queue them.
- **CSV Job Upload:** Users can upload a `jobs.csv` file. The UI will render this as an editable data grid. Users can toggle job `enabled` states, modify rows, and dispatch the entire batch to the backend.

### 3.3 Image Generation Parameters

- **Core Controls:** Sliders/Inputs for `Width`, `Height`, and `Batch Count`.
- **Advanced Overrides (Collapsible):** Granular control over `Seed`, `Steps`, `CFG Scale`, `Sampler Name`, `Scheduler`, and `Denoise` strength.
- **Model Selection:** Dropdowns (read from the backend) to select the `UNET`, `VAE`, and `CLIP` models.

### 3.4 Execution & Observability

- **Real-time Progress:** The frontend must receive WebSocket events from the backend to display granular generation progress (e.g., which node is executing, completion percentage) via a sleek progress bar.
- **Gallery / History Vault:** A masonry grid view where users can browse all locally generated images.
- **Metadata Inspector:** Clicking an image in the gallery must reveal the exact parameters (Seed, Positive Prompt, Negative Prompt, Model) used to generate it.

---

## 4. Non-Functional Requirements

### 4.1 Architecture & Maintainability (Clean Code)

- **Modularity:** The Next.js frontend must use Compound Components (e.g., for the Prompt Builder) and Custom Hooks (for API/WebSocket logic) to avoid prop-drilling.
- **Design Patterns:** The Python backend must utilize the **Adapter Pattern** (to wrap ComfyUI), **Strategy Pattern** (for loading CSV vs. JSON jobs), and the **Builder Pattern** (for constructing the massive ComfyUI workflow JSON dicts).
- **State Management:** The frontend will use `Zustand` for global state (Prompt state, Job Queue state) and `React Query` for asynchronous data fetching.

### 4.2 Performance & Scalability

- **Asynchronous Processing:** FastAPI must handle image generation requests asynchronously (via `BackgroundTasks` or an external queue like Celery) so as not to block or timeout HTTP requests from the Next.js client.
- **Pagination:** The Image Gallery API endpoint must support pagination or infinite scrolling to prevent crashing the browser when loading thousands of images from the local output directory.

### 4.3 Usability & UX

- **Layout:** A rigid 3-pane architecture (Left Sidebar for assets/navigation, Center Canvas for building/viewing, Right Sidebar for parameters).
- **Micro-interactions:** Skeleton loaders for fetching data, smooth opacity transitions for image reveals, and non-intrusive toast notifications for success/error states.

### 4.4 Security & Local Access

- **CORS Configuration:** FastAPI must restrict cross-origin requests exclusively to the Next.js local development port (e.g., `localhost:3000`).
- **Path Traversal Protection:** Endpoints serving local images or reading dictionaries must strictly validate and sanitize file paths to prevent arbitrary local file reads.

---

## 5. Major User Flows

### Flow 1: Manual Studio Generation (Single/Iterative)

1.  **Initialize:** User navigates to the "Studio" tab. The frontend fetches `dictionaries.json` via API and populates dropdowns.
2.  **Construct:** User types natural language in the text area and selects "Fern" from the `CHARACTER` dropdown and "@wlop" from the `ARTIST` dropdown.
3.  **Configure:** User sets width to 1024, height to 1024, and clicks "Generate".
4.  **Dispatch:** Next.js sends a standardized `GenerationRequest` payload (JSON) via POST to the FastAPI backend.
5.  **Process:** FastAPI validates the payload (Pydantic), uses the `ComfyWorkflowBuilder` to inject the prompt into the base workflow, and sends it to ComfyUI.
6.  **Observe:** Next.js listens to the WebSocket. A slim progress bar animates across the canvas.
7.  **Complete:** ComfyUI saves the image. FastAPI notifies Next.js. Next.js fetches the new image URL and displays it in the central viewport.

### Flow 2: Dynamic Template Batch Generation

1.  **Initialize:** User navigates to the "Dynamic Batch" tab.
2.  **Configure:** User selects a specific `DYNAMIC_TEMPLATE` from a dropdown, sets the Generation Count to `50`, and selects the target dictionary.
3.  **Dispatch:** User clicks "Start Batch". Next.js sends a `DynamicJobRequest` POST to FastAPI.
4.  **Process:** FastAPI immediately returns a `200 OK` (Job Queued). In a background task, the backend loop (`run_dynamic_pipeline`) begins synthesizing random prompts and queuing them into ComfyUI.
5.  **Observe:** The Bottom Panel "Queue" UI in Next.js displays the active job status (e.g., "Job 3 of 50 Processing").
6.  **Complete:** As each image finishes, it asynchronously populates into the Gallery view.

### Flow 3: CSV Job Management

1.  **Upload:** User navigates to the "Batch Manager" tab and drags-and-drops a `jobs.csv` file.
2.  **Review/Edit:** The Next.js frontend parses the CSV and displays it in an AG-Grid/TanStack table. The user double-clicks a row to tweak a prompt or toggles the `Enabled` checkbox for specific rows.
3.  **Dispatch:** User clicks "Run Enabled Jobs". Next.js sends an array of job objects to the backend.
4.  **Process:** FastAPI uses the `JobParserStrategy` to process the incoming payload, iterating through the list and dispatching them to the AI engine.

---

## 6. System Architecture (High-Level)

```mermaid
graph TD
    subgraph Next.js Frontend (Client)
        UI[3-Pane Studio UI]
        Zustand[Zustand State]
        Hooks[React Query / API Hooks]
        UI <--> Zustand
        UI <--> Hooks
    end

    subgraph FastAPI Backend (Server)
        Router[API Routers]
        Adapter[AIEngineAdapter]
        Builder[ComfyWorkflowBuilder]
        WS[WebSocket Pub/Sub]

        Router --> Builder
        Builder --> Adapter
    end

    subgraph Local AI Engine
        Comfy[ComfyUI Server]
        FileSystem[Local File System /output]
    end

    Hooks -- REST POST (Jobs) --> Router
    Hooks -- REST GET (Images/Dicts) --> Router
    UI -- WebSocket (Progress) --> WS

    Adapter -- REST POST (Workflow JSON) --> Comfy
    Comfy -- WebSocket (Execution Status) --> WS
    Comfy -- Saves Images --> FileSystem
    Router -- Mounts Static Directory --> FileSystem
```
