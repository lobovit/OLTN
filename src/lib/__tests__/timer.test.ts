import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeTimerPhase,
  DEFAULT_SETTINGS,
  pauseTimer,
  resumeTimer,
  skipTimerPhase,
  startPomodoro,
  stopTimer,
  store,
} from "../../state/store";

describe("pomodoro", () => {
  beforeEach(() => {
    stopTimer();
    store.settings = { ...store.settings, pomodoro: { ...DEFAULT_SETTINGS.pomodoro } };
    vi.useRealTimers();
  });

  it("inicia o ciclo no foco com a duração configurada", () => {
    startPomodoro(" beber água ");
    expect(store.timer.running).toBe(true);
    expect(store.timer.phase).toBe("focus");
    expect(store.timer.remainingMs).toBe(25 * 60_000);
    expect(store.timer.totalMs).toBe(25 * 60_000);
    expect(store.timer.label).toBe("beber água");
    expect(store.timer.endsAt).toBeGreaterThan(Date.now());
  });

  it("alterna foco → pausa curta → foco automaticamente", () => {
    startPomodoro("");
    completeTimerPhase();
    expect(store.timer.phase).toBe("shortBreak");
    expect(store.timer.remainingMs).toBe(5 * 60_000);
    expect(store.timer.completedFocus).toBe(1);
    expect(store.timer.running).toBe(store.settings.pomodoro.autoContinue);
    completeTimerPhase();
    expect(store.timer.phase).toBe("focus");
    expect(store.timer.completedFocus).toBe(1);
  });

  it("usa a pausa longa após N focos", () => {
    store.settings = {
      ...store.settings,
      pomodoro: { ...store.settings.pomodoro, cycles: 2 },
    };
    startPomodoro("");
    completeTimerPhase();
    completeTimerPhase();
    completeTimerPhase();
    expect(store.timer.phase).toBe("longBreak");
    expect(store.timer.completedFocus).toBe(2);
    expect(store.timer.remainingMs).toBe(15 * 60_000);
  });

  it("respeita o autoContinue desligado", () => {
    store.settings = {
      ...store.settings,
      pomodoro: { ...store.settings.pomodoro, autoContinue: false },
    };
    startPomodoro("");
    completeTimerPhase();
    expect(store.timer.phase).toBe("shortBreak");
    expect(store.timer.running).toBe(false);
    expect(store.timer.remainingMs).toBe(5 * 60_000);
  });

  it("pausa e retoma mantendo o restante", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    startPomodoro("");
    vi.setSystemTime(new Date("2026-01-01T00:04:00Z"));
    pauseTimer();
    expect(store.timer.running).toBe(false);
    expect(store.timer.remainingMs).toBe(21 * 60_000);
    expect(store.timer.endsAt).toBeNull();
    vi.setSystemTime(new Date("2026-01-01T01:00:00Z"));
    resumeTimer();
    expect(store.timer.running).toBe(true);
    expect(store.timer.endsAt).toBe(Date.now() + 21 * 60_000);
  });

  it("pular avança a fase e `stopTimer` limpa tudo", () => {
    startPomodoro("");
    skipTimerPhase();
    expect(store.timer.phase).toBe("shortBreak");
    stopTimer();
    expect(store.timer.running).toBe(false);
    expect(store.timer.remainingMs).toBe(0);
    expect(store.timer.completedFocus).toBe(0);
    expect(store.timer.label).toBe("");
  });
});
