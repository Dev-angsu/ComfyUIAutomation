import React, { useState } from "react";
import { ManualGenerator } from "./ManualGenerator";
import { BatchUploader } from "./BatchUploader";
import { DynamicPipelineUploader } from "./DynamicPipelineUploader";
import { GenerationSettings } from "./GenerationSettings";
import { QueueMonitor } from "./QueueMonitor";

export const StudioWorkspace: React.FC = () => {
  const [mode, setMode] = useState<"manual" | "batch" | "dynamic">("manual");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
      <div className="lg:col-span-8 flex flex-col gap-6">
        {/* Tab Selection */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 flex gap-2">
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              mode === "manual"
                ? "bg-indigo-500/10 text-indigo-400"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Studio
          </button>
          <button
            onClick={() => setMode("batch")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              mode === "batch"
                ? "bg-indigo-500/10 text-indigo-400"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Batch Jobs (CSV/JSON)
          </button>
          <button
            onClick={() => setMode("dynamic")}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              mode === "dynamic"
                ? "bg-indigo-500/10 text-indigo-400"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Dynamic Pipeline (JSON)
          </button>
        </div>

        {/* Selected Component */}
        {mode === "manual" && <ManualGenerator />}
        {mode === "batch" && <BatchUploader />}
        {mode === "dynamic" && <DynamicPipelineUploader />}
      </div>
      
      <div className="lg:col-span-4 flex flex-col gap-6">
        <GenerationSettings />
        <QueueMonitor />
      </div>
    </div>
  );
};
