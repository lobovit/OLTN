import type { JSX } from "preact";
import { useRef } from "preact/hooks";
import { t } from "../../i18n/pt-BR";
import type { PublishPoll } from "../../lib/publish-plan";
import { Icon } from "../ui/Icon";

interface PollEditorProps {
  value: PublishPoll;
  onChange: (poll: PublishPoll) => void;
}

/** Poll options, expiry and multiple-choice toggle (controlled). */
export function PollEditor({ value, onChange }: PollEditorProps): JSX.Element {
  // The poll model is positional, so keys are stable per slot and only
  // regenerated when the option count changes (typing keeps the inputs).
  const idSeq = useRef(0);
  const idsRef = useRef<string[]>([]);
  if (idsRef.current.length !== value.options.length) {
    idsRef.current = value.options.map(() => `poll-opt-${++idSeq.current}`);
  }

  const setOption = (index: number, text: string): void => {
    onChange({ ...value, options: value.options.map((o, i) => (i === index ? text : o)) });
  };
  const addOption = (): void => onChange({ ...value, options: [...value.options, ""] });
  const removeOption = (index: number): void => {
    onChange({ ...value, options: value.options.filter((_, i) => i !== index) });
  };

  return (
    <div class="compose-poll">
      {value.options.map((option, index) => (
        <div class="poll-option-row" key={idsRef.current[index]}>
          <span class="muted">
            {t.pollOption} {index + 1}
          </span>
          <input
            class="field"
            value={option}
            onInput={(e) => setOption(index, (e.target as HTMLInputElement).value)}
          />
          {value.options.length > 2 && (
            <button
              type="button"
              class="icon-btn"
              aria-label={t.pollRemove}
              onClick={() => removeOption(index)}
            >
              <Icon name="close-line" size={16} />
            </button>
          )}
        </div>
      ))}
      {value.options.length < 4 && (
        <button type="button" class="btn ghost sm" onClick={addOption}>
          <Icon name="plus-line" size={14} />
          {t.pollAddOption}
        </button>
      )}
      <div class="poll-meta">
        <label>
          {t.pollExpires}
          <select
            class="field"
            value={value.expiresIn}
            onChange={(e) =>
              onChange({ ...value, expiresIn: Number((e.target as HTMLSelectElement).value) })
            }
          >
            <option value={300}>5 min</option>
            <option value={1800}>30 min</option>
            <option value={3600}>1 h</option>
            <option value={21600}>6 h</option>
            <option value={86400}>1 d</option>
            <option value={604800}>7 d</option>
          </select>
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={value.multiple}
            onChange={(e) =>
              onChange({ ...value, multiple: (e.target as HTMLInputElement).checked })
            }
          />
          {t.pollMultiple}
        </label>
      </div>
    </div>
  );
}
