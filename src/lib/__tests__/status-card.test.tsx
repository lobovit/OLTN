import { beforeEach, describe, expect, it } from "vitest";
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

describe("StatusCard: ações em posts remotos", () => {
  it("habilita curtir/responder mesmo quando o autor é de outra instância", () => {
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

  it("habilita ações também para posts carregados de outra instância", () => {
    const key = putStatus(remoteStatus(), "other.instance");
    const host = document.createElement("div");
    render(<StatusCard statusKey={key} />, host);
    expect(host.querySelector<HTMLButtonElement>(".status-action.fav")?.disabled).toBe(false);
  });
});
