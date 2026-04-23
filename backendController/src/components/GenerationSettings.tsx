import React from "react";
import { useSettings } from "../lib/settings-context";

export const GenerationSettings: React.FC = () => {
  const { settings, updateSettings, isLoading } = useSettings();

  if (isLoading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 animate-pulse">
        <div className="h-6 w-32 bg-zinc-800 rounded mb-4"></div>
        <div className="space-y-4">
          <div className="h-10 bg-zinc-800 rounded"></div>
          <div className="h-10 bg-zinc-800 rounded"></div>
        </div>
      </div>
    );
  }

  const presets = [
    { name: "1:1 Square", width: 1024, height: 1024 },
    { name: "16:9 Landscape", width: 1344, height: 768 },
    { name: "9:16 Portrait", width: 768, height: 1344 },
    { name: "4:5 Portrait", width: 896, height: 1152 },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-6 shadow-xl">
      <div>
        <h2 className="text-lg font-medium text-zinc-100 mb-1 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round" className="text-indigo-400">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          Generation Parameters
        </h2>
        <p className="text-sm text-zinc-500">
          Global settings applied to all generation jobs.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Workflow Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Active Workflow
          </label>
          <div className="relative">
            <select
              value={settings.workflow}
              onChange={(e) => updateSettings({ workflow: e.target.value })}
              className="w-full bg-black/40 border border-zinc-800 rounded-lg p-2.5 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer"
            >
              {(settings.availableWorkflows || []).map((wf) => (
                <option key={wf} value={wf}>
                  {wf.replace(".json", "").charAt(0).toUpperCase() + wf.replace(".json", "").slice(1)}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round">
                <path d="m6 9 6 6 6-6"></path>
              </svg>
            </div>
          </div>
        </div>

        {/* Width Slider */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Width
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="64"
                max="4096"
                step="8"
                className="bg-black/40 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] font-mono text-zinc-300 w-20 focus:outline-none focus:border-indigo-500/50 text-right"
                value={settings.width}
                onChange={(e) => updateSettings({ width: Number(e.target.value) })}
              />
              <span className="text-[10px] text-zinc-600 font-medium">PX</span>
            </div>
          </div>
          <input
            type="range"
            min="64"
            max="2048"
            step="64"
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
            value={settings.width}
            onChange={(e) => updateSettings({ width: Number(e.target.value) })}
          />
        </div>

        {/* Height Slider */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Height
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="64"
                max="4096"
                step="8"
                className="bg-black/40 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] font-mono text-zinc-300 w-20 focus:outline-none focus:border-indigo-500/50 text-right"
                value={settings.height}
                onChange={(e) => updateSettings({ height: Number(e.target.value) })}
              />
              <span className="text-[10px] text-zinc-600 font-medium">PX</span>
            </div>
          </div>
          <input
            type="range"
            min="64"
            max="2048"
            step="64"
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
            value={settings.height}
            onChange={(e) => updateSettings({ height: Number(e.target.value) })}
          />
        </div>

        {/* Steps Slider */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Steps
            </label>
            <input
              type="number"
              min="1"
              max="150"
              step="1"
              className="bg-black/40 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] font-mono text-zinc-300 w-16 focus:outline-none focus:border-indigo-500/50 text-right"
              value={settings.steps}
              onChange={(e) => updateSettings({ steps: Number(e.target.value) })}
            />
          </div>
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
            value={settings.steps}
            onChange={(e) => updateSettings({ steps: Number(e.target.value) })}
          />
        </div>

        {/* Resolution Presets */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Resolution Presets
          </label>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => updateSettings({ width: preset.width, height: preset.height })}
                className={`text-[11px] font-medium py-2 px-3 rounded-lg border transition-all ${
                  settings.width === preset.width && settings.height === preset.height
                    ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-400 shadow-[0_0_10px_rgba(79,70,229,0.1)]"
                    : "bg-black/20 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
