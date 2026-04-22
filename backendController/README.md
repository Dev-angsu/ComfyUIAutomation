# AI Studio - Backend Controller (Frontend)

This is a lightweight React frontend built with Vite and Tailwind CSS to monitor and interact with the ComfyUI FastAPI Backend.

## Project Structure

```text
backendController/
├── src/
│   ├── components/      # React components (ManualGenerator, QueueMonitor, TaskList)
│   ├── lib/             # Utilities (api-client.ts)
│   ├── App.tsx          # Main application layout
│   ├── main.tsx         # React DOM entry point
│   └── index.css        # Tailwind CSS imports
├── package.json         # Project dependencies
├── vite.config.ts       # Vite bundler configuration
└── tailwind.config.js   # Tailwind styling config
```

## Prerequisites

- **Node.js** (v18 or higher)
- Your **FastAPI Backend** must be running locally on port `8000`.

## Installation

Navigate into this directory and install the dependencies:

```bash
cd backendController
npm install
```

## Running the Application

Start the development server:

```bash
npm run dev
```

The app will be available at: **http://localhost:3000**

## Connecting to the Backend

By default, `src/lib/api-client.ts` points to `http://localhost:8000/api`. Ensure your FastAPI backend has **CORS configured** to allow requests from `http://localhost:3000`.
