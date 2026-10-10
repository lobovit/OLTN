import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import { getRest } from "../../api/client";
import type { Status, Translation } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { fullDate, shortNumber, timeAgo } from "../../lib/format";
import { userMessageForError } from "../../lib/errors";
import { navigate } from "../../lib/router";
import {
  currentAccount,
  patchStatus,
  setCompose,
  statusKey as statusKeyOf,
  store,
  toast,
} from "../../state/store";
import { useStatus } from "../../state/hooks";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { Content } from "./Content";
import { EmojiText } from "./EmojiText";
import { MediaGrid } from "./Media";
import { PollView } from "./Poll";
import "./status.css";

interface StatusCardProps {
  statusKey: string;
  compact?: boolean;
  inThread?: boolean;
  showActions?: boolean;
  hideHeader?: boolean;
}

function hostOf(status: Status): string {
  try {
    return new URL(status.uri).host;
  } catch {
    return store.instance?.uri ?? "";
  }
}

function accountRoute(acct: string, fallbackHost: string): string {
  const [name, host] = acct.split("@");
  return `/${encodeURIComponent(host || fallbackHost)}/a/@${encodeURIComponent(name)}`;
}

export function StatusCard({
  statusKey,
  compact,
  inThread,
  showActions = true,
  hideHeader,
}: StatusCardProps): JSX.Element | null {
  const outer = useStatus(statusKey);
  const appState = useSnapshot(store);
  const [cwOpen, setCwOpen] = useState(false);
  const [translated, setTranslated] = useState<Translation | null>(null);
  const [translating, setTranslating] = useState(false);

  if (!outer) return null;

  const target: Status = (outer.reblog ?? outer) as Status;
  const booster = outer.reblog ? outer : null;
  const host = hostOf(target);
  const account = currentAccount();
  const canAct = appState.auth === "authenticated" && !!account && account.instance === host;
  const isSelf = !!appState.me && appState.me.id === target.account.id;
  const targetKey = statusKeyOf(target);

  const filtered = (target.filtered ?? []).filter((f) => f.filter);
  const hidden = filtered.some(
    (f) => f.filter.filterAction === "hide" && host !== (store.instance?.uri ?? ""),
  );
  const warned = filtered.find((f) => f.filter.filterAction !== "hide");

  const openStatus = (e: MouseEvent): void => {
    const el = e.target as HTMLElement;
    // Links, botões, mídia e enquetes têm comportamento próprio
    if (el.closest("a, button, .media-grid, .poll")) return;
    // Não navega se o usuário está selecionando texto
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim()) return;
    navigate(`/${encodeURIComponent(host)}/s/${target.id}`);
  };

  const openAuthor = (e: MouseEvent): void => {
    e.stopPropagation();
    navigate(accountRoute(target.account.acct, host));
  };

  const act = async (kind: "boost" | "fav" | "bookmark", e: MouseEvent): Promise<void> => {
    e.stopPropagation();
    if (!canAct || !account) return;
    const key = targetKey;
    const optimistic: Partial<Status> =
      kind === "boost"
        ? {
            reblogsCount: target.reblogsCount + (target.reblogged ? 0 : 1),
            reblogged: !target.reblogged,
          }
        : kind === "fav"
          ? {
              favouritesCount: target.favouritesCount + (target.favourited ? 0 : 1),
              favourited: !target.favourited,
            }
          : { bookmarked: !target.bookmarked };
    patchStatus(key, optimistic);
    try {
      const client = getRest(account.instance, account.accessToken);
      const sel = client.v1.statuses.$select(target.id);
      if (kind === "boost") {
        if (target.reblogged) await sel.unreblog();
        else await sel.reblog();
      } else if (kind === "fav") {
        if (target.favourited) await sel.unfavourite();
        else await sel.favourite();
      } else if (target.bookmarked) {
        await sel.unbookmark();
      } else {
        await sel.bookmark();
      }
    } catch (err) {
      console.warn("[oltn] action failed", err);
      patchStatus(key, {
        reblogsCount: target.reblogsCount,
        reblogged: target.reblogged,
        favouritesCount: target.favouritesCount,
        favourited: target.favourited,
        bookmarked: target.bookmarked,
      });
      toast(userMessageForError(err, t.errorGeneric), "error");
    }
  };

  const reply = (e: MouseEvent): void => {
    e.stopPropagation();
    if (!canAct) return;
    setCompose({ mode: "reply", statusId: target.id });
  };

  const translate = async (e: MouseEvent): Promise<void> => {
    e.stopPropagation();
    if (!account || translating) return;
    setTranslating(true);
    try {
      const client = getRest(account.instance, account.accessToken);
      const result = (await client.v1.statuses
        .$select(target.id)
        .translate({ lang: "pt" })) as unknown as Translation;
      setTranslated(result);
    } catch (err) {
      console.warn("[oltn] translate failed", err);
      toast("Tradução indisponível para este post.", "error");
    } finally {
      setTranslating(false);
    }
  };

  const cwHidden = !!target.spoilerText && !cwOpen;
  const displayContent = translated ? translated.content : target.content;

  if (hidden) return null;

  return (
    <article
      class={`status-card ${compact ? "compact" : ""} ${inThread ? "in-thread" : ""}`}
      onClick={openStatus}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") navigate(`/${encodeURIComponent(host)}/s/${target.id}`);
      }}
    >
      {booster && (
        <div class="reblog-line">
          <Icon name="repeat-line" size={14} />
          <a
            href={`#/${encodeURIComponent(hostOf(booster))}/a/@${encodeURIComponent(booster.account.acct.split("@")[0])}`}
            onClick={(e) => e.stopPropagation()}
          >
            {booster.account.displayName ? (
              <EmojiText text={booster.account.displayName} emojis={booster.account.emojis} />
            ) : (
              booster.account.username
            )}
          </a>
          <span class="faint">impulsionou</span>
        </div>
      )}

      {!hideHeader && (
        <div class="byline" onClick={openAuthor}>
          <Avatar
            src={target.account.avatar}
            name={target.account.displayName || target.account.username}
            size={compact ? 34 : 42}
          />
          <div class="byline-text">
            <div class="display-name">
              <EmojiText
                text={target.account.displayName || target.account.username}
                emojis={target.account.emojis}
              />
            </div>
            <div class="handle">
              @{target.account.acct}
              {host !== (store.instance?.uri ?? "") ? `@${host}` : ""}
            </div>
          </div>
          <time
            class="timestamp"
            dateTime={target.createdAt}
            title={fullDate(target.createdAt)}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/${encodeURIComponent(host)}/s/${target.id}`);
            }}
          >
            {timeAgo(target.createdAt)}
          </time>
        </div>
      )}

      {target.spoilerText && (
        <div class="spoiler">
          <div class="spoiler-label">
            <Icon name="eye-close-line" size={14} />
            aviso: {target.spoilerText}
          </div>
          {!cwOpen && (
            <button
              type="button"
              class="cw-toggle"
              onClick={(e) => {
                e.stopPropagation();
                setCwOpen(true);
              }}
            >
              {t.showMore}
            </button>
          )}
        </div>
      )}

      {!cwHidden && (
        <>
          <Content
            html={displayContent}
            emojis={target.emojis}
            class={translated ? "translated" : ""}
          />
          {translated && (
            <div class="translation muted" onClick={(e) => e.stopPropagation()}>
              <span class="faint">
                traduzido de {translated.detectedLanguageSource} para português
              </span>{" "}
              <button
                type="button"
                class="cw-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  setTranslated(null);
                }}
              >
                {t.showOriginal}
              </button>
            </div>
          )}
          {!translated && target.language && target.language !== "pt" && canAct && (
            <div class="translation" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                class="cw-toggle"
                disabled={translating}
                onClick={(e) => void translate(e)}
              >
                {translating ? t.loading : `${t.translate} (${target.language})`}
              </button>
            </div>
          )}

          <MediaGrid
            attachments={target.mediaAttachments}
            instance={host}
            sensitive={target.sensitive}
          />

          {target.poll && (
            <PollView poll={target.poll} statusKey={targetKey} instance={host} canVote={canAct} />
          )}

          {target.card && !target.mediaAttachments.length && (
            <a
              class="link-card"
              href={target.card.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {target.card.image && <img src={target.card.image} alt="" loading="lazy" />}
              <span class="title">{target.card.title}</span>
              {target.card.description && (
                <span class="desc clamp-2">{target.card.description}</span>
              )}
              <span class="provider">{target.card.providerName}</span>
            </a>
          )}
        </>
      )}

      {warned && (
        <div class="filter-warning" onClick={(e) => e.stopPropagation()}>
          <Icon name="filter-line" size={15} />
          oculto por filtro: {warned.filter.title}
        </div>
      )}

      {showActions && (
        <div class="actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            class="status-action reply"
            title={t.reply}
            aria-label={target.repliesCount > 0 ? `${t.reply} (${target.repliesCount})` : t.reply}
            onClick={reply}
            disabled={!canAct}
          >
            <Icon name="share-forward-line" size={16} class="rot-180" />
            {target.repliesCount > 0 && (
              <span class="count">{shortNumber(target.repliesCount)}</span>
            )}
          </button>
          <button
            type="button"
            class={`status-action boost ${target.reblogged ? "on" : ""}`}
            title={t.boost}
            aria-label={target.reblogsCount > 0 ? `${t.boost} (${target.reblogsCount})` : t.boost}
            aria-pressed={!!target.reblogged}
            onClick={(e) => void act("boost", e)}
            disabled={!canAct}
          >
            <Icon name="repeat-line" size={16} />
            {target.reblogsCount > 0 && (
              <span class="count">{shortNumber(target.reblogsCount)}</span>
            )}
          </button>
          <button
            type="button"
            class={`status-action fav ${target.favourited ? "on" : ""}`}
            title={t.favourite}
            aria-label={
              target.favouritesCount > 0
                ? `${t.favourite} (${target.favouritesCount})`
                : t.favourite
            }
            aria-pressed={!!target.favourited}
            onClick={(e) => void act("fav", e)}
            disabled={!canAct}
          >
            <Icon name={target.favourited ? "heart-fill" : "heart-line"} size={16} />
            {target.favouritesCount > 0 && (
              <span class="count">{shortNumber(target.favouritesCount)}</span>
            )}
          </button>
          <button
            type="button"
            class={`status-action bookmark ${target.bookmarked ? "on" : ""}`}
            title={t.bookmark}
            aria-label={t.bookmark}
            aria-pressed={!!target.bookmarked}
            onClick={(e) => void act("bookmark", e)}
            disabled={!canAct}
          >
            <Icon name={target.bookmarked ? "bookmark-fill" : "bookmark-line"} size={16} />
          </button>
          {isSelf && canAct && (
            <button
              type="button"
              class="status-action edit"
              title={t.editPost}
              aria-label={t.editPost}
              onClick={(e) => {
                e.stopPropagation();
                setCompose({ mode: "edit", statusId: target.id });
              }}
            >
              <Icon name="pencil-line" size={16} />
            </button>
          )}
          <div class="spacer" />
          {target.editedAt && (
            <span class="edit-badge" title={fullDate(target.editedAt)}>
              <Icon name="history-line" size={13} />
              editado
            </span>
          )}
        </div>
      )}
    </article>
  );
}
