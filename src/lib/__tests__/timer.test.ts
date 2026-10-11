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

  it("starts the cycle on focus with the configured duration", () => {
    startPomodoro(" beber água ");
    expect(store.timer.running).toBe(true);
    expect(store.timer.phase).toBe("focus");
    expect(store.timer.remainingMs).toBe(25 * 60_000);
    expect(store.timer.totalMs).toBe(25 * 60_000);
    expect(store.timer.label).toBe("beber água");
    expect(store.timer.endsAt).toBeGreaterThan(Date.now());
  });

  it("alternates focus → short break → focus automatically", () => {
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

  it("uses the long break after N rounds", () => {
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

  it("respects autoContinue turned off", () => {
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

  it("pauses and resumes keeping the remainder", () => {
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

  it("skip advances the phase and `stopTimer` clears everything", () => {
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
