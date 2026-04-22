import React from "react";
import { QueueMonitor } from "./components/QueueMonitor";
import { ManualGenerator } from "./components/ManualGenerator";
import { TaskList } from "./components/TaskList";
import { BatchUploader } from "./components/BatchUploader";
import { DynamicPipelineUploader } from "./components/DynamicPipelineUploader";

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-white">
            AI{" "}
            <span className="text-zinc-500 font-light">
              Studio BackendController
            </span>
          </h1>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            Backend Connected
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 flex flex-col gap-6">
          <ManualGenerator />
          <BatchUploader />
          <DynamicPipelineUploader />
        </div>
        <div className="lg:col-span-4 flex flex-col gap-6">
          <QueueMonitor />
          <TaskList />
        </div>
      </main>
    </div>
  );
}
