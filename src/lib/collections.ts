import type {
  Account,
  Collection,
  CollectionItem,
  CollectionWithAccounts,
  CreateCollectionParams,
} from "../api/types";

export const MAX_COLLECTION_ACCOUNTS = 25;

export type CollectionAccountPolicy = "automatic" | "manual" | "denied" | "unknown";

/** How the source account's policy applies to the current viewer. */
export function collectionAccountPolicy(
  account: Pick<Account, "featureApproval">,
): CollectionAccountPolicy {
  const approval = account.featureApproval as
    | (NonNullable<Account["featureApproval"]> & { currentUser?: string })
    | undefined;
  const policy = approval?.current_user ?? approval?.currentUser;
  return policy === "automatic" || policy === "manual" || policy === "denied" ? policy : "unknown";
}

export function canAddToCollection(account: Pick<Account, "featureApproval">): boolean {
  const policy = collectionAccountPolicy(account);
  return policy === "automatic" || policy === "manual";
}

/** Full handle for an account whose id is valid on `sourceInstance`. */
export function collectionAccountHandle(
  account: Pick<Account, "acct">,
  sourceInstance: string,
): string {
  const acct = account.acct.trim().replace(/^@+/, "");
  if (acct.includes("@")) return acct;
  return sourceInstance ? `${acct}@${sourceInstance}` : acct;
}

/** Account ids used by a collection's avatar preview (featured items only). */
export function collectionPreviewAccountIds(collection: Collection, maxItems = 4): string[] {
  return [
    ...new Set(collection.items.map((item) => item.accountId).filter((id): id is string => !!id)),
  ].slice(0, maxItems);
}

/** Accounts in collection order, dropping items whose account is unavailable. */
export function collectionEntries(
  data: CollectionWithAccounts,
): { item: CollectionItem; account: Account }[] {
  const accounts = new Map(data.accounts.map((account) => [account.id, account]));
  return data.collection.items.flatMap((item) => {
    const account = item.accountId ? accounts.get(item.accountId) : undefined;
    return account ? [{ item, account }] : [];
  });
}

/** Owner account from a CollectionWithAccounts response. */
export function collectionOwner(data: CollectionWithAccounts): Account | null {
  return data.accounts.find((account) => account.id === data.collection.accountId) ?? null;
}

/** Canonical web URL when available, otherwise the internal fallback. */
export function collectionShareLink(collection: Pick<Collection, "url">, fallback: string): string {
  return collection.url || fallback;
}

/** Mastodon expects the topic without the leading #. */
export function normalizeCollectionTag(value: string): string {
  return value.trim().replace(/^#+/, "").trim();
}

export interface CollectionDetailsInput {
  name: string;
  description: string;
  tag: string;
  language: string;
  discoverable: boolean;
  sensitive: boolean;
}

/** Converts form state into the payload accepted by create/update. */
export function buildCollectionPayload(input: CollectionDetailsInput): CreateCollectionParams {
  return {
    name: input.name.trim(),
    description: input.description.trim() || null,
    language: input.language || null,
    tagName: normalizeCollectionTag(input.tag) || null,
    discoverable: input.discoverable,
    sensitive: input.sensitive,
  };
}

/** Collection quota check shared by the profile tab and the editor. */
export function canCreateCollection(limit: number, currentCount: number): boolean {
  return limit > 0 && currentCount < limit;
}
