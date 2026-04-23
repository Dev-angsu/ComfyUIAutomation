import React, { useEffect, useState } from "react";
import { apiClient } from "../lib/api-client";

export const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const tasksPerPage = 5;

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await apiClient.getTasks();
        // Reverse the list to show the latest completed/enqueued tasks at the top
        const allTasks = res.tasks ? [...res.tasks].reverse() : [];
        setTasks(allTasks);
      } catch (err) {
        console.error(err);
      }
    };

    fetchTasks();
    const interval = setInterval(fetchTasks, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteTask = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation(); // Don't open the modal
    if (!window.confirm("Delete this task from history?")) return;
    
    try {
      await apiClient.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      alert("Failed to delete task");
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to clear ALL task history?")) return;
    
    try {
      await apiClient.deleteAllTasks();
      setTasks([]);
    } catch (err) {
      alert("Failed to clear tasks");
    }
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchQuery]);

  // Filtering logic
  const filteredTasks = tasks.filter((task) => {
    const matchesStatus =
      filterStatus === "ALL" || task.status === filterStatus;

    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      searchQuery === "" ||
      (task.id && task.id.toLowerCase().includes(searchLower)) ||
      (task.positive_prompt &&
        task.positive_prompt.toLowerCase().includes(searchLower)) ||
      (task.negative_prompt &&
        task.negative_prompt.toLowerCase().includes(searchLower)) ||
      (task.batch_id && task.batch_id.toLowerCase().includes(searchLower));

    return matchesStatus && matchesSearch;
  });

  const getTaskImageUrl = (task: any) => {
    if (!task) return "";
    let foundPath = "";

    // Deep recursive search to find the image URL, since ComfyUI responses are often heavily nested
    const searchForImage = (obj: any) => {
      if (foundPath || !obj || typeof obj !== "object") return;

      if (
        typeof obj.url === "string" &&
        (obj.url.includes(".png") ||
          obj.url.includes(".jpg") ||
          obj.url.includes(".webp") ||
          obj.url.includes("api/images"))
      ) {
        foundPath = obj.url;
        return;
      }
      if (typeof obj.image_url === "string") {
        foundPath = obj.image_url;
        return;
      }
      if (typeof obj.file_path === "string") {
        foundPath = obj.file_path;
        return;
      }

      Object.values(obj).forEach((val) => {
        if (typeof val === "object") searchForImage(val);
      });
    };

    searchForImage(task.result);
    searchForImage(task.output);
    searchForImage(task);

    if (!foundPath) return "";
    const baseUrl = foundPath.startsWith("http")
      ? foundPath
      : `http://localhost:8000${foundPath.startsWith("/") ? "" : "/"}${foundPath}`;

    // Use the unique task.id to bypass disk cache for identically named files
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}cb=${task.id}`;
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredTasks.length / tasksPerPage) || 1;
  const validPage = Math.min(currentPage, totalPages); // Ensure we don't land on an empty out-of-bounds page
  const indexOfLastTask = validPage * tasksPerPage;
  const indexOfFirstTask = indexOfLastTask - tasksPerPage;
  const currentTasks = filteredTasks.slice(indexOfFirstTask, indexOfLastTask);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-zinc-800 flex flex-col gap-4 sm:flex-row justify-between items-start sm:items-center">
        <div className="flex items-center gap-4">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Recent Tasks
          </h3>
          <span className="text-xs text-zinc-500 font-mono">
            Total: {filteredTasks.length}
          </span>
          {tasks.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-[10px] font-bold text-red-400/60 hover:text-red-400 px-2 py-1 rounded border border-red-500/10 hover:border-red-500/30 transition-all uppercase tracking-tighter ml-2"
            >
              Clear All
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-48">
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder-zinc-600"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLineJoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-black/40 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="QUEUED">Queued</option>
            <option value="EXECUTING">Executing</option>
            <option value="DONE">Finished</option>
            <option value="ERROR">Failed</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="bg-black/20 text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
            <tr>
              <th className="px-4 py-3 font-medium">Task ID</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Prompt Snippet</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-zinc-600">
                  {tasks.length === 0
                    ? "No active tasks"
                    : "No tasks match your filters"}
                </td>
              </tr>
            ) : (
              currentTasks.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="hover:bg-white/[0.03] transition-colors cursor-pointer"
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
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => handleDeleteTask(e, task.id)}
                      className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Delete Task"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-zinc-800 flex justify-between items-center bg-black/10">
          <button
            disabled={validPage === 1}
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-zinc-300 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-zinc-500 font-medium">
            Page {validPage} of {totalPages}
          </span>
          <button
            disabled={validPage === totalPages}
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-zinc-300 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50 rounded-t-xl">
              <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
                Task Details
              </h2>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLineJoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex flex-col gap-4 text-sm text-zinc-300">
              <div className="grid grid-cols-2 gap-4">
                <ModalField label="Task ID" value={selectedTask.id} isMono />
                <ModalField label="Status" value={selectedTask.status} />
                <ModalField
                  label="Type"
                  value={selectedTask.type || "Manual"}
                />
                <ModalField
                  label="Batch ID"
                  value={selectedTask.batch_id || "N/A"}
                  isMono
                />
                <ModalField
                  label="Width"
                  value={selectedTask.width || "Default"}
                />
                <ModalField
                  label="Height"
                  value={selectedTask.height || "Default"}
                />
                <ModalField
                  label="Seed"
                  value={selectedTask.seed || "Random"}
                />
                <ModalField
                  label="Steps"
                  value={selectedTask.steps || "Default"}
                />
                <ModalField
                  label="Workflow"
                  value={selectedTask.workflow || "anima.json"}
                />
                <ModalField
                  label="Comfy Prompt ID"
                  value={selectedTask.comfy_prompt_id || "Pending"}
                  isMono
                />
              </div>

              <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Positive Prompt
                  </span>
                  {selectedTask.positive_prompt && (
                    <CopyButton text={selectedTask.positive_prompt} />
                  )}
                </div>
                <div className="bg-black/30 p-3 rounded border border-zinc-800 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-zinc-400">
                  {selectedTask.positive_prompt || "N/A"}
                </div>
              </div>

              <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Negative Prompt
                  </span>
                  {selectedTask.negative_prompt && (
                    <CopyButton text={selectedTask.negative_prompt} />
                  )}
                </div>
                <div className="bg-black/30 p-3 rounded border border-zinc-800 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-zinc-400">
                  {selectedTask.negative_prompt || "N/A"}
                </div>
              </div>

              {selectedTask.error && (
                <div className="flex flex-col gap-1 mt-2">
                  <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">
                    Error Details
                  </span>
                  <div className="bg-red-500/10 text-red-400 p-3 rounded border border-red-500/20 whitespace-pre-wrap break-words font-mono text-xs">
                    {selectedTask.error}
                  </div>
                </div>
              )}

              {(selectedTask.status === "DONE" ||
                selectedTask.status === "COMPLETED") && (
                <div className="flex flex-col gap-1 mt-4 border-t border-zinc-800/50 pt-4">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Output Image
                  </span>
                  {getTaskImageUrl(selectedTask) ? (
                    <img
                      src={getTaskImageUrl(selectedTask)}
                      alt="Generated Output"
                      onLoad={(e) => {
                        e.currentTarget.classList.remove(
                          "opacity-0",
                          "blur-sm",
                        );
                        e.currentTarget.classList.add("opacity-100", "blur-0");
                      }}
                      className="w-full max-h-80 object-contain rounded border border-zinc-800 bg-black/30 mt-2 opacity-0 blur-sm transition-all duration-500 ease-out"
                    />
                  ) : (
                    <div className="bg-black/30 p-3 rounded border border-zinc-800 font-mono text-xs text-zinc-500">
                      Image URL not found in task payload.
                      <details className="mt-2">
                        <summary className="cursor-pointer text-zinc-400 hover:text-zinc-300">
                          View Raw Task Data
                        </summary>
                        <pre className="mt-2 overflow-x-auto text-[10px] text-zinc-600 bg-black/50 p-2 rounded">
                          {JSON.stringify(
                            selectedTask.result || selectedTask,
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper component for the modal fields
const ModalField = ({
  label,
  value,
  isMono = false,
}: {
  label: string;
  value: string | number;
  isMono?: boolean;
}) => (
  <div className="flex flex-col gap-1 border-b border-zinc-800/50 pb-2">
    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
      {label}
    </span>
    <span
      className={`text-sm ${isMono ? "font-mono text-xs text-indigo-300 truncate" : "text-zinc-200"}`}
      title={String(value)}
    >
      {value}
    </span>
  </div>
);

// Helper component for the copy button
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset icon after 2 seconds
  };

  return (
    <button
      onClick={handleCopy}
      className="text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
      title="Copy to clipboard"
    >
      {copied ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLineJoin="round"
          className="text-emerald-400"
        >
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLineJoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      )}
    </button>
  );
};
