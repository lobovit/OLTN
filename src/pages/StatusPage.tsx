import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import { getRest } from "../api/client";
import type { Status } from "../api/types";
import { t } from "../i18n/pt-BR";
import { back } from "../lib/router";
import { StatusCard } from "../components/status/StatusCard";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import { TimelineSkeleton } from "../components/feed/Timeline";
import { currentAccount, putStatus, putStatuses, statusKey, store } from "../state/store";
import { useStatus } from "../state/hooks";

interface Props {
  params: { instance?: string; id: string };
}

function replyDepth(status: Status, byId: Map<string, Status>): number {
  let depth = 0;
  let cur: Status | undefined = status;
  while (cur?.inReplyToId && byId.has(cur.inReplyToId) && depth < 10) {
    cur = byId.get(cur.inReplyToId);
    depth += 1;
  }
  return depth;
}

export function StatusPage({ params }: Props): JSX.Element {
  const instance = params.instance;
  const id = params.id;
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [ancestors, setAncestors] = useState<Status[]>([]);
  const [descendants, setDescendants] = useState<Status[]>([]);
  const [error, setError] = useState<unknown>(null);
  const focus = useStatus(focusKey ?? "");
  const focusRef = useRef<HTMLDivElement>(null);
  const lastPostedKey = useSnapshot(store).ui.lastPostedKey;

  /* Insere a resposta recém-publicada na thread aberta (sem recarregar) */
  useEffect(() => {
    if (!lastPostedKey) return;
    const status = store.statuses[lastPostedKey];
    if (!status?.inReplyToId) return;
    const parentId = status.inReplyToId;
    const inThread =
      parentId === id ||
      (focus ? focus.id === parentId : false) ||
      ancestors.some((s) => s.id === parentId) ||
      descendants.some((s) => s.id === parentId);
    if (!inThread) return;
    setDescendants((prev) => (prev.some((s) => s.id === status.id) ? prev : [...prev, status]));
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-status-key="${CSS.escape(statusKey(status))}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPostedKey]);

  /* Centraliza o toot focado na tela ao abrir a thread. Re-centraliza quando
     mídias de posts acima terminam de carregar, sem brigar com o usuário. */
  useEffect(() => {
    if (!focusKey) return;
    const container = focusRef.current?.closest<HTMLElement>(".deck-body");
    if (!container) return;
    let cancelled = false;
    let lastTop = -1;
    let userMoved = false;

    const center = (): void => {
      const el = focusRef.current;
      if (cancelled || !el) return;
      const rect = el.getBoundingClientRect();
      const contRect = container.getBoundingClientRect();
      const target = Math.max(
        0,
        container.scrollTop +
          (rect.top - contRect.top) -
          (container.clientHeight - rect.height) / 2,
      );
      lastTop = target;
      container.scrollTo({ top: target, behavior: "auto" });
    };

    const onScroll = (): void => {
      if (lastTop >= 0 && Math.abs(container.scrollTop - lastTop) > 40) userMoved = true;
    };
    container.addEventListener("scroll", onScroll, { passive: true });

    const raf = requestAnimationFrame(center);

    const pending = [...container.querySelectorAll<HTMLImageElement>("img")].filter(
      (img) => !img.complete,
    );
    let remaining = pending.length;
    const onLoad = (): void => {
      remaining -= 1;
      if (remaining <= 0 && !userMoved) center();
    };
    for (const img of pending) img.addEventListener("load", onLoad, { once: true });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      container.removeEventListener("scroll", onScroll);
      for (const img of pending) img.removeEventListener("load", onLoad);
    };
  }, [focusKey]);

  useEffect(() => {
    if (!instance) return;
    const inst: string = instance;
    let cancelled = false;
    async function load(): Promise<void> {
      setError(null);
      const account = currentAccount();
      const token = account && account.instance === inst ? account.accessToken : undefined;
      const client = getRest(inst, token);
      try {
        const [status, context] = await Promise.all([
          client.v1.statuses.$select(id).fetch(),
          client.v1.statuses.$select(id).context.fetch(),
        ]);
        if (cancelled) return;
        putStatuses([...context.ancestors, ...context.descendants]);
        setFocusKey(putStatus(status));
        setAncestors(context.ancestors);
        setDescendants(context.descendants);
      } catch (err) {
        if (!cancelled) setError(err);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [instance, id]);

  if (error && !focus) {
    return (
      <PageShell title={t.thread} showBack>
        <div class="center-state">
          <Icon name="wifi-off-line" size={28} />
          <h3>{t.statusNotFound}</h3>
          <button type="button" class="btn ghost" onClick={() => back()}>
            <Icon name="back-line" size={16} />
            {t.back}
          </button>
        </div>
      </PageShell>
    );
  }

  const byId = new Map<string, Status>();
  for (const s of descendants) byId.set(s.id, s);
  if (focus) byId.set(focus.id, focus);

  return (
    <PageShell title={t.thread} showBack>
      <div class="thread">
        {ancestors.map((s) => (
          <StatusCard key={statusKey(s)} statusKey={statusKey(s)} compact hideHeader />
        ))}
        {focusKey ? (
          <div class="thread-focus" ref={focusRef}>
            <StatusCard statusKey={focusKey} inThread />
          </div>
        ) : (
          <TimelineSkeleton />
        )}
        {descendants.map((s) => (
          <div
            key={statusKey(s)}
            class="thread-reply"
            data-status-key={statusKey(s)}
            style={{ marginInlineStart: `${Math.min(replyDepth(s, byId), 6) * 14}px` }}
          >
            <StatusCard statusKey={statusKey(s)} compact />
          </div>
        ))}
      </div>
    </PageShell>
  );
}
