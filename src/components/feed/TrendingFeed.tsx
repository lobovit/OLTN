import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { Tag } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { clientFor, hrefFor } from "../../lib/identity";
import { navigate } from "../../lib/router";
import { currentAccount } from "../../state/store";
import { Icon } from "../ui/Icon";
import { Timeline } from "./Timeline";

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
              </span>
            </button>
          ))}
        </div>
      )}
      <Timeline kind={{ type: "trending" }} instance={target} emptyTitle={t.emptyTrending} />
    </>
  );
}
