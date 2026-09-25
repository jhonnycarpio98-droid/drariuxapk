import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // base './' para que el bundle funcione dentro del WebView de Capacitor
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    port: 5173,
    // En desarrollo, proxy de /api hacia el motor Evennia (VPS o local :8000).
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
