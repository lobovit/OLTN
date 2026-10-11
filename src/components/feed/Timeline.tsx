import type { JSX } from "preact";
import { useSnapshot } from "valtio";
import { t } from "../../i18n/pt-BR";
import { userMessageForError } from "../../lib/errors";
import type { Status } from "../../api/types";
import { currentAccount, putStatuses, statusKey, store } from "../../state/store";
import { usePagedFeed } from "../../state/hooks";
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
  const snap = useSnapshot(store);
  const kindKey = JSON.stringify(kind);
  const account = currentAccount();
  const targetInstance = instance ?? account?.instance ?? "";
  const token = account?.instance === targetInstance ? account.accessToken : undefined;
  const queue = listenQueue
    ? snap.homeQueue
        .map((key) => snap.statuses[key])
        .filter((status): status is NonNullable<typeof status> => !!status)
        .map((status) => status as unknown as Status)
    : [];

  const feed = usePagedFeed<Status>({
    key: `${kindKey}|${targetInstance}`,
    enabled: !!targetInstance,
    adapter: {
      fetchPage: async (cursor) => {
        const page = await fetchStatusPage(kind, limit, cursor, {
          instance: targetInstance,
          accessToken: token,
        });
        putStatuses([...page.items], targetInstance);
        return page;
      },
      keyOf: statusKey,
      cursorOf: (status) => status.id,
    },
    queue,
    queueMode: "manual",
    onFlushQueue: () => {
      store.homeQueue = [];
    },
  });

  return (
    <div class="timeline">
      {feed.queue.length > 0 && (
        <button type="button" class="updates-pill" onClick={feed.flushQueue}>
          <Icon name="arrow-down-line" size={15} />
          {feed.queue.length} {feed.queue.length === 1 ? t.queueOne : t.queueMany}
        </button>
      )}

      {feed.loading && !feed.items.length ? (
        <TimelineSkeleton />
      ) : feed.error && !feed.items.length ? (
        <div class="center-state">
          <Icon name="wifi-off-line" size={28} />
          <h3>{userMessageForError(feed.error, t.errorLoad)}</h3>
          <button type="button" class="btn ghost" onClick={feed.reload}>
            <Icon name="refresh-2-line" size={16} />
            {t.retry}
          </button>
        </div>
      ) : !feed.items.length ? (
        <div class="center-state">
          <Icon name="quill-pen-line" size={28} />
          <h3>{emptyTitle ?? t.empty}</h3>
          {emptyHint && <p>{emptyHint}</p>}
        </div>
      ) : (
        <>
          {feed.items.map((status) => (
            <StatusCard key={statusKey(status)} statusKey={statusKey(status)} />
          ))}
          {feed.moreError ? (
            <div class="load-more load-more-error">
              <span class="muted">{userMessageForError(feed.moreError, t.errorLoad)}</span>
              <button type="button" class="btn ghost" onClick={feed.loadMore}>
                <Icon name="refresh-2-line" size={16} />
                {t.retry}
              </button>
            </div>
          ) : (
            feed.hasMore && (
              <div class="load-more">
                <button
                  type="button"
                  class="btn ghost"
                  onClick={feed.loadMore}
                  disabled={feed.loadingMore}
                >
                  {feed.loadingMore ? (
                    <span class="spinner" />
                  ) : (
                    <Icon name="dropdown-line" size={16} />
                  )}
                  {feed.loadingMore ? t.loadingMore : t.loadMore}
                </button>
              </div>
            )
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
