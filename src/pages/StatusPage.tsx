import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import { getRest } from "../api/client";
import type { Context, Status } from "../api/types";
import { t } from "../i18n/pt-BR";
import { back } from "../lib/router";
import { StatusCard } from "../components/status/StatusCard";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import { TimelineSkeleton } from "../components/feed/Timeline";
import {
  currentAccount,
  putStatus,
  putStatuses,
  statusKey,
  statusSourceById,
  store,
} from "../state/store";
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
  const instance = params.instance ?? currentAccount()?.instance;
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
    const inst = instance;
    if (!inst) return;
    let cancelled = false;
    void (async () => {
      setError(null);
      const account = currentAccount();
      const attempt = async (
        source: string,
      ): Promise<{ status: Status; context: Context; source: string }> => {
        const token = account && account.instance === source ? account.accessToken : undefined;
        const client = getRest(source, token);
        const [status, context] = await Promise.all([
          client.v1.statuses.$select(id).fetch(),
          client.v1.statuses.$select(id).context.fetch(),
        ]);
        return { status, context, source };
      };
      try {
        let result: { status: Status; context: Context; source: string };
        try {
          result = await attempt(inst);
        } catch (err) {
          // A rota pode apontar para a instância do autor; o `id` só é válido
          // na instância que originou o post (fonte registrada no cache).
          const source = statusSourceById(id);
          if (!source || source === inst) throw err;
          result = await attempt(source);
        }
        if (cancelled) return;
        putStatuses([...result.context.ancestors, ...result.context.descendants], result.source);
        setFocusKey(putStatus(result.status, result.source));
        setAncestors(result.context.ancestors);
        setDescendants(result.context.descendants);
      } catch (err) {
        if (!cancelled) setError(err);
      }
    })();
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
