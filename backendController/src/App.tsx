import React, { useState, useEffect } from "react";
import { QueueMonitor } from "./components/QueueMonitor";
import { ManualGenerator } from "./components/ManualGenerator";
import { TaskList } from "./components/TaskList";
import { BatchUploader } from "./components/BatchUploader";
import { DynamicPipelineUploader } from "./components/DynamicPipelineUploader";
import { Gallery } from "./components/Gallery";
import { SettingsProvider } from "./lib/settings-context";
import { ToastProvider } from "./lib/toast-context";
import { GenerationSettings } from "./components/GenerationSettings";
import { ChatApp } from "./components/ChatApp";

export default function App() {
  const [activeTab, setActiveTab] = useState<
    "studio" | "tasks" | "gallery" | "chat"
  >("studio");

  const [isBackendReady, setIsBackendReady] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        // Hitting the gallery endpoint is a great health check because FastAPI
        // will return 502 if it can't reach ComfyUI on port 8188.
        const response = await fetch(
          `http://${window.location.hostname}:8000/api/gallery?page=1&page_size=1`,
        );
        if (response.ok) {
          setIsBackendReady(true);
        } else {
          setIsBackendReady(false);
        }
      } catch (err) {
        setIsBackendReady(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 3000); // Check every 3 seconds
    return () => clearInterval(interval);
  }, []);

  if (!isBackendReady) {
    return (
      <div className="flex h-screen bg-zinc-950 items-center justify-center text-zinc-200 font-sans selection:bg-indigo-500/30">
        <div className="flex flex-col items-center justify-center space-y-6 bg-zinc-900/50 rounded-2xl border border-zinc-800 p-10 shadow-2xl">
          <div className="w-12 h-12 border-4 border-zinc-700 border-t-indigo-500 rounded-full animate-spin"></div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-medium text-zinc-200">
              Waiting for AI Studio Environment...
            </h2>
            <p className="text-zinc-500 text-sm max-w-md mx-auto">
              Connecting to FastAPI (Port 8000) and ComfyUI (Port 8188).
              <br />
              The interface will load automatically once all services are
              online.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <SettingsProvider>
      <div className="flex h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-indigo-500/30 overflow-hidden">
        {/* Left Navigation Pane */}
        <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0 z-20">
          <div className="h-16 flex items-center px-6 border-b border-zinc-800">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              AI{" "}
              <span className="text-zinc-500 font-light">
                Studio BackendController
              </span>
            </h1>
          </div>

          <nav className="flex-1 p-4 flex flex-col gap-2">
            <button
              onClick={() => setActiveTab("studio")}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === "studio"
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLineJoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Studio Workspace
            </button>

            <button
              onClick={() => setActiveTab("tasks")}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === "tasks"
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLineJoin="round"
              >
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
              Recent Tasks
            </button>

            <button
              onClick={() => setActiveTab("gallery")}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === "gallery"
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLineJoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              Image Gallery
            </button>

            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === "chat"
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLineJoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Stories Chat
            </button>
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header */}
          <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md flex items-center justify-between px-8 shrink-0 z-10">
            <h2 className="text-sm font-medium text-zinc-300 capitalize tracking-widest">
              {activeTab === "studio"
                ? "Generation Studio"
                : activeTab === "gallery"
                  ? "Image Gallery"
                  : activeTab === "chat"
                    ? "Stories"
                    : "Task History"}
            </h2>
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              Backend Connected
            </div>
          </header>

          {/* Scrollable Page Content */}
          <main className="flex-1 overflow-y-auto p-8">
            <div
              className={`max-w-7xl mx-auto gap-8 ${activeTab === "studio" ? "grid grid-cols-1 lg:grid-cols-12" : "hidden"}`}
            >
              <div className="lg:col-span-8 flex flex-col gap-6">
                <ManualGenerator />
                <BatchUploader />
                <DynamicPipelineUploader />
              </div>
              <div className="lg:col-span-4 flex flex-col gap-6">
                <GenerationSettings />
                <QueueMonitor />
              </div>
            </div>

            <div
              className={`max-w-7xl mx-auto flex-col gap-6 ${activeTab === "tasks" ? "flex" : "hidden"}`}
            >
              <TaskList />
            </div>

            <div
              className={`max-w-7xl mx-auto flex-col gap-6 ${activeTab === "gallery" ? "flex" : "hidden"}`}
            >
              <Gallery onNavigate={(tab: "studio" | "tasks" | "gallery" | "chat") => setActiveTab(tab)} />
            </div>

            <div
              className={`max-w-7xl mx-auto h-full flex-col gap-6 ${activeTab === "chat" ? "flex" : "hidden"}`}
              style={{ height: "calc(100vh - 140px)" }}
            >
              <ChatApp />
            </div>
          </main>
        </div>
      </div>
      </SettingsProvider>
    </ToastProvider>
  );
}
