import React from "react";

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isElectron: boolean;
    };
  }
}

export const TitleBar: React.FC = () => {
  const isElectron = !!window.electronAPI?.isElectron;

  if (!isElectron) return null;

  return (
    <div className="h-8 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 select-none drag-region shrink-0">
      <div className="flex items-center gap-2 pointer-events-none">
        <img src="lai.png" alt="Icon" className="w-4 h-4 rounded-sm" />
        <span className="text-[10px] font-medium text-zinc-400 tracking-wider">LAI STUDIO DESKTOP</span>
      </div>
      
      <div className="flex items-center h-full no-drag-region">
        <button 
          onClick={() => window.electronAPI?.minimize()}
          className="h-full px-3 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          title="Minimize"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button 
          onClick={() => window.electronAPI?.maximize()}
          className="h-full px-3 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          title="Maximize"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          </svg>
        </button>
        <button 
          onClick={() => window.electronAPI?.close()}
          className="h-full px-4 text-zinc-400 hover:bg-red-600 hover:text-white transition-colors"
          title="Close"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  );
};
