import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import type { Status } from "../../api/types";
import { StatusCard } from "../../components/status/StatusCard";
import { putStatus, store } from "../../state/store";

function remoteStatus(): Status {
  return {
    id: "123",
    uri: "https://remote.example/users/ana/statuses/123",
    url: "https://remote.example/@ana/123",
    createdAt: new Date().toISOString(),
    content: "<p>oi</p>",
    account: {
      id: "a1",
      acct: "ana@remote.example",
      username: "ana",
      displayName: "Ana",
      avatar: "",
      avatarStatic: "",
      emojis: [],
    },
    mediaAttachments: [],
    mentions: [],
    tags: [],
    emojis: [],
    favouritesCount: 0,
    reblogsCount: 0,
    repliesCount: 0,
  } as unknown as Status;
}

beforeEach(() => {
  store.statuses = {};
  store.statusSources = {};
  store.auth = "authenticated";
  store.me = null;
  store.instance = null;
  store.accounts = [
    {
      id: "me",
      instance: "my.instance",
      handle: "@eu@my.instance",
      displayName: "Eu",
      avatar: "",
      accessToken: "tok",
      clientId: "client",
      createdAt: 0,
    },
  ];
  store.currentAccountId = "me";
});

describe("StatusCard: actions on remote posts", () => {
  it("enables fav/reply even when the author is from another instance", () => {
    const key = putStatus(remoteStatus(), "my.instance");
    const host = document.createElement("div");
    render(<StatusCard statusKey={key} />, host);
    const reply = host.querySelector<HTMLButtonElement>(".status-action.reply");
    const fav = host.querySelector<HTMLButtonElement>(".status-action.fav");
    const boost = host.querySelector<HTMLButtonElement>(".status-action.boost");
    expect(reply?.disabled).toBe(false);
    expect(fav?.disabled).toBe(false);
    expect(boost?.disabled).toBe(false);
  });

  it("also enables actions for posts loaded from another instance", () => {
    const key = putStatus(remoteStatus(), "other.instance");
    const host = document.createElement("div");
    render(<StatusCard statusKey={key} />, host);
    expect(host.querySelector<HTMLButtonElement>(".status-action.fav")?.disabled).toBe(false);
  });
});

describe("StatusCard: translation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to Google when the instance replies without content", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("translate.googleapis.com")) {
        return new Response(JSON.stringify([[["olá mundo", "hello world", null]], null, "en"]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const key = putStatus(remoteStatus(), "my.instance");
    const host = document.createElement("div");
    render(<StatusCard statusKey={key} />, host);
    host.querySelector<HTMLButtonElement>(".translation .cw-toggle")?.click();
    await vi.waitFor(() => {
      expect(host.querySelector(".translate-option")).toBeTruthy();
    });
    host.querySelector<HTMLButtonElement>(".translate-option")?.click();
    await vi.waitFor(() => {
      expect(host.querySelector(".content")?.textContent).toContain("olá mundo");
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
