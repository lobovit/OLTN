import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import type { PomodoroSettings } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { formatDuration } from "../../lib/format";
import { saveSettings } from "../../state/boot";
import {
  pauseTimer,
  resumeTimer,
  skipTimerPhase,
  startPomodoro,
  stopTimer,
  store,
  type TimerPhase,
} from "../../state/store";
import { Sheet } from "../ui/Sheet";
import "./timer.css";

function phaseLabel(phase: TimerPhase): string {
  if (phase === "focus") return t.timerFocus;
  if (phase === "shortBreak") return t.timerBreak;
  return t.timerLongBreak;
}

function clamp(value: number, min: number, max: number): number {
  const n = Math.round(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function PomodoroSheet(): JSX.Element | null {
  const snap = useSnapshot(store);
  const [label, setLabel] = useState("");

  if (!snap.ui.timerOpen) return null;

  const timer = snap.timer;
  const cfg = snap.settings.pomodoro;
  const active = timer.remainingMs > 0;
  const cycles = Math.max(1, Math.round(cfg.cycles));
  const pct =
    timer.totalMs > 0 ? Math.max(0, Math.min(100, (timer.remainingMs / timer.totalMs) * 100)) : 0;
  const close = (): void => {
    store.ui.timerOpen = false;
  };

  const updateConfig = (patch: Partial<PomodoroSettings>): void => {
    store.settings = { ...store.settings, pomodoro: { ...store.settings.pomodoro, ...patch } };
    saveSettings();
  };

  return (
    <Sheet
      title={t.pomodoro}
      onClose={close}
      class="timer-sheet"
      footer={
        active ? (
          <>
            <button type="button" class="btn ghost" onClick={stopTimer}>
              {t.timerReset}
            </button>
            <div class="spacer" />
            <button type="button" class="btn ghost" onClick={skipTimerPhase}>
              {t.timerSkip}
            </button>
            <button
              type="button"
              class="btn primary"
              onClick={() => (timer.running ? pauseTimer() : resumeTimer())}
            >
              {timer.running ? t.timerPause : `${t.timerStart} · ${phaseLabel(timer.phase)}`}
            </button>
          </>
        ) : (
          <>
            <div class="spacer" />
            <button
              type="button"
              class="btn primary"
              onClick={() => startPomodoro(label)}
              disabled={cfg.focusMinutes < 1}
            >
              {t.timerStart}
            </button>
          </>
        )
      }
    >
      <div class="timer-body">
        <div class="timer-phase">
          {phaseLabel(timer.phase)}
          {timer.phase === "focus" &&
            active &&
            ` · ${(timer.completedFocus % cycles) + 1}/${cycles}`}
        </div>
        <div class="timer-display">{formatDuration(timer.remainingMs)}</div>
        {active && (
          <div class="timer-bar">
            <span style={{ width: `${pct}%` }} />
          </div>
        )}
        {timer.label && <div class="timer-label">{timer.label}</div>}
        {!active && (
          <>
            <div class="timer-config">
              <label class="timer-field">
                <span>{t.timerFocus}</span>
                <input
                  type="number"
                  min={1}
                  max={180}
                  class="field"
                  value={cfg.focusMinutes}
                  onChange={(e) =>
                    updateConfig({
                      focusMinutes: clamp(Number((e.target as HTMLInputElement).value), 1, 180),
                    })
                  }
                />
              </label>
              <label class="timer-field">
                <span>{t.timerBreak}</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  class="field"
                  value={cfg.shortBreakMinutes}
                  onChange={(e) =>
                    updateConfig({
                      shortBreakMinutes: clamp(Number((e.target as HTMLInputElement).value), 1, 60),
                    })
                  }
                />
              </label>
              <label class="timer-field">
                <span>{t.timerLongBreak}</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  class="field"
                  value={cfg.longBreakMinutes}
                  onChange={(e) =>
                    updateConfig({
                      longBreakMinutes: clamp(Number((e.target as HTMLInputElement).value), 1, 120),
                    })
                  }
                />
              </label>
              <label class="timer-field">
                <span>{t.timerCycles}</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  class="field"
                  value={cfg.cycles}
                  onChange={(e) =>
                    updateConfig({
                      cycles: clamp(Number((e.target as HTMLInputElement).value), 1, 12),
                    })
                  }
                />
              </label>
            </div>
            <label class="check">
              <input
                type="checkbox"
                checked={cfg.autoContinue}
                onChange={(e) =>
                  updateConfig({ autoContinue: (e.target as HTMLInputElement).checked })
                }
              />
              {t.timerAuto}
            </label>
            <input
              class="field"
              placeholder={t.timerLabelPlaceholder}
              aria-label={t.timerLabel}
              value={label}
              onInput={(e) => setLabel((e.target as HTMLInputElement).value)}
            />
          </>
        )}
      </div>
    </Sheet>
  );
}
