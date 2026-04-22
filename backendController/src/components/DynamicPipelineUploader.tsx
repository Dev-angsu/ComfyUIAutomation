import React, { useState, useRef } from "react";
import { apiClient } from "../lib/api-client";

export const DynamicPipelineUploader: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(10);
  const [lastBatch, setLastBatch] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const res = await apiClient.uploadJSONBatch(file, count);
      setLastBatch(res.batch_id);
    } catch (err) {
      console.error(err);
      alert("Failed to upload JSON batch. Check backend console.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Reset input so the same file can be uploaded again if needed
      }
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-zinc-100 mb-1">
          Dynamic Pipeline (JSON)
        </h2>
        <p className="text-sm text-zinc-500">
          Upload a JSON configuration file to trigger the dynamic generation
          pipeline.
        </p>
      </div>

      <div className="flex items-end gap-4">
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

        <div className="flex items-center gap-4 pb-0.5">
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
            id="json-upload"
          />
          <label
            htmlFor="json-upload"
            className={`bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium py-2.5 px-6 rounded-lg transition-all cursor-pointer border border-zinc-700 hover:border-zinc-600 ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {loading ? "Uploading..." : "Select & Upload JSON"}
          </label>
          {lastBatch && (
            <span className="text-xs text-emerald-400 font-mono">
              ✓ Batch ID: {lastBatch.substring(0, 8)}... queued
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
