import React, { useState } from "react";
import { useAuth } from "../lib/AuthContext";

export const LoginPage: React.FC<{ onToggle: () => void }> = ({ onToggle }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("password", password);
      await login(formData);
    } catch (err) {
      setError("Invalid username or password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white p-4">
      <div className="w-full max-w-md bg-[#121212] border border-white/10 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          AI Studio
        </h1>
        <p className="text-zinc-400 mb-8">Welcome back. Please login to your account.</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              placeholder="Enter your username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all transform active:scale-[0.98]"
          >
            Login
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <p className="text-zinc-500 text-sm">
            Don't have an account?{" "}
            <button onClick={onToggle} className="text-blue-400 hover:text-blue-300 font-medium">
              Create an account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
