import { describe, expect, it, vi } from "vitest";

vi.mock("../../i18n/pt-BR", () => ({
  t: {
    loggedOut: "session-expired",
    errorForbidden: "forbidden",
    errorNotFound: "not-found",
    errorRateLimit: "rate-limited",
    errorNetwork: "network",
    errorGeneric: "generic",
  },
}));

import { HttpError, httpStatusOf, userMessageForError } from "../errors";
import { isRetriable, withRetry } from "../retry";
import { t } from "../../i18n/pt-BR";

describe("httpStatusOf", () => {
  it("reads the status from our HttpError", () => {
    expect(httpStatusOf(new HttpError("x", 404))).toBe(404);
  });

  it("reads statusCode from masto-style errors", () => {
    expect(httpStatusOf({ statusCode: 429 })).toBe(429);
  });

  it("returns null for ordinary errors", () => {
    expect(httpStatusOf(new Error("boom"))).toBeNull();
    expect(httpStatusOf("string")).toBeNull();
  });
});

describe("userMessageForError", () => {
  it("maps codes to friendly messages", () => {
    expect(userMessageForError(new HttpError("x", 401))).toBe(t.loggedOut);
    expect(userMessageForError({ statusCode: 403 })).toBe(t.errorForbidden);
    expect(userMessageForError(new HttpError("x", 429))).toBe(t.errorRateLimit);
  });

  it("treats network failure as TypeError", () => {
    expect(userMessageForError(new TypeError("Failed to fetch"))).toBe(t.errorNetwork);
  });

  it("uses the contextual fallback on 5xx and unknown errors", () => {
    expect(userMessageForError(new HttpError("x", 500), "ctx")).toBe("ctx");
    expect(userMessageForError(new Error("boom"), "ctx")).toBe("ctx");
  });
});

describe("isRetriable", () => {
  it("retries 5xx, timeout and network; never 4xx", () => {
    expect(isRetriable(new HttpError("x", 500))).toBe(true);
    expect(isRetriable(new TypeError("Failed to fetch"))).toBe(true);
    expect(isRetriable(new HttpError("x", 404))).toBe(false);
    expect(isRetriable(new Error("boom"))).toBe(false);
  });
});

describe("withRetry", () => {
  const noSleep = () => Promise.resolve();

  it("success on the first attempt does not retry", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn, { sleep: noSleep })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries until it succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("net"))
      .mockRejectedValueOnce(new TypeError("net"))
      .mockResolvedValue("ok");
    await expect(
      withRetry(fn, { maxAttempts: 3, retryIf: isRetriable, sleep: noSleep }),
    ).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("stops at the limit and propagates the last error", async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError("net"));
    await expect(
      withRetry(fn, { maxAttempts: 3, retryIf: isRetriable, sleep: noSleep }),
    ).rejects.toThrow("net");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry ineligible errors", async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError("x", 422));
    await expect(
      withRetry(fn, { maxAttempts: 3, retryIf: isRetriable, sleep: noSleep }),
    ).rejects.toThrow("x");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
