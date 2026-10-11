import { proxy } from "valtio";
import type {
  AccountMeta,
  ComposeIntent,
  CredentialAccount,
  InstanceInfo,
  MediaViewerIntent,
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
  /** Epoch ms em que termina (quando `running`). */
  endsAt: number | null;
  /** Milissegundos restantes (atualizado pelo watcher). */
  remainingMs: number;
  /** Duração total da fase atual (para a barra de progresso). */
  totalMs: number;
  /** Fase atual do ciclo. */
  phase: TimerPhase;
  /** Focos concluídos na sessão (define quando vem a pausa longa). */
  completedFocus: number;
  /** Lembrete opcional (ex.: "beber água"). */
  label: string;
}

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
  notifQueue: Notification[];
  statuses: Record<string, Status>;
  /** Instância em que o `id` de cada status é válido (para montar links). */
  statusSources: Record<string, string>;
  /** Accts bloqueados nesta sessão (oculta posts imediatamente). */
  blockedAccounts: string[];
  /** Pomodoro/lembrete (roda fora do sheet). */
  timer: TimerState;
  ui: {
    compose: ComposeIntent | null;
    mediaViewer: MediaViewerIntent | null;
    toasts: ToastItem[];
    shortcutsHelp: boolean;
    searchOpen: boolean;
    timerOpen: boolean;
    /** Popup de introdução à plataforma. */
    helpOpen: boolean;
    /** Chave do último status publicado/editado (para inserir na thread aberta). */
    lastPostedKey: string | null;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  accent: "green",
  language: "en",
  textSize: 16,
  railExpanded: false,
  autoStream: true,
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
  },
});

/* ---------- chaves de status ---------- */

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

/** Instância que originou um status em cache, buscando pelo `id`. */
export function statusSourceById(id: string): string | undefined {
  for (const [key, status] of Object.entries(store.statuses)) {
    if (status.id === id) return store.statusSources[key];
  }
  return undefined;
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

/* ---------- pomodoro / lembrete ---------- */

function pomodoroMinutes(phase: TimerPhase): number {
  const cfg = store.settings.pomodoro;
  const minutes =
    phase === "focus"
      ? cfg.focusMinutes
      : phase === "shortBreak"
        ? cfg.shortBreakMinutes
        : cfg.longBreakMinutes;
  return Math.max(1, Math.round(minutes));
}

/** Próxima fase do ciclo: foco → pausa curta (longa a cada N focos) → foco. */
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

/** Começa um ciclo novo, no foco. */
export function startPomodoro(label: string): void {
  setTimerPhase("focus", true, 0, label.trim());
}

/** Encerra a fase atual (fim do timer ou "pular") e prepara a próxima. */
export function completeTimerPhase(): void {
  const timer = store.timer;
  if (!timer.running && timer.remainingMs <= 0) return;
  const completedFocus = timer.phase === "focus" ? timer.completedFocus + 1 : timer.completedFocus;
  const next = nextTimerPhase(timer.phase, completedFocus);
  setTimerPhase(next, store.settings.pomodoro.autoContinue, completedFocus, timer.label);
}

/** Pula a fase atual sem parar o ciclo. */
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
