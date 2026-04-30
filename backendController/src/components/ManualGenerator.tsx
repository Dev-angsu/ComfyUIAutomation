import React, { useState, useRef, useEffect } from "react";
import { apiClient, PromptCollection } from "../lib/api-client";
import { useSettings } from "../lib/settings-context";
import { useToast } from "../lib/toast-context";

const AutoResizeTextarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minHeight?: string }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [props.value]);

  const { minHeight, className, ...rest } = props;
  return (
    <textarea
      ref={ref}
      {...rest}
      style={{ minHeight: minHeight || "80px" }}
      className={`${className} overflow-hidden resize-none`}
    />
  );
};

export const ManualGenerator: React.FC = () => {

  const { addToast } = useToast();
  const { settings, updateSettings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [lastTask, setLastTask] = useState<string | null>(null);
  const [batchCount, setBatchCount] = useState(1);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("Studio Prompt");
  const [saveCollectionId, setSaveCollectionId] = useState<number | undefined>(undefined);
  const [availableCollections, setAvailableCollections] = useState<PromptCollection[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const promises = Array.from({ length: batchCount }).map(() =>
        apiClient.generateSingle({
          positive_prompt: settings.positivePrompt,
          negative_prompt: settings.negativePrompt,
          params: { 
            width: settings.width, 
            height: settings.height, 
            steps: settings.steps,
            workflow: settings.workflow 
          },
        })
      );
      const results = await Promise.all(promises);
      setLastTask(results[results.length - 1].task_id);
      addToast(`Successfully queued ${batchCount} task${batchCount > 1 ? "s" : ""}.`, "success");
    } catch (err) {
      addToast("Failed to dispatch job. Check console.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSave = async () => {
    setShowSaveModal(true);
    try {
      const cols = await apiClient.getCollections();
      setAvailableCollections(cols);
    } catch (err) {
      console.error("Failed to fetch collections", err);
    }
  };

  const handleSave = async () => {
    try {
      await apiClient.createPrompt({
        name: saveName || "Unnamed Prompt",
        positive_prompt: settings.positivePrompt,
        negative_prompt: settings.negativePrompt,
        width: settings.width,
        height: settings.height,
        steps: settings.steps,
        collection_id: saveCollectionId
      });
      addToast("✨ Prompt saved to Prompts Zone!", "success");
      setShowSaveModal(false);
    } catch (err) {
      addToast("Failed to save prompt.", "error");
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
        <AutoResizeTextarea
          minHeight="100px"
          className="bg-black/40 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
          value={settings.positivePrompt}
          onChange={(e) => updateSettings({ positivePrompt: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Negative Prompt
        </label>
        <AutoResizeTextarea
          minHeight="60px"
          className="bg-black/40 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono"
          value={settings.negativePrompt}
          onChange={(e) => updateSettings({ negativePrompt: e.target.value })}
        />
      </div>

      <div className="pt-2 flex items-center justify-between">
        <div className="text-xs text-emerald-400 font-mono">
          {lastTask ? `✓ Dispatched: ${lastTask.substring(0, 8)}...` : ""}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Batch
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={batchCount}
              onChange={(e) => setBatchCount(Number(e.target.value))}
              className="bg-black/40 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50 w-16 text-center"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenSave}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium py-2.5 px-4 rounded-lg transition-all border border-zinc-700/50 flex items-center gap-2"
              title="Save to Prompts Zone"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLineJoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
              Save
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2.5 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(79,70,229,0.15)]"
            >
              {loading ? "Queuing..." : "Generate"}
            </button>
          </div>
        </div>
      </div>

      {/* Save Prompt Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-300 text-left">
            <h2 className="text-2xl font-bold text-white mb-6">Save Studio Prompt</h2>
            
            <div className="space-y-6 mb-10">
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest block">Prompt Name</label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="w-full bg-black/40 border border-zinc-800 rounded-2xl p-4 text-white placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest block">Collection (Optional)</label>
                <select
                  value={saveCollectionId || ""}
                  onChange={(e) => setSaveCollectionId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full bg-black/40 border border-zinc-800 rounded-2xl p-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all appearance-none"
                >
                  <option value="">No Collection</option>
                  {availableCollections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-8 py-4 rounded-2xl text-zinc-400 font-bold hover:bg-zinc-800 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
              >
                Save Prompt
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};
