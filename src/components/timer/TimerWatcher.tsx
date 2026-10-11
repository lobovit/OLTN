import { useEffect } from "preact/hooks";
import { useSnapshot } from "valtio";
import { t } from "../../i18n/pt-BR";
import { playChime } from "../../lib/chime";
import { formatDuration } from "../../lib/format";
import { completeTimerPhase, store, toast } from "../../state/store";

/** Keeps the timer running outside the sheet: tick, tab title and end notice. */
export function TimerWatcher(): null {
  const timer = useSnapshot(store).timer;

  useEffect(() => {
    const id = window.setInterval(() => {
      const current = store.timer;
      if (!current.running || !current.endsAt) return;
      const remaining = Math.max(0, current.endsAt - Date.now());
      if (remaining <= 0) {
        const finished = current.phase;
        const label = current.label;
        completeTimerPhase();
        playChime();
        const done = finished === "focus" ? t.timerFocusDone : t.timerBreakDone;
        toast(label ? `${label} — ${done}` : done, "ok");
        return;
      }
      store.timer.remainingMs = remaining;
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    document.title = timer.remainingMs > 0 ? `${formatDuration(timer.remainingMs)} · OLTN` : "OLTN";
  }, [timer.remainingMs]);

  return null;
}
