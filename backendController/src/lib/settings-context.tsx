import React, { createContext, useContext, useState, useEffect } from "react";
import { apiClient, AppConfig } from "./api-client";

interface Settings {
  width: number;
  height: number;
  steps: number;
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
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadInitialSettings = async () => {
      // 1. Try local storage
      const saved = localStorage.getItem("gen_settings");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSettings(parsed);
          setIsLoading(false);
          // Still fetch from backend in background to keep it fresh if it's the first time
          return;
        } catch (e) {
          console.error("Failed to parse saved settings", e);
        }
      }

      // 2. Fetch from backend
      try {
        const config = await apiClient.getConfig();
        const initialSettings = {
          width: config.default_width,
          height: config.default_height,
          steps: config.ksampler_steps,
        };
        setSettings(initialSettings);
        localStorage.setItem("gen_settings", JSON.stringify(initialSettings));
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
