import React, { useState } from "react";
import { apiClient } from "../lib/api-client";
import { useSettings } from "../lib/settings-context";
import { useToast } from "../lib/toast-context";

export const ManualGenerator: React.FC = () => {
  const { addToast } = useToast();
  const { settings, updateSettings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [lastTask, setLastTask] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient.generateSingle({
        positive_prompt: settings.positivePrompt,
        negative_prompt: settings.negativePrompt,
        params: { 
          width: settings.width, 
          height: settings.height, 
          steps: settings.steps,
          workflow: settings.workflow 
        },
      });
      setLastTask(res.task_id);
    } catch (err) {
      addToast("Failed to dispatch job. Check console.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-6"
    >
      <div>
        <h2 className="text-lg font-medium text-zinc-100 mb-1">
          Studio Generation
        </h2>
        <p className="text-sm text-zinc-500">
          Draft your prompt and dispatch a job to the local queue.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Positive Prompt
        </label>
        <textarea
          rows={4}
          className="bg-black/40 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none font-mono"
          value={settings.positivePrompt}
          onChange={(e) => updateSettings({ positivePrompt: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Negative Prompt
        </label>
        <textarea
          rows={2}
          className="bg-black/40 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none font-mono"
          value={settings.negativePrompt}
          onChange={(e) => updateSettings({ negativePrompt: e.target.value })}
        />
      </div>

      <div className="pt-2 flex items-center justify-between">
        <div className="text-xs text-emerald-400 font-mono">
          {lastTask ? `✓ Dispatched: ${lastTask.substring(0, 8)}...` : ""}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2.5 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(79,70,229,0.15)]"
        >
          {loading ? "Queuing..." : "Generate Image"}
        </button>
      </div>
    </form>
  );
};
