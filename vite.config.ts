import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";

/* Build metadata: semver comes from package.json, the rest is best-effort git info. */
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf8"),
) as { version: string };

function gitOutput(args: string[]): string {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

const appInfo = {
  version: pkg.version,
  commit: gitOutput(["rev-parse", "--short", "HEAD"]),
  date: gitOutput(["show", "-s", "--format=%cI", "HEAD"]) || new Date().toISOString(),
};

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
  define: {
    __APP_INFO__: JSON.stringify(appInfo),
  },
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
    // valtio importa `react` — inline para o alias acima valer nos testes.
    server: { deps: { inline: ["valtio"] } },
  },
});
