import React, { useState, useRef } from "react";
import { apiClient } from "../lib/api-client";
import { useSettings } from "../lib/settings-context";

export const DynamicPipelineUploader: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(10);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastBatch, setLastBatch] = useState<string | null>(null);
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
      const res = await apiClient.uploadJSONBatch(selectedFile, {
        width: settings.width,
        height: settings.height,
        steps: settings.steps,
      });
      setLastBatch(res.batch_id);
      setSelectedFile(null); // Clear after success
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error(err);
      alert("Failed to upload JSON batch. Check backend console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-zinc-100 mb-1">
          Dynamic Pipeline (JSON)
        </h2>
        <p className="text-sm text-zinc-500">
          Upload a JSON configuration file to trigger the dynamic generation pipeline.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Batch Count
            </label>
            <input
              type="number"
              min={1}
              max={500}
              className="bg-black/40 border border-zinc-800 rounded-lg p-2.5 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50 w-28"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </div>

          <div className="flex flex-col gap-2 flex-1 justify-end">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Config File
            </label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".json"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                id="json-upload"
              />
              <label
                htmlFor="json-upload"
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium py-2.5 px-6 rounded-lg transition-all cursor-pointer border border-zinc-700 hover:border-zinc-600 whitespace-nowrap"
              >
                {selectedFile ? "Change JSON" : "Select JSON"}
              </label>

              {selectedFile && (
                <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-lg truncate">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round" className="text-indigo-400 shrink-0">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                  </svg>
                  <span className="text-xs font-mono text-indigo-300 truncate">
                    {selectedFile.name}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {selectedFile && (
          <button
            onClick={handleExecute}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-lg transition-all shadow-[0_0_20px_rgba(79,70,229,0.2)] flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                Executing Pipeline...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                Execute Dynamic Pipeline
              </>
            )}
          </button>
        )}

        {lastBatch && (
          <div className="text-xs text-emerald-400 font-mono text-center">
            ✓ Pipeline enqueued with Batch ID: {lastBatch}
          </div>
        )}
      </div>
    </div>
  );
};
