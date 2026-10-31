import { proxy } from "valtio";
import type {
  AccountMeta,
  ComposeIntent,
  CredentialAccount,
  FloatRect,
  InstanceInfo,
  MediaViewerIntent,
  NewsletterSource,
  Notification,
  Settings,
  Shortcut,
  Status,
  ToastItem,
} from "../api/types";

export type AuthState = "loading" | "anonymous" | "authenticated";
export type StreamState = "off" | "connecting" | "on";

export interface AccountPrefs {
  shortcuts: Shortcut[];
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  /** Floating panel rects by shortcut id (deck mode off). */
  floats?: Record<string, FloatRect>;
  /** Floating panel stacking order, back to front. */
  floatOrder?: string[];
  /** Panel colors by shortcut id (shared by deck columns and floating panels). */
  colors?: Record<string, string>;
  /** News profiles aggregated by the Newsletter page. */
  newsletterSources?: NewsletterSource[];
  /** End of the last Timeseries review (Unix ms). */
  timeseriesLastAt?: number;
}

export interface AppState {
  booted: boolean;
  auth: AuthState;
  accounts: AccountMeta[];
  currentAccountId: string | null;
  me: CredentialAccount | null;
  instance: InstanceInfo | null;
  settings: Settings;
  prefs: Record<string, AccountPrefs>;
  shortcuts: Shortcut[];
  stream: StreamState;
  notifBadge: number;
  homeQueue: string[];
  notifQueue: Notification[];
  statuses: Record<string, Status>;
  /** Instance where each status `id` is valid (to build links). */
  statusSources: Record<string, string>;
  /** Accts blocked in this session (hides posts immediately). */
  blockedAccounts: string[];
  ui: {
    compose: ComposeIntent | null;
    mediaViewer: MediaViewerIntent | null;
    toasts: ToastItem[];
    shortcutsHelp: boolean;
    searchOpen: boolean;
    /** Platform intro popup. */
    helpOpen: boolean;
    /** Key of the last published/edited status (to insert into the open thread). */
    lastPostedKey: string | null;
    /** Home columns show the image gallery instead of the timeline. */
    homeGallery: boolean;
    /** Bumped on every successful boost toggle; refreshes mounted boosts feeds. */
    boostsRevision: number;
    /** Bumped by the column refresh button; reloads every mounted feed. */
    feedsRevision: number;
    /** Bumped when a status is pinned/unpinned; reloads profile pinned posts. */
    pinsRevision: number;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  accent: "green",
  language: "en",
  textSize: 16,
  layout: "columns",
  autoStream: true,
  autoplayGifs: true,
};

export const store = proxy<AppState>({
  booted: false,
  auth: "loading",
  accounts: [],
  currentAccountId: null,
  me: null,
  instance: null,
  settings: { ...DEFAULT_SETTINGS },
  prefs: {},
  shortcuts: [],
  stream: "off",
  notifBadge: 0,
  homeQueue: [],
  notifQueue: [],
  statuses: {},
  statusSources: {},
  blockedAccounts: [],
  ui: {
    compose: null,
    mediaViewer: null,
    toasts: [],
    shortcutsHelp: false,
    searchOpen: false,
    helpOpen: false,
    lastPostedKey: null,
    homeGallery: false,
    boostsRevision: 0,
    feedsRevision: 0,
    pinsRevision: 0,
  },
});

/* ---------- status keys ---------- */

export function statusKey(status: Status): string {
  return status.uri || String(status.id);
}

export function putStatuses(list: Status[], source?: string): void {
  for (const status of list) {
    if (status.reblog) putStatus(status.reblog, source);
    putStatus(status, source);
  }
  const keys = Object.keys(store.statuses);
  if (keys.length > 1200) {
    for (const key of keys.slice(0, 200)) {
      delete store.statuses[key];
      delete store.statusSources[key];
    }
  }
}

export function putStatus(status: Status, source?: string): string {
  const key = statusKey(status);
  if (status.reblog) putStatus(status.reblog, source);
  store.statuses[key] = status;
  if (source) store.statusSources[key] = source;
  return key;
}

export function patchStatus(key: string, patch: Partial<Status>): void {
  const current = store.statuses[key];
  if (current) store.statuses[key] = { ...current, ...patch };
}

export function removeStatusById(instance: string, id: string): void {
  for (const [key, status] of Object.entries(store.statuses)) {
    if (status.id === id && key.includes(instance)) {
      delete store.statuses[key];
      delete store.statusSources[key];
    }
  }
}

/** Instance that originated a cached status, looked up by `id`. */
export function statusSourceById(id: string): string | undefined {
  for (const [key, status] of Object.entries(store.statuses)) {
    if (status.id === id) return store.statusSources[key];
  }
  return undefined;
}

/* ---------- ui actions ---------- */

let toastSeq = 0;
export function toast(text: string, kind?: ToastItem["kind"]): void {
  const item: ToastItem = { id: ++toastSeq, text, kind };
  store.ui.toasts = [...store.ui.toasts, item];
  window.setTimeout(() => {
    store.ui.toasts = store.ui.toasts.filter((t) => t.id !== item.id);
  }, 3200);
}

export function setCompose(intent: ComposeIntent | null): void {
  store.ui.compose = intent;
}

export function setMediaViewer(intent: MediaViewerIntent | null): void {
  store.ui.mediaViewer = intent;
}

export function currentAccount(): AccountMeta | null {
  return store.accounts.find((a) => a.id === store.currentAccountId) ?? null;
}

export function accountNS(account: AccountMeta): string {
  return `${account.id}@${account.instance}`;
}

export function pushHomeQueue(key: string): void {
  if (store.homeQueue.includes(key)) return;
  store.homeQueue = [key, ...store.homeQueue].slice(0, 60);
}

/** Queues a notification received via streaming (badge included). */
export function pushNotification(notification: Notification): void {
  if (store.notifQueue.some((n) => n.id === notification.id)) return;
  store.notifQueue = [notification, ...store.notifQueue].slice(0, 40);
  store.notifBadge += 1;
}
