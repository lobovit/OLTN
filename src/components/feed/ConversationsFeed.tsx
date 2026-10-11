import type { JSX } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { getRest } from "../../api/client";
import type { Conversation } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { userMessageForError } from "../../lib/errors";
import { htmlToPlainText, timeAgo } from "../../lib/format";
import { navigate } from "../../lib/router";
import { currentAccount, putStatuses } from "../../state/store";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { EmojiText } from "../status/EmojiText";

const PAGE = 20;

function participantNames(conversation: Conversation): string {
  const names = conversation.accounts.map((a) => a.displayName || a.username);
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

export function ConversationsFeed({ instance }: { instance?: string }): JSX.Element {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const maxIdRef = useRef<string | undefined>(undefined);

  const loadInitial = useCallback(async (): Promise<void> => {
    const account = currentAccount();
    if (!account) return;
    setLoading(true);
    setError(null);
    try {
      const page = await getRest(
        instance ?? account.instance,
        account.accessToken,
      ).v1.conversations.list({ limit: PAGE });
      setItems([...page]);
      maxIdRef.current = page.length ? page[page.length - 1].id : undefined;
      setHasMore(page.length === PAGE);
    } catch (err) {
      console.warn("[oltn] conversations load failed", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [instance]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const loadMore = useCallback(async (): Promise<void> => {
    const account = currentAccount();
    if (!account || !maxIdRef.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getRest(
        instance ?? account.instance,
        account.accessToken,
      ).v1.conversations.list({ limit: PAGE, maxId: maxIdRef.current });
      setItems((prev) => [...prev, ...page.filter((c) => !prev.some((p) => p.id === c.id))]);
      if (page.length) maxIdRef.current = page[page.length - 1].id;
      if (page.length < PAGE) setHasMore(false);
    } catch (err) {
      console.warn("[oltn] conversations page failed", err);
    } finally {
      setLoadingMore(false);
    }
  }, [instance, loadingMore]);

  const open = (conversation: Conversation): void => {
    const account = currentAccount();
    if (!account) return;
    if (conversation.unread) {
      void getRest(account.instance, account.accessToken)
        .v1.conversations.$select(conversation.id)
        .read()
        .catch((err) => console.warn("[oltn] mark read failed", err));
      setItems((prev) => prev.map((c) => (c.id === conversation.id ? { ...c, unread: false } : c)));
    }
    const status = conversation.lastStatus;
    if (status) {
      const source = instance ?? account.instance;
      putStatuses([status], source);
      navigate(`/${encodeURIComponent(source)}/s/${status.id}`);
    }
  };

  if (loading && !items.length) {
    return (
      <div class="center-state">
        <span class="spinner" />
      </div>
    );
  }

  if (error && !items.length) {
    return (
      <div class="center-state">
        <Icon name="wifi-off-line" size={28} />
        <h3>{userMessageForError(error, t.errorLoad)}</h3>
        <button type="button" class="btn ghost" onClick={() => void loadInitial()}>
          <Icon name="refresh-2-line" size={16} />
          {t.retry}
        </button>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div class="center-state">
        <Icon name="mail-line" size={28} />
        <h3>{t.emptyMessages}</h3>
      </div>
    );
  }

  return (
    <div class="conversation-list">
      {items.map((conversation) => {
        const last = conversation.lastStatus;
        const preview = last ? htmlToPlainText(last.content) : "";
        return (
          <button
            key={conversation.id}
            type="button"
            class="list-row"
            onClick={() => open(conversation)}
          >
            <Avatar
              src={conversation.accounts[0]?.avatar}
              name={participantNames(conversation)}
              size={38}
            />
            <div class="row-main">
              <div class="row-title">
                {conversation.accounts.slice(0, 2).map((account, index) => (
                  <span key={account.id}>
                    {index > 0 && ", "}
                    <EmojiText
                      text={account.displayName || account.username}
                      emojis={account.emojis}
                    />
                  </span>
                ))}
                {conversation.accounts.length > 2 && ` +${conversation.accounts.length - 2}`}
                {conversation.unread && <span class="conv-dot" role="img" aria-label={t.unread} />}
              </div>
              {preview && <div class="row-sub clamp-2">{preview}</div>}
            </div>
            {last && (
              <time class="row-time" dateTime={last.createdAt}>
                {timeAgo(last.createdAt)}
              </time>
            )}
          </button>
        );
      })}
      {hasMore && (
        <button
          type="button"
          class="btn ghost block load-more"
          disabled={loadingMore}
          onClick={() => void loadMore()}
        >
          {loadingMore ? t.loadingMore : t.loadMore}
        </button>
      )}
    </div>
  );
}
