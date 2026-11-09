import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development Vite runs behind Caddy, which serves the app under its
// domain over HTTPS; hot reloading goes through the same address.
const domain = process.env.DOMAIN ?? "localhost";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  // Bundled up front: discovering it on first use reloads the page, which
  // would end a transcription in the middle.
  optimizeDeps: { include: ["@huggingface/transformers"] },
  worker: { format: "es" },
  server: {
    port: 5173,
    // "web" is how the other containers reach it, e.g. in tests.
    allowedHosts: [domain, "web"],
    hmr: { host: domain, clientPort: 443, protocol: "wss" },
  },
});
