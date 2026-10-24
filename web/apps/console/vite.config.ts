import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Served by Spring Boot under /console-next/ (ADR-0011). In development, Vite serves the app and forwards /api to the
// running Fabor app, so both share one origin as they do in production.
export default defineConfig({
  base: "/console-next/",
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: { "/api": { target: process.env.FABOR_API ?? "http://localhost:18080", changeOrigin: false } },
  },
  build: { outDir: "dist", sourcemap: true, chunkSizeWarningLimit: 700 },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
