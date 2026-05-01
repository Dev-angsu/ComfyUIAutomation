import React, { useState, useEffect } from "react";
import { TaskList } from "./components/TaskList";
import { apiClient, BACKEND_URL } from "./lib/api-client";
import { Gallery } from "./components/Gallery";
import { SettingsProvider } from "./lib/settings-context";
import { ToastProvider } from "./lib/toast-context";
import { ChatApp } from "./components/ChatApp";
import { StudioWorkspace } from "./components/StudioWorkspace";
import { Collections } from "./components/Collections";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { LoginPage } from "./components/LoginPage";
import { RegisterPage } from "./components/RegisterPage";
import { AccountPage } from "./components/AccountPage";
import { PromptsZone } from "./components/PromptsZone";
import { useSettings } from "./lib/settings-context";
import { ConfirmProvider } from "./lib/confirm-context";
import { SetupPreferencesModal } from "./components/SetupPreferencesModal";


function MainInterface() {
  const [activeTab, setActiveTab] = useState<
    "studio" | "tasks" | "gallery" | "chat" | "profile" | "prompts" | "collections"
  >("studio");

  const [isBackendReady, setIsBackendReady] = useState(false);
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [queueStats, setQueueStats] = useState({
    queued: 0,
    executing: 0,
    completed: 0,
    total: 0,
  });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(
          `${BACKEND_URL}/api/health`,
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
    const interval = setInterval(checkHealth, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isBackendReady || !user) return;

    const fetchQueue = async () => {
      try {
        const data = await apiClient.getQueueStats();
        setQueueStats(data);
      } catch (err) {
        console.error("Top bar queue fetch error:", err);
      }
    };

    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, [isBackendReady, user]);

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
    <div className="flex h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-indigo-500/30 overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Left Navigation Pane */}
      <aside className={`
          fixed inset-y-0 left-0 w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0 z-40 transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-800">
          <h1 className="text-xl font-semibold tracking-tight text-white">
            LAI Studio
          </h1>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 text-zinc-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <nav className="flex-1 p-4 flex flex-col gap-2">
          {settings.navVisibility.studio && (
            <button
              onClick={() => { setActiveTab("studio"); setIsSidebarOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === "studio"
                ? "bg-indigo-500/10 text-indigo-400"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
              Studio
            </button>
          )}

          {settings.navVisibility.tasks && (
            <button
              onClick={() => { setActiveTab("tasks"); setIsSidebarOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === "tasks"
                ? "bg-indigo-500/10 text-indigo-400"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
              Tasks
            </button>
          )}

          {settings.navVisibility.gallery && (
            <button
              onClick={() => { setActiveTab("gallery"); setIsSidebarOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === "gallery"
                ? "bg-indigo-500/10 text-indigo-400"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              Gallery
            </button>
          )}

          {settings.navVisibility.chat && (
            <button
              onClick={() => { setActiveTab("chat"); setIsSidebarOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === "chat"
                ? "bg-indigo-500/10 text-indigo-400"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              Stories
            </button>
          )}

          {settings.navVisibility.prompts && (
            <button
              onClick={() => { setActiveTab("prompts"); setIsSidebarOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === "prompts"
                ? "bg-indigo-500/10 text-indigo-400"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
              Prompts Zone
            </button>
          )}

          {settings.navVisibility.collections && (
            <button
              onClick={() => { setActiveTab("collections"); setIsSidebarOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === "collections"
                ? "bg-indigo-500/10 text-indigo-400"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              Collections
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={() => { setActiveTab("profile"); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === "profile"
              ? "bg-zinc-800 ring-1 ring-zinc-700"
              : "hover:bg-zinc-800/50 group"
              }`}
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold shadow-lg shadow-indigo-500/10 group-hover:scale-105 transition-transform">
              {user?.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-white truncate">{user?.username}</p>
              <p className="text-[10px] text-zinc-500 group-hover:text-zinc-400 transition-colors">Account Settings</p>
            </div>
          </button>
          <div className="mt-2 px-4 flex justify-between items-center">
            <button onClick={logout} className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors py-2">Sign Out</button>
            <span className="text-[10px] text-zinc-800 font-mono">v1.2.0</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-zinc-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <h2 className="text-sm font-medium text-zinc-300 capitalize tracking-widest truncate">
              {activeTab === "studio"
                ? "Studio"
                : activeTab === "gallery"
                  ? "Gallery"
                  : activeTab === "chat"
                    ? "Stories"
                    : activeTab === "profile"
                      ? "Account"
                      : activeTab === "prompts"
                        ? "Prompts Zone"
                        : activeTab === "collections"
                          ? "Collections"
                          : "Tasks"}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
              <div className={`w-1.5 h-1.5 bg-emerald-500 rounded-full ${queueStats.executing > 0 ? "animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" : ""}`}></div>
              <span className="text-zinc-400 mr-0.5">EXE:</span>
              <span className="font-bold">{queueStats.executing}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
              <div className={`w-1.5 h-1.5 bg-amber-500 rounded-full ${queueStats.queued > 0 ? "animate-bounce" : ""}`}></div>
              <span className="text-zinc-400 mr-0.5">QUE:</span>
              <span className="font-bold">{queueStats.queued}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className={`max-w-7xl mx-auto ${activeTab === "studio" ? "flex flex-col" : "hidden"}`}>
            <StudioWorkspace />
          </div>
          
          <div className={`max-w-7xl mx-auto flex-col gap-6 ${activeTab === "tasks" ? "flex" : "hidden"}`}>
            <TaskList />
          </div>

          <div className={`max-w-7xl mx-auto flex-col gap-6 ${activeTab === "gallery" ? "flex" : "hidden"}`}>
            <Gallery isActive={activeTab === "gallery"} onNavigate={(tab: any) => setActiveTab(tab)} />
          </div>

          <div className={`max-w-7xl mx-auto h-full flex-col gap-6 ${activeTab === "chat" ? "flex" : "hidden"}`} style={{ height: "calc(100vh - 140px)" }}>
            <ChatApp />
          </div>

          <div className={`max-w-7xl mx-auto flex-col gap-6 ${activeTab === "profile" ? "flex" : "hidden"}`}>
            <AccountPage />
          </div>
          
          <div className={`max-w-7xl mx-auto flex-col gap-6 ${activeTab === "prompts" ? "flex" : "hidden"}`}>
            <PromptsZone isActive={activeTab === "prompts"} onTakePrompt={() => setActiveTab("studio")} />
          </div>

          <div className={`max-w-7xl mx-auto flex-col gap-6 ${activeTab === "collections" ? "flex" : "hidden"}`}>
            <Collections isActive={activeTab === "collections"} onNavigate={(tab: any) => setActiveTab(tab)} />
          </div>
        </main>
      </div>
    </div>
  );
}

function AuthWrapper() {
  const { user, loading, connectionError } = useAuth();
  const [showRegister, setShowRegister] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    if (user && (user as any).needs_setup) {
      setShowSetup(true);
    } else {
      setShowSetup(false);
    }
  }, [user]);

  if (loading || connectionError) {
    return (
      <div className="flex h-screen bg-zinc-950 items-center justify-center text-zinc-200 font-sans selection:bg-indigo-500/30">
        <div className="flex flex-col items-center justify-center space-y-6 bg-zinc-900/50 rounded-2xl border border-zinc-800 p-10 shadow-2xl">
          <div className="w-12 h-12 border-4 border-zinc-700 border-t-indigo-500 rounded-full animate-spin"></div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-medium text-zinc-200">
              {connectionError ? "Reconnecting to AI Studio..." : "Initializing AI Studio..."}
            </h2>
            <p className="text-zinc-500 text-sm max-w-md mx-auto">
              {connectionError
                ? "The backend is currently unreachable. Retrying connection..."
                : "Connecting to FastAPI and ComfyUI services."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return showRegister ? (
      <RegisterPage onToggle={() => setShowRegister(false)} />
    ) : (
      <LoginPage onToggle={() => setShowRegister(true)} />
    );
  }

  return (
    <>
      <MainInterface />
      <SetupPreferencesModal
        isOpen={showSetup}
        onComplete={() => setShowSetup(false)}
      />
    </>
  );
}


export default function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <ToastProvider>
          <SettingsProvider>
            <AuthWrapper />
          </SettingsProvider>
        </ToastProvider>
      </ConfirmProvider>
    </AuthProvider>
  );
}
