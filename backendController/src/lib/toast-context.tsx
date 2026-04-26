import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <ToastMessage key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastMessage: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const [isLeaving, setIsLeaving] = useState(false);

  // Smooth remove animation before completely unmounting
  const handleRemove = () => {
    setIsLeaving(true);
    setTimeout(() => onRemove(toast.id), 300); // Matches the duration of the exit animation
  };

  const getColors = () => {
    switch (toast.type) {
      case "success":
        return {
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/20",
          iconBg: "bg-emerald-500",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLineJoin="round" className="text-white">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ),
        };
      case "error":
        return {
          bg: "bg-red-500/10",
          border: "border-red-500/20",
          iconBg: "bg-red-500",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLineJoin="round" className="text-white">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ),
        };
      case "info":
      default:
        return {
          bg: "bg-indigo-500/10",
          border: "border-indigo-500/20",
          iconBg: "bg-indigo-500",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLineJoin="round" className="text-white">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          ),
        };
    }
  };

  const colors = getColors();

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 min-w-[320px] max-w-sm rounded-xl shadow-2xl backdrop-blur-xl border ${colors.bg} ${colors.border} transition-all duration-300 ease-out origin-right ${
        isLeaving ? "opacity-0 scale-95 translate-x-8" : "opacity-100 scale-100 translate-x-0 animate-in slide-in-from-right-8 fade-in"
      }`}
    >
      <div className={`w-6 h-6 rounded-full flex flex-shrink-0 items-center justify-center shadow-inner ${colors.iconBg}`}>
        {colors.icon}
      </div>
      <p className="flex-1 text-sm font-medium text-white/90 leading-snug">{toast.message}</p>
      <button
        onClick={handleRemove}
        className="flex-shrink-0 p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLineJoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  );
};
