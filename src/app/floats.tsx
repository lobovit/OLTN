import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import type { FloatRect } from "../api/types";
import { HomeGalleryToggle } from "../components/feed/HomeGalleryToggle";
import { Icon } from "../components/ui/Icon";
import { t } from "../i18n/pt-BR";
import {
  bringToFront,
  clampFloatRect,
  floatDefaults,
  snapFloatRect,
  stackOrder,
} from "../lib/floats";
import { COLUMN_LIMIT, orderColumns } from "../lib/layout";
import { beginPointerDrag } from "../lib/pointer-drag";
import { saveFloatLayout, saveShortcuts } from "../state/boot";
import { accountNS, currentAccount, store } from "../state/store";
import { ColumnContent, iconForShortcut } from "./column-content";
import { PanelColorButton } from "./panel-color";
import { shortcutLabel } from "./shortcuts";

let activeDndCleanup: (() => void) | null = null;

/** Deck mode off: the home shortcuts become post-it panels that can be moved,
    resized and stacked anywhere on the canvas. */
export function FloatCanvas(): JSX.Element {
  const snap = useSnapshot(store);
  const account = currentAccount();
  const layout = account ? snap.prefs[accountNS(account)] : undefined;
  const list = orderColumns(snap.shortcuts.slice(0, COLUMN_LIMIT), layout?.columnOrder ?? []);
  const rects = layout?.floats ?? {};
  const zOrder = layout?.floatOrder ?? [];
  const colors: Record<string, string> = layout?.colors ?? {};
  const [canvas, setCanvas] = useState({ w: 1200, h: 720 });
  const canvasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = (): void => setCanvas({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => activeDndCleanup?.(), []);

  const rectFor = (id: string, index: number): FloatRect =>
    clampFloatRect(rects[id] ?? floatDefaults(index, canvas.w, canvas.h), canvas.w, canvas.h);

  const listIds = list.map((s) => s.id);
  const stack = stackOrder(zOrder, listIds);
  const zFor = (id: string): number => stack.indexOf(id) + 1;

  /** Latest prefs from the store (drag commits must not use the render snapshot). */
  const liveLayout = (): { rects: Record<string, FloatRect>; stack: string[] } => {
    if (!account) return { rects: {}, stack };
    const live = store.prefs[accountNS(account)];
    return {
      rects: { ...(live?.floats ?? {}) },
      stack: stackOrder(live?.floatOrder ?? [], listIds),
    };
  };

  const bringFront = (id: string): void => {
    const live = liveLayout();
    if (live.stack[live.stack.length - 1] === id) return;
    saveFloatLayout(live.rects, bringToFront(live.stack, id));
  };

  const persist = (id: string, rect: FloatRect): void => {
    const live = liveLayout();
    saveFloatLayout({ ...live.rects, [id]: rect }, live.stack);
  };

  const startDrag = (e: PointerEvent, id: string, index: number): void => {
    const handle = e.currentTarget as HTMLElement;
    const panel = handle.closest(".float") as HTMLElement | null;
    if (!panel) return;
    const start = rectFor(id, index);
    const others = list
      .map((shortcut, otherIndex) => ({ id: shortcut.id, rect: rectFor(shortcut.id, otherIndex) }))
      .filter((entry) => entry.id !== id)
      .map((entry) => entry.rect);
    let last = { x: 0, y: 0 };

    const snapped = (delta: { x: number; y: number }): FloatRect =>
      snapFloatRect(
        { ...start, x: start.x + delta.x, y: start.y + delta.y },
        others,
        canvas.w,
        canvas.h,
      );

    const finish = (commit: boolean): void => {
      panel.style.transform = "";
      panel.classList.remove("dragging");
      if (!commit || (!last.x && !last.y)) return;
      persist(id, snapped(last));
    };
    activeDndCleanup = beginPointerDrag(e, {
      threshold: 4,
      onStart: () => panel.classList.add("dragging"),
      onMove: (ctx) => {
        const rect = snapped(ctx.delta);
        last = { x: rect.x - start.x, y: rect.y - start.y };
        panel.style.transform = `translate(${last.x}px, ${last.y}px)`;
      },
      onCommit: () => finish(true),
      onCancel: () => finish(false),
    });
  };

  const startResize = (e: PointerEvent, id: string, index: number): void => {
    const handle = e.currentTarget as HTMLElement;
    const panel = handle.closest(".float") as HTMLElement | null;
    if (!panel) return;
    const start = rectFor(id, index);
    let rect = start;

    const finish = (commit: boolean): void => {
      panel.classList.remove("resizing");
      if (!commit || (rect.w === start.w && rect.h === start.h)) {
        panel.style.removeProperty("width");
        panel.style.removeProperty("height");
        return;
      }
      persist(id, rect);
    };
    activeDndCleanup = beginPointerDrag(e, {
      threshold: 2,
      onStart: () => panel.classList.add("resizing"),
      onMove: (ctx) => {
        rect = clampFloatRect(
          { ...start, w: start.w + ctx.delta.x, h: start.h + ctx.delta.y },
          canvas.w,
          canvas.h,
        );
        panel.style.width = `${rect.w}px`;
        panel.style.height = `${rect.h}px`;
      },
      onCommit: () => finish(true),
      onCancel: () => finish(false),
    });
  };

  const nudge = (e: KeyboardEvent, id: string, index: number, resize: boolean): void => {
    const step = 16;
    const dx = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
    const dy = e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    const start = rectFor(id, index);
    const next = resize
      ? { ...start, w: start.w + dx, h: start.h + dy }
      : { ...start, x: start.x + dx, y: start.y + dy };
    persist(id, clampFloatRect(next, canvas.w, canvas.h));
  };

  return (
    <div
      class="floats"
      id="main"
      tabindex={-1}
      ref={(el: HTMLDivElement | null) => {
        canvasRef.current = el;
      }}
    >
      {list.map((shortcut, index) => {
        const rect = rectFor(shortcut.id, index);
        const label = shortcutLabel(shortcut);
        return (
          <section
            key={shortcut.id}
            class="float"
            data-shortcut-id={shortcut.id}
            data-panel-color={colors[shortcut.id]}
            style={{
              left: `${rect.x}px`,
              top: `${rect.y}px`,
              width: `${rect.w}px`,
              height: `${rect.h}px`,
              zIndex: zFor(shortcut.id),
            }}
            onPointerDown={() => bringFront(shortcut.id)}
          >
            <header class="deck-header">
              <button
                type="button"
                class="col-grip"
                title={`${t.movePanel}: ${label}`}
                aria-label={`${t.movePanel}: ${label}`}
                onPointerDown={(e) => startDrag(e, shortcut.id, index)}
                onKeyDown={(e) => nudge(e, shortcut.id, index, false)}
              />
              <Icon name={iconForShortcut(shortcut)} size={18} />
              <h1>{label}</h1>
              <div class="spacer" />
              {shortcut.type === "home" && <HomeGalleryToggle />}
              <button
                type="button"
                class="icon-btn col-refresh"
                title={t.refresh}
                aria-label={`${t.refresh}: ${label}`}
                onClick={() => {
                  store.ui.feedsRevision += 1;
                }}
              >
                <Icon name="refresh-2-line" size={15} />
              </button>
              <PanelColorButton id={shortcut.id} color={colors[shortcut.id]} label={label} />
              <button
                type="button"
                class="icon-btn col-close"
                title={t.closePanel}
                aria-label={`${t.closePanel}: ${label}`}
                onClick={() => saveShortcuts(store.shortcuts.filter((s) => s.id !== shortcut.id))}
              >
                <Icon name="close-line" size={15} />
              </button>
            </header>
            <div class="deck-body">
              <ColumnContent shortcut={shortcut} instance={account?.instance} />
            </div>
            <button
              type="button"
              class="float-resize"
              title={`${t.resizePanel}: ${label}`}
              aria-label={`${t.resizePanel}: ${label} (${rect.w}×${rect.h})`}
              onPointerDown={(e) => startResize(e, shortcut.id, index)}
              onKeyDown={(e) => nudge(e, shortcut.id, index, true)}
            />
          </section>
        );
      })}
      {!list.length && (
        <div class="center-state">
          <Icon name="list-check-line" size={28} />
          <p>{t.pinHint}</p>
        </div>
      )}
    </div>
  );
}
