import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The FastAPI backend (backend/app/main.py) serves /api.
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
  build: {
    // index.html is the game; p2.html is Person 2's banking workshop.
    rollupOptions: {
      input: { game: "index.html", workshop: "p2.html" },
      // Phaser is one large module; keep it in its own chunk.
      output: { manualChunks: { phaser: ["phaser"] } },
    },
    chunkSizeWarningLimit: 1600,
  },
});
