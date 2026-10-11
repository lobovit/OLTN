import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { getRest } from "../../api/client";
import type { Tag } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { navigate } from "../../lib/router";
import { currentAccount } from "../../state/store";
import { Icon } from "../ui/Icon";
import { Timeline } from "./Timeline";

/** Hashtags em alta no momento + posts em alta. */
export function TrendingFeed({ instance }: { instance?: string }): JSX.Element {
  const account = currentAccount();
  const target = instance ?? account?.instance ?? "";
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    void (async () => {
      const token = account && account.instance === target ? account.accessToken : undefined;
      try {
        const page = await getRest(target, token).v1.trends.tags.list({ limit: 10 });
        if (!cancelled) setTags(page);
      } catch (err) {
        console.warn("[oltn] trending tags failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target, account]);

  return (
    <>
      {tags.length > 0 && (
        <div class="trending-tags">
          {tags.map((tag) => (
            <button
              key={tag.name}
              type="button"
              class="trend-row"
              onClick={() =>
                navigate(`/${encodeURIComponent(target)}/t/${encodeURIComponent(tag.name)}`)
              }
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
