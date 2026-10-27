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
  SavedLayout,
  Settings,
  Shortcut,
  Status,
  ToastItem,
} from "../api/types";

export type AuthState = "loading" | "anonymous" | "authenticated";
export type StreamState = "off" | "connecting" | "on";

export type TimerPhase = "focus" | "shortBreak" | "longBreak";

export interface TimerState {
  running: boolean;
  /** Epoch ms when it ends (while `running`). */
  endsAt: number | null;
  /** Remaining milliseconds (updated by the watcher). */
  remainingMs: number;
  /** Total duration of the current phase (for the progress bar). */
  totalMs: number;
  /** Current cycle phase. */
  phase: TimerPhase;
  /** Focus rounds completed in the session (defines when the long break comes). */
  completedFocus: number;
  /** Optional reminder (e.g. "drink water"). */
  label: string;
}

export interface AccountPrefs {
  shortcuts: Shortcut[];
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  savedLayouts?: SavedLayout[];
  /** Floating panel rects by shortcut id (deck mode off). */
  floats?: Record<string, FloatRect>;
  /** Floating panel stacking order, back to front. */
  floatOrder?: string[];
  /** Panel colors by shortcut id (shared by deck columns and floating panels). */
  colors?: Record<string, string>;
  /** News profiles aggregated by the Newsletter page. */
  newsletterSources?: NewsletterSource[];
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
  /** Pomodoro/reminder (runs outside the sheet). */
  timer: TimerState;
  ui: {
    compose: ComposeIntent | null;
    mediaViewer: MediaViewerIntent | null;
    toasts: ToastItem[];
    shortcutsHelp: boolean;
    searchOpen: boolean;
    timerOpen: boolean;
    /** Platform intro popup. */
    helpOpen: boolean;
    /** Key of the last published/edited status (to insert into the open thread). */
    lastPostedKey: string | null;
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
  pomodoro: {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    cycles: 4,
    autoContinue: true,
  },
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
  timer: {
    running: false,
    endsAt: null,
    remainingMs: 0,
    totalMs: 0,
    phase: "focus",
    completedFocus: 0,
    label: "",
  },
  ui: {
    compose: null,
    mediaViewer: null,
    toasts: [],
    shortcutsHelp: false,
    searchOpen: false,
    timerOpen: false,
    helpOpen: false,
    lastPostedKey: null,
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

/* ---------- pomodoro / reminder ---------- */

function pomodoroMinutes(phase: TimerPhase): number {
  const cfg = store.settings.pomodoro;
  let minutes: number;
  if (phase === "focus") {
    minutes = cfg.focusMinutes;
  } else if (phase === "shortBreak") {
    minutes = cfg.shortBreakMinutes;
  } else {
    minutes = cfg.longBreakMinutes;
  }
  return Math.max(1, Math.round(minutes));
}

/** Next cycle phase: focus → short break (long every N rounds) → focus. */
export function nextTimerPhase(phase: TimerPhase, completedFocus: number): TimerPhase {
  if (phase !== "focus") return "focus";
  const cycles = Math.max(1, Math.round(store.settings.pomodoro.cycles));
  return completedFocus > 0 && completedFocus % cycles === 0 ? "longBreak" : "shortBreak";
}

function setTimerPhase(
  phase: TimerPhase,
  running: boolean,
  completedFocus: number,
  label: string,
): void {
  const totalMs = pomodoroMinutes(phase) * 60_000;
  store.timer = {
    running,
    endsAt: running ? Date.now() + totalMs : null,
    remainingMs: totalMs,
    totalMs,
    phase,
    completedFocus,
    label,
  };
}

/** Starts a fresh cycle, on focus. */
export function startPomodoro(label: string): void {
  setTimerPhase("focus", true, 0, label.trim());
}

/** Ends the current phase (timer end or "skip") and prepares the next. */
export function completeTimerPhase(): void {
  const timer = store.timer;
  if (!timer.running && timer.remainingMs <= 0) return;
  const completedFocus = timer.phase === "focus" ? timer.completedFocus + 1 : timer.completedFocus;
  const next = nextTimerPhase(timer.phase, completedFocus);
  setTimerPhase(next, store.settings.pomodoro.autoContinue, completedFocus, timer.label);
}

/** Skips the current phase without stopping the cycle. */
export function skipTimerPhase(): void {
  const timer = store.timer;
  if (!timer.running && timer.remainingMs <= 0) return;
  const completedFocus = timer.phase === "focus" ? timer.completedFocus + 1 : timer.completedFocus;
  const next = nextTimerPhase(timer.phase, completedFocus);
  setTimerPhase(next, timer.running, completedFocus, timer.label);
}

export function pauseTimer(): void {
  const timer = store.timer;
  if (!timer.running || !timer.endsAt) return;
  store.timer = {
    ...timer,
    running: false,
    endsAt: null,
    remainingMs: Math.max(0, timer.endsAt - Date.now()),
  };
}

export function resumeTimer(): void {
  const timer = store.timer;
  if (timer.running || timer.remainingMs <= 0) return;
  store.timer = { ...timer, running: true, endsAt: Date.now() + timer.remainingMs };
}

export function stopTimer(): void {
  store.timer = {
    running: false,
    endsAt: null,
    remainingMs: 0,
    totalMs: 0,
    phase: "focus",
    completedFocus: 0,
    label: "",
  };
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
