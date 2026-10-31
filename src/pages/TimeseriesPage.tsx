import type { JSX } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import type { Status } from "../api/types";
import { Avatar } from "../components/ui/Avatar";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import { Content } from "../components/status/Content";
import { EmojiText } from "../components/status/EmojiText";
import { t } from "../i18n/pt-BR";
import { userMessageForError } from "../lib/errors";
import { fullDate, shortNumber, timeAgo } from "../lib/format";
import { clientFor, hrefFor } from "../lib/identity";
import { navigate } from "../lib/router";
import {
  buildTimeseriesItems,
  sortTimeseries,
  timeseriesAuthors,
  topTimeseriesLinks,
  type TimeseriesCategory,
  type TimeseriesItem,
  type TimeseriesSort,
} from "../lib/timeseries";
import { saveTimeseriesLastAt } from "../state/boot";
import { accountNS, currentAccount, putStatuses, statusKey, store, toast } from "../state/store";
import "./timeseries.css";

const MAX_RANGE = 13;
const FETCH_LIMIT = 20;
const MAX_PAGES = 40;
const MAX_POSTS = 800;

/** Compact review of the Home timeline over a chosen time window. */
export function TimeseriesPage(): JSX.Element {
  const snap = useSnapshot(store);
  const account = currentAccount();
  const instance = account?.instance ?? "";
  const lastAt = account ? snap.prefs[accountNS(account)]?.timeseriesLastAt : undefined;
  const [rangeDraft, setRangeDraft] = useState(1);
  const [range, setRange] = useState(1);
  const [untilLast, setUntilLast] = useState(false);
  const [reload, setReload] = useState(0);
  const [posts, setPosts] = useState<Status[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [limited, setLimited] = useState(false);
  const [category, setCategory] = useState<TimeseriesCategory | "all">("all");
  const [author, setAuthor] = useState<string | null>(null);
  const [sort, setSort] = useState<TimeseriesSort>("recent");

  useEffect(() => {
    if (rangeDraft === range) return;
    const timer = window.setTimeout(() => setRange(rangeDraft), 350);
    return () => window.clearTimeout(timer);
  }, [rangeDraft, range]);

  useEffect(() => {
    if (!account) return;
    const ns = accountNS(account);
    const liveLast = store.prefs[ns]?.timeseriesLastAt;
    const now = Date.now();
    const cutoff =
      range >= MAX_RANGE ? (untilLast && liveLast ? liveLast : null) : now - range * 3_600_000;
    let cancelled = false;
    setLoading(true);
    setPosts(null);
    setError(null);
    setProgress(0);
    setLimited(false);
    setCategory("all");
    setAuthor(null);
    void (async () => {
      try {
        const client = clientFor(account.instance).client;
        const collected: Status[] = [];
        const seen = new Set<string>();
        let cursor: string | undefined;
        let stoppedByLimit = false;
        for (let page = 0; page < MAX_PAGES && collected.length < MAX_POSTS; page++) {
          const batch = await client.v1.timelines.home.list({
            limit: FETCH_LIMIT,
            maxId: cursor,
          });
          if (cancelled) return;
          if (!batch.length) break;
          putStatuses(batch, account.instance);
          for (const status of batch) {
            const key = statusKey(status);
            if (seen.has(key)) continue;
            seen.add(key);
            collected.push(status);
          }
          setProgress(collected.length);
          const oldest = Date.parse(batch[batch.length - 1].createdAt);
          cursor = batch[batch.length - 1].id;
          if (batch.length < FETCH_LIMIT) break;
          if (cutoff !== null && oldest < cutoff) break;
          if (collected.length >= MAX_POSTS || page === MAX_PAGES - 1) {
            stoppedByLimit = true;
            break;
          }
        }
        if (cancelled) return;
        setPosts(
          cutoff === null
            ? collected
            : collected.filter((status) => Date.parse(status.createdAt) >= cutoff),
        );
        setLimited(stoppedByLimit);
      } catch (err) {
        console.warn("[oltn] timeseries failed", err);
        if (!cancelled) {
          setError(err);
          setPosts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account?.instance, account?.id, range, untilLast, reload]);

  const baseItems = useMemo(
    () => buildTimeseriesItems(posts ?? [], snap.blockedAccounts),
    [posts, snap.blockedAccounts],
  );
  const sorted = useMemo(() => sortTimeseries(baseItems, sort), [baseItems, sort]);
  const authors = useMemo(() => timeseriesAuthors(baseItems), [baseItems]);
  const links = useMemo(() => topTimeseriesLinks(baseItems), [baseItems]);
  const counts = useMemo(
    () => ({
      all: baseItems.length,
      original: baseItems.filter((item) => item.category === "original").length,
      reply: baseItems.filter((item) => item.category === "reply").length,
      boost: baseItems.filter((item) => item.category === "boost").length,
      quote: baseItems.filter((item) => item.category === "quote").length,
    }),
    [baseItems],
  );
  const visible = useMemo(
    () =>
      sorted.filter(
        (item) =>
          (category === "all" || item.category === category) &&
          (!author || item.target.account.id === author),
      ),
    [sorted, category, author],
  );

  useEffect(() => {
    if (author && !authors.some((entry) => entry.account.id === author)) setAuthor(null);
  }, [authors, author]);

  const markSeen = (): void => {
    saveTimeseriesLastAt(Date.now());
    toast(t.timeseriesMarkedSeen, "ok");
  };

  const rangeLabel = (value: number): string => {
    if (value >= MAX_RANGE) {
      return untilLast && lastAt
        ? `${t.timeseriesSinceLast} (${fullDate(lastAt)})`
        : t.timeseriesBeyond12;
    }
    if (value === 1) return t.timeseriesLastHour;
    return t.timeseriesLastHours.replace("{n}", String(value));
  };

  const filters: { value: TimeseriesCategory | "all"; label: string; count: number }[] = [
    { value: "all", label: t.all, count: counts.all },
    { value: "original", label: t.posts, count: counts.original },
    { value: "reply", label: t.replies, count: counts.reply },
    { value: "boost", label: t.boosts, count: counts.boost },
    { value: "quote", label: t.timeseriesQuotes, count: counts.quote },
  ];

  return (
    <PageShell
      title={t.timeseries}
      subtitle={t.timeseriesSubtitle}
      showBack
      actions={
        <button
          type="button"
          class="icon-btn"
          title={t.refresh}
          aria-label={t.refresh}
          disabled={loading}
          onClick={() => setReload((value) => value + 1)}
        >
          <Icon name="refresh-2-line" size={16} />
        </button>
      }
    >
      <div class="timeseries">
        <div class="timeseries-range-control">
          <div class="timeseries-range-head">
            <span class="timeseries-filter-label">{t.timeseriesRange}</span>
            <strong>{rangeLabel(rangeDraft)}</strong>
          </div>
          <input
            class="timeseries-slider"
            type="range"
            min={1}
            max={MAX_RANGE}
            step={1}
            value={rangeDraft}
            aria-label={t.timeseriesRange}
            aria-valuetext={rangeLabel(rangeDraft)}
            onInput={(e) => setRangeDraft(Number((e.currentTarget as HTMLInputElement).value))}
          />
          <div class="timeseries-slider-ticks" aria-hidden>
            <span>1h</span>
            <span>12h</span>
            <span>12h+</span>
          </div>
          {rangeDraft >= MAX_RANGE && lastAt && (
            <label class="timeseries-until-last">
              <input
                type="checkbox"
                checked={untilLast}
                onChange={(e) => setUntilLast((e.currentTarget as HTMLInputElement).checked)}
              />
              {t.timeseriesUntilLast} ({fullDate(lastAt)})
            </label>
          )}
        </div>

        <div class="timeseries-seen">
          <span class="muted">
            {lastAt ? `${t.timeseriesLast}: ${fullDate(lastAt)}` : t.timeseriesNoLast}
          </span>
          <button type="button" class="btn ghost" onClick={markSeen}>
            <Icon name="check-line" size={15} />
            {t.timeseriesMarkSeen}
          </button>
        </div>

        {loading ? (
          <TimeseriesLoading progress={progress} />
        ) : error ? (
          <div class="center-state">
            <Icon name="wifi-off-line" size={28} />
            <h3>{userMessageForError(error, t.errorLoad)}</h3>
            <button type="button" class="btn ghost" onClick={() => setReload((value) => value + 1)}>
              <Icon name="refresh-2-line" size={16} />
              {t.retry}
            </button>
          </div>
        ) : !posts?.length ? (
          <div class="center-state">
            <Icon name="history-line" size={28} />
            <h3>{t.timeseriesEmpty}</h3>
            <p>{t.timeseriesEmptyHint}</p>
          </div>
        ) : (
          <>
            {links.length > 0 && (
              <section class="timeseries-links-section">
                <h2 class="timeseries-section-title">{t.timeseriesTopLinks}</h2>
                <div class="timeseries-links">
                  {links.map((link) => (
                    <a
                      key={link.url}
                      class="timeseries-link"
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.image && <img src={link.image} alt="" loading="lazy" />}
                      <span class="timeseries-link-body">
                        {link.provider && (
                          <span class="timeseries-link-provider">{link.provider}</span>
                        )}
                        <span class="timeseries-link-title">{link.title}</span>
                        <span class="timeseries-link-meta">
                          {link.count} {t.timeseriesShares}
                        </span>
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            <div class="timeseries-filters" role="group" aria-label={t.filters}>
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  class={`timeseries-filter ${category === filter.value ? "active" : ""}`}
                  aria-pressed={category === filter.value}
                  onClick={() => setCategory(filter.value)}
                >
                  {filter.label}
                  <span class="timeseries-count">{filter.count}</span>
                </button>
              ))}
            </div>

            {authors.length > 1 && (
              <div class="timeseries-authors" role="group" aria-label={t.timeseriesAuthors}>
                <span class="timeseries-filter-label">{t.timeseriesAuthors}</span>
                <div class="timeseries-author-list">
                  {authors.slice(0, 12).map((entry) => (
                    <button
                      key={entry.account.id}
                      type="button"
                      class={`timeseries-author ${author === entry.account.id ? "active" : ""}`}
                      aria-pressed={author === entry.account.id}
                      title={`@${entry.account.acct}`}
                      onClick={() =>
                        setAuthor((current) =>
                          current === entry.account.id ? null : entry.account.id,
                        )
                      }
                    >
                      <Avatar
                        src={entry.account.avatarStatic || entry.account.avatar}
                        name={entry.account.displayName || entry.account.username}
                        size={26}
                      />
                      <span class="timeseries-author-name">
                        {entry.account.displayName || entry.account.username}
                      </span>
                      <span class="timeseries-count">{entry.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div class="timeseries-sort">
              <label class="timeseries-filter-label" for="timeseries-sort">
                {t.timeseriesSort}
              </label>
              <select
                id="timeseries-sort"
                class="timeseries-select"
                value={sort}
                onChange={(e) =>
                  setSort((e.currentTarget as HTMLSelectElement).value as TimeseriesSort)
                }
              >
                <option value="recent">{t.timeseriesSortRecent}</option>
                <option value="engagement">{t.timeseriesSortEngagement}</option>
                <option value="replies">{t.timeseriesSortReplies}</option>
                <option value="favourites">{t.timeseriesSortFavourites}</option>
                <option value="boosts">{t.timeseriesSortBoosts}</option>
                <option value="quotes">{t.timeseriesSortQuotes}</option>
              </select>
            </div>

            {visible.length ? (
              <div class="timeseries-list">
                {visible.map((item) => (
                  <TimeseriesRow key={item.key} item={item} instance={instance} />
                ))}
              </div>
            ) : (
              <div class="center-state">
                <Icon name="filter-line" size={28} />
                <h3>{t.timeseriesNoMatches}</h3>
              </div>
            )}

            <footer class="timeseries-footer">
              {visible.length} {t.posts}
              {limited && <p>{t.timeseriesLimited}</p>}
            </footer>
          </>
        )}
      </div>
    </PageShell>
  );
}

function TimeseriesLoading({ progress }: { progress: number }): JSX.Element {
  return (
    <>
      <p class="timeseries-progress">
        <span class="spinner" /> {t.timeseriesFetching}
        {progress > 0 ? ` (${progress})` : ""}
      </p>
      <div class="timeseries-list" aria-hidden>
        {Array.from({ length: 5 }, (_, index) => (
          <div class="timeseries-skeleton" key={index}>
            <div class="skeleton timeseries-skeleton-avatar" />
            <div class="timeseries-skeleton-lines">
              <div class="skeleton timeseries-skeleton-line w40" />
              <div class="skeleton timeseries-skeleton-line w90" />
              <div class="skeleton timeseries-skeleton-line w70" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function TimeseriesRow({
  item,
  instance,
}: {
  item: TimeseriesItem;
  instance: string;
}): JSX.Element {
  const target = item.target;
  const author = target.account;
  const href = hrefFor.status(target.id, instance);
  const open = (): void => navigate(href);
  const media = target.mediaAttachments.filter(
    (attachment) => attachment.type === "image" || attachment.type === "gifv",
  );
  const hiddenMedia = target.sensitive || !!target.spoilerText;
  const description = author.displayName || author.username;

  return (
    <article
      class={`timeseries-row category-${item.category}`}
      data-focusable
      tabIndex={0}
      onClick={(e) => {
        const el = e.target as HTMLElement;
        if (el.closest("a, button")) return;
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.toString().trim()) return;
        open();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        if ((e.target as HTMLElement).closest("a, button")) return;
        e.preventDefault();
        e.stopPropagation();
        open();
      }}
    >
      {item.category === "boost" && (
        <div class="timeseries-boost">
          <Icon name="repeat-line" size={14} />
          <EmojiText
            text={item.status.account.displayName || item.status.account.username}
            emojis={item.status.account.emojis}
          />
          <span class="muted">{t.boosted}</span>
        </div>
      )}
      <div class="timeseries-row-body">
        <Avatar src={author.avatarStatic || author.avatar} name={description} size={30} />
        <div class="timeseries-main">
          <div class="timeseries-meta">
            <span class="timeseries-name">
              <EmojiText text={description} emojis={author.emojis} />
            </span>
            <span class="timeseries-handle">@{author.acct}</span>
            {item.category === "reply" && (
              <span class="timeseries-tag">
                <Icon name="share-forward-line" size={11} class="rot-180" />
                {t.replies}
              </span>
            )}
            {item.category === "quote" && (
              <span class="timeseries-tag">
                <Icon name="quote-left-line" size={11} />
                {t.timeseriesQuotes}
              </span>
            )}
            <time
              class="timeseries-time"
              dateTime={item.status.createdAt}
              title={fullDate(item.status.createdAt)}
            >
              {timeAgo(item.status.createdAt)}
            </time>
          </div>

          {target.spoilerText ? (
            <div class="timeseries-cw">
              <Icon name="eye-close-line" size={13} />
              {target.spoilerText}
            </div>
          ) : (
            <Content html={target.content} emojis={target.emojis} class="timeseries-content" />
          )}

          {hiddenMedia && target.mediaAttachments.length > 0 ? (
            <span class="timeseries-media-hidden">
              <Icon name="eye-close-line" size={12} />
              {t.media} ({target.mediaAttachments.length})
            </span>
          ) : (
            media.length > 0 && (
              <div class="timeseries-media">
                {media.slice(0, 3).map((attachment) => (
                  <img
                    key={attachment.id}
                    src={attachment.previewUrl ?? attachment.url ?? ""}
                    alt={attachment.description || t.media}
                    loading="lazy"
                    decoding="async"
                  />
                ))}
                {media.length > 3 && <span class="timeseries-media-more">+{media.length - 3}</span>}
              </div>
            )
          )}

          {target.poll && (
            <span class="timeseries-tag">
              <Icon name="list-check-line" size={11} />
              {t.poll}
            </span>
          )}

          <div class="timeseries-stats">
            {target.repliesCount > 0 && (
              <Stat icon="message-1-line" value={target.repliesCount} label={t.replies} />
            )}
            {target.favouritesCount > 0 && (
              <Stat icon="heart-line" value={target.favouritesCount} label={t.favourite} />
            )}
            {target.reblogsCount > 0 && (
              <Stat icon="repeat-line" value={target.reblogsCount} label={t.boost} />
            )}
            {target.quotesCount > 0 && (
              <Stat icon="quote-left-line" value={target.quotesCount} label={t.timeseriesQuotes} />
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function Stat({ icon, value, label }: { icon: string; value: number; label: string }): JSX.Element {
  return (
    <span class="timeseries-stat" aria-label={`${label}: ${value}`}>
      <Icon name={icon} size={12} />
      {shortNumber(value)}
    </span>
  );
}
