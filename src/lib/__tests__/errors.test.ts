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
  it("lê o status do nosso HttpError", () => {
    expect(httpStatusOf(new HttpError("x", 404))).toBe(404);
  });

  it("lê statusCode de erros estilo masto", () => {
    expect(httpStatusOf({ statusCode: 429 })).toBe(429);
  });

  it("devolve null para erros comuns", () => {
    expect(httpStatusOf(new Error("boom"))).toBeNull();
    expect(httpStatusOf("string")).toBeNull();
  });
});

describe("userMessageForError", () => {
  it("mapeia códigos para mensagens amigáveis", () => {
    expect(userMessageForError(new HttpError("x", 401))).toBe(t.loggedOut);
    expect(userMessageForError({ statusCode: 403 })).toBe(t.errorForbidden);
    expect(userMessageForError(new HttpError("x", 429))).toBe(t.errorRateLimit);
  });

  it("trata falha de rede como TypeError", () => {
    expect(userMessageForError(new TypeError("Failed to fetch"))).toBe(t.errorNetwork);
  });

  it("usa o fallback contextual em 5xx e desconhecidos", () => {
    expect(userMessageForError(new HttpError("x", 500), "ctx")).toBe("ctx");
    expect(userMessageForError(new Error("boom"), "ctx")).toBe("ctx");
  });
});

describe("isRetriable", () => {
  it("repete 5xx, timeout e rede; nunca 4xx", () => {
    expect(isRetriable(new HttpError("x", 500))).toBe(true);
    expect(isRetriable(new TypeError("Failed to fetch"))).toBe(true);
    expect(isRetriable(new HttpError("x", 404))).toBe(false);
    expect(isRetriable(new Error("boom"))).toBe(false);
  });
});

describe("withRetry", () => {
  const noSleep = () => Promise.resolve();

  it("sucesso na primeira tentativa não repete", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withRetry(fn, { sleep: noSleep })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("repete até conseguir", async () => {
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

  it("para no limite e propaga o último erro", async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError("net"));
    await expect(
      withRetry(fn, { maxAttempts: 3, retryIf: isRetriable, sleep: noSleep }),
    ).rejects.toThrow("net");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("não repete erros não elegíveis", async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError("x", 422));
    await expect(
      withRetry(fn, { maxAttempts: 3, retryIf: isRetriable, sleep: noSleep }),
    ).rejects.toThrow("x");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
