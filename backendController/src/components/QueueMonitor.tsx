import React, { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";

export const QueueMonitor: React.FC = () => {
  const [stats, setStats] = useState({
    queued: 0,
    executing: 0,
    completed: 0,
    total: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiClient.getQueueStats();
        setStats(data);
      } catch (err) {
        console.error("Queue monitor error:", err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
        Server Queue
      </h3>
      <div className="grid grid-cols-3 gap-4">
        <StatBox
          label="Executing"
          value={stats.executing}
          color="text-emerald-400"
        />
        <StatBox label="Queued" value={stats.queued} color="text-amber-400" />
        <StatBox
          label="Completed"
          value={stats.completed}
          color="text-indigo-400"
        />
      </div>
    </div>
  );
};

const StatBox = ({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) => (
  <div className="flex flex-col bg-black/20 rounded-lg p-3 border border-white/5">
    <span className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">
      {label}
    </span>
    <span className={`text-2xl font-light ${color}`}>{value}</span>
  </div>
);
