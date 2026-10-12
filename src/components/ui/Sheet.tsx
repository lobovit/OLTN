import type { ComponentChildren, JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "../../i18n/pt-BR";
import { clamp, usePointerDrag } from "../../lib/pointer-drag";
import { readJSON, writeJSON } from "../../lib/storage";
import { Icon } from "./Icon";

interface SheetProps {
  title?: string;
  onClose: () => void;
  children: ComponentChildren;
  footer?: ComponentChildren;
  flush?: boolean;
  class?: string;
  /** Extra header actions, before the close button (e.g. counter). */
  headerActions?: ComponentChildren;
  /** Allows dragging and resizing the window (desktop). */
  draggable?: boolean;
  /** Key to remember position and size across sessions. */
  positionKey?: string;
}

interface SheetGeom {
  x: number;
  y: number;
  w?: number;
  h?: number;
}

const MIN_W = 320;
const MIN_H = 260;

const DESKTOP = "(min-width: 48em)";

export function Sheet({
  title,
  onClose,
  children,
  footer,
  flush,
  class: className,
  headerActions,
  draggable,
  positionKey,
}: SheetProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const storageKey = draggable && positionKey ? `sheet-pos-${positionKey}` : null;
  const [geom, setGeom] = useState<SheetGeom>(() =>
    storageKey ? readJSON<SheetGeom>(storageKey, { x: 0, y: 0 }) : { x: 0, y: 0 },
  );
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  /** True while a pointer gesture is active; Escape cancels it before close. */
  const gestureActive = useRef(false);

  const persist = (next: SheetGeom): void => {
    if (storageKey) writeJSON(storageKey, next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // An active drag/resize consumes Escape (cancels the gesture).
        if (gestureActive.current) return;
        // Escape first closes inner popups (e.g. mention suggestions)
        if (
          document.querySelector(".mention-menu, .emoji-picker, .translate-menu, .schedule-panel")
        )
          return;
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  /* Re-anchors remembered position and size if the window resized */
  useEffect(() => {
    if (!draggable || !storageKey) return;
    const sheet = ref.current;
    if (!sheet) return;
    const w = geom.w != null ? Math.min(geom.w, window.innerWidth - 16) : geom.w;
    const h = geom.h != null ? Math.min(geom.h, window.innerHeight - 16) : geom.h;
    if (w != null) sheet.style.setProperty("--sheet-w", `${w}px`);
    if (h != null) sheet.style.setProperty("--sheet-h", `${h}px`);
    const rect = sheet.getBoundingClientRect();
    const baseLeft = rect.left - geom.x;
    const baseTop = rect.top - geom.y;
    const x = clamp(geom.x, 8 - baseLeft, window.innerWidth - 8 - rect.width - baseLeft);
    const y = clamp(geom.y, 8 - baseTop, window.innerHeight - 8 - rect.height - baseTop);
    if (x !== geom.x || y !== geom.y || w !== geom.w || h !== geom.h) {
      const next: SheetGeom = { x, y, w: w ?? undefined, h: h ?? undefined };
      setGeom(next);
      persist(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dragBounds = useRef({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
  const dragPos = useRef<SheetGeom>({ x: 0, y: 0 });
  const onDragHandleDown = usePointerDrag({
    onStart: () => {
      const sheet = ref.current;
      if (!sheet) return;
      gestureActive.current = true;
      const rect = sheet.getBoundingClientRect();
      const baseLeft = rect.left - geom.x;
      const baseTop = rect.top - geom.y;
      dragBounds.current = {
        minX: 8 - baseLeft,
        maxX: window.innerWidth - 8 - rect.width - baseLeft,
        minY: 8 - baseTop,
        maxY: window.innerHeight - 8 - rect.height - baseTop,
      };
      dragPos.current = { ...geom };
      setDragging(true);
    },
    onMove: (ctx) => {
      const sheet = ref.current;
      if (!sheet) return;
      const bounds = dragBounds.current;
      const x = clamp(geom.x + ctx.delta.x, bounds.minX, bounds.maxX);
      const y = clamp(geom.y + ctx.delta.y, bounds.minY, bounds.maxY);
      dragPos.current = { ...geom, x, y };
      sheet.style.setProperty("--sheet-dx", `${Math.round(x)}px`);
      sheet.style.setProperty("--sheet-dy", `${Math.round(y)}px`);
    },
    onCommit: () => {
      gestureActive.current = false;
      setDragging(false);
      setGeom(dragPos.current);
      persist(dragPos.current);
    },
    onCancel: () => {
      gestureActive.current = false;
      setDragging(false);
      const sheet = ref.current;
      sheet?.style.setProperty("--sheet-dx", `${geom.x}px`);
      sheet?.style.setProperty("--sheet-dy", `${geom.y}px`);
    },
  });

  const startDrag = (e: PointerEvent): void => {
    if (!draggable) return;
    if (!window.matchMedia(DESKTOP).matches) return;
    if ((e.target as HTMLElement).closest("button, a")) return;
    onDragHandleDown(e);
  };

  const resizeTo = (w: number, h: number): void => {
    const sheet = ref.current;
    const rect = sheet?.getBoundingClientRect();
    if (!sheet || !rect) return;
    const nextW = Math.round(Math.min(Math.max(w, MIN_W), window.innerWidth - 8 - rect.left));
    const nextH = Math.round(Math.min(Math.max(h, MIN_H), window.innerHeight - 8 - rect.top));
    const next: SheetGeom = { ...geom, w: nextW, h: nextH };
    setGeom(next);
    persist(next);
  };

  const resizeBase = useRef({ w: 0, h: 0, maxW: 0, maxH: 0 });
  const resizeSize = useRef({ w: 0, h: 0 });
  const onResizeHandleDown = usePointerDrag({
    onStart: () => {
      const sheet = ref.current;
      if (!sheet) return;
      gestureActive.current = true;
      const rect = sheet.getBoundingClientRect();
      resizeBase.current = {
        w: rect.width,
        h: rect.height,
        maxW: window.innerWidth - 8 - rect.left,
        maxH: window.innerHeight - 8 - rect.top,
      };
      resizeSize.current = { w: rect.width, h: rect.height };
      setResizing(true);
    },
    onMove: (ctx) => {
      const sheet = ref.current;
      if (!sheet) return;
      const base = resizeBase.current;
      const w = Math.min(Math.max(base.w + ctx.delta.x, MIN_W), base.maxW);
      const h = Math.min(Math.max(base.h + ctx.delta.y, MIN_H), base.maxH);
      resizeSize.current = { w, h };
      sheet.style.setProperty("--sheet-w", `${Math.round(w)}px`);
      sheet.style.setProperty("--sheet-h", `${Math.round(h)}px`);
    },
    onCommit: () => {
      gestureActive.current = false;
      setResizing(false);
      const next: SheetGeom = {
        ...geom,
        w: Math.round(resizeSize.current.w),
        h: Math.round(resizeSize.current.h),
      };
      setGeom(next);
      persist(next);
    },
    onCancel: () => {
      gestureActive.current = false;
      setResizing(false);
      const sheet = ref.current;
      if (geom.w != null) sheet?.style.setProperty("--sheet-w", `${geom.w}px`);
      else sheet?.style.removeProperty("--sheet-w");
      if (geom.h != null) sheet?.style.setProperty("--sheet-h", `${geom.h}px`);
      else sheet?.style.removeProperty("--sheet-h");
    },
  });

  const startResize = (e: PointerEvent): void => {
    if (!draggable) return;
    if (!window.matchMedia(DESKTOP).matches) return;
    e.stopPropagation();
    onResizeHandleDown(e);
  };

  const styleParts = [`--sheet-dx:${geom.x}px`, `--sheet-dy:${geom.y}px`];
  if (geom.w != null) styleParts.push(`--sheet-w:${geom.w}px`);
  if (geom.h != null) styleParts.push(`--sheet-h:${geom.h}px`);

  return (
    <>
      <div class="overlay-backdrop" onClick={onClose} />
      <div
        ref={ref}
        class={`sheet ${className ?? ""} ${draggable ? "draggable" : ""} ${dragging ? "dragging" : ""} ${resizing ? "resizing" : ""}`}
        style={draggable ? styleParts.join(";") : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div class="sheet-grip" onPointerDown={startDrag} />
        {title !== undefined && (
          <div class="sheet-header" onPointerDown={startDrag}>
            <h2>{title}</h2>
            <div class="spacer" />
            {headerActions}
            <button class="icon-btn" onClick={onClose} aria-label={t.close} type="button">
              <Icon name="close-line" size={18} />
            </button>
          </div>
        )}
        <div class={`sheet-body ${flush ? "flush" : ""}`}>{children}</div>
        {footer && <div class="sheet-footer">{footer}</div>}
        {draggable && (
          <div
            class="sheet-resize"
            role="separator"
            aria-label={t.resizePopup}
            tabIndex={0}
            onPointerDown={startResize}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 96 : 24;
              const rect = ref.current?.getBoundingClientRect();
              if (!rect) return;
              if (e.key === "ArrowRight") {
                e.preventDefault();
                resizeTo(rect.width + step, rect.height);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                resizeTo(rect.width - step, rect.height);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                resizeTo(rect.width, rect.height + step);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                resizeTo(rect.width, rect.height - step);
              }
            }}
          />
        )}
      </div>
    </>
  );
}
