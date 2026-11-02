import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import { ColumnRefreshButton } from "../../components/feed/ColumnRefreshButton";
import { store } from "../../state/store";

beforeEach(() => {
  store.ui.feedsRevision = 0;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("ColumnRefreshButton", () => {
  it("requests a reload and shows feedback for the press", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    await act(async () => {
      render(<ColumnRefreshButton label="Home" />, host);
    });
    const button = host.querySelector<HTMLButtonElement>("button")!;

    await act(async () => {
      button.click();
    });
    expect(store.ui.feedsRevision).toBe(1);
    expect(button.classList.contains("refreshing")).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.disabled).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(button.classList.contains("refreshing")).toBe(false);
    expect(button.getAttribute("aria-busy")).toBe("false");
    expect(button.disabled).toBe(false);
  });
});
