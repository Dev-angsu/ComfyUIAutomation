# AI Studio — Full-Stack Implementation Plan

## Executive Summary

Transform the existing Python CLI automation into a professional **AI Studio** web application. The system interfaces with a local ComfyUI instance, backed by a PostgreSQL + Redis data layer, a refactored FastAPI backend following Clean Architecture and SOLID principles, and a Next.js (App Router) frontend with a 3-pane Figma/Blender-like workspace.

> [!IMPORTANT]
> The existing `demodictionary.json` contains explicit adult content (NSFW sexual/violent descriptions in `POSE`, `PLACE` arrays). This plan is **content-agnostic** — the app is a neutral generation tool. Content moderation/filtering is out of scope unless you request it. The dictionary seeder will load whatever is present in the file.

---

## Finalized Decisions

| Question | Decision |
|----------|----------|
| Database | ✅ Create new `ai_studio` DB (Phase 2) |
| ComfyUI Output | ✅ Windows path `F:\ComfyUI_windows_portable...\output` — **platform-agnostic via ComfyUI's own `/view` HTTP API** (no filesystem mounting) |
| Phase 1 Scope | ✅ File-based only — DB added in Phase 2 |
| Dictionary Content | ✅ Seed `demodictionary.json` as-is |
| Frontend Port | ✅ `localhost:3000` |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Next.js 14 (App Router) — Frontend (localhost:3000)    │
│  Zustand · React Query · Shadcn UI · TailwindCSS        │
│  3-Pane: LeftSidebar | Canvas (Studio/Jobs/Gallery)     │
│                         | RightSidebar (Params)         │
└────────────────┬────────────────────────────────────────┘
                 │ REST + WebSocket
┌────────────────▼────────────────────────────────────────┐
│  FastAPI Backend (localhost:8000)                       │
│  ┣ api/          — Routers (REST endpoints)             │
│  ┣ core/         — Business Logic (Builder, Engine)     │
│  ┣ adapters/     — ComfyUI Adapter, Job Parsers         │
│  ┣ db/           — SQLAlchemy ORM, Repository Pattern   │
│  ┣ models/       — Pydantic Schemas (DTOs)              │
│  ┗ workers/      — Background Task Runners              │
└──────┬──────────────────────────┬───────────────────────┘
       │                          │
┌──────▼──────┐          ┌───────▼───────┐
│  PostgreSQL │          │     Redis     │
│  ai_studio  │          │  Queue/Cache  │
└─────────────┘          └───────────────┘
                                 │
┌───────────────────────────────▼────────┐
│    ComfyUI Server (192.168.101.15:8188)│
│    REST + WebSocket                    │
└────────────────────────────────────────┘
```

---

## Proposed Changes

### Phase 1 — Backend Refactor (FastAPI + Clean Architecture)
*Goal: Replace CLI Python scripts with a production-grade FastAPI server. No DB yet — uses files for initial testing.*

---

#### [MODIFY] Backend directory — Full restructure

**Current structure:**
```
Backend/
  app.py, client.py, pipeline.py, prompts.py, config.py
```

**Target structure:**
```
Backend/
  ┣ api/
  ┃ ┣ __init__.py
  ┃ ┣ generate.py       # POST /api/generate, POST /api/batch/dynamic, POST /api/batch/csv
  ┃ ┣ dictionaries.py   # GET /api/dictionaries, POST /api/dictionaries/{category}
  ┃ ┣ gallery.py        # GET /api/gallery (paginated)
  ┃ ┣ models_list.py    # GET /api/models (UNET, VAE, CLIP lists from ComfyUI)
  ┃ ┗ websockets.py     # WS /ws/progress/{task_id}
  ┣ core/
  ┃ ┣ workflow_builder.py  # Builder Pattern — fluent API for ComfyUI workflow JSON
  ┃ ┗ prompt_engine.py     # Prompt assembly, tag ordering, NLP merging
  ┣ adapters/
  ┃ ┣ comfy_client.py      # Async Adapter/Facade over ComfyUI REST + WS
  ┃ ┗ job_parsers.py       # Strategy Pattern — CSV / JSON / DB loaders
  ┣ db/
  ┃ ┣ database.py          # SQLAlchemy async engine + session factory
  ┃ ┣ models.py            # ORM models (all tables)
  ┃ ┣ repositories/
  ┃ ┃ ┣ task_repo.py
  ┃ ┃ ┣ batch_repo.py
  ┃ ┃ ┗ image_repo.py
  ┃ ┗ migrations/          # Alembic
  ┣ models/
  ┃ ┗ schemas.py           # Pydantic DTOs
  ┣ workers/
  ┃ ┗ queue_worker.py      # Background task runner (Redis BLPOP loop)
  ┣ main.py                # FastAPI app entry point
  ┣ config.py              # Pydantic Settings (env-based)
  ┗ requirements.txt       # Updated deps
```

**Key files to create/modify:**

#### [MODIFY] `Backend/config.py`
Convert to `pydantic-settings` `BaseSettings` class reading from `.env`:
```python
class Settings(BaseSettings):
    comfy_server: str = "192.168.101.15:8188"
    db_host: str = "localhost"
    db_name: str = "ai_studio"
    redis_url: str = "redis://default@127.0.0.1:6379"
    comfy_output_dir: str = "/path/to/comfyui/output"
    ...
```

#### [NEW] `Backend/adapters/comfy_client.py`
- `ComfyUIAdapter` class implementing `IAIEngine` protocol
- `async queue_prompt(workflow: dict) -> str` — returns `prompt_id`
- `async stream_progress(prompt_id, ws_callback)` — async websocket listener
- `async get_models() -> dict` — fetches UNET/VAE/CLIP lists from ComfyUI `/object_info`

#### [NEW] `Backend/core/workflow_builder.py`
- `ComfyWorkflowBuilder` with fluent methods:
  - `.set_positive_prompt(text: str)`
  - `.set_negative_prompt(text: str)`
  - `.set_dimensions(w: int, h: int)`
  - `.set_seed(seed: int)`
  - `.set_sampler(steps, cfg, sampler_name, scheduler, denoise)`
  - `.set_models(unet, vae, clip)`
  - `.build() -> dict` — returns the complete workflow JSON

#### [NEW] `Backend/adapters/job_parsers.py`
- `IJobParser` protocol with `parse(source) -> list[dict]`
- `CSVJobParser`, `JSONJobParser`, `DBJobParser` (later)
- `JobLoader` context class with `get_parser(source_type)` factory

#### [NEW] `Backend/models/schemas.py`
Pydantic models (DTOs):
- `GenerationRequest` — single manual job
- `DynamicBatchRequest` — count + template_id
- `CSVBatchRequest` — list of job rows
- `GenerationResult` — standardized output (file_path, seed, prompt_id)
- `TaskStatusResponse`, `BatchStatusResponse`
- `ImageMetadata`, `GalleryPage` (paginated)

#### [NEW] `Backend/api/generate.py`
- `POST /api/generate` — manual single job → background task → returns `task_id`
- `POST /api/batch/dynamic` — dynamic batch → returns `batch_id`
- `POST /api/batch/csv` — CSV job list → returns `batch_id`
- `GET /api/tasks/{task_id}` — task status (reads Redis first, falls back to DB)

#### [NEW] `Backend/api/websockets.py`
- `WS /ws/progress/{task_id}` — relay Redis Pub/Sub events to the connected Next.js client
- Observer pattern: FastAPI subscribes to `ws:progress:{task_id}` Redis channel

#### [NEW] `Backend/main.py`
- FastAPI app with CORS restricted to `localhost:3000`
- Mount ComfyUI output dir as `/static/outputs` for image serving
- Include all routers
- Startup event: initialize Redis connection pool, DB engine

---

### Phase 2 — Database Layer (PostgreSQL + Redis)
*Goal: Persistent storage for all jobs, tasks, images, and configuration.*

#### [NEW] `Backend/db/models.py`
SQLAlchemy ORM models matching the DB PRD schema:
- `DictionaryCategory`, `DictionaryTerm`
- `DynamicTemplate`
- `JobBatch` (with SQLAlchemy ENUMs: `BatchType`, `BatchStatus`)
- `GenerationTask` (with JSONB `workflow_config`, `TaskStatus` enum)
- `Image` (with JSONB `generation_meta`, soft-delete `deleted_at`)

#### [NEW] `Backend/db/database.py`
- Async SQLAlchemy engine: `create_async_engine(settings.db_url)`
- `AsyncSession` factory
- `get_db()` FastAPI dependency

#### [NEW] `Backend/db/repositories/`
Repository pattern — one file per aggregate:
- `TaskRepository`: `create_task`, `update_status`, `get_by_id`
- `BatchRepository`: `create_batch`, `update_batch_status`
- `ImageRepository`: `create_image`, `list_paginated`, `soft_delete`, `toggle_favorite`
- `DictionaryRepository`: `list_categories`, `list_terms`, `add_term`

#### [NEW] `Backend/db/migrations/`
- Alembic with `alembic init migrations`
- Initial migration creating all tables with ENUMs, indexes, FKs

#### [NEW] `Backend/workers/queue_worker.py`
- `async run_generation_worker()` — BLPOP `queue:generation:pending`
- On pop: update Redis `task:status:{id}`, call ComfyUI adapter, publish progress to `ws:progress:{id}`
- On completion: write `Image` record + update `GenerationTask` in a single DB transaction

#### [NEW] `scripts/seed_dictionaries.py`
- One-off script to read `Jobs/demodictionary.json` and INSERT into `dictionary_categories` + `dictionary_terms` + `dynamic_templates`

#### [NEW] `scripts/sync_gallery.py`
- Scans ComfyUI output directory, reads PNG `tEXt` metadata chunks, backfills `images` table

---

### Phase 3 — Frontend (Next.js 14, App Router)
*Goal: The 3-pane professional dark-mode Studio UI.*

#### [NEW] `frontend/` directory
Initialized with `create-next-app` + Shadcn UI + TailwindCSS.

**Directory structure:**
```
frontend/src/
  ┣ app/
  ┃ ┣ layout.tsx           # Root layout — 3-pane shell
  ┃ ┣ page.tsx             # Studio (default route)
  ┃ ┣ jobs/page.tsx        # Batch Manager
  ┃ ┗ gallery/page.tsx     # History Vault
  ┣ components/
  ┃ ┣ layout/
  ┃ ┃ ┣ LeftSidebar.tsx    # Nav + Dictionary Explorer
  ┃ ┃ ┣ RightSidebar.tsx   # Generation Parameters Panel
  ┃ ┃ ┣ BottomPanel.tsx    # Queue + Console (collapsible)
  ┃ ┃ ┗ MainLayout.tsx     # 3-pane wrapper
  ┃ ┣ studio/
  ┃ ┃ ┣ PromptBuilder/
  ┃ ┃ ┃ ┣ index.tsx        # Compound component root
  ┃ ┃ ┃ ┣ Toolbar.tsx
  ┃ ┃ ┃ ┣ NaturalLanguageInput.tsx
  ┃ ┃ ┃ ┣ TokenList.tsx    # Tag chips
  ┃ ┃ ┃ ┗ LivePreview.tsx  # Read-only synthesized prompt
  ┃ ┃ ┣ DynamicTemplateEditor.tsx
  ┃ ┃ ┣ Viewport.tsx       # Image + progress overlay
  ┃ ┃ ┗ GenerateButton.tsx
  ┃ ┣ gallery/
  ┃ ┃ ┣ ImageGrid.tsx      # Masonry gallery
  ┃ ┃ ┣ ImageCard.tsx
  ┃ ┃ ┗ MetadataInspector.tsx  # Side-panel on click
  ┃ ┣ jobs/
  ┃ ┃ ┣ JobTable.tsx       # TanStack Table grid
  ┃ ┃ ┣ CSVUploader.tsx    # Dropzone
  ┃ ┃ ┗ StatusBadge.tsx    # Pulsing dot indicators
  ┃ ┗ ui/                  # Shadcn/Radix primitives (auto-generated)
  ┣ hooks/
  ┃ ┣ useGenerate.ts       # POST /api/generate + WebSocket subscribe
  ┃ ┣ useDictionaries.ts   # React Query for GET /api/dictionaries
  ┃ ┣ useGallery.ts        # Infinite scroll gallery
  ┃ ┣ useModels.ts         # Model list fetcher
  ┃ ┗ useComfyWebsocket.ts # WS connection manager
  ┣ store/
  ┃ ┣ promptStore.ts       # Zustand: prompt string, tokens, params
  ┃ ┣ jobStore.ts          # Zustand: active queue
  ┃ ┗ uiStore.ts           # Zustand: sidebar collapsed states
  ┣ lib/
  ┃ ┣ api-client.ts        # Centralized fetch wrapper (base URL, error handling)
  ┃ ┗ ws-client.ts         # WebSocket manager singleton
  ┗ styles/
    ┗ globals.css          # Color tokens, typography (Inter + JetBrains Mono)
```

**Color Palette (CSS Custom Properties):**
```css
--bg-app: #0E1117;
--surface: #1A1D24;
--border: #2D3139;
--accent: #6366F1;       /* Indigo primary */
--accent-amber: #F59E0B;
--text-primary: #E2E8F0;
--text-muted: #94A3B8;
```

---

### Phase 4 — Integration & Real-Time Features
*Goal: Wire frontend to backend; implement live WebSocket progress.*

#### [MODIFY] `frontend/src/hooks/useComfyWebsocket.ts`
- Connects to `ws://localhost:8000/ws/progress/{task_id}`
- Emits events: `{ type: 'progress', pct: 45, node: '11' }`, `{ type: 'completed', image_url: '...' }`
- Used by `Viewport.tsx` to animate the slim progress bar

#### [MODIFY] `frontend/src/components/studio/Viewport.tsx`
- Slim 3px progress line at top (CSS transition on `width`)
- Smooth opacity fade-in on image completion

#### API Routes (Next.js minimal API — just for auth/env protection):
- `app/api/proxy/[...path]/route.ts` — optional thin proxy to avoid exposing raw FastAPI to browser

---

### Phase 5 — Polish, Models Management & Scalability
*Goal: Advanced features, model hot-swap, and production-readiness.*

- **Model Selection Panel:** `GET /api/models` → ComfyUI `/object_info` endpoint to dynamically list available UNET/VAE/CLIP models
- **Dictionary Manager:** Add/remove terms via the UI (API → DB → Redis cache invalidation)
- **Favorites & Soft Delete:** Gallery curation with `is_favorited` toggle and soft delete
- **CRON/Watchdog**: Daily cleanup of orphaned files (soft-deleted > 30 days)
- **Alembic Migrations**: Version-controlled schema with rollback support
- **Docker Compose**: Optional compose file for local Postgres + Redis

---

## Phased Rollout Schedule

| Phase | Deliverable | Acceptance Criteria |
|-------|-------------|---------------------|
| **1** | FastAPI server with ComfyUI adapter, routes, pydantic schemas, in-memory + file-based (no DB yet) | Can POST a job, job runs on ComfyUI, returns image filename |
| **2** | PostgreSQL schema + Redis queuing + Alembic migrations + seed scripts | All jobs + images tracked in DB; queue worker processes tasks asynchronously |
| **3** | Next.js 3-pane UI with Studio view, all layouts, prompt builder | App loads, shows dropdowns from API, prompt preview works, can hit generate |
| **4** | WebSocket progress streaming + Gallery + Batch Manager full integration | Real-time progress bar animates; gallery shows all images with metadata inspector |
| **5** | Model selection, dictionary manager UI, favorites, cleanup jobs | Full feature parity with PRD; codebase is extension-ready |

---

## Verification Plan

### Per Phase — Automated / CLI Tests
- Phase 1: `pytest backend/tests/` covering adapter, builder, parsers; manual `curl` to `/api/generate`
- Phase 2: `alembic upgrade head` runs cleanly; seed script populates DB; `redis-cli monitor` confirms queue operations
- Phase 3: `npm run dev` — Lighthouse mobile score, no TS errors, `next build` passes
- Phase 4: Browser test — trigger generation, observe slim progress bar animate, image fades in
- Phase 5: Full E2E flow — upload CSV, run batch, watch batch queue in bottom panel, visit gallery

### Manual Verification
- UI verified in browser at `localhost:3000` — 3-pane layout is responsive and collapsible
- ComfyUI queue visible at `192.168.101.15:8188` during generation confirms adapter works
- PostgreSQL `psql` query confirms `generation_tasks` and `images` rows are written correctly

---

## Open Questions

> [!IMPORTANT]
> 1. **Database name**: Use new `ai_studio` DB, or repurpose `valoStats` with a new schema? — please confirm
> 2. **ComfyUI output path**: What is the absolute path of ComfyUI's output folder on your machine/server so we can mount it correctly?
> 3. **Scope of Phase 1**: Should I immediately wire up DB in Phase 1, or keep it file-based and add DB in Phase 2 as planned? The phased approach lets you test the API faster.
> 4. **Content Dictionary**: The `demodictionary.json` has NSFW content. Do you want a default `safe` dictionary seeded, or seed exactly as-is?
> 5. **Frontend Port**: The CORS config will allow `localhost:3000` (Next.js default). Confirm this is acceptable.

