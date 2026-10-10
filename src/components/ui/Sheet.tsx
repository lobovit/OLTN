import type { ComponentChildren, JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "../../i18n/pt-BR";
import { readJSON, writeJSON } from "../../lib/storage";
import { Icon } from "./Icon";

interface SheetProps {
  title?: string;
  onClose: () => void;
  children: ComponentChildren;
  footer?: ComponentChildren;
  flush?: boolean;
  class?: string;
  /** Ações extras no cabeçalho, antes do botão de fechar (ex.: contador). */
  headerActions?: ComponentChildren;
  /** Permite arrastar e redimensionar a janela (desktop). */
  draggable?: boolean;
  /** Chave para lembrar posição e tamanho entre sessões. */
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

function clampRange(value: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2;
  return Math.min(Math.max(value, min), max);
}

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

  const persist = (next: SheetGeom): void => {
    if (storageKey) writeJSON(storageKey, next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Escape primeiro fecha popups internos (ex.: sugestões de menção)
        if (document.querySelector(".mention-menu")) return;
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

  /* Reencaixa posição e tamanho lembrados se a janela mudou de tamanho */
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
    const x = clampRange(geom.x, 8 - baseLeft, window.innerWidth - 8 - rect.width - baseLeft);
    const y = clampRange(geom.y, 8 - baseTop, window.innerHeight - 8 - rect.height - baseTop);
    if (x !== geom.x || y !== geom.y || w !== geom.w || h !== geom.h) {
      const next: SheetGeom = { x, y, w: w ?? undefined, h: h ?? undefined };
      setGeom(next);
      persist(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startDrag = (e: PointerEvent): void => {
    if (!draggable) return;
    if (!window.matchMedia("(min-width: 48em)").matches) return;
    const sheet = ref.current;
    if (!sheet) return;
    if ((e.target as HTMLElement).closest("button, a")) return;
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = sheet.getBoundingClientRect();
    const baseLeft = rect.left - geom.x;
    const baseTop = rect.top - geom.y;
    const minX = 8 - baseLeft;
    const maxX = window.innerWidth - 8 - rect.width - baseLeft;
    const minY = 8 - baseTop;
    const maxY = window.innerHeight - 8 - rect.height - baseTop;
    let pos = { ...geom };

    const onMove = (ev: PointerEvent): void => {
      pos = {
        x: clampRange(geom.x + (ev.clientX - startX), minX, maxX),
        y: clampRange(geom.y + (ev.clientY - startY), minY, maxY),
      };
      sheet.style.setProperty("--sheet-dx", `${Math.round(pos.x)}px`);
      sheet.style.setProperty("--sheet-dy", `${Math.round(pos.y)}px`);
    };
    const onUp = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setDragging(false);
      setGeom(pos);
      persist(pos);
    };

    setDragging(true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
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

  const startResize = (e: PointerEvent): void => {
    if (!draggable) return;
    if (!window.matchMedia("(min-width: 48em)").matches) return;
    const sheet = ref.current;
    if (!sheet) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = sheet.getBoundingClientRect();
    const maxW = window.innerWidth - 8 - rect.left;
    const maxH = window.innerHeight - 8 - rect.top;
    let w = rect.width;
    let h = rect.height;

    const onMove = (ev: PointerEvent): void => {
      w = Math.min(Math.max(rect.width + (ev.clientX - startX), MIN_W), maxW);
      h = Math.min(Math.max(rect.height + (ev.clientY - startY), MIN_H), maxH);
      sheet.style.setProperty("--sheet-w", `${Math.round(w)}px`);
      sheet.style.setProperty("--sheet-h", `${Math.round(h)}px`);
    };
    const onUp = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setResizing(false);
      const next: SheetGeom = { ...geom, w: Math.round(w), h: Math.round(h) };
      setGeom(next);
      persist(next);
    };

    setResizing(true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
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
