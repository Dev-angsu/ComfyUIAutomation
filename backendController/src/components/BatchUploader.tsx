import React, { useState, useRef } from "react";
import { useLocalStorage } from "../lib/useLocalStorage";
import { apiClient } from "../lib/api-client";
import { useSettings } from "../lib/settings-context";
import { useToast } from "../lib/toast-context";

export const BatchUploader: React.FC = () => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastBatch, setLastBatch] = useState<string | null>(null);
  
  // Randomization Settings (Persisted)
  const [randomizeSize, setRandomizeSize] = useLocalStorage("batch_randomize_size", false);
  const [minRatio, setMinRatio] = useLocalStorage("batch_min_ratio", 0.5);
  const [maxRatio, setMaxRatio] = useLocalStorage("batch_max_ratio", 2.0);
  const [minRes, setMinRes] = useLocalStorage("batch_min_res", 512);
  const [maxRes, setMaxRes] = useLocalStorage("batch_max_res", 1024);

  const { settings } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setLastBatch(null);
    }
  };

  const handleExecute = async () => {
    if (!selectedFile) return;

    setLoading(true);
    try {
      const res = await apiClient.uploadCSVBatch(selectedFile, {
        width: settings.width,
        height: settings.height,
        steps: settings.steps,
        workflow: settings.workflow,
      }, {
        randomize_size: randomizeSize,
        min_ratio: minRatio,
        max_ratio: maxRatio,
        min_res: minRes,
        max_res: maxRes,
      });
      setLastBatch(res.batch_id);
      setSelectedFile(null); // Clear after success
      if (fileInputRef.current) fileInputRef.current.value = "";
      addToast("Batch job queued successfully!", "success");
    } catch (err) {
      console.error(err);
      addToast("Failed to upload batch. Check backend console.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-medium text-zinc-100 mb-1">
            Batch Jobs (CSV/JSON)
          </h2>
          <p className="text-sm text-zinc-500">
            Upload a jobs.csv or jobs.json file to enqueue multiple tasks at once.
          </p>
        </div>
      </div>

      {/* Randomization Section */}
      <div className="bg-black/20 border border-zinc-800/50 rounded-xl p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${randomizeSize ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-500'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round">
                <path d="M21 16V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"></path>
                <path d="M7 12h10"></path>
                <path d="M12 7v10"></path>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">Randomize Aspect Ratio & Resolution</h3>
              <p className="text-xs text-zinc-500">Each image in the batch will get unique dimensions</p>
            </div>
          </div>
          <button
            onClick={() => setRandomizeSize(!randomizeSize)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${randomizeSize ? 'bg-indigo-600' : 'bg-zinc-700'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${randomizeSize ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {randomizeSize && (
          <div className="grid grid-cols-2 gap-4 mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Aspect Ratio Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={minRatio}
                  onChange={(e) => setMinRatio(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50"
                  placeholder="Min (e.g. 0.5)"
                />
                <span className="text-zinc-600">to</span>
                <input
                  type="number"
                  step="0.1"
                  value={maxRatio}
                  onChange={(e) => setMaxRatio(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50"
                  placeholder="Max (e.g. 2.0)"
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Resolution (Long Edge)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={minRes}
                  onChange={(e) => setMinRes(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50"
                  placeholder="Min (e.g. 512)"
                />
                <span className="text-zinc-600">to</span>
                <input
                  type="number"
                  value={maxRes}
                  onChange={(e) => setMaxRes(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50"
                  placeholder="Max (e.g. 1024)"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".csv,.json"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium py-2.5 px-6 rounded-lg transition-all cursor-pointer border border-zinc-700 hover:border-zinc-600"
          >
            {selectedFile ? "Change File" : "Select Batch File"}
          </label>

          {selectedFile && (
            <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round" className="text-indigo-400">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                <polyline points="13 2 13 9 20 9"></polyline>
              </svg>
              <span className="text-xs font-mono text-indigo-300 truncate max-w-[200px]">
                {selectedFile.name}
              </span>
            </div>
          )}

          {lastBatch && (
            <span className="text-xs text-emerald-400 font-mono">
              ✓ Batch {lastBatch.substring(0, 8)}... queued
            </span>
          )}
        </div>

        {selectedFile && (
          <button
            onClick={handleExecute}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold py-4 rounded-lg transition-all shadow-[0_0_20px_rgba(79,70,229,0.2)] flex items-center justify-center gap-2 group"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                Executing Batch...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round" className="group-hover:scale-110 transition-transform">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Run Batch Job
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
