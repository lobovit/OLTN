import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import {
  buildAuthorizeUrl,
  exchangeCode,
  fetchInstance,
  makeChallenge,
  makeState,
  makeVerifier,
  normalizeInstanceInput,
  openAuthorize,
  PENDING_AUTH_KEY,
  registerApp,
  supportsPKCE,
  type InstanceSummary,
  type PendingAuth,
} from "../api/auth";
import { getRest } from "../api/client";
import type { AccountMeta } from "../api/types";
import { t } from "../i18n/pt-BR";
import { sessionRead, sessionRemove, sessionWrite } from "../lib/storage";
import { navigate } from "../lib/router";
import { store } from "../state/store";
import { addAccount, signIn } from "../state/boot";
import { Icon } from "../components/ui/Icon";
import "./login.css";

const APPS_KEY = "apps";

interface CachedApp {
  clientId: string;
  clientSecret?: string;
}

function readCachedApp(instance: string): CachedApp | null {
  const apps = sessionRead<Record<string, CachedApp>>(APPS_KEY, {});
  return apps[instance] ?? null;
}

function cacheApp(instance: string, app: CachedApp): void {
  const apps = sessionRead<Record<string, CachedApp>>(APPS_KEY, {});
  apps[instance] = app;
  sessionWrite(APPS_KEY, apps);
}

export function LoginPage(): JSX.Element {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [instance, setInstance] = useState<InstanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin) return;
      const data = event.data as { type?: string; code?: string; state?: string };
      if (data?.type !== "oltn-oauth" || !data.code) return;
      void completeLogin(data.code, data.state);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [instance]);

  const discover = async (e: Event): Promise<void> => {
    e.preventDefault();
    setError(null);
    const parsed = normalizeInstanceInput(input);
    if (!parsed) {
      setError(t.loginNotFound);
      return;
    }
    setBusy(true);
    try {
      const info = await fetchInstance(parsed.host);
      setInstance(info);
    } catch {
      setError(String(input).includes("@") ? t.loginNotFound : t.loginInstanceDown);
      setInstance(null);
    } finally {
      setBusy(false);
    }
  };

  const startLogin = async (): Promise<void> => {
    if (!instance) return;
    setBusy(true);
    setError(null);
    try {
      const host = instance.uri;
      let app = readCachedApp(host);
      if (!app) {
        app = await registerApp(host);
        cacheApp(host, app);
      }
      const pkce = await supportsPKCE(host);
      const pending: PendingAuth = {
        instance: host,
        clientId: app.clientId,
        clientSecret: app.clientSecret,
        pkce,
        state: makeState(),
        redirectAfter: "/",
      };
      if (pkce) {
        const verifier = makeVerifier();
        pending.codeVerifier = verifier;
        const challenge = await makeChallenge(verifier);
        sessionWrite(PENDING_AUTH_KEY, pending);
        openAuthorize(
          buildAuthorizeUrl({
            instance: host,
            clientId: app.clientId,
            pkce: true,
            codeChallenge: challenge,
            state: pending.state,
            forceLogin: store.accounts.length > 0,
          }),
        );
      } else {
        sessionWrite(PENDING_AUTH_KEY, pending);
        openAuthorize(
          buildAuthorizeUrl({
            instance: host,
            clientId: app.clientId,
            state: pending.state,
            forceLogin: store.accounts.length > 0,
          }),
        );
      }
    } catch (err) {
      console.warn("[oltn] login start failed", err);
      setError(t.errorAuth);
    } finally {
      setBusy(false);
    }
  };

  const completeLogin = async (code: string, state?: string): Promise<void> => {
    if (exchanging) return;
    setExchanging(true);
    const pending = sessionRead<PendingAuth | null>(PENDING_AUTH_KEY, null);
    if (!pending) {
      setError(t.errorAuth);
      setExchanging(false);
      return;
    }
    if (pending.state && state !== pending.state) {
      console.warn("[oltn] oauth state mismatch");
      setError(t.errorAuth);
      setExchanging(false);
      return;
    }
    sessionRemove(PENDING_AUTH_KEY);
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
      navigate("/", { replace: true });
    } catch (err) {
      console.warn("[oltn] oauth exchange failed", err);
      setError(t.errorAuth);
    } finally {
      setExchanging(false);
    }
  };

  return (
    <div class="login-page">
      <div class="login-stack">
        <div class="login-brand">
          <svg class="login-mark" viewBox="0 0 64 64" width={104} height={104} aria-hidden>
            <circle class="mark-ring" cx="32" cy="32" r="21" fill="none" strokeWidth="5" />
            <g class="mark-orbit">
              <circle cx="32" cy="11" r="6.5" />
            </g>
          </svg>
          <h1 class="login-wordmark">OLTN</h1>
          <p class="login-tagline">{t.tagline}</p>
        </div>

        <div class="login-card glass">
          {!instance ? (
            <form onSubmit={(e) => void discover(e)}>
              <p class="login-lead">{t.loginSubtitle}</p>
              <label class="login-label" htmlFor="instance">
                {t.instanceLabel}
              </label>
              <input
                id="instance"
                class="field"
                placeholder={t.instancePlaceholder}
                value={input}
                autocomplete="url"
                autocapitalize="off"
                spellcheck={false}
                onInput={(e) => setInput((e.target as HTMLInputElement).value)}
                autoFocus
              />
              {error && <p class="login-error">{error}</p>}
              <button type="submit" class="btn primary block" disabled={busy || !input.trim()}>
                {busy ? <span class="spinner" /> : <Icon name="arrow-right-line" size={16} />}
                {busy ? t.loginLooking : t.loginButton}
              </button>
            </form>
          ) : (
            <div class="instance-preview">
              {instance.thumbnail && <img class="instance-thumb" src={instance.thumbnail} alt="" />}
              <div class="instance-title">{instance.title}</div>
              <div class="instance-uri muted">{instance.uri}</div>
              {error && <p class="login-error">{error}</p>}
              <div class="login-actions">
                <button
                  type="button"
                  class="btn ghost"
                  onClick={() => {
                    setInstance(null);
                    setError(null);
                  }}
                >
                  {t.back}
                </button>
                <button
                  type="button"
                  class="btn primary"
                  onClick={() => void startLogin()}
                  disabled={busy || exchanging}
                >
                  {busy || exchanging ? <span class="spinner" /> : null}
                  {exchanging ? t.loading : t.loginButton}
                </button>
              </div>
            </div>
          )}

          {store.accounts.length > 0 && (
            <div class="existing-accounts">
              <div class="section-title" style={{ padding: "16px 0 8px" }}>
                {t.accounts}
              </div>
              {store.accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  class="list-row"
                  onClick={() => {
                    void signIn(account).then(() => navigate("/", { replace: true }));
                  }}
                >
                  <img class="avatar" src={account.avatar} alt="" width={36} height={36} />
                  <div class="row-main">
                    <div class="row-title">{account.displayName}</div>
                    <div class="row-sub">{account.handle}</div>
                  </div>
                  <Icon name="arrow-right-line" size={16} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
