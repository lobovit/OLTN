import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { getRest } from "../api/client";
import type { Tag } from "../api/types";
import { t } from "../i18n/pt-BR";
import { navigate } from "../lib/router";
import { Timeline } from "../components/feed/Timeline";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import { currentAccount } from "../state/store";

export function TrendingPage(): JSX.Element {
  const account = currentAccount();
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    void (async () => {
      const client = getRest(account.instance, account.accessToken);
      try {
        const page = await client.v1.trends.tags.list({ limit: 10 });
        if (!cancelled) setTags(page);
      } catch (err) {
        console.warn("[oltn] trending load failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account]);

  return (
    <PageShell title={t.trending} showBack>
      {tags.length > 0 && (
        <div class="trending-tags">
          {tags.map((tag) => (
            <button
              key={tag.name}
              type="button"
              class="trend-row"
              onClick={() =>
                navigate(
                  `/${encodeURIComponent(account?.instance ?? "")}/t/${encodeURIComponent(tag.name)}`,
                )
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
      <Timeline
        kind={{ type: "trending" }}
        instance={account?.instance}
        emptyTitle={t.emptyTrending}
      />
    </PageShell>
  );
}
