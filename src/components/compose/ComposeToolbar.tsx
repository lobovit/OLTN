import type { JSX, RefObject } from "preact";
import { t } from "../../i18n/pt-BR";
import { Icon } from "../ui/Icon";
import type { ComposePanels } from "./useComposePanels";
import { ToolButton } from "./ToolButton";

function submitLabel(state: { busy: boolean; isEdit: boolean; scheduled: boolean }): string {
  if (state.busy) {
    if (state.isEdit) return t.saving;
    return state.scheduled ? t.scheduling : t.posting;
  }
  if (state.isEdit) return t.save;
  return state.scheduled ? t.schedule : t.post;
}

export interface ComposeToolbarProps {
  fileRef: RefObject<HTMLInputElement | null>;
  onFiles: (files: FileList) => void;
  mediaCount: number;
  hasPoll: boolean;
  canPoll: boolean;
  showCw: boolean;
  onToggleCw: () => void;
  onTogglePoll: () => void;
  panels: ComposePanels;
  translating: boolean;
  hasText: boolean;
  scheduleBlocked: boolean;
  scheduled: boolean;
  canSubmit: boolean;
  busy: boolean;
  isEdit: boolean;
  onSubmit: () => void;
}

/** Compose sheet footer: media/poll/CW/popover buttons and the submit button. */
export function ComposeToolbar(props: ComposeToolbarProps): JSX.Element {
  const { panels } = props;
  const mediaBlocked = props.mediaCount >= 4 || props.hasPoll;
  return (
    <>
      <input
        ref={props.fileRef}
        class="compose-file"
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        onChange={(e) => {
          const files = (e.target as HTMLInputElement).files;
          if (files?.length) props.onFiles(files);
          (e.target as HTMLInputElement).value = "";
        }}
      />
      <ToolButton
        icon="attachment-line"
        title={t.attachMedia}
        label={t.attachMedia}
        disabled={mediaBlocked}
        onClick={() => props.fileRef.current?.click()}
      />
      <ToolButton
        icon="list-check-line"
        title={t.addPoll}
        label={t.addPoll}
        active={props.hasPoll}
        disabled={!props.canPoll}
        onClick={props.onTogglePoll}
      />
      <button
        type="button"
        class={`icon-btn toolbar-cw ${props.showCw ? "active" : ""}`}
        title={t.contentWarning}
        aria-label={t.contentWarning}
        aria-pressed={props.showCw}
        onClick={props.onToggleCw}
      >
        CW
      </button>
      <ToolButton
        icon="emoji-line"
        title={t.emojiPicker}
        label={t.emojiPicker}
        active={panels.emojiOpen}
        expanded={panels.emojiOpen}
        toggle="emoji"
        onClick={panels.toggleEmoji}
      />
      <ToolButton
        icon="movie-line"
        title={t.gif}
        label={t.gif}
        active={panels.gifOpen}
        expanded={panels.gifOpen}
        toggle="gif"
        disabled={mediaBlocked}
        onClick={panels.toggleGif}
      />
      <ToolButton
        title={t.translateTo}
        label={t.translateTo}
        active={panels.transOpen}
        expanded={panels.transOpen}
        toggle="translate"
        disabled={!props.hasText || props.translating}
        onClick={panels.toggleTranslation}
      >
        {props.translating ? <span class="spinner" /> : <Icon name="translate-line" size={20} />}
      </ToolButton>
      <ToolButton
        icon="calendar-line"
        title={props.scheduleBlocked ? t.scheduleNoThread : t.schedule}
        label={t.schedule}
        active={panels.scheduleOpen || props.scheduled}
        expanded={panels.scheduleOpen}
        toggle="schedule"
        disabled={props.scheduleBlocked}
        onClick={panels.toggleSchedule}
      />
      <div class="spacer" />
      <button
        type="button"
        class="btn primary"
        disabled={!props.canSubmit}
        onClick={props.onSubmit}
      >
        {props.busy && <span class="spinner" />}
        {submitLabel({ busy: props.busy, isEdit: props.isEdit, scheduled: props.scheduled })}
      </button>
    </>
  );
}
