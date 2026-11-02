import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountMeta } from "../../api/types";
import { getRest } from "../../api/client";
import { decodeVapidKey, disablePush, enablePush, isPushEnabled, PushError } from "../push";

vi.mock("../../api/client", () => ({ getRest: vi.fn() }));

const VAPID =
  "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksig";

const baseAccount: AccountMeta = {
  id: "1",
  instance: "mock.instance",
  handle: "@you@mock.instance",
  displayName: "You",
  avatar: "",
  accessToken: "token",
  clientId: "client",
  createdAt: 1,
};

let accountSequence = 0;

function subscription() {
  return {
    endpoint: "https://push.example/sub",
    options: { applicationServerKey: null },
    toJSON: () => ({
      endpoint: "https://push.example/sub",
      expirationTime: null,
      keys: { p256dh: "p256dh", auth: "auth" },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  } as unknown as PushSubscription;
}

function setup(
  permission: NotificationPermission = "granted",
  existing = false,
  appScopes?: string[],
) {
  const account = { ...baseAccount, accessToken: `token-${++accountSequence}` };
  const sub = subscription();
  const subscribe = vi.fn().mockResolvedValue(sub);
  const getSubscription = vi.fn().mockResolvedValue(existing ? sub : null);
  const registration = {
    pushManager: { getSubscription, subscribe },
  } as unknown as ServiceWorkerRegistration;
  const serviceWorker = {
    register: vi.fn().mockResolvedValue(registration),
    getRegistration: vi.fn().mockResolvedValue(registration),
    ready: Promise.resolve(registration),
  };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: serviceWorker,
  });
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", {
    permission,
    requestPermission: vi.fn().mockResolvedValue(permission),
  });
  const create = vi.fn().mockResolvedValue({});
  const fetchSubscription = vi.fn().mockResolvedValue({});
  const remove = vi.fn().mockResolvedValue(undefined);
  const verifyCredentials = vi.fn().mockResolvedValue({ scopes: appScopes });
  vi.mocked(getRest).mockReturnValue({
    v2: {
      instance: {
        fetch: vi.fn().mockResolvedValue({ configuration: { vapid: { publicKey: VAPID } } }),
      },
    },
    v1: {
      apps: { verifyCredentials },
      push: { subscription: { create, fetch: fetchSubscription, remove } },
    },
  } as never);
  return {
    account,
    sub,
    subscribe,
    getSubscription,
    serviceWorker,
    create,
    fetchSubscription,
    remove,
    verifyCredentials,
  };
}

beforeEach(() => {
  vi.mocked(getRest).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "serviceWorker");
  Reflect.deleteProperty(window, "isSecureContext");
});

describe("decodeVapidKey", () => {
  it("decodes URL-safe base64 without padding", () => {
    expect([...decodeVapidKey("AQIDBAU")]).toEqual([1, 2, 3, 4, 5]);
  });

  it("accepts URL-safe characters", () => {
    expect([...decodeVapidKey("-_8")]).toEqual([0xfb, 0xff]);
  });
});

describe("push subscriptions", () => {
  it("registers the browser subscription on the server", async () => {
    const run = setup();
    await enablePush(run.account);
    expect(run.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(VAPID).buffer,
    });
    expect(run.create).toHaveBeenCalledWith({
      subscription: {
        endpoint: "https://push.example/sub",
        keys: { p256dh: "p256dh", auth: "auth" },
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
    });
  });

  it("requires notification permission", async () => {
    const run = setup("denied");
    await expect(enablePush(run.account)).rejects.toMatchObject({ kind: "permission" });
  });

  it("asks for a new session when the token lacks the push scope", async () => {
    const run = setup("granted", false, ["read", "write", "follow"]);
    await expect(enablePush(run.account)).rejects.toMatchObject({ kind: "scope" });
    expect(run.verifyCredentials).toHaveBeenCalled();
  });

  it("checks both the browser and server registration", async () => {
    const run = setup("granted", true);
    await expect(isPushEnabled(run.account)).resolves.toBe(true);
    expect(run.fetchSubscription).toHaveBeenCalled();
  });

  it("removes both subscriptions when disabled", async () => {
    const run = setup("granted", true);
    await disablePush(run.account);
    expect(run.remove).toHaveBeenCalled();
    expect(run.sub.unsubscribe).toHaveBeenCalled();
  });

  it("reports server failures", async () => {
    const run = setup();
    run.create.mockRejectedValue(new Error("http"));
    await expect(enablePush(run.account)).rejects.toBeInstanceOf(PushError);
    await expect(enablePush(run.account)).rejects.toMatchObject({ kind: "server" });
  });
});
