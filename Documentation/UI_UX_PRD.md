# UI/UX Product Requirements Document: AI Studio Interface

## 1. Vision & Design Philosophy

The interface must step away from the ubiquitous "single column chat-bot" or "Gradio/Streamlit" layouts typical of AI tools. Instead, it will adopt a **"Professional Workspace"** paradigm.

### Core Principles

- **Pro-Tool Aesthetic:** High information density balanced with clean typography and ample negative space. It should feel like a native desktop application (e.g., Figma, Blender, or Ableton).
- **Dark-Theme First:** As a creative, visually-driven application, the default theme should be a sophisticated dark mode (Deep charcoal/slate, not pure #000000) to allow generated images to pop.
- **Modular & Collapsible:** Users should be able to hide panels (like settings or job queues) to focus purely on the prompt crafting or the image gallery.
- **Tokenized Inputs:** Instead of raw, messy comma-separated strings for tags, recognized dictionary terms should render as dismissible UI "tokens" or "chips".

---

## 2. Global Layout Architecture (The 3-Pane System)

The application will utilize a full-viewport, 3-pane layout, ensuring all controls are accessible without excessive scrolling.

### 2.1 Left Sidebar: Navigation & Assets

- **Width:** Fixed (e.g., 240px), collapsible to icons only (64px).
- **Contents:**
  - Workspace Switcher: Studio (Creation), Batch Jobs (CSV Manager), Gallery (History).
  - Dictionary Explorer: A searchable tree-view of `dictionaries.json` (Artists, Styles, etc.) that users can drag-and-drop or click to insert into the active prompt.

### 2.2 Center Stage: The Canvas / Workspace

- **Width:** Fluid (flex-grow).
- **Contents (Studio Mode):**
  - **Prompt Builder:** A split input area.
    - _Top Section:_ Natural Language input (standard text area, elegant typography).
    - _Bottom Section:_ Tokenized Tag input. When a user selects from the dropdown, it appears as a chic visual chip (e.g., `[ 👤 Fern ]`, `[ 🎨 @wlop ]`).
  - **Live Preview:** A sleek, real-time read-only text block showing exactly what string will be sent to the backend.
  - **The Viewport:** A large central area displaying the currently generating image (with a sleek overlaid progress bar) or the most recently generated batch.

### 2.3 Right Sidebar: Parameters & Inspector

- **Width:** Fixed (e.g., 320px).
- **Contents:**
  - **Generation Settings:** Accordion-style menus for standard parameters (Width, Height, Batch Count).
  - **Advanced Overrides:** Seed inputs, CFG Scale, Steps (hidden by default under an "Advanced" toggle to avoid clutter).
  - **Primary Action:** A sticky, prominent **"Generate"** button at the bottom or top of this pane. It should have a subtle glowing hover state or a loading spinner integrated into the button when active.

### 2.4 Bottom Panel: Console & Queue (Optional/Collapsible)

- **Height:** Fixed (e.g., 200px), hidden by default.
- **Contents:** A tabular view of the current queue, displaying active jobs, completed jobs, and a terminal-style log output for advanced users to see backend websocket messages.

---

## 3. UI Component Specifications & Industry Practices

To achieve the "not made by AI" look, the UI must follow atomic design principles and utilize a headless component library (like Radix UI or Headless UI) styled with Tailwind CSS.

### 3.1 Color Palette (Professional Dark Mode)

- **Background (App):** `#0E1117` or `#121212` (Deep Slate).
- **Surface/Panels:** `#1A1D24` (Slightly lighter for elevation).
- **Borders:** `#2D3139` (Subtle 1px borders to separate panes, no heavy drop shadows).
- **Primary Accent:** `#6366F1` (Indigo) or `#F59E0B` (Amber). Used sparingly _only_ for active states, the Generate button, and progress bars.
- **Text:** `#E2E8F0` (Primary), `#94A3B8` (Secondary/Muted).

### 3.2 Typography

- **UI Elements (Buttons, Labels):** _Inter_ or _Geist_ (Clean, modern sans-serif).
- **Prompts & Code/JSON Previews:** _JetBrains Mono_ or _Fira Code_ (Monospace for technical accuracy and a "hacker/pro" feel).

### 3.3 The Prompt Builder (Core Interaction)

- **Auto-complete Combobox:** When a user types `/` or `@` in the text area, a sleek floating popover appears (Cmd+K style palette) allowing instant keyboard-navigable filtering of the `dictionaries.json`.
- **Visual Modularity:** The "Dynamic Templates" should be represented as visual blocks. E.g., a sentence where variables are dropdowns directly inline with the text.
  - _Example:_ `1girl,` `[ Dropdown: CHARACTER ]` `,` `[ Dropdown: ARTIST ]`

### 3.4 Data Grid (Batch Jobs View)

- Instead of a basic HTML table, use a high-performance grid (like AG-Grid or TanStack Table).
- Features: Resizable columns, sticky headers, inline editing (double-click a cell to edit the `natural_language` string).
- Status Indicators: Subtle pulsing dots (🟡 Queued, 🔵 Generating, 🟢 Done, 🔴 Error) next to each row.

---

## 4. Micro-Interactions & Feedback (The Polish)

The difference between a cheap app and a professional tool lies in the micro-interactions.

- **Websocket Progress Bar:** Do not use a generic chunky progress bar. Use a slim (2px-4px) line at the very top of the central canvas that smoothly animates across the screen as nodes complete.
- **Skeleton Loaders:** When fetching dictionaries or gallery images, show subtle shimmering wireframes (skeletons) rather than a spinning circle.
- **Toast Notifications:** For non-intrusive feedback (e.g., "Job Added to Queue", "Copied to Clipboard"), use sleek, dark toast notifications sliding in from the bottom right.
- **Image Reveal:** When an image finishes generating, fade it in smoothly (opacity transition over 300ms) rather than snapping it into existence.

---

## 5. Next.js Modular Architecture (Frontend Implementation)

To ensure the code is as modular as the design, organize the Next.js `app/` and `components/` directories atomically:

```text
src/
 ┣ components/
 ┃ ┣ ui/               # Generic, reusable styled components (Buttons, Inputs, Dialogs - e.g., Shadcn UI)
 ┃ ┣ layout/           # Sidebar, Topbar, MainLayout wrappers
 ┃ ┣ studio/           # Domain-specific: PromptBuilder, TagToken, DynamicTemplateEditor
 ┃ ┣ gallery/          # Domain-specific: ImageGrid, ImageModal, MetadataInspector
 ┃ ┗ jobs/             # Domain-specific: JobTable, CSVUploader
 ┣ hooks/              # Custom hooks (useComfyWebsocket, useDictionaries)
 ┣ store/              # Zustand global state (usePromptStore, useJobQueueStore)
 ┗ app/
   ┣ page.tsx          # Studio View (Main)
   ┣ jobs/             # Batch Manager View
   ┗ gallery/          # Vault/History View
```

### 5.1 Technology Recommendations for this UI

1.  **Framework:** Next.js (App Router) + React.
2.  **Styling:** Tailwind CSS (utility-first, ensures zero generic out-of-the-box CSS leakage).
3.  **Component Library:** **Shadcn UI** (It installs Radix UI components directly into your codebase, meaning you own the code and can customize it to look incredibly bespoke).
4.  **Icons:** **Lucide React** (Clean, consistent stroke-based icons).
5.  **State Management:** **Zustand** (Allows the Prompt Builder, Sidebar, and Generate Button to live in separate React components without prop-drilling).
