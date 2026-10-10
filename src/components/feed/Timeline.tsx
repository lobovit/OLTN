import type { JSX } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import { t } from "../../i18n/pt-BR";
import { userMessageForError } from "../../lib/errors";
import { currentAccount, putStatuses, statusKey, store } from "../../state/store";
import { StatusCard } from "../status/StatusCard";
import { Icon } from "../ui/Icon";
import { fetchStatusPage, type TimelineKind } from "./timeline-fetch";
import "./feed.css";

interface TimelineProps {
  kind: TimelineKind;
  instance?: string;
  emptyTitle?: string;
  emptyHint?: string;
  listenQueue?: boolean;
  limit?: number;
}

export function Timeline({
  kind,
  instance,
  emptyTitle,
  emptyHint,
  listenQueue = false,
  limit = 20,
}: TimelineProps): JSX.Element {
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [hasMore, setHasMore] = useState(false);
  const lastIdRef = useRef<string | null>(null);
  const queue = useSnapshot(store).homeQueue;
  const kindKey = JSON.stringify(kind);
  const account = currentAccount();
  const targetInstance = instance ?? account?.instance ?? "";
  const token = account?.instance === targetInstance ? account.accessToken : undefined;

  const loadInitial = useCallback(async () => {
    if (!targetInstance) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchStatusPage(
        kind,
        { limit },
        { instance: targetInstance, accessToken: token },
      );
      putStatuses(list);
      setIds(list.map(statusKey));
      lastIdRef.current = list.length ? list[list.length - 1].id : null;
      setHasMore(list.length >= limit);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line
  }, [kindKey, targetInstance, token, limit]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const loadMore = async (): Promise<void> => {
    if (loadingMore || !hasMore || !lastIdRef.current) return;
    setLoadingMore(true);
    try {
      const list = await fetchStatusPage(
        kind,
        { limit, maxId: lastIdRef.current },
        { instance: targetInstance, accessToken: token },
      );
      putStatuses(list);
      const keys = list.map(statusKey);
      setIds((prev) => [...prev, ...keys.filter((k) => !prev.includes(k))]);
      lastIdRef.current = list.length ? list[list.length - 1].id : lastIdRef.current;
      if (list.length < limit) setHasMore(false);
    } catch (err) {
      setError(err);
    } finally {
      setLoadingMore(false);
    }
  };

  const flushQueue = (): void => {
    const pending = [...queue];
    if (!pending.length) return;
    setIds((prev) => [...pending.filter((k) => !prev.includes(k)), ...prev]);
    store.homeQueue = [];
  };

  const showQueue = listenQueue && queue.length > 0;

  return (
    <div class="timeline">
      {showQueue && (
        <button type="button" class="updates-pill" onClick={flushQueue}>
          <Icon name="arrow-down-line" size={15} />
          {queue.length} {queue.length === 1 ? t.queueOne : t.queueMany}
        </button>
      )}

      {loading && !ids.length ? (
        <TimelineSkeleton />
      ) : error && !ids.length ? (
        <div class="center-state">
          <Icon name="wifi-off-line" size={28} />
          <h3>{userMessageForError(error, t.errorLoad)}</h3>
          <button type="button" class="btn ghost" onClick={() => void loadInitial()}>
            <Icon name="refresh-2-line" size={16} />
            {t.retry}
          </button>
        </div>
      ) : !ids.length ? (
        <div class="center-state">
          <Icon name="quill-pen-line" size={28} />
          <h3>{emptyTitle ?? t.empty}</h3>
          {emptyHint && <p>{emptyHint}</p>}
        </div>
      ) : (
        <>
          {ids.map((key) => (
            <StatusCard key={key} statusKey={key} />
          ))}
          {hasMore && (
            <div class="load-more">
              <button
                type="button"
                class="btn ghost"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? <span class="spinner" /> : <Icon name="dropdown-line" size={16} />}
                {loadingMore ? t.loadingMore : t.loadMore}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function TimelineSkeleton(): JSX.Element {
  return (
    <div class="timeline-skeleton" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div class="sk-row" key={i}>
          <div class="skeleton sk-avatar" />
          <div class="sk-lines">
            <div class="skeleton sk-line w40" />
            <div class="skeleton sk-line w90" />
            <div class="skeleton sk-line w75" />
          </div>
        </div>
      ))}
    </div>
  );
}
