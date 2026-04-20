# Design Patterns & Architecture PRD: AI Studio

## 1. Architectural Philosophy

To ensure the AI Studio is maintainable, scalable, and extendable, the system will adhere to **Clean Architecture** principles. The core goal is the **Separation of Concerns**: the UI should not know about HTTP requests, the API should not know about UI state, and the core business logic (prompt building and AI orchestration) should not be tightly coupled to a specific AI engine (like ComfyUI).

The system will strictly adhere to the **SOLID** principles:

- **S**ingle Responsibility: Every module, class, or function will have one reason to change.
- **O**pen/Closed: The system will be open for extension (e.g., adding new AI models) but closed for modification.
- **L**iskov Substitution: Interfaces (like an `IAIEngine` or `IJobLoader`) will allow interchangeable implementations.
- **I**nterface Segregation: Large monolithic interfaces will be broken down into smaller, role-specific ones.
- **D**ependency Inversion: High-level modules will not depend on low-level modules; both will depend on abstractions.

---

## 2. Backend Design Patterns (FastAPI / Python)

The Python backend serves as the orchestration layer between the frontend and the AI generation engine.

### 2.1 The Adapter (and Facade) Pattern

- **Current State:** `client.py` makes direct `requests` and `websocket` calls to ComfyUI.
- **Target Implementation:** Create an `AIEngineAdapter` interface. The `ComfyUIAdapter` will implement this interface, acting as a **Facade** over the complex websocket handshakes and HTTP REST calls specific to ComfyUI.
- **Benefit:** If we decide to move from local ComfyUI to a cloud provider like RunPod or Replicate, or a local Automatic1111 instance, we simply create a `RunPodAdapter` that adheres to the `AIEngineAdapter` interface. The FastAPI routes will not need a single line of code changed.

### 2.2 The Strategy Pattern

- **Current State:** `pipeline.py`'s `load_jobs` function uses `if/elif` blocks to handle `.json` and `.csv` files.
- **Target Implementation:** Implement a `JobParserStrategy` interface with `CSVJobParser` and `JSONJobParser` concrete strategies. A `JobLoader` context class will use the appropriate strategy based on the file extension.
- **Benefit:** Adding support for `.yaml` or a database connection later requires adding a new strategy class, fulfilling the Open/Closed Principle.

### 2.3 The Builder Pattern

- **Current State:** `generate_image` in `pipeline.py` deeply copies a massive JSON dictionary and manually assigns keys (e.g., `workflow["11"]["inputs"]["text"] = pos_prompt`). This is brittle and ComfyUI-workflow-specific.
- **Target Implementation:** Create a `ComfyWorkflowBuilder` class. It will expose fluent methods like `.set_positive_prompt(text)`, `.set_dimensions(width, height)`, and `.set_seed(seed)`.
- **Benefit:** Encapsulates the messy dictionary manipulation. If the ComfyUI workflow changes (e.g., Node 11 becomes Node 42), only the `ComfyWorkflowBuilder` class needs updating.

### 2.4 The Observer Pattern (Pub/Sub)

- **Application:** WebSocket Progress Streaming.
- **Target Implementation:** When the FastAPI server receives a websocket stream from ComfyUI, it acts as a Publisher. Connected Next.js clients (Subscribers) listen for specific events (`executing`, `progress`, `completed`).
- **Benefit:** Decouples the frontend tracking UI from the backend generation loop. Multiple frontend clients can observe the same generation job simultaneously.

---

## 3. Frontend Design Patterns (Next.js / React)

The React frontend must manage complex local state (the prompt builder) and asynchronous remote state (jobs, galleries) without becoming a monolithic "spaghetti" codebase.

### 3.1 Custom Hooks (The Container / Presentational Pattern)

- **Application:** Separating UI rendering from business logic.
- **Target Implementation:** Instead of putting `fetch` calls and WebSocket listeners directly inside React components, extract them into custom hooks (e.g., `useGenerateImage`, `useComfyWebsocket`, `useDictionaries`).
- **Benefit:** Components become purely presentational ("dumb" components), making them highly reusable and easy to test. The logic ("smart" containers) is encapsulated in the hooks.

### 3.2 Compound Components Pattern

- **Application:** The Prompt Builder UI.
- **Target Implementation:** The Prompt Builder involves text areas, tokenized chips, and dropdown menus working together. Instead of passing dozens of props into a single `<PromptBuilder />` component, we use compound components:
  ```tsx
  <PromptBuilder>
    <PromptBuilder.Toolbar />
    <PromptBuilder.InputArea />
    <PromptBuilder.TokenList />
  </PromptBuilder>
  ```
- **Benefit:** Prevents "prop drilling" and provides immense flexibility in how the UI is composed and styled in the future without breaking the internal state logic.

### 3.3 The Store / Flux Pattern (via Zustand)

- **Application:** Global application state.
- **Target Implementation:** Create isolated state slices using Zustand.
  - `usePromptStore`: Manages the current prompt string, selected dictionary tokens, and generation parameters (width/height).
  - `useJobStore`: Manages the queue of running/pending tasks.
- **Benefit:** Avoids passing state up and down the React tree. Components can subscribe only to the specific piece of state they care about, minimizing unnecessary re-renders.

### 3.4 API Adapter / Repository Pattern

- **Application:** Data fetching (using React Query).
- **Target Implementation:** All HTTP calls to the FastAPI backend are wrapped in an `ApiClient` class or utility object. React Query uses this client to fetch, cache, and mutate data.
- **Benefit:** Centralizes API configurations (like base URLs, authentication headers, and error handling). If the API route changes from `/api/generate` to `/v2/generate`, it is updated in exactly one place.

---

## 4. Applying SOLID Principles to the Codebase

Here is how the team will enforce SOLID during development:

1.  **Single Responsibility Principle (SRP):**
    - _Rule:_ A file like `pipeline.py` should not handle both file reading (CSV/JSON parsing) and WebSocket communications.
    - _Action:_ Split `pipeline.py` into `job_parser.py`, `workflow_builder.py`, and `job_runner.py`.
2.  **Open/Closed Principle (OCP):**
    - _Rule:_ Adding a new dictionary category (e.g., "OUTFITS") should not require changing the UI code.
    - _Action:_ The UI will dynamically render dropdowns based on the keys returned by the `GET /api/dictionaries` endpoint, not hardcoded React components.
3.  **Liskov Substitution Principle (LSP):**
    - _Rule:_ Any new AI generation endpoint must guarantee the same output format.
    - _Action:_ Whether an image is generated via `run_dynamic_pipeline` or `run_manual_pipeline`, both must return a standardized `GenerationResult` object containing the file path and metadata.
4.  **Interface Segregation Principle (ISP):**
    - _Rule:_ Do not force frontend components to depend on data they don't use.
    - _Action:_ The `ImageGallery` component receives a strict `ImageProps` interface (just URL and alt text), while the `MetadataInspector` receives the full `GenerationMetadata` interface.
5.  **Dependency Inversion Principle (DIP):**
    - _Rule:_ High-level React components should depend on interfaces, not implementations.
    - _Action:_ Next.js components depend on React Query hooks (the abstraction), not the raw `fetch` API (the low-level implementation).

---

## 5. Modular Directory Structure

To support these patterns, the codebase will be restructured as follows:

### Backend (Python)

```text
Backend/
 ┣ api/                 # FastAPI routes (Controllers)
 ┃ ┣ __init__.py
 ┃ ┣ generate.py
 ┃ ┗ websockets.py
 ┣ core/                # Business logic & Builders
 ┃ ┣ workflow_builder.py# Builder Pattern for ComfyUI JSON
 ┃ ┗ prompt_engine.py   # NLP and Tag merging logic
 ┣ adapters/            # External connections (Adapter/Facade)
 ┃ ┣ comfy_client.py    # Wraps websocket and REST calls
 ┃ ┗ job_parsers.py     # Strategy Pattern for JSON/CSV loading
 ┣ models/              # Pydantic Schemas (Data Transfer Objects)
 ┃ ┗ schemas.py
 ┗ main.py              # FastAPI application entry point
```

### Frontend (Next.js)

```text
src/
 ┣ lib/                 # Core utilities
 ┃ ┣ api-client.ts      # API Adapter Pattern
 ┃ ┗ ws-client.ts       # WebSocket connection manager
 ┣ hooks/               # Custom Hooks (Container Pattern)
 ┃ ┣ useGenerate.ts
 ┃ ┗ useDictionaries.ts
 ┣ store/               # Zustand (Flux Pattern)
 ┃ ┣ promptStore.ts
 ┃ ┗ jobStore.ts
 ┣ components/
 ┃ ┣ ui/                # Dumb/Presentational components (Buttons, Inputs)
 ┃ ┗ features/          # Smart/Compound components (PromptBuilder, Gallery)
 ┗ app/                 # Next.js Pages (Routing)
```
