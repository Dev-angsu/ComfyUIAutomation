import React, { useState, useRef } from "react";
import { apiClient } from "../lib/api-client";
import { useSettings } from "../lib/settings-context";
import { useToast } from "../lib/toast-context";

export const BatchUploader: React.FC = () => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
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
      const res = await apiClient.uploadCSVBatch(selectedFile, {
        width: settings.width,
        height: settings.height,
        steps: settings.steps,
        workflow: settings.workflow,
      });
      setLastBatch(res.batch_id);
      setSelectedFile(null); // Clear after success
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error(err);
      addToast("Failed to upload batch. Check backend console.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-zinc-100 mb-1">
          Batch Jobs (CSV/JSON)
        </h2>
        <p className="text-sm text-zinc-500">
          Upload a jobs.csv or jobs.json file to enqueue multiple tasks at once.
        </p>
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
            {selectedFile ? "Change File" : "Select File"}
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
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-lg transition-all shadow-[0_0_20px_rgba(79,70,229,0.2)] flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                Executing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Execute Batch Job
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
