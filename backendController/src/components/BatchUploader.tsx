import React, { useState, useRef } from "react";
import { apiClient } from "../lib/api-client";

export const BatchUploader: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [lastBatch, setLastBatch] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const res = await apiClient.uploadCSVBatch(file);
      setLastBatch(res.batch_id);
    } catch (err) {
      console.error(err);
      alert("Failed to upload batch. Check backend console.");
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
          Batch Jobs (CSV)
        </h2>
        <p className="text-sm text-zinc-500">
          Upload a jobs.csv file to enqueue multiple tasks at once.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <input
          type="file"
          accept=".csv"
          ref={fileInputRef}
          onChange={handleUpload}
          className="hidden"
          id="csv-upload"
        />
        <label
          htmlFor="csv-upload"
          className={`bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium py-2.5 px-6 rounded-lg transition-all cursor-pointer border border-zinc-700 hover:border-zinc-600 ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {loading ? "Uploading..." : "Select & Upload CSV"}
        </label>
        {lastBatch && (
          <span className="text-xs text-emerald-400 font-mono">
            ✓ Batch ID: {lastBatch.substring(0, 8)}... queued
          </span>
        )}
      </div>
    </div>
  );
};
