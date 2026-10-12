import type { JSX } from "preact";
import type { MediaAttachment } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { Icon } from "../ui/Icon";

interface MediaAttachmentsProps {
  media: readonly MediaAttachment[];
  onDescription: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}

/** Attached media list with alt-text inputs and remove buttons. */
export function MediaAttachments({
  media,
  onDescription,
  onRemove,
}: MediaAttachmentsProps): JSX.Element | null {
  if (!media.length) return null;
  return (
    <div class="compose-media">
      {media.map((item, index) => (
        <div class="compose-media-item" key={item.id}>
          <img src={item.previewUrl || item.url || undefined} alt="" />
          <input
            class="field"
            placeholder={t.attachAlt}
            value={item.description ?? ""}
            onInput={(e) => onDescription(index, (e.target as HTMLInputElement).value)}
          />
          <button
            type="button"
            class="icon-btn"
            aria-label={t.delete}
            onClick={() => onRemove(index)}
          >
            <Icon name="close-line" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
