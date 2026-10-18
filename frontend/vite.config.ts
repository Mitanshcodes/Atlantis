import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The game's writing lives in backend/app/content, shared with the engine.
const content = fileURLToPath(new URL("../backend/app/content", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@content": content } },
  server: {
    port: 5173,
    fs: { allow: [".", content] },
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
