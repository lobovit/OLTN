import type { JSX } from "preact";
import { useEffect } from "preact/hooks";
import { useSnapshot } from "valtio";
import { t } from "../../i18n/pt-BR";
import { Icon } from "../ui/Icon";
import { setMediaViewer, store } from "../../state/store";

export function MediaViewer(): JSX.Element | null {
  const intent = useSnapshot(store).ui.mediaViewer;
  if (!intent) return null;
  return <MediaViewerInner key={`${intent.instance}:${intent.index}`} />;
}

function MediaViewerInner(): JSX.Element | null {
  const intent = store.ui.mediaViewer!;
  const close = (): void => setMediaViewer(null);
  const items = intent.attachments;
  const index = Math.min(intent.index, items.length - 1);
  const item = items[index];

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!item) return null;

  const step = (delta: number): void => {
    setMediaViewer({ ...intent, index: (index + delta + items.length) % items.length });
  };

  return (
    <div
      class="media-viewer"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div class="media-viewer-bar">
        <span class="muted">
          {index + 1}/{items.length}
        </span>
        <div class="spacer" />
        <a
          class="icon-btn"
          href={item.url ?? item.previewUrl}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={t.openOriginal}
        >
          <Icon name="external-link-line" size={18} />
        </a>
        <button type="button" class="icon-btn" onClick={close} aria-label={t.close}>
          <Icon name="close-line" size={20} />
        </button>
      </div>
      <button
        type="button"
        class="media-viewer-nav prev"
        onClick={() => step(-1)}
        aria-label="Anterior"
      >
        <Icon name="back-line" size={22} />
      </button>
      <div class="media-viewer-stage">
        {item.type === "image" || item.type === "gifv" ? (
          <img src={item.url ?? item.previewUrl} alt={item.description ?? ""} />
        ) : item.type === "video" ? (
          <video src={item.url ?? item.previewUrl} controls autoplay />
        ) : item.type === "audio" ? (
          <audio src={item.url ?? item.previewUrl} controls autoplay />
        ) : (
          <div class="center-state">
            <Icon name="link-line" size={28} />
            <a href={item.url ?? item.previewUrl} target="_blank" rel="noreferrer">
              {item.url ?? item.previewUrl}
            </a>
          </div>
        )}
      </div>
      <button
        type="button"
        class="media-viewer-nav next"
        onClick={() => step(1)}
        aria-label="Próximo"
      >
        <Icon name="arrow-right-line" size={22} />
      </button>
      {item.description && <div class="media-viewer-alt">{item.description}</div>}
    </div>
  );
}
