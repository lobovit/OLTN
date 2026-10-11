import { beforeEach, describe, expect, it } from "vitest";
import type { Notification } from "../../api/types";
import { pushNotification, store } from "../../state/store";

function notif(id: string, type = "favourite"): Notification {
  return { id, type, createdAt: "2026-01-01T00:00:00.000Z" } as unknown as Notification;
}

describe("pushNotification", () => {
  beforeEach(() => {
    store.notifQueue = [];
    store.notifBadge = 0;
  });

  it("enfileira a notificação e incrementa o badge", () => {
    pushNotification(notif("1"));
    expect(store.notifQueue.map((n) => n.id)).toEqual(["1"]);
    expect(store.notifBadge).toBe(1);
  });

  it("não duplica a mesma notificação", () => {
    pushNotification(notif("1"));
    pushNotification(notif("1"));
    expect(store.notifQueue).toHaveLength(1);
    expect(store.notifBadge).toBe(1);
  });

  it("mantém no máximo 40 itens na fila", () => {
    for (let i = 0; i < 45; i++) pushNotification(notif(String(i)));
    expect(store.notifQueue).toHaveLength(40);
    expect(store.notifQueue[0].id).toBe("44");
    expect(store.notifBadge).toBe(45);
  });
});
