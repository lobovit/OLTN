import type { JSX } from "preact";
import { t } from "../../i18n/pt-BR";
import { toLocalInputValue } from "../../lib/format";

interface SchedulePanelProps {
  value: string;
  date: Date | null;
  valid: boolean;
  onInput: (value: string) => void;
  onClear: () => void;
  onConfirm: () => void;
}

/** Draft scheduling panel (datetime picker + confirm/clear). */
export function SchedulePanel({
  value,
  date,
  valid,
  onInput,
  onClear,
  onConfirm,
}: SchedulePanelProps): JSX.Element {
  return (
    <div class="schedule-panel">
      <label class="schedule-field">
        <span>{t.scheduleAt}</span>
        <input
          type="datetime-local"
          class="field"
          min={toLocalInputValue(new Date(Date.now() + 5 * 60_000))}
          value={value}
          onInput={(e) => onInput((e.target as HTMLInputElement).value)}
        />
      </label>
      {date && !valid && <p class="schedule-error">{t.scheduleTooSoon}</p>}
      <div class="schedule-actions">
        <button type="button" class="btn ghost sm" disabled={!value} onClick={onClear}>
          {t.scheduleClear}
        </button>
        <button type="button" class="btn primary sm" disabled={!date || !valid} onClick={onConfirm}>
          {t.confirm}
        </button>
      </div>
    </div>
  );
}
