import { createRestAPIClient, createStreamingAPIClient } from "masto";
import { TtlCache, asyncMemo } from "../lib/mem";
import { isRetriable, withRetry } from "../lib/retry";
import type { CustomEmoji, InstanceInfo, Notification, RestClient, Status } from "./types";

const restCache = new Map<string, RestClient>();

export function getRest(instance: string, accessToken?: string): RestClient {
  const key = `${instance}|${accessToken ?? ""}`;
  const cached = restCache.get(key);
  if (cached) return cached;
  const client = createRestAPIClient({
    url: `https://${instance}`,
    accessToken,
    timeout: 30_000,
    mediaTimeout: 120_000,
  });
  restCache.set(key, client);
  return client;
}

export function dropRest(instance: string, accessToken?: string): void {
  restCache.delete(`${instance}|${accessToken ?? ""}`);
}

const customEmojisCache = new Map<string, Promise<CustomEmoji[]>>();

/** Instance custom emojis (cached per session/instance). */
export function getCustomEmojis(instance: string, accessToken?: string): Promise<CustomEmoji[]> {
  const key = `${instance}|${accessToken ?? ""}`;
  let promise = customEmojisCache.get(key);
  if (!promise) {
    promise = (async () => getRest(instance, accessToken).v1.customEmojis.list())().catch((err) => {
      customEmojisCache.delete(key);
      throw err;
    });
    customEmojisCache.set(key, promise);
  }
  return promise;
}

const instanceCache = new TtlCache(5 * 60_000);

export async function getInstanceInfo(instance: string): Promise<InstanceInfo> {
  return asyncMemo(instanceCache, instance, async () => {
    try {
      const info = await withRetry(() => getRest(instance).v1.instance.fetch(), {
        maxAttempts: 2,
        baseDelayMs: 400,
        retryIf: isRetriable,
      });
      return {
        uri: info.uri || instance,
        title: info.title || instance,
        thumbnail: info.thumbnail ?? null,
        streamingApi: info.urls?.streamingApi ?? null,
        version: info.version,
      };
    } catch {
      return { uri: instance, title: instance };
    }
  });
}

export interface StreamHandlers {
  onUpdate?: (status: Status) => void;
  onDelete?: (statusId: string) => void;
  onNotification?: (notification: Notification) => void;
  onStatusUpdate?: (status: Status) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export function connectUserStream(opts: {
  instance: string;
  accessToken: string;
  streamingApi?: string | null;
  handlers: StreamHandlers;
}): () => void {
  const url = opts.streamingApi || `wss://${opts.instance}/api/v1/streaming`;
  let stopped = false;
  let closeClient: (() => void) | null = null;

  void (async () => {
    try {
      const client = createStreamingAPIClient({
        streamingApiUrl: url,
        accessToken: opts.accessToken,
        implementation: WebSocket,
        retry: true,
      });
      closeClient = () => client.close();
      if (stopped) {
        closeClient();
        return;
      }
      opts.handlers.onOpen?.();
      const subscription = client.user.subscribe();
      for await (const event of subscription) {
        if (stopped) break;
        switch (event.event) {
          case "update":
            opts.handlers.onUpdate?.(event.payload);
            break;
          case "delete":
            opts.handlers.onDelete?.(event.payload);
            break;
          case "notification":
            opts.handlers.onNotification?.(event.payload);
            break;
          case "status.update":
            opts.handlers.onStatusUpdate?.(event.payload);
            break;
        }
      }
    } catch (err) {
      if (!stopped) console.warn("[oltn] stream error", err);
    } finally {
      if (!stopped) opts.handlers.onClose?.();
    }
  })();

  return () => {
    stopped = true;
    try {
      closeClient?.();
    } catch {
      /* noop */
    }
    opts.handlers.onClose?.();
  };
}
