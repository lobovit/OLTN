import type { InstanceInfo } from "../api/types";

/** Collections shipped in Mastodon 4.6 (REST API version 10). */
export const COLLECTIONS_MIN_API_VERSION = 10;
const COLLECTIONS_MIN_MASTODON = { major: 4, minor: 6 };

type VersionInfo = Pick<InstanceInfo, "apiVersion" | "version">;

/** Parses the leading `major.minor.patch` of a Mastodon version string. */
export function parseMastodonVersion(
  version?: string | null,
): { major: number; minor: number; patch: number } | null {
  const match = /^\s*(\d+)\.(\d+)(?:\.(\d+))?/.exec(version ?? "");
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3] ?? 0),
  };
}

/**
 * Whether an instance exposes the Collections API.
 * Prefer `api_versions`; fall back to the version string for servers that
 * predate it. Unknown versions return false so the UI stays quiet.
 */
export function supportsCollections(info?: VersionInfo | null): boolean {
  if (!info) return false;
  if (typeof info.apiVersion === "number") {
    return info.apiVersion >= COLLECTIONS_MIN_API_VERSION;
  }
  const version = parseMastodonVersion(info.version);
  if (!version) return false;
  return (
    version.major > COLLECTIONS_MIN_MASTODON.major ||
    (version.major === COLLECTIONS_MIN_MASTODON.major &&
      version.minor >= COLLECTIONS_MIN_MASTODON.minor)
  );
}
