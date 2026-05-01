import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    allowedHosts: ["deb.local", "deb-mac.local"], 
    port: 5173, // Changed to standard Vite port or kept as 3000 if preferred, but Electron script uses 5173
  },
});
