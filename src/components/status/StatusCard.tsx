import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import { getRest } from "../../api/client";
import type { Status, Translation } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import {
  fullDate,
  htmlToPlainText,
  languageName,
  plainTextToHtml,
  shortNumber,
  timeAgo,
} from "../../lib/format";
import { httpStatusOf } from "../../lib/errors";
import { navigate } from "../../lib/router";
import { localStatus } from "../../lib/resolve";
import { TRANSLATE_TARGETS, translateText } from "../../lib/translate";
import {
  currentAccount,
  putStatus,
  setCompose,
  statusKey as statusKeyOf,
  store,
  toast,
} from "../../state/store";
import { blockStatusAuthor, toggleStatusAction } from "../../state/status-actions";
import { useStatus } from "../../state/hooks";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { Content } from "./Content";
import { EmojiText } from "./EmojiText";
import { MediaGrid } from "./Media";
import { PollView } from "./Poll";
import { ReportSheet } from "./ReportSheet";
import "./status.css";

/** Instances that refused native translation (no service configured). */
const instanceTranslateUnsupported = new Set<string>();

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
  const [transLang, setTransLang] = useState("");
  const [transMenuOpen, setTransMenuOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const transRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{
    top?: number;
    bottom?: number;
    right: number;
  } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!transMenuOpen) return;
    const onDown = (e: PointerEvent): void => {
      if (!transRef.current?.contains(e.target as Node)) setTransMenuOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [transMenuOpen]);

  useEffect(() => {
    if (!menuPos) return;
    const onDown = (e: PointerEvent): void => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuPos(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menuPos]);

  if (!outer) return null;

  const target: Status = (outer.reblog ?? outer) as Status;
  const booster = outer.reblog ? outer : null;
  const host = hostOf(target);
  const account = currentAccount();
  const canAct = appState.auth === "authenticated" && !!account;
  const isSelf = !!appState.me && appState.me.id === target.account.id;
  const targetKey = statusKeyOf(target);
  // The `id` is only valid on the instance that originated the status — for
  // remote/boosted posts this is not the author's host.
  const sourceInstance = store.statusSources[targetKey] ?? host;
  const openHref = `/${encodeURIComponent(sourceInstance)}/s/${target.id}`;

  /** Status id on the account instance (resolves posts from other instances). */
  const resolveLocalId = async (): Promise<string | null> => {
    if (!account) return null;
    const local = await localStatus(
      getRest(account.instance, account.accessToken),
      account.instance,
      target,
      sourceInstance,
    );
    if (!local) return null;
    if (local !== target) putStatus(local, account.instance);
    return local.id;
  };

  const openMenu = (e: MouseEvent): void => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const right = Math.max(8, window.innerWidth - rect.right);
    setMenuPos(
      window.innerHeight - rect.bottom < 150
        ? { bottom: window.innerHeight - rect.top + 6, right }
        : { top: rect.bottom + 6, right },
    );
  };

  const blockUser = async (): Promise<void> => {
    if (!account) return;
    setMenuPos(null);
    if (!window.confirm(`${t.blockConfirm} @${target.account.acct}`)) return;
    await blockStatusAuthor(
      { client: getRest(account.instance, account.accessToken), instance: account.instance },
      targetKey,
    );
  };

  const filtered = (target.filtered ?? []).filter((f) => f.filter);
  const hidden = filtered.some(
    (f) => f.filter.filterAction === "hide" && host !== (store.instance?.uri ?? ""),
  );
  const warned = filtered.find((f) => f.filter.filterAction !== "hide");

  const openStatus = (e: MouseEvent): void => {
    const el = e.target as HTMLElement;
    // Links, buttons, media and polls have their own behavior
    if (el.closest("a, button, .media-grid, .poll")) return;
    // Do not navigate while the user is selecting text
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim()) return;
    navigate(openHref);
  };

  const openAuthor = (e: MouseEvent): void => {
    e.stopPropagation();
    navigate(accountRoute(target.account.acct, host));
  };

  const act = (kind: "boost" | "fav" | "bookmark", e: MouseEvent): void => {
    e.stopPropagation();
    if (!canAct || !account) return;
    void toggleStatusAction(
      { client: getRest(account.instance, account.accessToken), instance: account.instance },
      targetKey,
      kind,
    );
  };

  const reply = async (e: MouseEvent): Promise<void> => {
    e.stopPropagation();
    if (!canAct) return;
    const id = await resolveLocalId();
    if (!id) {
      toast(t.errorGeneric, "error");
      return;
    }
    setCompose({ mode: "reply", statusId: id });
  };

  const translateViaFallback = async (lang: string): Promise<Translation> => {
    const result = await translateText(htmlToPlainText(target.content), lang);
    return {
      content: plainTextToHtml(result.text),
      detectedLanguageSource: result.source ?? target.language ?? "",
      provider: "google",
    };
  };

  const translate = async (lang: string): Promise<void> => {
    if (!account || translating) return;
    setTransMenuOpen(false);
    setTranslating(true);
    const instance = account.instance;
    try {
      let result: Translation | null = null;
      if (!instanceTranslateUnsupported.has(instance)) {
        const id = await resolveLocalId();
        if (id) {
          try {
            const client = getRest(instance, account.accessToken);
            result = (await client.v1.statuses
              .$select(id)
              .translate({ lang })) as unknown as Translation;
          } catch (err) {
            console.warn("[oltn] instance translate failed; using fallback", err);
            const status = httpStatusOf(err);
            if (status === 403 || status === 404) instanceTranslateUnsupported.add(instance);
          }
        }
      }
      if (!result) result = await translateViaFallback(lang);
      setTransLang(lang);
      setTranslated(result);
    } catch (err) {
      console.warn("[oltn] translate failed", err);
      toast(t.translateUnavailable, "error");
    } finally {
      setTranslating(false);
    }
  };

  const cwHidden = !!target.spoilerText && !cwOpen;
  const displayContent = translated ? translated.content : target.content;
  const blockedAccount = appState.blockedAccounts.includes(target.account.acct);

  if (hidden || blockedAccount) return null;

  return (
    <>
      <article
        class={`status-card ${compact ? "compact" : ""} ${inThread ? "in-thread" : ""}`}
        onClick={openStatus}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") navigate(openHref);
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
            <span class="faint">{t.boosted}</span>
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
                navigate(openHref);
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
              {t.warningPrefix} {target.spoilerText}
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
                  {t.translated} · {languageName(transLang)}
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
            {!translated && canAct && (
              <div class="translation" onClick={(e) => e.stopPropagation()} ref={transRef}>
                <button
                  type="button"
                  class="cw-toggle"
                  disabled={translating}
                  aria-haspopup="listbox"
                  aria-expanded={transMenuOpen}
                  onClick={() => setTransMenuOpen((v) => !v)}
                >
                  {translating
                    ? t.loading
                    : `${t.translate}${target.language ? ` (${target.language})` : ""}`}
                </button>
                {transMenuOpen && (
                  <div
                    class="translate-menu status-translate-menu"
                    role="listbox"
                    aria-label={t.translateTo}
                  >
                    {TRANSLATE_TARGETS.map((code) => (
                      <button
                        key={code}
                        type="button"
                        role="option"
                        class="translate-option"
                        onClick={() => void translate(code)}
                      >
                        <span>{languageName(code)}</span>
                        <span class="faint">{code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <MediaGrid
              attachments={target.mediaAttachments}
              instance={host}
              sensitive={target.sensitive}
            />

            {target.poll && (
              <PollView
                poll={target.poll}
                statusKey={targetKey}
                canVote={canAct && sourceInstance === account?.instance}
              />
            )}

            {target.card && !target.mediaAttachments.length && (
              <a
                class="link-card"
                href={target.card.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {target.card.image && (
                  <img
                    src={target.card.image}
                    alt=""
                    width={target.card.width ?? undefined}
                    height={target.card.height ?? undefined}
                    loading="lazy"
                  />
                )}
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
            {t.filterHiddenBy} {warned.filter.title}
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
            {isSelf && canAct && sourceInstance === account?.instance && (
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
            {!isSelf && canAct && (
              <div class="action-more">
                <button
                  type="button"
                  class={`status-action more ${menuPos ? "on" : ""}`}
                  title={t.moreOptions}
                  aria-label={t.moreOptions}
                  aria-haspopup="menu"
                  aria-expanded={!!menuPos}
                  onClick={openMenu}
                >
                  <Icon name="more-1-line" size={16} />
                </button>
              </div>
            )}
            <div class="spacer" />
            {target.editedAt && (
              <span class="edit-badge" title={fullDate(target.editedAt)}>
                <Icon name="history-line" size={13} />
                {t.edited}
              </span>
            )}
          </div>
        )}
        {menuPos && (
          <div
            ref={menuRef}
            class="action-menu"
            role="menu"
            style={{ top: menuPos.top, bottom: menuPos.bottom, right: menuPos.right }}
          >
            <button
              type="button"
              role="menuitem"
              class="action-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                setMenuPos(null);
                setReportOpen(true);
              }}
            >
              <Icon name="report-line" size={15} />
              {t.reportPost}
            </button>
            <button
              type="button"
              role="menuitem"
              class="action-menu-item danger"
              onClick={(e) => {
                e.stopPropagation();
                void blockUser();
              }}
            >
              <Icon name="user-forbid-line" size={15} />
              {t.blockUser}
            </button>
          </div>
        )}
      </article>
      {reportOpen && (
        <ReportSheet statusKey={targetKey} status={target} onClose={() => setReportOpen(false)} />
      )}
    </>
  );
}
