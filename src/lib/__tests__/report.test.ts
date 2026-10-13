import { describe, expect, it } from "vitest";
import { REPORT_EMAIL, sendReport } from "../report";

interface CapturedCall {
  url: string;
  init?: RequestInit;
}

function fakeFetch(calls: CapturedCall[], status = 200): typeof fetch {
  return (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response("{}", { status });
  }) as typeof fetch;
}

describe("sendReport", () => {
  it("posts the report to the FormSubmit endpoint", async () => {
    const calls: CapturedCall[] = [];

    const ok = await sendReport(
      { type: "bug", message: "The deck loses the scroll position" },
      fakeFetch(calls),
    );

    expect(ok).toBe(true);
    expect(calls[0]?.url).toBe(`https://formsubmit.co/ajax/${REPORT_EMAIL}`);
    expect(calls[0]?.init?.method).toBe("POST");
    const body = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    expect(body._subject).toBe("[OLTN] Problem report");
    expect(body.type).toBe("bug");
    expect(body.message).toBe("The deck loses the scroll position");
  });

  it("does not send an empty message", async () => {
    const calls: CapturedCall[] = [];

    const ok = await sendReport({ type: "suggestion", message: "   " }, fakeFetch(calls));

    expect(ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("includes the reply email only when given", async () => {
    const withEmail: CapturedCall[] = [];
    await sendReport(
      { type: "bug", message: "Crash on resize", email: " me@example.com " },
      fakeFetch(withEmail),
    );
    const body = JSON.parse(String(withEmail[0]?.init?.body)) as Record<string, unknown>;
    expect(body.email).toBe("me@example.com");

    const withoutEmail: CapturedCall[] = [];
    await sendReport({ type: "bug", message: "No reply address" }, fakeFetch(withoutEmail));
    const bare = JSON.parse(String(withoutEmail[0]?.init?.body)) as Record<string, unknown>;
    expect(bare.email).toBeUndefined();
  });
});
