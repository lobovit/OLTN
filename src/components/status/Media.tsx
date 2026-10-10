import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { decodeBlurHash } from "fast-blurhash";
import type { MediaAttachment } from "../../api/types";
import { setMediaViewer, store } from "../../state/store";
import { Icon } from "../ui/Icon";
import "./status.css";

function attachmentRatio(att: MediaAttachment): number | undefined {
  const original = att.meta?.original;
  if (!original) return undefined;
  return (
    original.aspect ||
    (original.width && original.height ? original.width / original.height : undefined)
  );
}

function BlurhashCanvas({ hash }: { hash: string }): JSX.Element | null {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || hash.length < 6) return;
    try {
      const w = 16;
      const h = 16;
      const pixels = decodeBlurHash(hash, w, h);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const imageData = ctx.createImageData(w, h);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);
    } catch {
      /* hash inválido */
    }
  }, [hash]);
  if (hash.length < 6) return null;
  return <canvas ref={ref} class="blurhash" aria-hidden />;
}

function MediaItem({
  attachment,
  total,
  sensitive,
  onOpen,
}: {
  attachment: MediaAttachment;
  total: number;
  sensitive: boolean;
  onOpen: (e: MouseEvent) => void;
}): JSX.Element {
  const [revealed, setRevealed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ratio = attachmentRatio(attachment);
  const blurred = sensitive && !revealed;
  const style = ratio ? { aspectRatio: String(ratio) } : undefined;
  const description = attachment.description || "mídia";
  const full = attachment.url ?? attachment.previewUrl;

  return (
    <figure
      class={`media-item type-${attachment.type} ${total === 1 ? "single" : ""}`}
      style={style}
      onClick={onOpen}
    >
      {!blurred && attachment.blurhash && <BlurhashCanvas hash={attachment.blurhash} />}
      {!blurred && (attachment.type === "image" || attachment.type === "gifv") && (
        <img
          src={attachment.previewUrl}
          alt={description}
          loading="lazy"
          decoding="async"
          class={loaded ? "loaded" : ""}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      )}
      {!blurred && attachment.type === "video" && (
        <video
          src={full}
          poster={attachment.previewUrl}
          controls
          preload="metadata"
          playsInline
          muted
          aria-label={description}
        />
      )}
      {!blurred && attachment.type === "audio" && <audio src={full} controls preload="metadata" />}
      {!blurred && attachment.type === "unknown" && full && (
        <a
          class="media-unknown"
          href={full}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon name="link-line" size={18} />
          <span>{description}</span>
        </a>
      )}
      {blurred && (
        <div class="media-blur">
          <button
            class="btn sm ghost"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRevealed(true);
            }}
          >
            <Icon name="eye-line" size={15} />
            Mostrar mídia
          </button>
        </div>
      )}
      {attachment.type === "gifv" && !blurred && <span class="gif-badge">GIF</span>}
    </figure>
  );
}

export function MediaGrid({
  attachments,
  instance,
  sensitive,
}: {
  attachments: readonly MediaAttachment[];
  instance?: string;
  sensitive?: boolean;
}): JSX.Element | null {
  if (!attachments.length) return null;
  const open =
    (index: number) =>
    (e: MouseEvent): void => {
      e.stopPropagation();
      setMediaViewer({
        instance: instance ?? store.instance?.uri ?? "",
        attachments: [...attachments],
        index,
      });
    };
  return (
    <div class={`media-grid count-${Math.min(attachments.length, 4)}`}>
      {attachments.map((attachment, index) => (
        <MediaItem
          key={attachment.id}
          attachment={attachment}
          total={attachments.length}
          sensitive={!!sensitive}
          onOpen={open(index)}
        />
      ))}
    </div>
  );
}
