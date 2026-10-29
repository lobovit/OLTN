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

describe("StatusCard: boost cards", () => {
  it("renders the inner status from the cache, not the stale wrapper copy", () => {
    const inner = remoteStatus();
    const wrapper = {
      ...remoteStatus(),
      id: "999",
      uri: "https://remote.example/users/ana/statuses/999",
      reblog: inner,
    } as unknown as Status;
    const wrapperKey = putStatus(wrapper as Status, "my.instance");
    // A later fetch updates the inner entry (e.g. counts/boost state).
    putStatus({ ...inner, reblogsCount: 7, reblogged: true } as unknown as Status, "my.instance");

    const host = document.createElement("div");
    render(<StatusCard statusKey={wrapperKey} />, host);
    const boost = host.querySelector<HTMLButtonElement>(".status-action.boost");
    expect(boost?.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector(".status-action.boost .count")?.textContent).toBe("7");
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

describe("StatusCard: privacy lock", () => {
  it("shows a lock for private and direct posts", () => {
    for (const visibility of ["private", "direct"] as const) {
      store.statuses = {};
      const key = putStatus({ ...remoteStatus(), visibility } as Status, "my.instance");
      const host = document.createElement("div");
      render(<StatusCard statusKey={key} />, host);
      expect(host.querySelector(".status-lock")).toBeTruthy();
    }
  });

  it("hides the lock for public and unlisted posts", () => {
    for (const visibility of ["public", "unlisted"] as const) {
      store.statuses = {};
      const key = putStatus({ ...remoteStatus(), visibility } as Status, "my.instance");
      const host = document.createElement("div");
      render(<StatusCard statusKey={key} />, host);
      expect(host.querySelector(".status-lock")).toBeNull();
    }
  });
});
