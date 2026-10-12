import type { JSX } from "preact";
import type { Status } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { fullDate, shortNumber } from "../../lib/format";
import { Icon } from "../ui/Icon";

export type ToggleKind = "boost" | "fav" | "bookmark";

interface StatusActionsBarProps {
  target: Status;
  canAct: boolean;
  /** Self-authored status shown from its own instance (edit button). */
  showEdit: boolean;
  /** Someone else's status while authenticated (more/⋯ menu). */
  showMore: boolean;
  menuOpen: boolean;
  onReply: (e: MouseEvent) => void;
  onAct: (kind: ToggleKind, e: MouseEvent) => void;
  onEdit: (e: MouseEvent) => void;
  onMore: (e: MouseEvent) => void;
}

/** Reply / boost / fav / bookmark bar plus edit and more-menu triggers. */
export function StatusActionsBar({
  target,
  canAct,
  showEdit,
  showMore,
  menuOpen,
  onReply,
  onAct,
  onEdit,
  onMore,
}: StatusActionsBarProps): JSX.Element {
  return (
    <div class="actions" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        class="status-action reply"
        title={t.reply}
        aria-label={target.repliesCount > 0 ? `${t.reply} (${target.repliesCount})` : t.reply}
        onClick={onReply}
        disabled={!canAct}
      >
        <Icon name="share-forward-line" size={16} class="rot-180" />
        {target.repliesCount > 0 && <span class="count">{shortNumber(target.repliesCount)}</span>}
      </button>
      <button
        type="button"
        class={`status-action boost ${target.reblogged ? "on" : ""}`}
        title={t.boost}
        aria-label={target.reblogsCount > 0 ? `${t.boost} (${target.reblogsCount})` : t.boost}
        aria-pressed={!!target.reblogged}
        onClick={(e) => onAct("boost", e)}
        disabled={!canAct}
      >
        <Icon name="repeat-line" size={16} />
        {target.reblogsCount > 0 && <span class="count">{shortNumber(target.reblogsCount)}</span>}
      </button>
      <button
        type="button"
        class={`status-action fav ${target.favourited ? "on" : ""}`}
        title={t.favourite}
        aria-label={
          target.favouritesCount > 0 ? `${t.favourite} (${target.favouritesCount})` : t.favourite
        }
        aria-pressed={!!target.favourited}
        onClick={(e) => onAct("fav", e)}
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
        onClick={(e) => onAct("bookmark", e)}
        disabled={!canAct}
      >
        <Icon name={target.bookmarked ? "bookmark-fill" : "bookmark-line"} size={16} />
      </button>
      {showEdit && (
        <button
          type="button"
          class="status-action edit"
          title={t.editPost}
          aria-label={t.editPost}
          onClick={onEdit}
        >
          <Icon name="pencil-line" size={16} />
        </button>
      )}
      {showMore && (
        <div class="action-more">
          <button
            type="button"
            class={`status-action more ${menuOpen ? "on" : ""}`}
            title={t.moreOptions}
            aria-label={t.moreOptions}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={onMore}
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
  );
}
