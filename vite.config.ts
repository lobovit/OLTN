import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";

// Alguns deps (valtio) importam `react` — mapeamos para preact/compat,
// mantendo o runtime 100% Preact.
const reactAlias = [
  { find: /^react$/, replacement: "preact/compat" },
  { find: /^react-dom$/, replacement: "preact/compat" },
  { find: /^react\/jsx-runtime$/, replacement: "preact/jsx-runtime" },
  { find: /^react\/jsx-dev-runtime$/, replacement: "preact/jsx-runtime" },
];

/* Headers de segurança aplicados pelo dev server / preview (dev local e túneis). */
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export default defineConfig({
  base: "./",
  envPrefix: ["VITE_", "SCOV_"],
  plugins: [preact()],
  resolve: {
    alias: reactAlias,
  },
  server: {
    host: true,
    // Túneis ngrok (o subdomínio grátis muda a cada sessão — curinga cobre todos)
    allowedHosts: [".ngrok-free.dev", ".ngrok-free.app", ".ngrok.app", ".ngrok.io"],
    headers: securityHeaders,
  },
  preview: {
    headers: securityHeaders,
  },
  build: {
    target: "es2022",
    cssCodeSplit: false,
    sourcemap: true,
  },
  test: {
    environment: "happy-dom",
  },
});
