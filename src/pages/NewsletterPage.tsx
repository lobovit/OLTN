import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import type { Account, NewsletterSource, Status, TrendLink } from "../api/types";
import { t } from "../i18n/pt-BR";
import { shortNumber } from "../lib/format";
import { clientFor, resolveAccountHandle, searchAccountsByUsername } from "../lib/identity";
import { DEFAULT_NEWSLETTER_SOURCES, mergeResolvedSources, newestFirst } from "../lib/newsletter";
import { trendTotalUses } from "../lib/trending";
import { accountNS, currentAccount, putStatuses, statusKey, store, toast } from "../state/store";
import { saveNewsletterSources } from "../state/boot";
import { Avatar } from "../components/ui/Avatar";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import { StatusCard } from "../components/status/StatusCard";
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

/** Trending news plus profiles the reader aggregates as sources. */
export function NewsletterPage(): JSX.Element {
  const account = currentAccount();
  const target = account?.instance ?? "";
  const snap = useSnapshot(store);
  const sources =
    (account ? snap.prefs[accountNS(account)]?.newsletterSources : undefined) ??
    DEFAULT_NEWSLETTER_SOURCES;
  const [links, setLinks] = useState<TrendLink[] | null>(null);
  const [handle, setHandle] = useState("");
  const [adding, setAdding] = useState(false);
  const [suggestions, setSuggestions] = useState<Account[]>([]);
  const [sourcePosts, setSourcePosts] = useState<Status[] | null>(null);
  const resolvedSources = sources.filter((source) => !!source.id);
  const sourceKey = resolvedSources.map((source) => source.id).join(",");
  const unresolvedKey = sources
    .filter((source) => !source.id)
    .map((source) => source.acct)
    .join("\n");

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

  useEffect(() => {
    if (!target || !sourceKey) {
      setSourcePosts(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const client = clientFor(target).client;
        const lists = await Promise.all(
          resolvedSources.map((source) =>
            client.v1.accounts.$select(source.id).statuses.list({
              limit: 8,
              excludeReplies: true,
            }),
          ),
        );
        const merged = newestFirst(lists);
        putStatuses(merged, target);
        if (!cancelled) setSourcePosts(merged);
      } catch (err) {
        console.warn("[oltn] newsletter sources failed", err);
        if (!cancelled) setSourcePosts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target, sourceKey]);

  /* Default sources ship with handles only; resolve their local account ids
     once, then persist them. Removed sources are simply absent from prefs. */
  useEffect(() => {
    if (!account || !unresolvedKey) return;
    const instance = account.instance;
    let cancelled = false;
    void (async () => {
      const client = clientFor(instance).client;
      const resolved = (
        await Promise.all(
          sources
            .filter((source) => !source.id)
            .map(async (source) => {
              const found = await resolveAccountHandle(client, source.acct);
              return found
                ? { id: found.id, acct: found.acct, name: found.displayName || found.username }
                : null;
            }),
        )
      ).filter((source): source is NewsletterSource => !!source);
      if (cancelled || !resolved.length) return;
      const live = store.prefs[accountNS(account)]?.newsletterSources ?? DEFAULT_NEWSLETTER_SOURCES;
      const next = mergeResolvedSources(live, resolved);
      const changed =
        next.length !== live.length ||
        next.some((source, index) => {
          const before = live[index];
          return (
            source.id !== before.id || source.acct !== before.acct || source.name !== before.name
          );
        });
      if (changed) saveNewsletterSources(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [account?.instance, unresolvedKey]);

  /* Live suggestions: search as the user types. A bare @user only reaches
     accounts known to the instance; a full handle is resolved remotely. */
  useEffect(() => {
    const instance = account?.instance;
    const raw = handle.trim();
    const query = raw.replace(/^@/, "");
    if (!instance || !query) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const client = clientFor(instance).client;
          const found = query.includes("@")
            ? await resolveAccountHandle(client, raw).then((result) => (result ? [result] : []))
            : await searchAccountsByUsername(client, raw, { partial: true });
          if (cancelled) return;
          const existing = new Set(sources.map((source) => source.id));
          setSuggestions(found.filter((candidate) => !existing.has(candidate.id)).slice(0, 5));
        } catch (err) {
          console.warn("[oltn] newsletter source search failed", err);
          if (!cancelled) setSuggestions([]);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [account?.instance, handle, sourceKey]);

  const addAccountSource = (found: Account): void => {
    const source = { id: found.id, acct: found.acct, name: found.displayName || found.username };
    const index = sources.findIndex(
      (item) => item.id === found.id || item.acct.toLowerCase() === found.acct.toLowerCase(),
    );
    saveNewsletterSources(
      index < 0 ? [...sources, source] : sources.map((item, i) => (i === index ? source : item)),
    );
    setHandle("");
    setSuggestions([]);
  };

  const addSource = async (e: Event): Promise<void> => {
    e.preventDefault();
    if (!account || !handle.trim() || adding) return;
    const input = handle.trim();
    const bare = !input.replace(/^@/, "").includes("@");
    setAdding(true);
    try {
      const client = clientFor(account.instance).client;
      // A bare @user has no domain to resolve: offer the known accounts that
      // match. Only an exact, single username is added without a click.
      if (bare) {
        const query = input.replace(/^@/, "").toLowerCase();
        const matches = (await searchAccountsByUsername(client, input, { partial: true })).filter(
          (candidate) => !sources.some((source) => source.id === candidate.id),
        );
        const exact = matches.find((candidate) => candidate.username.toLowerCase() === query);
        if (matches.length === 1 && exact) addAccountSource(exact);
        else if (matches.length > 0) setSuggestions(matches);
        else toast(t.newsletterSourceNotFound, "error");
        return;
      }
      const found = await resolveAccountHandle(client, input);
      if (!found) {
        toast(t.newsletterSourceNotFound, "error");
        return;
      }
      addAccountSource(found);
    } finally {
      setAdding(false);
    }
  };

  const removeSource = (acct: string): void => {
    saveNewsletterSources(
      sources.filter((source) => source.acct.toLowerCase() !== acct.toLowerCase()),
    );
  };

  const [hero, ...rest] = links ?? [];

  return (
    <PageShell title={t.newsletter} showBack>
      <div class="newsletter">
        <p class="newsletter-subtitle muted">{t.newsletterSubtitle}</p>

        <section class="newsletter-sources">
          <h2>{t.newsletterSources}</h2>
          <form class="newsletter-source-form" onSubmit={(e) => void addSource(e)}>
            <input
              class="field"
              placeholder={t.newsletterSourcePlaceholder}
              value={handle}
              autocomplete="off"
              autocapitalize="off"
              spellcheck={false}
              onInput={(e) => {
                setHandle((e.target as HTMLInputElement).value);
                setSuggestions([]);
              }}
            />
            <button type="submit" class="btn ghost" disabled={adding || !handle.trim()}>
              {adding ? <span class="spinner" /> : <Icon name="plus-line" size={15} />}
              {t.newsletterSourceAdd}
            </button>
          </form>
          {suggestions.length > 0 && (
            <div class="newsletter-suggestions" role="listbox" aria-label={t.newsletterSources}>
              {suggestions.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  role="option"
                  class="newsletter-suggestion"
                  onClick={() => addAccountSource(candidate)}
                >
                  <Avatar
                    src={candidate.avatarStatic || candidate.avatar}
                    name={candidate.displayName || candidate.username}
                    size={24}
                  />
                  <span class="newsletter-suggestion-name">
                    {candidate.displayName || candidate.username}
                  </span>
                  <span class="newsletter-suggestion-acct">@{candidate.acct}</span>
                </button>
              ))}
            </div>
          )}
          <p class="newsletter-sources-hint">{t.newsletterSourcesHint}</p>
          {sources.length > 0 && (
            <div class="newsletter-chips">
              {sources.map((source) => (
                <span class="newsletter-chip" key={source.id || source.acct}>
                  @{source.acct}
                  <button
                    type="button"
                    class="newsletter-chip-remove"
                    title={`${t.delete}: @${source.acct}`}
                    aria-label={`${t.delete}: @${source.acct}`}
                    onClick={() => removeSource(source.acct)}
                  >
                    <Icon name="close-line" size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        {sourcePosts && (
          <section class="newsletter-feed">
            <h2 class="newsletter-heading">{t.newsletterFromSources}</h2>
            {sourcePosts.length > 0 ? (
              <div class="newsletter-posts">
                {sourcePosts.map((status) => (
                  <StatusCard key={statusKey(status)} statusKey={statusKey(status)} />
                ))}
              </div>
            ) : (
              <p class="muted">{t.empty}</p>
            )}
          </section>
        )}

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
