import React from "react";
import { useAuth } from "../lib/AuthContext";
import { useSettings } from "../lib/settings-context";

export function AccountPage() {
  const { user } = useAuth();
  const { settings, updateSettings } = useSettings();

  const toggleNav = (key: keyof typeof settings.navVisibility) => {
    updateSettings({
      navVisibility: {
        ...settings.navVisibility,
        [key]: !settings.navVisibility[key],
      },
    });
  };

  return (
    <div className="space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Profile Header */}
      <section className="relative overflow-hidden rounded-3xl bg-zinc-900 border border-zinc-800 p-8 lg:p-12">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[100px] -ml-32 -mb-32"></div>
        
        <div className="relative flex flex-col md:flex-row items-center gap-8">
          <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-1 shadow-2xl shadow-indigo-500/20">
            <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center text-4xl font-bold text-white">
              {user?.username.charAt(0).toUpperCase()}
            </div>
          </div>
          
          <div className="text-center md:text-left space-y-2">
            <h1 className="text-3xl font-bold text-white tracking-tight">
              {user?.username}
            </h1>
            <p className="text-zinc-400 font-medium">
              {user?.email || "No email provided"}
            </p>
            <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-2">
              <span className="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-300 uppercase tracking-widest">
                User ID: #{user?.id}
              </span>
              <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-mono text-indigo-400 uppercase tracking-widest">
                Standard Account
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Navigation Visibility Settings */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
            </div>
            <h3 className="text-lg font-semibold text-white">Navigation Settings</h3>
          </div>
          
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
            {[
              { id: "studio", label: "Studio Workspace", description: "The main AI generation studio environment" },
              { id: "tasks", label: "Recent Tasks", description: "Monitor and manage your generation queue" },
              { id: "gallery", label: "Image Gallery", description: "Browse and download your generated content" },
              { id: "chat", label: "Stories (Chat)", description: "Interactive AI storytelling and chat" },
            ].map((item) => (
              <div key={item.id} className="p-5 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-zinc-200">{item.label}</div>
                  <div className="text-xs text-zinc-500">{item.description}</div>
                </div>
                <button
                  onClick={() => toggleNav(item.id as any)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
                    settings.navVisibility[item.id as keyof typeof settings.navVisibility] ? "bg-indigo-600" : "bg-zinc-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.navVisibility[item.id as keyof typeof settings.navVisibility] ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Account Extension Section (Future Features) */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <h3 className="text-lg font-semibold text-white">Security & Access</h3>
          </div>
          
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4 border-dashed">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <div>
              <h4 className="text-sm font-medium text-zinc-300 text-pretty">Enhanced Security coming soon</h4>
              <p className="text-xs text-zinc-500 mt-1">Two-factor authentication and session management are in development.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Storage & Usage (Future Extension) */}
      <section className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">Usage Statistics</h3>
            <p className="text-sm text-zinc-400 max-w-md">Detailed breakdown of your generation history and cloud storage usage will appear here.</p>
          </div>
          <button className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-xl transition-all border border-zinc-700 whitespace-nowrap">
            View Usage History
          </button>
        </div>
        
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 opacity-50 grayscale pointer-events-none">
          {[
            { label: "Total Generations", value: "1,248" },
            { label: "Hours Rendered", value: "42.5h" },
            { label: "Storage Used", value: "2.8 GB" },
          ].map((stat) => (
            <div key={stat.label} className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{stat.label}</div>
              <div className="text-2xl font-bold text-white mt-1">{stat.value}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
