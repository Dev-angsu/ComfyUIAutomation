import React, { useState } from "react";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../lib/AuthContext";

interface SetupPreferencesModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function SetupPreferencesModal({ isOpen, onComplete }: SetupPreferencesModalProps) {
  const { user } = useAuth();
  const [comfyUrl, setComfyUrl] = useState("127.0.0.1:8188");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await apiClient.updatePreferences({ comfy_url: comfyUrl });
      onComplete();
    } catch (err: any) {
      setError(err.message || "Failed to save preferences");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-zinc-900 rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8">
          <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto border border-indigo-500/20 shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round" className="text-indigo-400">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Welcome to AI Studio</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Hello <span className="text-indigo-400 font-medium">{user?.username}</span>! Let's get your environment configured for the first time.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">
                ComfyUI Server Address
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-indigo-400 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round">
                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                    <line x1="6" y1="6" x2="6.01" y2="6" />
                    <line x1="6" y1="18" x2="6.01" y2="18" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={comfyUrl}
                  onChange={(e) => setComfyUrl(e.target.value)}
                  placeholder="e.g. 127.0.0.1:8188"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 pl-12 pr-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all shadow-inner"
                  required
                />
              </div>
              <p className="text-[10px] text-zinc-600 ml-1 leading-relaxed">
                By default, this is <span className="font-mono text-zinc-500">127.0.0.1:8188</span> if running locally. You can change this later in settings.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Start Creating
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round" className="group-hover:translate-x-1 transition-transform">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
        
        <div className="bg-zinc-950/50 p-6 border-t border-zinc-800 text-center">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium">
            AI Studio Desktop Environment
          </p>
        </div>
      </div>
    </div>
  );
}
