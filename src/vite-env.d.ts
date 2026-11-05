/// <reference types="vite/client" />

interface AppInfo {
  /** Semver version read from package.json at build time. */
  version: string;
  /** Short git commit of the build, or an empty string outside a repo. */
  commit: string;
  /** ISO date of the build commit. */
  date: string;
}

declare const __APP_INFO__: AppInfo;
