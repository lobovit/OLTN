import { proxy } from "valtio";
import type {
  AccountMeta,
  ComposeIntent,
  CredentialAccount,
  InstanceInfo,
  MediaViewerIntent,
  SavedLayout,
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
  savedLayouts?: SavedLayout[];
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
  statuses: Record<string, Status>;
  ui: {
    compose: ComposeIntent | null;
    mediaViewer: MediaViewerIntent | null;
    toasts: ToastItem[];
    shortcutsHelp: boolean;
    searchOpen: boolean;
    /** Chave do último status publicado/editado (para inserir na thread aberta). */
    lastPostedKey: string | null;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  accent: "green",
  language: "pt-BR",
  textSize: 16,
  railExpanded: false,
  autoStream: true,
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
  statuses: {},
  ui: {
    compose: null,
    mediaViewer: null,
    toasts: [],
    shortcutsHelp: false,
    searchOpen: false,
    lastPostedKey: null,
  },
});

/* ---------- chaves de status ---------- */

export function statusKey(status: Status): string {
  return status.uri || String(status.id);
}

export function putStatuses(list: Status[]): void {
  for (const status of list) {
    if (status.reblog) putStatus(status.reblog);
    putStatus(status);
  }
  const keys = Object.keys(store.statuses);
  if (keys.length > 1200) {
    for (const key of keys.slice(0, 200)) delete store.statuses[key];
  }
}

export function putStatus(status: Status): string {
  const key = statusKey(status);
  if (status.reblog) putStatus(status.reblog);
  store.statuses[key] = status;
  return key;
}

export function patchStatus(key: string, patch: Partial<Status>): void {
  const current = store.statuses[key];
  if (current) store.statuses[key] = { ...current, ...patch };
}

export function removeStatusById(instance: string, id: string): void {
  for (const [key, status] of Object.entries(store.statuses)) {
    if (status.id === id && key.includes(instance)) delete store.statuses[key];
  }
}

/* ---------- ações de ui ---------- */

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
