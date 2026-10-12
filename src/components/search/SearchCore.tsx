import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { getRest } from "../../api/client";
import type { Account, Status, Tag } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { navigate } from "../../lib/router";
import { StatusCard } from "../status/StatusCard";
import { EmojiText } from "../status/EmojiText";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { currentAccount, putStatuses, statusKey } from "../../state/store";

type SearchTab = "accounts" | "hashtags" | "statuses";

interface SearchCoreProps {
  initialQuery?: string;
  /** Called when opening a result (e.g. close the popup). */
  onNavigate?: () => void;
}

interface SearchResultsState {
  accounts: Account[];
  hashtags: Tag[];
  statuses: Status[];
  loading: boolean;
  failed: boolean;
}

/** Fetches accounts/hashtags/statuses for the query (tick forces a retry). */
function useSearchResults(query: string, tick: number): SearchResultsState {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [hashtags, setHashtags] = useState<Tag[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setAccounts([]);
      setHashtags([]);
      setStatuses([]);
      setFailed(false);
      return;
    }
    const account = currentAccount();
    if (!account) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const client = getRest(account.instance, account.accessToken);
    void (async () => {
      try {
        const result = await client.v2.search.list({ q: query, resolve: true, limit: 20 });
        if (cancelled) return;
        setAccounts(result.accounts);
        setHashtags(result.hashtags);
        setStatuses(result.statuses);
        putStatuses(result.statuses, account.instance);
      } catch (err) {
        if (!cancelled) {
          console.warn("[oltn] search failed", err);
          setFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, tick]);

  return { accounts, hashtags, statuses, loading, failed };
}

function SearchCenterState({
  icon,
  title,
  onRetry,
}: {
  icon: string;
  title: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div class="center-state">
      <Icon name={icon} size={28} />
      <h3>{title}</h3>
      {onRetry && (
        <button type="button" class="btn ghost" onClick={onRetry}>
          <Icon name="refresh-2-line" size={16} />
          {t.retry}
        </button>
      )}
    </div>
  );
}

function SearchEmptyState(): JSX.Element {
  return (
    <div class="center-state">
      <h3>{t.empty}</h3>
    </div>
  );
}

function AccountResults({
  accounts,
  instance,
  onGo,
}: {
  accounts: readonly Account[];
  instance: string;
  onGo: (href: string) => void;
}): JSX.Element {
  if (!accounts.length) return <SearchEmptyState />;
  return (
    <div class="account-list">
      {accounts.map((account) => (
        <button
          key={account.id}
          type="button"
          class="list-row"
          onClick={() => onGo(`/${instance}/a/${account.id}`)}
        >
          <Avatar src={account.avatar} name={account.displayName || account.username} size={38} />
          <div class="row-main">
            <div class="row-title">
              <EmojiText text={account.displayName || account.username} emojis={account.emojis} />
            </div>
            <div class="row-sub">@{account.acct}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function HashtagResults({
  hashtags,
  instance,
  onGo,
}: {
  hashtags: readonly Tag[];
  instance: string;
  onGo: (href: string) => void;
}): JSX.Element {
  if (!hashtags.length) return <SearchEmptyState />;
  return (
    <div class="account-list">
      {hashtags.map((tag) => (
        <button
          key={tag.name}
          type="button"
          class="list-row"
          onClick={() => onGo(`/${instance}/t/${encodeURIComponent(tag.name)}`)}
        >
          <Icon name="hashtag-line" size={18} />
          <div class="row-main">
            <div class="row-title">{tag.name}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function StatusResults({ statuses }: { statuses: readonly Status[] }): JSX.Element {
  if (!statuses.length) return <SearchEmptyState />;
  return (
    <div class="timeline">
      {statuses.map((status) => (
        <StatusCard key={statusKey(status)} statusKey={statusKey(status)} />
      ))}
    </div>
  );
}

function SearchResults({
  query,
  tab,
  results,
  instance,
  onGo,
  onRetry,
}: {
  query: string;
  tab: SearchTab;
  results: SearchResultsState;
  instance: string;
  onGo: (href: string) => void;
  onRetry: () => void;
}): JSX.Element {
  if (!query) return <SearchCenterState icon="search-2-line" title={t.emptySearch} />;
  if (results.loading) {
    return (
      <div class="center-state">
        <span class="spinner" />
      </div>
    );
  }
  if (results.failed) {
    return <SearchCenterState icon="wifi-off-line" title={t.errorLoad} onRetry={onRetry} />;
  }
  if (tab === "accounts") {
    return <AccountResults accounts={results.accounts} instance={instance} onGo={onGo} />;
  }
  if (tab === "hashtags") {
    return <HashtagResults hashtags={results.hashtags} instance={instance} onGo={onGo} />;
  }
  return <StatusResults statuses={results.statuses} />;
}

function SearchTabs({
  tab,
  onTab,
}: {
  tab: SearchTab;
  onTab: (tab: SearchTab) => void;
}): JSX.Element {
  const tabs: [SearchTab, string][] = [
    ["accounts", t.profile],
    ["hashtags", t.hashtags],
    ["statuses", t.posts],
  ];
  return (
    <div class="subtabs">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          type="button"
          class={`subtab ${tab === key ? "active" : ""}`}
          onClick={() => onTab(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function SearchCore({ initialQuery = "", onNavigate }: SearchCoreProps): JSX.Element {
  const [input, setInput] = useState(initialQuery);
  const [q, setQ] = useState(initialQuery);
  const [tab, setTab] = useState<SearchTab>("accounts");
  const [tick, setTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useSearchResults(q, tick);
  const instance = encodeURIComponent(currentAccount()?.instance ?? "");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const go = (href: string): void => {
    navigate(href);
    onNavigate?.();
  };

  return (
    <>
      <form
        class="search-form"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(input.trim());
        }}
      >
        <div class="search-box">
          <Icon name="search-2-line" size={18} />
          <input
            ref={inputRef}
            class="field"
            placeholder={t.instancePlaceholder}
            value={input}
            onInput={(e) => setInput((e.target as HTMLInputElement).value)}
          />
        </div>
      </form>
      <SearchTabs tab={tab} onTab={setTab} />
      <SearchResults
        query={q}
        tab={tab}
        results={results}
        instance={instance}
        onGo={go}
        onRetry={() => setTick((n) => n + 1)}
      />
    </>
  );
}
