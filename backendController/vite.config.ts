import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["deb.local"], // Allow connections from any host (for Docker compatibility)
    port: 3000,
  },
});
