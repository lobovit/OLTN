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
  /** Chamado ao abrir um resultado (ex.: fechar o popup). */
  onNavigate?: () => void;
}

export function SearchCore({ initialQuery = "", onNavigate }: SearchCoreProps): JSX.Element {
  const [input, setInput] = useState(initialQuery);
  const [q, setQ] = useState(initialQuery);
  const [tab, setTab] = useState<SearchTab>("accounts");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [hashtags, setHashtags] = useState<Tag[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [tick, setTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setAccounts([]);
      setHashtags([]);
      setStatuses([]);
      setLoadError(false);
      return;
    }
    const account = currentAccount();
    if (!account) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    const client = getRest(account.instance, account.accessToken);
    void (async () => {
      try {
        const result = await client.v2.search.list({ q, resolve: true, limit: 20 });
        if (cancelled) return;
        setAccounts(result.accounts);
        setHashtags(result.hashtags);
        setStatuses(result.statuses);
        putStatuses(result.statuses, account.instance);
      } catch (err) {
        if (!cancelled) {
          console.warn("[oltn] search failed", err);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q, tick]);

  const go = (href: string): void => {
    navigate(href);
    onNavigate?.();
  };

  const instance = encodeURIComponent(currentAccount()?.instance ?? "");

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
      <div class="subtabs">
        {(
          [
            ["accounts", t.profile],
            ["hashtags", t.hashtags],
            ["statuses", t.posts],
          ] as [SearchTab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            class={`subtab ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {!q ? (
        <div class="center-state">
          <Icon name="search-2-line" size={28} />
          <h3>{t.emptySearch}</h3>
        </div>
      ) : loading ? (
        <div class="center-state">
          <span class="spinner" />
        </div>
      ) : loadError ? (
        <div class="center-state">
          <Icon name="wifi-off-line" size={28} />
          <h3>{t.errorLoad}</h3>
          <button type="button" class="btn ghost" onClick={() => setTick((n) => n + 1)}>
            <Icon name="refresh-2-line" size={16} />
            {t.retry}
          </button>
        </div>
      ) : tab === "accounts" ? (
        accounts.length ? (
          <div class="account-list">
            {accounts.map((account) => (
              <button
                key={account.id}
                type="button"
                class="list-row"
                onClick={() => go(`/${instance}/a/${account.id}`)}
              >
                <Avatar
                  src={account.avatar}
                  name={account.displayName || account.username}
                  size={38}
                />
                <div class="row-main">
                  <div class="row-title">
                    <EmojiText
                      text={account.displayName || account.username}
                      emojis={account.emojis}
                    />
                  </div>
                  <div class="row-sub">@{account.acct}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div class="center-state">
            <h3>{t.empty}</h3>
          </div>
        )
      ) : tab === "hashtags" ? (
        hashtags.length ? (
          <div class="account-list">
            {hashtags.map((tag) => (
              <button
                key={tag.name}
                type="button"
                class="list-row"
                onClick={() => go(`/${instance}/t/${encodeURIComponent(tag.name)}`)}
              >
                <Icon name="hashtag-line" size={18} />
                <div class="row-main">
                  <div class="row-title">{tag.name}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div class="center-state">
            <h3>{t.empty}</h3>
          </div>
        )
      ) : statuses.length ? (
        <div class="timeline">
          {statuses.map((status) => (
            <StatusCard key={statusKey(status)} statusKey={statusKey(status)} />
          ))}
        </div>
      ) : (
        <div class="center-state">
          <h3>{t.empty}</h3>
        </div>
      )}
    </>
  );
}
