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
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 flex flex-wrap sm:flex-nowrap gap-1.5">
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 min-w-[100px] py-3 px-4 rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wide transition-all border ${
              mode === "manual"
                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            }`}
          >
            Manual
          </button>
          <button
            onClick={() => setMode("batch")}
            className={`flex-1 min-w-[100px] py-3 px-4 rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wide transition-all border ${
              mode === "batch"
                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            }`}
          >
            Batch
          </button>
          <button
            onClick={() => setMode("dynamic")}
            className={`flex-1 min-w-[100px] py-3 px-4 rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wide transition-all border ${
              mode === "dynamic"
                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            }`}
          >
            Pipeline
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
