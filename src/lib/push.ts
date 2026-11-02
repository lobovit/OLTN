import { getRest } from "../api/client";
import type { AccountMeta, RestClient } from "../api/types";

type PushCreateParams = Omit<
  Parameters<RestClient["v1"]["push"]["subscription"]["create"]>[0],
  "subscription" | "data" | "policy"
> & {
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    standard?: boolean;
  };
  data?: { alerts?: Record<string, boolean>; policy?: string };
};

export type PushSupport = "supported" | "unsupported" | "insecure";
export type PushErrorKind =
  | "unsupported"
  | "insecure"
  | "permission"
  | "scope"
  | "vapid"
  | "subscription"
  | "server";

export class PushError extends Error {
  constructor(readonly kind: PushErrorKind) {
    super(kind);
    this.name = "PushError";
  }
}

/** Whether this context can create a Web Push subscription. */
export function pushSupport(): PushSupport {
  if (!window.isSecureContext) return "insecure";
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  return "supported";
}

/** Decodes the URL-safe base64 VAPID key returned by the Mastodon API. */
export function decodeVapidKey(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index++) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

function sameKey(current: ArrayBuffer | null, expected: Uint8Array): boolean {
  if (!current) return false;
  const bytes = new Uint8Array(current);
  if (bytes.length !== expected.length) return false;
  return bytes.every((value, index) => value === expected[index]);
}

interface PushPreparation {
  registration: ServiceWorkerRegistration;
  key: Uint8Array;
}

const preparations = new Map<string, Promise<PushPreparation>>();

/** Registers the worker and fetches the instance key before the permission prompt. */
export function preparePush(account: AccountMeta): Promise<PushPreparation> {
  const cacheKey = `${account.instance}|${account.accessToken}`;
  let promise = preparations.get(cacheKey);
  if (!promise) {
    promise = (async () => {
      const client = getRest(account.instance, account.accessToken);
      try {
        const app = await client.v1.apps.verifyCredentials();
        if (app.scopes && !app.scopes.includes("push")) throw new PushError("scope");
      } catch (err) {
        if (err instanceof PushError) throw err;
      }
      const info = await client.v2.instance.fetch();
      const publicKey = info.configuration?.vapid?.publicKey;
      if (!publicKey) throw new PushError("vapid");
      let key: Uint8Array;
      try {
        key = decodeVapidKey(publicKey);
      } catch {
        throw new PushError("vapid");
      }
      const registration = await navigator.serviceWorker.register("./sw.js");
      await navigator.serviceWorker.ready;
      return { registration, key };
    })().catch((err) => {
      preparations.delete(cacheKey);
      throw err;
    });
    preparations.set(cacheKey, promise);
  }
  return promise;
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "supported") return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Checks the browser subscription and the server-side registration together. */
export async function isPushEnabled(account: AccountMeta): Promise<boolean> {
  if (pushSupport() !== "supported" || Notification.permission !== "granted") return false;
  const subscription = await getPushSubscription();
  if (!subscription) return false;
  try {
    await getRest(account.instance, account.accessToken).v1.push.subscription.fetch();
    return true;
  } catch {
    return false;
  }
}

export async function enablePush(account: AccountMeta): Promise<void> {
  const support = pushSupport();
  if (support !== "supported") {
    throw new PushError(support === "insecure" ? "insecure" : "unsupported");
  }
  if (Notification.permission === "denied") throw new PushError("permission");
  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new PushError("permission");
  }

  const { registration, key } = await preparePush(account);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key.buffer as ArrayBuffer,
      });
    } catch {
      throw new PushError("subscription");
    }
  }

  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) throw new PushError("subscription");

  const client = getRest(account.instance, account.accessToken);
  const params: PushCreateParams = {
    subscription: {
      endpoint: json.endpoint,
      keys: { p256dh, auth },
      standard: true,
    },
    data: {
      alerts: {
        follow: true,
        followRequest: true,
        favourite: true,
        reblog: true,
        mention: true,
        poll: true,
        update: true,
      },
      policy: "all",
    },
  };
  try {
    await client.v1.push.subscription.create(
      params as unknown as Parameters<RestClient["v1"]["push"]["subscription"]["create"]>[0],
    );
  } catch {
    throw new PushError("server");
  }
}

export async function disablePush(account: AccountMeta): Promise<void> {
  try {
    await getRest(account.instance, account.accessToken).v1.push.subscription.remove();
  } catch {}
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
  preparations.delete(`${account.instance}|${account.accessToken}`);
}
