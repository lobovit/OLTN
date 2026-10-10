/* OAuth + descoberta de instância (baseado no fluxo do Phanpy, simplificado). */

import { isRetriable, withRetry } from "../lib/retry";

const SCOPES = "read write follow";

export const REDIRECT_URI = location.origin + location.pathname;

function baseUrl(instance: string): string {
  return `https://${instance}`;
}

export interface InstanceSummary {
  uri: string;
  title: string;
  thumbnail?: string | null;
}

export interface AppCredentials {
  clientId: string;
  clientSecret?: string;
}

export function normalizeInstanceInput(input: string): {
  host: string;
  username?: string;
} | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  const mention = value.match(/^@?([^@\s]+)@([^@\s]+)$/);
  if (mention) {
    const host = cleanHost(mention[2]);
    return host ? { host, username: mention[1] } : null;
  }
  const host = cleanHost(value);
  return host ? { host } : null;
}

function cleanHost(raw: string): string | null {
  let host = raw
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .split("/")[0];
  if (!host || (!host.includes(".") && !host.includes(":"))) return null;
  if (!/^[a-z0-9.-]+(:\d{2,5})?$/.test(host)) return null;
  return host;
}

export async function fetchInstance(instance: string): Promise<InstanceSummary> {
  const res = await withRetry(
    () =>
      fetch(`${baseUrl(instance)}/api/v1/instance`, {
        headers: { Accept: "application/json" },
      }),
    { maxAttempts: 2, baseDelayMs: 400, retryIf: isRetriable },
  );
  if (!res.ok) throw new Error(`instance_http_${res.status}`);
  const json = (await res.json()) as {
    uri?: string;
    title?: string;
    thumbnail?: string | null;
  };
  return {
    uri: json.uri || instance,
    title: json.title || instance,
    thumbnail: json.thumbnail ?? null,
  };
}

export async function registerApp(instance: string): Promise<AppCredentials> {
  const res = await fetch(`${baseUrl(instance)}/api/v1/apps`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_name: "OLTN",
      redirect_uris: REDIRECT_URI,
      scopes: SCOPES,
      website: REDIRECT_URI,
    }).toString(),
  });
  if (!res.ok) throw new Error(`register_http_${res.status}`);
  const json = (await res.json()) as {
    client_id: string;
    client_secret?: string;
  };
  return {
    clientId: json.client_id,
    clientSecret: json.client_secret || undefined,
  };
}

export async function supportsPKCE(instance: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl(instance)}/.well-known/oauth-authorization-server`);
    if (!res.ok) return false;
    const json = (await res.json()) as {
      code_challenge_methods_supported?: string[];
    };
    return !!json.code_challenge_methods_supported?.includes("S256");
  } catch {
    return false;
  }
}

export function makeVerifier(): string {
  const array = new Uint32Array(28);
  crypto.getRandomValues(array);
  return Array.from(array, (n) => n.toString(16).padStart(2, "0")).join("");
}

/** Valor aleatório para o parâmetro `state` do OAuth (CSRF/replay). */
export function makeState(): string {
  const array = new Uint32Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (n) => n.toString(16).padStart(2, "0")).join("");
}

export async function makeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function buildAuthorizeUrl(opts: {
  instance: string;
  clientId: string;
  pkce?: boolean;
  codeChallenge?: string;
  forceLogin?: boolean;
  state?: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
  });
  if (opts.pkce && opts.codeChallenge) {
    params.set("code_challenge_method", "S256");
    params.set("code_challenge", opts.codeChallenge);
  }
  if (opts.state) params.set("state", opts.state);
  if (opts.forceLogin) params.set("force_login", "true");
  return `${baseUrl(opts.instance)}/oauth/authorize?${params.toString()}`;
}

export async function exchangeCode(opts: {
  instance: string;
  clientId: string;
  clientSecret?: string;
  code: string;
  codeVerifier?: string;
}): Promise<{ accessToken: string }> {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
    code: opts.code,
  });
  if (opts.clientSecret) params.set("client_secret", opts.clientSecret);
  if (opts.codeVerifier) params.set("code_verifier", opts.codeVerifier);
  const res = await fetch(`${baseUrl(opts.instance)}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`token_http_${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("token_missing");
  return { accessToken: json.access_token };
}

export async function revokeToken(opts: {
  instance: string;
  clientId: string;
  clientSecret?: string;
  token: string;
}): Promise<boolean> {
  try {
    const params = new URLSearchParams({
      client_id: opts.clientId,
      token: opts.token,
    });
    if (opts.clientSecret) params.set("client_secret", opts.clientSecret);
    const res = await fetch(`${baseUrl(opts.instance)}/oauth/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface PendingAuth {
  instance: string;
  clientId: string;
  clientSecret?: string;
  codeVerifier?: string;
  pkce: boolean;
  state?: string;
  redirectAfter?: string;
}

export const PENDING_AUTH_KEY = "pendingAuth";

/** Abre a URL de autorização (popup com fallback para redirect completo). */
export function openAuthorize(url: string): void {
  const popup = window.open(url, "oltn-oauth", "width=560,height=720");
  if (!popup) location.href = url;
}
