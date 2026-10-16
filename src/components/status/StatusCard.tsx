import type { JSX, RefObject } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import type { Status } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { fullDate, languageName, timeAgo } from "../../lib/format";
import { clientFor, hrefFor, localStatus, sourceInstanceFor } from "../../lib/identity";
import { navigate } from "../../lib/router";
import { TRANSLATE_TARGETS } from "../../lib/translate";
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
import { StatusActionsBar, type ToggleKind } from "./StatusActionsBar";
import { useStatusTranslation, type StatusTranslationState } from "./useStatusTranslation";
import "./status.css";

interface StatusCardProps {
  statusKey: string;
  compact?: boolean;
  inThread?: boolean;
  showActions?: boolean;
  hideHeader?: boolean;
}

interface ActionMenuPos {
  top?: number;
  bottom?: number;
  right: number;
}

function hostOf(status: Status): string {
  try {
    return new URL(status.uri).host;
  } catch {
    return store.instance?.uri ?? "";
  }
}

function ReblogLine({ booster, href }: { booster: Status; href: string }): JSX.Element {
  return (
    <div class="reblog-line">
      <Icon name="repeat-line" size={14} />
      <a href={`#${href}`} onClick={(e) => e.stopPropagation()}>
        {booster.account.displayName ? (
          <EmojiText text={booster.account.displayName} emojis={booster.account.emojis} />
        ) : (
          booster.account.username
        )}
      </a>
      <span class="faint">{t.boosted}</span>
    </div>
  );
}

function Byline({
  target,
  host,
  compact,
  openHref,
  onAuthor,
}: {
  target: Status;
  host: string;
  compact: boolean;
  openHref: string;
  onAuthor: (e: MouseEvent) => void;
}): JSX.Element {
  return (
    <div class="byline" onClick={onAuthor}>
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
          {!target.account.acct.includes("@") && host !== (store.instance?.uri ?? "")
            ? `@${host}`
            : ""}
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
  );
}

function SpoilerNotice({
  text,
  open,
  onOpen,
}: {
  text: string;
  open: boolean;
  onOpen: () => void;
}): JSX.Element {
  return (
    <div class="spoiler">
      <div class="spoiler-label">
        <Icon name="eye-close-line" size={14} />
        {t.warningPrefix} {text}
      </div>
      {!open && (
        <button
          type="button"
          class="cw-toggle"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          {t.showMore}
        </button>
      )}
    </div>
  );
}

function LinkCard({ card }: { card: NonNullable<Status["card"]> }): JSX.Element {
  return (
    <a
      class="link-card"
      href={card.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      {card.image && (
        <img
          src={card.image}
          alt=""
          width={card.width ?? undefined}
          height={card.height ?? undefined}
          loading="lazy"
        />
      )}
      <span class="title">{card.title}</span>
      {card.description && <span class="desc clamp-2">{card.description}</span>}
      <span class="provider">{card.providerName}</span>
    </a>
  );
}

function StatusTranslationBlock({
  target,
  canAct,
  translation,
}: {
  target: Status;
  canAct: boolean;
  translation: StatusTranslationState;
}): JSX.Element | null {
  if (translation.translated) {
    return (
      <div class="translation muted" onClick={(e) => e.stopPropagation()}>
        <span class="faint">
          {t.translated} · {languageName(translation.transLang)}
        </span>{" "}
        <button
          type="button"
          class="cw-toggle"
          onClick={(e) => {
            e.stopPropagation();
            translation.showOriginal();
          }}
        >
          {t.showOriginal}
        </button>
      </div>
    );
  }
  if (!canAct) return null;
  return (
    <div class="translation" onClick={(e) => e.stopPropagation()} ref={translation.containerRef}>
      <button
        type="button"
        class="cw-toggle"
        disabled={translation.translating}
        aria-haspopup="listbox"
        aria-expanded={translation.menuOpen}
        onClick={() => translation.setMenuOpen(!translation.menuOpen)}
      >
        {translation.translating
          ? t.loading
          : `${t.translate}${target.language ? ` (${target.language})` : ""}`}
      </button>
      {translation.menuOpen && (
        <div class="translate-menu status-translate-menu" role="listbox" aria-label={t.translateTo}>
          {TRANSLATE_TARGETS.map((code) => (
            <button
              key={code}
              type="button"
              role="option"
              aria-selected={false}
              class="translate-option"
              onClick={() => void translation.translate(code)}
            >
              <span>{languageName(code)}</span>
              <span class="faint">{code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Report/block menu position, outside-click and anchoring. */
function useActionMenu() {
  const [menuPos, setMenuPos] = useState<ActionMenuPos | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuPos) return;
    const onDown = (e: PointerEvent): void => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuPos(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menuPos]);

  const open = (e: MouseEvent): void => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const right = Math.max(8, window.innerWidth - rect.right);
    setMenuPos(
      window.innerHeight - rect.bottom < 150
        ? { bottom: window.innerHeight - rect.top + 6, right }
        : { top: rect.bottom + 6, right },
    );
  };

  const close = (): void => setMenuPos(null);

  return { menuPos, menuRef, open, close };
}

function StatusActionMenu({
  pos,
  menuRef,
  onReport,
  onBlock,
}: {
  pos: ActionMenuPos;
  menuRef: RefObject<HTMLDivElement | null>;
  onReport: (e: MouseEvent) => void;
  onBlock: (e: MouseEvent) => void;
}): JSX.Element {
  return (
    <div
      ref={menuRef}
      class="action-menu"
      role="menu"
      style={{ top: pos.top, bottom: pos.bottom, right: pos.right }}
    >
      <button type="button" role="menuitem" class="action-menu-item" onClick={onReport}>
        <Icon name="report-line" size={15} />
        {t.reportPost}
      </button>
      <button type="button" role="menuitem" class="action-menu-item danger" onClick={onBlock}>
        <Icon name="user-forbid-line" size={15} />
        {t.blockUser}
      </button>
    </div>
  );
}

export function StatusCard(props: StatusCardProps): JSX.Element | null {
  const outer = useStatus(props.statusKey);
  if (!outer) return null;
  return <StatusCardView outer={outer} {...props} />;
}

interface StatusCardViewProps extends StatusCardProps {
  outer: Status;
}

function StatusCardView({
  outer,
  compact,
  inThread,
  showActions = true,
  hideHeader,
}: StatusCardViewProps): JSX.Element | null {
  const appState = useSnapshot(store);
  const [cwOpen, setCwOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const menu = useActionMenu();

  // Boost cards display the inner status through its own cache entry (like
  // Phanpy's recursive <Status>), so stream/refetch/action updates reflect.
  const innerKey = outer.reblog ? statusKeyOf(outer.reblog) : null;
  const cachedInner = innerKey
    ? (appState.statuses[innerKey] as unknown as Status | undefined)
    : undefined;
  const target: Status = (cachedInner ?? outer.reblog ?? outer) as Status;
  const booster = outer.reblog ? outer : null;
  const host = hostOf(target);
  const account = currentAccount();
  const canAct = appState.auth === "authenticated" && !!account;
  const isSelf = !!appState.me && appState.me.id === target.account.id;
  const targetKey = statusKeyOf(target);
  // The `id` is only valid on the instance that originated the status — for
  // remote/boosted posts this is not the author's host.
  const sourceInstance = sourceInstanceFor(targetKey, target);
  const openHref = hrefFor.status(target.id, sourceInstance);

  /** Status id on the account instance (resolves posts from other instances). */
  const resolveLocalId = async (): Promise<string | null> => {
    if (!account) return null;
    const local = await localStatus(
      clientFor(account.instance).client,
      account.instance,
      target,
      sourceInstance,
    );
    if (!local) return null;
    if (local !== target) putStatus(local, account.instance);
    return local.id;
  };

  const translation = useStatusTranslation(target, account, resolveLocalId);

  const blockUser = async (): Promise<void> => {
    if (!account) return;
    menu.close();
    if (!window.confirm(`${t.blockConfirm} @${target.account.acct}`)) return;
    await blockStatusAuthor(clientFor(account.instance), targetKey);
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
    navigate(hrefFor.accountById(sourceInstance, target.account.id));
  };

  const act = (kind: ToggleKind, e: MouseEvent): void => {
    e.stopPropagation();
    if (!canAct || !account) return;
    void toggleStatusAction(clientFor(account.instance), targetKey, kind);
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

  const cwHidden = !!target.spoilerText && !cwOpen;
  const displayContent = translation.translated ? translation.translated.content : target.content;
  const blockedAccount = appState.blockedAccounts.includes(target.account.acct);

  if (hidden || blockedAccount) return null;

  return (
    <>
      <article
        class={`status-card ${compact ? "compact" : ""} ${inThread ? "in-thread" : ""}`}
        data-focusable
        onClick={openStatus}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") navigate(openHref);
        }}
      >
        {booster && (
          <ReblogLine
            booster={booster}
            href={hrefFor.accountById(
              sourceInstanceFor(statusKeyOf(booster), booster),
              booster.account.id,
            )}
          />
        )}

        {!hideHeader && (
          <Byline
            target={target}
            host={host}
            compact={!!compact}
            openHref={openHref}
            onAuthor={openAuthor}
          />
        )}

        {target.spoilerText && (
          <SpoilerNotice text={target.spoilerText} open={cwOpen} onOpen={() => setCwOpen(true)} />
        )}

        {!cwHidden && (
          <>
            <Content
              html={displayContent}
              emojis={target.emojis}
              class={translation.translated ? "translated" : ""}
            />
            <StatusTranslationBlock target={target} canAct={canAct} translation={translation} />

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

            {target.card && !target.mediaAttachments.length && <LinkCard card={target.card} />}
          </>
        )}

        {warned && (
          <div class="filter-warning" onClick={(e) => e.stopPropagation()}>
            <Icon name="filter-line" size={15} />
            {t.filterHiddenBy} {warned.filter.title}
          </div>
        )}

        {showActions && (
          <StatusActionsBar
            target={target}
            canAct={canAct}
            showEdit={isSelf && canAct && sourceInstance === account?.instance}
            showMore={!isSelf && canAct}
            menuOpen={!!menu.menuPos}
            onReply={reply}
            onAct={act}
            onEdit={(e) => {
              e.stopPropagation();
              setCompose({ mode: "edit", statusId: target.id });
            }}
            onMore={menu.open}
          />
        )}
        {menu.menuPos && (
          <StatusActionMenu
            pos={menu.menuPos}
            menuRef={menu.menuRef}
            onReport={(e) => {
              e.stopPropagation();
              menu.close();
              setReportOpen(true);
            }}
            onBlock={(e) => {
              e.stopPropagation();
              void blockUser();
            }}
          />
        )}
      </article>
      {reportOpen && (
        <ReportSheet statusKey={targetKey} status={target} onClose={() => setReportOpen(false)} />
      )}
    </>
  );
}
