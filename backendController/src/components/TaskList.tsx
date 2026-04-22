import React, { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";

export const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await apiClient.getTasks();
        // Show the most recent 5 tasks
        setTasks(res.tasks.slice(0, 5));
      } catch (err) {
        console.error(err);
      }
    };

    fetchTasks();
    const interval = setInterval(fetchTasks, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-zinc-800">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Recent Tasks
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="bg-black/20 text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
            <tr>
              <th className="px-4 py-3 font-medium">Task ID</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Prompt Snippet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-zinc-600">
                  No active tasks
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr
                  key={task.id}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-[11px] text-zinc-300">
                    {task.id.split("-")[0]}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium tracking-wide ${task.status === "DONE" ? "bg-emerald-500/10 text-emerald-400" : task.status === "ERROR" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}
                    >
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs opacity-80 whitespace-normal break-words min-w-[250px]">
                    {task.positive_prompt}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
