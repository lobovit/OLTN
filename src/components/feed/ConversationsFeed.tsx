import type { JSX } from "preact";
import type { Conversation } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { userMessageForError } from "../../lib/errors";
import { htmlToPlainText, timeAgo } from "../../lib/format";
import { clientFor } from "../../lib/identity";
import { navigate } from "../../lib/router";
import { currentAccount, putStatuses } from "../../state/store";
import { usePagedFeed } from "../../state/hooks";
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
  const account = currentAccount();
  const target = instance ?? account?.instance ?? "";

  const feed = usePagedFeed<Conversation>({
    key: target,
    enabled: !!account && !!target,
    adapter: {
      fetchPage: async (cursor) => {
        const page = await clientFor(target).client.v1.conversations.list({
          limit: PAGE,
          maxId: cursor ?? undefined,
        });
        return { items: page, hasMore: page.length >= PAGE };
      },
      keyOf: (conversation) => conversation.id,
      cursorOf: (conversation) => conversation.id,
    },
  });

  const open = (conversation: Conversation): void => {
    if (!account) return;
    if (conversation.unread) {
      void clientFor(account.instance)
        .client.v1.conversations.$select(conversation.id)
        .read()
        .catch((err) => console.warn("[oltn] mark read failed", err));
      feed.patch(conversation.id, { unread: false } as Partial<Conversation>);
    }
    const status = conversation.lastStatus;
    if (status) {
      putStatuses([status], target);
      navigate(`/${encodeURIComponent(target)}/s/${status.id}`);
    }
  };

  if (feed.loading && !feed.items.length) {
    return (
      <div class="center-state">
        <span class="spinner" />
      </div>
    );
  }

  if (feed.error && !feed.items.length) {
    return (
      <div class="center-state">
        <Icon name="wifi-off-line" size={28} />
        <h3>{userMessageForError(feed.error, t.errorLoad)}</h3>
        <button type="button" class="btn ghost" onClick={feed.reload}>
          <Icon name="refresh-2-line" size={16} />
          {t.retry}
        </button>
      </div>
    );
  }

  if (!feed.items.length) {
    return (
      <div class="center-state">
        <Icon name="mail-line" size={28} />
        <h3>{t.emptyMessages}</h3>
      </div>
    );
  }

  return (
    <div class="conversation-list">
      {feed.items.map((conversation) => {
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
                {conversation.accounts.slice(0, 2).map((participant, index) => (
                  <span key={participant.id}>
                    {index > 0 && ", "}
                    <EmojiText
                      text={participant.displayName || participant.username}
                      emojis={participant.emojis}
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
      {feed.moreError ? (
        <div class="load-more load-more-error">
          <span class="muted">{t.errorLoad}</span>
          <button type="button" class="btn ghost" onClick={feed.loadMore}>
            <Icon name="refresh-2-line" size={16} />
            {t.retry}
          </button>
        </div>
      ) : (
        feed.hasMore && (
          <button
            type="button"
            class="btn ghost block load-more"
            disabled={feed.loadingMore}
            onClick={feed.loadMore}
          >
            {feed.loadingMore ? t.loadingMore : t.loadMore}
          </button>
        )
      )}
    </div>
  );
}
