import { defineConfig } from "vite";

export default defineConfig({
  envDir: "../",
  server: {
    // Allow tunnel hosts (cloudflared, ngrok, ...) used by Discord URL mappings
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
