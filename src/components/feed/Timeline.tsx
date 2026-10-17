import type { JSX, RefObject } from "preact";
import { useRef } from "preact/hooks";
import { useSnapshot } from "valtio";
import { t } from "../../i18n/pt-BR";
import { userMessageForError } from "../../lib/errors";
import { clientFor } from "../../lib/identity";
import type { FeedAdapter } from "../../lib/paged-feed";
import { scrollFeedToTop } from "../../lib/scroll";
import { snapshotValue } from "../../lib/snapshot";
import type { Status } from "../../api/types";
import { currentAccount, putStatuses, statusKey, store } from "../../state/store";
import { usePagedFeed, type PagedFeed } from "../../state/hooks";
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

/** Adapter wiring the pure feed machine to the endpoint fetch and status cache. */
function makeTimelineAdapter(
  kind: TimelineKind,
  limit: number,
  targetInstance: string,
): FeedAdapter<Status> {
  return {
    fetchPage: async (cursor) => {
      const page = await fetchStatusPage(kind, limit, cursor, clientFor(targetInstance));
      putStatuses([...page.items], targetInstance);
      return page;
    },
    keyOf: statusKey,
    cursorOf: (status) => status.id,
  };
}

function clearHomeQueue(): void {
  store.homeQueue = [];
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
  const rootRef = useRef<HTMLDivElement>(null);
  const kindKey = JSON.stringify(kind);
  const account = currentAccount();
  const targetInstance = instance ?? account?.instance ?? "";
  // Boost feeds also reload when a boost toggle succeeds; the column refresh
  // button bumps feedsRevision, reloading every mounted feed.
  const revision = `|${snap.ui.feedsRevision}${
    kind.type === "boosts" ? `|${snap.ui.boostsRevision}` : ""
  }`;
  const queue: Status[] = listenQueue
    ? snap.homeQueue
        .map((key) => snapshotValue<Status>(snap.statuses[key]))
        .filter((status): status is Status => !!status)
    : [];

  const feed = usePagedFeed<Status>({
    key: `${kindKey}|${targetInstance}${revision}`,
    enabled: !!targetInstance,
    adapter: makeTimelineAdapter(kind, limit, targetInstance),
    queue,
    queueMode: "manual",
    onFlushQueue: clearHomeQueue,
  });

  return (
    <div class="timeline" ref={rootRef}>
      <UpdatesPill feed={feed} rootRef={rootRef} />
      <TimelineBody feed={feed} emptyTitle={emptyTitle} emptyHint={emptyHint} />
    </div>
  );
}

function UpdatesPill({
  feed,
  rootRef,
}: {
  feed: PagedFeed<Status>;
  rootRef: RefObject<HTMLDivElement | null>;
}): JSX.Element | null {
  if (!feed.queue.length) return null;
  return (
    <button
      type="button"
      class="updates-pill"
      onClick={() => {
        feed.flushQueue();
        scrollFeedToTop(rootRef.current);
      }}
    >
      <Icon name="arrow-down-line" size={15} />
      {feed.queue.length} {feed.queue.length === 1 ? t.queueOne : t.queueMany}
    </button>
  );
}

function TimelineBody({
  feed,
  emptyTitle,
  emptyHint,
}: {
  feed: PagedFeed<Status>;
  emptyTitle?: string;
  emptyHint?: string;
}): JSX.Element {
  if (feed.loading && !feed.items.length) return <TimelineSkeleton />;
  if (feed.error && !feed.items.length)
    return <TimelineErrorState error={feed.error} onRetry={feed.reload} />;
  if (!feed.items.length) return <TimelineEmptyState title={emptyTitle} hint={emptyHint} />;
  return (
    <>
      {feed.items.map((status) => (
        <StatusCard key={statusKey(status)} statusKey={statusKey(status)} />
      ))}
      <TimelinePager feed={feed} />
    </>
  );
}

function TimelineErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}): JSX.Element {
  return (
    <div class="center-state">
      <Icon name="wifi-off-line" size={28} />
      <h3>{userMessageForError(error, t.errorLoad)}</h3>
      <button type="button" class="btn ghost" onClick={onRetry}>
        <Icon name="refresh-2-line" size={16} />
        {t.retry}
      </button>
    </div>
  );
}

function TimelineEmptyState({ title, hint }: { title?: string; hint?: string }): JSX.Element {
  return (
    <div class="center-state">
      <Icon name="quill-pen-line" size={28} />
      <h3>{title ?? t.empty}</h3>
      {hint && <p>{hint}</p>}
    </div>
  );
}

function TimelinePager({ feed }: { feed: PagedFeed<Status> }): JSX.Element | null {
  if (feed.moreError) {
    return (
      <div class="load-more load-more-error">
        <span class="muted">{userMessageForError(feed.moreError, t.errorLoad)}</span>
        <button type="button" class="btn ghost" onClick={feed.loadMore}>
          <Icon name="refresh-2-line" size={16} />
          {t.retry}
        </button>
      </div>
    );
  }
  if (!feed.hasMore) return null;
  return (
    <div class="load-more">
      <button type="button" class="btn ghost" onClick={feed.loadMore} disabled={feed.loadingMore}>
        {feed.loadingMore ? <span class="spinner" /> : <Icon name="dropdown-line" size={16} />}
        {feed.loadingMore ? t.loadingMore : t.loadMore}
      </button>
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
