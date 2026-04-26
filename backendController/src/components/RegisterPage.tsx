import React, { useState } from "react";
import { useAuth } from "../lib/AuthContext";

export const RegisterPage: React.FC<{ onToggle: () => void }> = ({ onToggle }) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await register({ username, email, password });
    } catch (err) {
      setError("Registration failed. Username might be taken.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white p-4">
      <div className="w-full max-w-md bg-[#121212] border border-white/10 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Join AI Studio
        </h1>
        <p className="text-zinc-400 mb-8">Start your creative journey today.</p>

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
              placeholder="Pick a unique username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Email (Optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              placeholder="you@example.com"
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
            Create Account
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <p className="text-zinc-500 text-sm">
            Already have an account?{" "}
            <button onClick={onToggle} className="text-blue-400 hover:text-blue-300 font-medium">
              Login instead
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
