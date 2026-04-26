import React, { createContext, useContext, useState, useEffect } from "react";
import { apiClient } from "./api-client";

interface User {
  id: number;
  username: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (formData: FormData) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const userData = await apiClient.getMe();
          setUser(userData);
        } catch (error) {
          console.error("Auth initialization failed", error);
          localStorage.removeItem("token");
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (formData: FormData) => {
    const data = await apiClient.login(formData);
    localStorage.setItem("token", data.access_token);
    const userData = await apiClient.getMe();
    setUser(userData);
  };

  const register = async (registerData: any) => {
    await apiClient.register(registerData);
    const formData = new FormData();
    formData.append("username", registerData.username);
    formData.append("password", registerData.password);
    await login(formData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
