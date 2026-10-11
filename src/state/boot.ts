import { exchangeCode, PENDING_AUTH_KEY, revokeToken, type PendingAuth } from "../api/auth";
import { connectUserStream, getRest, getInstanceInfo } from "../api/client";
import type {
  AccentSetting,
  AccountMeta,
  SavedLayout,
  Settings,
  Shortcut,
  Status,
} from "../api/types";
import { t } from "../i18n/pt-BR";
import { setFormatLocale } from "../lib/format";
import { navigate, parseHash } from "../lib/router";
import {
  migrateLegacyStorage,
  readJSON,
  sessionRead,
  sessionRemove,
  writeJSON,
} from "../lib/storage";
import {
  DEFAULT_SETTINGS,
  accountNS,
  currentAccount,
  pushHomeQueue,
  pushNotification,
  putStatus,
  putStatuses,
  removeStatusById,
  store,
  type AppState,
} from "./store";

function defaultShortcuts(): Shortcut[] {
  return [
    { id: "home", type: "home", label: t.home },
    { id: "notifications", type: "notifications", label: t.notifications },
    { id: "local", type: "local", label: t.local },
  ];
}

let disconnectStream: (() => void) | null = null;

/* ---------- persistência ---------- */

function saveAccounts(): void {
  writeJSON("accounts", store.accounts);
}

function saveCurrentAccountId(): void {
  writeJSON("currentAccount", store.currentAccountId);
}

export function saveSettings(): void {
  writeJSON("settings", store.settings);
  applyAppearance();
}

function savePrefs(): void {
  writeJSON("prefs", store.prefs);
}

export function applyAppearance(): void {
  const root = document.documentElement;
  root.dataset["theme"] = store.settings.theme;
  root.dataset["accent"] = store.settings.accent;
  root.lang = store.settings.language;
  root.style.setProperty("--text-size", `${store.settings.textSize}px`);
  setFormatLocale(store.settings.language);
  applyFavicon();
}

const ACCENT_HEX: Record<AccentSetting, string> = {
  green: "#3ddc97",
  orange: "#f59e0b",
  purple: "#a78bfa",
  blue: "#60a5fa",
  pink: "#f472b6",
};

function applyFavicon(): void {
  const color = ACCENT_HEX[store.settings.accent] ?? ACCENT_HEX.green;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="16" fill="#0a0e13"/>` +
    `<circle cx="32" cy="34" r="17" fill="none" stroke="${color}" stroke-width="7"/>` +
    `<circle cx="32" cy="17" r="8" fill="${color}"/></svg>`;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/* ---------- conta ---------- */

export function resolveShortcuts(): void {
  const account = currentAccount();
  if (!account) {
    store.shortcuts = [];
    return;
  }
  const prefs = store.prefs[accountNS(account)];
  store.shortcuts = prefs?.shortcuts?.length
    ? prefs.shortcuts
    : defaultShortcuts().map((s) => ({ ...s }));
}

export function saveShortcuts(shortcuts: Shortcut[]): void {
  const account = currentAccount();
  store.shortcuts = shortcuts;
  if (!account) return;
  const ns = accountNS(account);
  store.prefs[ns] = { ...(store.prefs[ns] ?? { shortcuts: [] }), shortcuts };
  savePrefs();
}

export function saveColumnLayout(order: readonly string[], widths: Record<string, number>): void {
  const account = currentAccount();
  if (!account) return;
  const ns = accountNS(account);
  const prev = store.prefs[ns];
  store.prefs[ns] = {
    shortcuts: prev?.shortcuts ?? [],
    columnOrder: [...order],
    columnWidths: { ...widths },
    savedLayouts: prev?.savedLayouts,
  };
  savePrefs();
}

export function saveSavedLayouts(layouts: readonly SavedLayout[]): void {
  const account = currentAccount();
  if (!account) return;
  const ns = accountNS(account);
  const prev = store.prefs[ns];
  store.prefs[ns] = { ...(prev ?? { shortcuts: [] }), savedLayouts: [...layouts] };
  savePrefs();
}

export function resetColumnLayout(): void {
  const account = currentAccount();
  if (!account) return;
  const ns = accountNS(account);
  const prev = store.prefs[ns];
  store.prefs[ns] = { shortcuts: prev?.shortcuts ?? [] };
  savePrefs();
}

export function addAccount(account: AccountMeta): void {
  store.accounts = [...store.accounts.filter((a) => a.id !== account.id), account];
  saveAccounts();
  store.currentAccountId = account.id;
  saveCurrentAccountId();
}

export function removeAccount(id: string): void {
  store.accounts = store.accounts.filter((a) => a.id !== id);
  saveAccounts();
  if (store.currentAccountId === id) {
    store.currentAccountId = store.accounts[0]?.id ?? null;
    saveCurrentAccountId();
  }
}

/** Atualiza dados públicos da conta atual (após editar o perfil). */
export function updateCurrentAccountMeta(
  patch: Partial<Pick<AccountMeta, "displayName" | "avatar" | "handle">>,
): void {
  const account = currentAccount();
  if (!account) return;
  const updated: AccountMeta = { ...account, ...patch };
  store.accounts = store.accounts.map((a) => (a.id === account.id ? updated : a));
  saveAccounts();
}

export async function signIn(account: AccountMeta): Promise<void> {
  store.auth = "loading";
  store.currentAccountId = account.id;
  saveCurrentAccountId();
  resolveShortcuts();
  try {
    const client = getRest(account.instance, account.accessToken);
    const [me, instance] = await Promise.all([
      client.v1.accounts.verifyCredentials(),
      getInstanceInfo(account.instance),
    ]);
    store.me = me;
    store.instance = instance;
    store.auth = "authenticated";
    if (store.settings.autoStream) {
      connectStream(account, instance.streamingApi ?? null);
    } else {
      store.stream = "off";
    }
  } catch (err) {
    console.warn("[oltn] signIn failed", err);
    store.me = null;
    store.auth = "anonymous";
    if (parseHash().path !== "/login") navigate("/login", { replace: true });
  }
}

export async function switchAccount(id: string): Promise<void> {
  const account = store.accounts.find((a) => a.id === id);
  if (!account) return;
  disconnectStream?.();
  disconnectStream = null;
  store.stream = "off";
  store.homeQueue = [];
  store.notifQueue = [];
  store.blockedAccounts = [];
  store.notifBadge = 0;
  store.me = null;
  store.instance = null;
  await signIn(account);
}

export async function signOut(): Promise<void> {
  const account = currentAccount();
  disconnectStream?.();
  disconnectStream = null;
  store.stream = "off";
  if (account) {
    void revokeToken({
      instance: account.instance,
      clientId: account.clientId,
      clientSecret: account.clientSecret,
      token: account.accessToken,
    });
    store.accounts = store.accounts.filter((a) => a.id !== account.id);
    saveAccounts();
    const next = store.accounts[0] ?? null;
    store.currentAccountId = next?.id ?? null;
    saveCurrentAccountId();
    if (next) {
      await signIn(next);
      return;
    }
  }
  store.me = null;
  store.instance = null;
  store.shortcuts = [];
  store.auth = "anonymous";
  navigate("/login", { replace: true });
}

/* ---------- stream ---------- */

/** Conecta ou desconecta o stream conforme a preferência de atualização automática. */
export function syncStream(): void {
  const account = currentAccount();
  if (!account || store.auth !== "authenticated") return;
  if (store.settings.autoStream) {
    if (store.stream === "off" || !disconnectStream) {
      connectStream(account, store.instance?.streamingApi ?? null);
    }
  } else if (disconnectStream || store.stream !== "off") {
    disconnectStream?.();
    disconnectStream = null;
    store.stream = "off";
  }
}

function connectStream(account: AccountMeta, streamingApi: string | null): void {
  disconnectStream?.();
  store.stream = "connecting";
  disconnectStream = connectUserStream({
    instance: account.instance,
    accessToken: account.accessToken,
    streamingApi,
    handlers: {
      onOpen: () => {
        store.stream = "on";
      },
      onClose: () => {
        store.stream = "off";
      },
      onUpdate: (status: Status) => {
        putStatuses([status], account.instance);
        pushHomeQueue(putStatus(status, account.instance));
      },
      onNotification: (notification) => {
        if (notification.status) putStatuses([notification.status], account.instance);
        pushNotification(notification);
      },
      onStatusUpdate: (status) => {
        putStatus(status, account.instance);
      },
      onDelete: (id: string) => {
        removeStatusById(account.instance, id);
      },
    },
  });
}

/* ---------- callback OAuth ---------- */

async function handleOAuthCallback(code: string, state?: string): Promise<boolean> {
  // Popup: repassa o código para a janela principal e fecha.
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage({ type: "oltn-oauth", code, state }, location.origin);
    } catch (err) {
      console.warn("[oltn] oauth relay failed", err);
    }
    document.body.innerHTML = `<div style="display:grid;place-items:center;height:100vh;font-family:system-ui">${t.loginDone}</div>`;
    window.setTimeout(() => window.close(), 400);
    return true;
  }

  const pending = sessionRead<PendingAuth | null>(PENDING_AUTH_KEY, null);
  sessionRemove(PENDING_AUTH_KEY);
  if (!pending) return false;
  if (pending.state && state !== pending.state) {
    console.warn("[oltn] oauth state mismatch");
    return false;
  }
  try {
    const { accessToken } = await exchangeCode({
      instance: pending.instance,
      clientId: pending.clientId,
      clientSecret: pending.clientSecret,
      code,
      codeVerifier: pending.codeVerifier,
    });
    const client = getRest(pending.instance, accessToken);
    const me = await client.v1.accounts.verifyCredentials();
    const account: AccountMeta = {
      id: me.id,
      instance: pending.instance,
      handle: me.acct.includes("@") ? me.acct : `${me.acct}@${pending.instance}`,
      displayName: me.displayName || me.username,
      avatar: me.avatar,
      accessToken,
      clientId: pending.clientId,
      clientSecret: pending.clientSecret,
      createdAt: Date.now(),
    };
    addAccount(account);
    await signIn(account);
    navigate(
      pending.redirectAfter && !pending.redirectAfter.startsWith("/login")
        ? pending.redirectAfter
        : "/",
      { replace: true },
    );
    return true;
  } catch (err) {
    console.warn("[oltn] oauth exchange failed", err);
    return false;
  }
}

/* ---------- boot ---------- */

export async function boot(): Promise<void> {
  migrateLegacyStorage();

  // 1. estado persistido
  store.accounts = readJSON<AccountMeta[]>("accounts", []);
  store.currentAccountId = readJSON<string | null>("currentAccount", null);
  store.settings = {
    ...DEFAULT_SETTINGS,
    ...readJSON<Partial<Settings>>("settings", {}),
  };
  store.prefs = readJSON<AppState["prefs"]>("prefs", {});
  applyAppearance();

  // 2. callback oauth (?code= pode estar no search ou no hash)
  const search = new URLSearchParams(location.search);
  const hashQuery = new URLSearchParams(location.hash.split("?")[1] ?? "");
  const code = search.get("code") ?? hashQuery.get("code");
  const oauthState = search.get("state") ?? hashQuery.get("state");
  if (code) {
    const handled = await handleOAuthCallback(code, oauthState ?? undefined);
    if (handled && window.opener) {
      store.booted = true;
      return;
    }
    history.replaceState(null, "", location.pathname + location.hash);
  }

  // 3. sessão
  const account = currentAccount() ?? store.accounts[0] ?? null;
  if (account) {
    await signIn(account);
  } else {
    store.auth = "anonymous";
  }

  store.booted = true;

  // 4. guarda de rota
  const { path } = parseHash();
  if (store.auth === "anonymous" && path !== "/login") {
    navigate("/login", { replace: true });
  } else if (store.auth === "authenticated" && path === "/login") {
    navigate("/", { replace: true });
  }
}
