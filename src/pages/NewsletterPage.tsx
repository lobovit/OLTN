import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { TrendLink } from "../api/types";
import { t } from "../i18n/pt-BR";
import { shortNumber } from "../lib/format";
import { clientFor } from "../lib/identity";
import { trendTotalUses } from "../lib/trending";
import { currentAccount } from "../state/store";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import { TrendChart } from "../components/feed/trend-spark";
import "./newsletter.css";

function NewsMeta({ link }: { link: TrendLink }): JSX.Element {
  return (
    <span class="newsletter-meta">
      <Icon name="trending-up-line" size={13} />
      {shortNumber(trendTotalUses(link.history ?? []))} {t.trendUses}
      <TrendChart history={link.history ?? []} />
    </span>
  );
}

function NewsHero({ link }: { link: TrendLink }): JSX.Element {
  return (
    <a class="newsletter-hero" href={link.url} target="_blank" rel="noopener noreferrer">
      {link.image && <img class="newsletter-hero-img" src={link.image} alt="" />}
      <span class="newsletter-hero-shade" aria-hidden="true" />
      <span class="newsletter-hero-body">
        <span class="newsletter-provider">{link.providerName}</span>
        <span class="newsletter-hero-title">{link.title}</span>
        {link.description && <span class="newsletter-hero-desc">{link.description}</span>}
        <NewsMeta link={link} />
      </span>
    </a>
  );
}

function NewsCard({ link }: { link: TrendLink }): JSX.Element {
  return (
    <a class="newsletter-card" href={link.url} target="_blank" rel="noopener noreferrer">
      {link.image ? (
        <img class="newsletter-cover" src={link.image} alt="" loading="lazy" decoding="async" />
      ) : (
        <span class="newsletter-cover newsletter-cover-empty" aria-hidden="true">
          <Icon name="news-line" size={22} />
        </span>
      )}
      <span class="newsletter-body">
        <span class="newsletter-provider">{link.providerName}</span>
        <span class="newsletter-title">{link.title}</span>
        {link.description && <span class="newsletter-desc">{link.description}</span>}
        <NewsMeta link={link} />
      </span>
    </a>
  );
}

/** Trending news (from the trending links) as a reading page. */
export function NewsletterPage(): JSX.Element {
  const account = currentAccount();
  const target = account?.instance ?? "";
  const [links, setLinks] = useState<TrendLink[] | null>(null);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    void (async () => {
      try {
        const page = await clientFor(target).client.v1.trends.links.list({ limit: 20 });
        if (!cancelled) setLinks(page);
      } catch (err) {
        console.warn("[oltn] newsletter failed", err);
        if (!cancelled) setLinks([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target]);

  const [hero, ...rest] = links ?? [];

  return (
    <PageShell title={t.newsletter} showBack>
      <div class="newsletter">
        <p class="newsletter-subtitle muted">{t.newsletterSubtitle}</p>
        {!links ? (
          <div class="center-state">
            <span class="spinner" />
          </div>
        ) : !links.length ? (
          <div class="center-state">
            <Icon name="news-line" size={28} />
            <p>{t.emptyTrending}</p>
          </div>
        ) : (
          <>
            {hero && <NewsHero link={hero} />}
            {rest.length > 0 && (
              <div class="newsletter-grid">
                {rest.map((link) => (
                  <NewsCard key={link.url} link={link} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
