import React, { createContext, useContext, useState, useEffect } from "react";
import { apiClient, AppConfig } from "./api-client";

interface Settings {
  width: number;
  height: number;
  steps: number;
  workflow: string;
  availableWorkflows: string[];
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>({
    width: 1024,
    height: 1024,
    steps: 30,
    workflow: "anima.json",
    availableWorkflows: ["anima.json"],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadInitialSettings = async () => {
      // 1. Try local storage
      const saved = localStorage.getItem("gen_settings");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSettings(prev => ({ ...prev, ...parsed }));
          setIsLoading(false);
        } catch (e) {
          console.error("Failed to parse saved settings", e);
        }
      }

      // 2. Fetch from backend (Always do this to get latest workflows)
      try {
        const config = await apiClient.getConfig();
        setSettings(prev => {
          const initialSettings = {
            width: prev.width || config.default_width,
            height: prev.height || config.default_height,
            steps: prev.steps || config.ksampler_steps,
            workflow: prev.workflow || config.default_workflow || "anima.json",
            availableWorkflows: config.available_workflows || ["anima.json"],
          };
          localStorage.setItem("gen_settings", JSON.stringify(initialSettings));
          return initialSettings;
        });
      } catch (err) {
        console.error("Failed to fetch initial settings", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialSettings();
  }, []);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem("gen_settings", JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
