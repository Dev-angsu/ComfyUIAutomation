Here is a comprehensive Product Requirements Document (PRD) and Architecture Guide for building a scalable, modular web application on top of your existing local image diffusion pipeline.

Product Requirements Document (PRD): AI Image Generation Studio
1. Executive Summary
The AI Image Generation Studio is a web-based interface built to orchestrate and control a local Image Diffusion model (via ComfyUI). It bridges an existing Python automation library with a modern Next.js frontend via a FastAPI backend. The platform provides intuitive controls for image generation, dynamic prompt building (using dropdowns, text inputs, and templates), and job batching, while maintaining the capacity to scale or extend to cloud infrastructure in the future.

2. Product Goals & Vision
Accessibility: Replace the current CLI-based workflow with a user-friendly graphical interface.
Control: Give users granular control over prompt construction (combining natural language and Danbooru-style tags) without needing to memorize syntax.
Observability: Provide real-time feedback on generation progress and an organized gallery of results.
Extensibility: Ensure the architecture allows for easy addition of new models, workflows, or generation parameters.
3. Features & Functional Requirements
3.1 Prompt Builder Interface
Dynamic Dropdowns: Read from dictionaries.json (Artists, Styles, Viewpoints, Characters, Poses, Settings) to populate dropdowns, allowing users to visually build the DYNAMIC_TEMPLATES.
Manual Text Entry: Free-text input for positive and negative prompts, with real-time tag auto-completion (based on Danbooru/Gelbooru standards).
Prompt Preview: A live preview box showing the final concatenated prompt strings (Tags + Natural Language) before submission.
3.2 Job & Batch Management
Job File Upload/Editor: Allow users to upload a jobs.csv file, visualize it in a data grid, edit individual rows (toggle enabled status, edit natural_language), and trigger batch generation.
Dynamic Pipeline Trigger: A dedicated view for triggering run_dynamic_pipeline, letting the user specify the count and select which dictionary to use.
3.3 Real-Time Execution & Observability
Live Progress Indicator: Visual progress bars displaying the execution status of the ComfyUI nodes (relayed from ComfyUI's WebSocket to the frontend).
Gallery Viewer: A grid view of generated images fetched from the output directory, with metadata (prompts, seed, model) attached to each image.
4. Architecture & Design Principles
To ensure the system is Modular, Scalable, and Extendable, we will use a 3-tier architecture.

4.1 Architecture Diagram
text
[ Next.js Frontend ]  <--(REST / WebSockets)-->  [ FastAPI Backend ]  <--(REST / WebSockets)-->  [ ComfyUI Local Server ]
    (UI, State)                                    (API Wrapper)                                   (Diffusion Engine)
4.2 Technology Stack
Frontend: Next.js (App Router), React, TailwindCSS, Zustand (State Management), React Query (Data Fetching), Lucide (Icons).
Backend: FastAPI (Python API), Pydantic (Data Validation), Uvicorn (ASGI Server), websockets (Async WS client/server).
AI Engine: ComfyUI, accessed via client.py and pipeline.py.
4.3 Design Principles
Separation of Concerns (Modularity):
The frontend should know nothing about ComfyUI workflows or node IDs (e.g., Node 11, Node 19). It only sends high-level data (Prompt, Width, Height, Count).
The backend translates high-level API requests into specific ComfyUI JSON workflows.
Stateless API (Scalability):
The FastAPI layer should remain stateless. If the app needs to scale out later (e.g., running multiple ComfyUI instances), you can introduce a task queue like Celery or Redis Queue (RQ). For now, FastAPI's BackgroundTasks or standard asyncio queues will handle local concurrency.
Adapter Pattern (Extendability):
Abstract the generate_image function into an interface. If you decide to switch from ComfyUI to Automatic1111 or a cloud API (like Replicate/RunPod) later, the FastAPI endpoints and Next.js frontend won't need to change.
5. Security Considerations
Even though this is designed for a local diffusion model, security best practices must be implemented to ensure safe extension to network/cloud environments later.

CORS (Cross-Origin Resource Sharing):
FastAPI must explicitly define allowed origins (e.g., http://localhost:3000). Do not use allow_origins=["*"] in production.
Input Validation & Sanitization:
Use Pydantic Models strictly. If an endpoint expects an integer for count, Pydantic will reject malicious payloads.
Sanitize inputs before injecting them into prompt strings to prevent JSON injection into the ComfyUI workflow payload.
Path Traversal Prevention:
When serving generated images from the local file system or reading dictionary files (e.g., dict_filepath), ensure paths are strictly validated. Use Python's os.path.abspath and ensure it falls within a designated allowed directory. Do not blindly trust user-provided filenames.
Rate Limiting & Queueing:
Image generation is resource-intensive. Implement an API rate limit or strict job queue limit to prevent Denial of Service (DoS) attacks on the local GPU.
6. Implementation Guide (How to Accomplish This)
Here is the step-by-step documentation on how to build this system based on your existing codebase.

Phase 1: Backend (FastAPI API Layer)
1. Define Data Models (Pydantic) Create robust data models for requests to ensure type safety.

python
from pydantic import BaseModel, Field
from typing import Optional, List

class GenerationRequest(BaseModel):
    positive_prompt: str
    negative_prompt: str
    width: int = Field(default=512, ge=256, le=2048)
    height: int = Field(default=512, ge=256, le=2048)
    count: int = Field(default=1, ge=1, le=10)

class DynamicJobRequest(BaseModel):
    dictionary_name: str
    count: int
2. Create the Endpoints Wrap your pipeline.py functions in API routes. You will need:

GET /api/dictionaries: Reads demodictionary.json and returns the keys/arrays so the frontend can build dropdowns.
POST /api/generate/manual: Takes a GenerationRequest, builds the ComfyUI workflow, and queues it.
POST /api/generate/dynamic: Takes a DynamicJobRequest and calls run_dynamic_pipeline.
GET /api/images: Returns a list of generated image URLs from the output folder.
3. Set up the WebSocket Relay To send live ComfyUI progress to Next.js, create a WebSocket endpoint in FastAPI. When a job starts, FastAPI connects to ComfyUI's WebSocket (using your client.py logic), and forwards executing and progress messages to the connected Next.js client.

Phase 2: Frontend (Next.js Layer)
1. Project Setup Initialize Next.js with Tailwind CSS:

bash
npx create-next-app@latest ai-studio --typescript --tailwind --eslint
2. Component Architecture Build modular React components:

<PromptBuilder />: Contains the dropdowns. It fetches data from GET /api/dictionaries on mount. Uses state to track selected ARTIST, CHARACTER, etc.
<TextInput />: For custom string entry.
<GenerationControls />: Contains the "Generate" button, Width/Height sliders, and Batch Count inputs.
<ProgressBar />: Listens to the Next.js WebSocket connection and updates width dynamically.
<ImageGallery />: A masonry grid fetching and displaying images.
3. State Management Use a tool like Zustand to manage the global state of the prompt.

typescript
import { create } from 'zustand'

interface PromptState {
  character: string;
  artist: string;
  naturalLanguage: string;
  setCharacter: (c: string) => void;
  // ...
  getConstructedPrompt: () => string;
}
Phase 3: Integration & Execution Flow
User Interacts: The user selects "Fern" from the Character dropdown and types "reading a book" in the natural language box.
Frontend Assembles: Zustand state combines this into: 1girl, Fern, reading a book.
API Call: Next.js sends a POST /api/generate/manual request to FastAPI with the prompt.
Backend Processes: FastAPI validates the payload using Pydantic. It loads the example.json workflow, injects the prompt and a random seed, and sends a REST POST to ComfyUI.
WebSocket Sync: FastAPI listens to the ComfyUI WebSocket. As ComfyUI processes Node 11, Node 19, etc., FastAPI forwards this to Next.js.
UI Updates: The <ProgressBar /> advances.
Completion: ComfyUI saves the image. FastAPI detects completion, fetches the image path, and tells Next.js to refresh the <ImageGallery />.
Phase 4: Serving Static Files safely
ComfyUI saves files locally. FastAPI needs to act as a static file server so Next.js can display them. In your FastAPI app, mount the ComfyUI output directory securely:

python
from fastapi.staticfiles import StaticFiles
import os

# Ensure absolute path for security
OUTPUT_DIR = os.path.abspath("../ComfyUI/output")

app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")
Now, Next.js can render images using <img src="http://localhost:8000/outputs/filename.png" />.

