import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import type { Tag, TrendLink } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { shortNumber } from "../../lib/format";
import { clientFor, hrefFor } from "../../lib/identity";
import { navigate } from "../../lib/router";
import { rankTrendingAuthors, type TrendingAuthor } from "../../lib/trending";
import { currentAccount, store } from "../../state/store";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { EmojiText } from "../status/EmojiText";
import { Timeline } from "./Timeline";
import "./feed.css";

type TrendTab = "posts" | "hashtags" | "people" | "news";

interface TrendBucket {
  day: string;
  uses?: string | null;
}

/** Total posts that used the tag/link across the trend window. */
function totalUses(history: readonly TrendBucket[]): number {
  return history.reduce((total, entry) => total + Number(entry.uses || 0), 0);
}

/** Basic bar chart of the daily uses (sparkline). */
function TrendChart({ history }: { history: readonly TrendBucket[] }): JSX.Element | null {
  const values = history.map((entry) => Number(entry.uses || 0));
  if (values.length < 2) return null;
  const width = 72;
  const height = 22;
  const max = Math.max(...values, 1);
  const step = width / values.length;
  return (
    <svg class="trend-chart" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {values.map((value, index) => {
        const bar = Math.max(2, Math.round((value / max) * height));
        return (
          <rect
            key={history[index].day}
            x={index * step}
            y={height - bar}
            width={Math.max(1, step - 3)}
            height={bar}
            rx={1.5}
          />
        );
      })}
    </svg>
  );
}

function TrendEmpty({ text }: { text: string }): JSX.Element {
  return (
    <div class="center-state">
      <Icon name="trending-up-line" size={28} />
      <p>{text}</p>
    </div>
  );
}

const TABS: { key: TrendTab; label: () => string }[] = [
  { key: "posts", label: () => t.posts },
  { key: "hashtags", label: () => t.hashtags },
  { key: "people", label: () => t.people },
  { key: "news", label: () => t.news },
];

/** Trending tabs: posts, hashtags, people and news. */
export function TrendingFeed({ instance }: { instance?: string }): JSX.Element {
  const account = currentAccount();
  const target = instance ?? account?.instance ?? "";
  const [tab, setTab] = useState<TrendTab>("posts");
  const [tags, setTags] = useState<Tag[]>([]);
  const [links, setLinks] = useState<TrendLink[]>([]);
  const [people, setPeople] = useState<TrendingAuthor[]>([]);
  const revision = useSnapshot(store).ui.feedsRevision;

  useEffect(() => {
    if (!target || tab !== "hashtags") return;
    let cancelled = false;
    void (async () => {
      try {
        const page = await clientFor(target).client.v1.trends.tags.list({ limit: 20 });
        if (!cancelled) setTags(page);
      } catch (err) {
        console.warn("[oltn] trending tags failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target, revision, tab]);

  useEffect(() => {
    if (!target || tab !== "news") return;
    let cancelled = false;
    void (async () => {
      try {
        const page = await clientFor(target).client.v1.trends.links.list({ limit: 20 });
        if (!cancelled) setLinks(page);
      } catch (err) {
        console.warn("[oltn] trending links failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target, revision, tab]);

  useEffect(() => {
    if (!target || tab !== "people") return;
    let cancelled = false;
    void (async () => {
      try {
        const page = await clientFor(target).client.v1.trends.statuses.list({ limit: 40 });
        if (!cancelled) setPeople(rankTrendingAuthors(page));
      } catch (err) {
        console.warn("[oltn] trending people failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target, revision, tab]);

  return (
    <div class="trending">
      <div class="subtabs">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            class={`subtab ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label()}
          </button>
        ))}
      </div>

      {tab === "posts" && (
        <Timeline kind={{ type: "trending" }} instance={target} emptyTitle={t.emptyTrending} />
      )}

      {tab === "hashtags" &&
        (tags.length > 0 ? (
          <div class="trending-tags">
            {tags.map((tag) => (
              <button
                key={tag.name}
                type="button"
                class="trend-row"
                onClick={() => navigate(hrefFor.tag(tag.name, target))}
              >
                <Icon name="hashtag-line" size={16} />
                <span class="row-main">
                  <span class="row-title">{tag.name}</span>
                  <span class="row-sub">
                    {shortNumber(totalUses(tag.history ?? []))} {t.trendUses}
                  </span>
                </span>
                <TrendChart history={tag.history ?? []} />
              </button>
            ))}
          </div>
        ) : (
          <TrendEmpty text={t.emptyTrending} />
        ))}

      {tab === "people" &&
        (people.length > 0 ? (
          <div class="trending-tags">
            {people.map(({ account: person, count }) => (
              <button
                key={person.id}
                type="button"
                class="trend-row"
                onClick={() => navigate(hrefFor.accountById(target, person.id))}
              >
                <Avatar
                  src={person.avatarStatic || person.avatar}
                  name={person.displayName || person.username}
                  size={38}
                />
                <span class="row-main">
                  <span class="row-title">
                    <EmojiText
                      text={person.displayName || person.username}
                      emojis={person.emojis}
                    />
                  </span>
                  <span class="row-sub">
                    @{person.acct} · {count} {t.trendingPosts}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <TrendEmpty text={t.empty} />
        ))}

      {tab === "news" &&
        (links.length > 0 ? (
          <div class="trending-tags">
            {links.map((link) => (
              <a
                key={link.url}
                class="trend-row"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="link-line" size={16} />
                <span class="row-main">
                  <span class="row-title">{link.title}</span>
                  <span class="row-sub">
                    {link.providerName} · {shortNumber(totalUses(link.history ?? []))} {t.trendUses}
                  </span>
                </span>
                <Icon name="external-link-line" size={14} />
              </a>
            ))}
          </div>
        ) : (
          <TrendEmpty text={t.empty} />
        ))}
    </div>
  );
}
