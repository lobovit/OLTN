import { afterEach, describe, expect, it, vi } from "vitest";
import { TRANSLATE_TARGETS, translateText } from "../translate";

interface StubResponse {
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
}

function stubFetch(response: StubResponse) {
  const mock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("translateText", () => {
  it("offers pt-BR instead of pt, which Mastodon would ignore", () => {
    expect(TRANSLATE_TARGETS).toContain("pt-BR");
    expect(TRANSLATE_TARGETS).not.toContain("pt");
  });

  it("joins translated segments and detects the source language", async () => {
    const fetchMock = stubFetch({
      ok: true,
      json: async () => [
        [
          ["olá ", "hello ", null],
          ["mundo", "world", null],
        ],
        null,
        "en",
      ],
    });
    const result = await translateText("hello world", "pt-BR");
    expect(result.text).toBe("olá mundo");
    expect(result.source).toBe("en");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("translate.googleapis.com");
    expect(init.method).toBe("POST");
    expect(String(init.body)).toContain("tl=pt-BR");
  });

  it("fails when the response is not ok", async () => {
    stubFetch({ ok: false, status: 429, json: async () => ({}) });
    await expect(translateText("oi", "en")).rejects.toThrow("translate_http_429");
  });

  it("fails when the response has no segments", async () => {
    stubFetch({ ok: true, json: async () => ({ foo: 1 }) });
    await expect(translateText("oi", "en")).rejects.toThrow("translate_parse");
  });

  it("fails when the translation is empty", async () => {
    stubFetch({ ok: true, json: async () => [[["", "oi", null]], null, "pt"] });
    await expect(translateText("oi", "en")).rejects.toThrow("translate_empty");
  });
});
