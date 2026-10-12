import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { Tag } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { shortNumber } from "../../lib/format";
import { clientFor, hrefFor } from "../../lib/identity";
import { navigate } from "../../lib/router";
import { currentAccount } from "../../state/store";
import { Icon } from "../ui/Icon";
import { Timeline } from "./Timeline";

type TrendHistory = NonNullable<Tag["history"]>;

/** Total posts that used the tag across the trend window. */
function totalUses(history: TrendHistory): number {
  return history.reduce((total, entry) => total + Number(entry.uses || 0), 0);
}

/** Basic bar chart of the daily uses (sparkline). */
function TrendChart({ history }: { history: TrendHistory }): JSX.Element | null {
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

/** Trending hashtags right now + trending posts. */
export function TrendingFeed({ instance }: { instance?: string }): JSX.Element {
  const account = currentAccount();
  const target = instance ?? account?.instance ?? "";
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    void (async () => {
      try {
        const page = await clientFor(target).client.v1.trends.tags.list({ limit: 10 });
        if (!cancelled) setTags(page);
      } catch (err) {
        console.warn("[oltn] trending tags failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target]);

  return (
    <>
      {tags.length > 0 && (
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
      )}
      <Timeline kind={{ type: "trending" }} instance={target} emptyTitle={t.emptyTrending} />
    </>
  );
}
