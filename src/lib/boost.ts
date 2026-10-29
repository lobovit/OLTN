import type { Status } from "../api/types";

/** Mirrors Mastodon's StatusPolicy#reblog?: direct posts can never be boosted,
    and someone else's followers-only post can't either. */
export function canBoostStatus(
  status: Pick<Status, "visibility" | "account">,
  meId?: string | null,
): boolean {
  if (status.visibility === "direct") return false;
  if (status.visibility === "private") return !!meId && status.account.id === meId;
  return true;
}
