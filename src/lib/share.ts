import type { Status } from "../api/types";

/** Link to share a status: its canonical web url, the ActivityPub uri, or the
    given in-app link when the server exposes neither. */
export function statusShareLink(status: Pick<Status, "url" | "uri">, fallback: string): string {
  return status.url || status.uri || fallback;
}
