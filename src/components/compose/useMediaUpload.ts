import type { Dispatch, StateUpdater } from "preact/hooks";
import { useRef, useState } from "preact/hooks";
import type { AccountMeta, MediaAttachment } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import type { GifResult } from "../../lib/giphy";
import { clientFor } from "../../lib/identity";
import { extractImageCaption } from "../../lib/image-caption";
import { mediaCreateParams } from "../../lib/media-params";
import type { PublishPoll } from "../../lib/publish-plan";
import { toast } from "../../state/store";

/** Downloads the selected GIF into a File for upload. */
async function fetchGifFile(gif: GifResult): Promise<File> {
  const blob = await fetch(gif.url, { referrerPolicy: "no-referrer" }).then((res) => res.blob());
  return new File([blob], "image.gif", { type: blob.type || "image/gif" });
}

/** Alt-text default: the file's embedded caption; explicit text always wins. */
async function defaultDescription(file: File, explicit?: string): Promise<string | undefined> {
  if (explicit?.trim()) return explicit;
  try {
    const caption = extractImageCaption(new Uint8Array(await file.arrayBuffer()));
    return caption ?? explicit;
  } catch {
    return explicit;
  }
}

export interface MediaUploadState {
  uploading: number;
  upload: (files: FileList | File[]) => Promise<void>;
  pickGif: (gif: GifResult) => Promise<void>;
  /** Updates the local alt text and pushes it to the media endpoint. */
  describe: (attachment: MediaAttachment, description: string) => void;
  /** Awaits the pending alt-text updates (call before publishing). */
  flushDescriptions: () => Promise<void>;
}

/** Uploads media attachments and GIFs for the composer (max 4 slots). */
export function useMediaUpload(input: {
  instance: string;
  account: AccountMeta | null;
  media: readonly MediaAttachment[];
  poll: PublishPoll | null;
  setMedia: Dispatch<StateUpdater<MediaAttachment[]>>;
  /** Boundary injection for tests; defaults to the instance client. */
  createMedia?: (file: File, description?: string) => Promise<MediaAttachment>;
  /** Boundary injection for tests; defaults to the instance client. */
  updateMedia?: (id: string, description: string) => Promise<void>;
}): MediaUploadState {
  const [uploading, setUploading] = useState(0);
  const pendingDescriptions = useRef(new Map<string, Promise<void>>());
  const sentDescriptions = useRef(new Map<string, string>());
  const describeTimers = useRef(new Map<string, number>());
  const latestDescriptions = useRef(new Map<string, string>());
  const createMedia =
    input.createMedia ??
    ((file: File, description?: string) =>
      clientFor(input.instance).client.v1.media.create(mediaCreateParams(file, description)));
  const updateMedia =
    input.updateMedia ??
    ((id: string, description: string) =>
      clientFor(input.instance)
        .client.v1.media.$select(id)
        .update({ description })
        .then(() => {}));

  const sendDescription = (id: string, description: string): void => {
    const clean = description.trim();
    if (sentDescriptions.current.get(id) === clean) return;
    sentDescriptions.current.set(id, clean);
    const tracked = updateMedia(id, clean)
      .catch((err) => console.warn("[oltn] media description failed", err))
      .finally(() => pendingDescriptions.current.delete(id));
    pendingDescriptions.current.set(id, tracked);
  };

  const describe = (attachment: MediaAttachment, description: string): void => {
    input.setMedia((prev) =>
      prev.map((item) => (item.id === attachment.id ? { ...item, description } : item)),
    );
    latestDescriptions.current.set(attachment.id, description);
    window.clearTimeout(describeTimers.current.get(attachment.id));
    describeTimers.current.set(
      attachment.id,
      window.setTimeout(
        () => sendDescription(attachment.id, latestDescriptions.current.get(attachment.id) ?? ""),
        400,
      ),
    );
  };

  const flushDescriptions = async (): Promise<void> => {
    for (const [id, timer] of describeTimers.current) {
      window.clearTimeout(timer);
      sendDescription(id, latestDescriptions.current.get(id) ?? "");
    }
    describeTimers.current.clear();
    await Promise.all([...pendingDescriptions.current.values()]);
  };

  const uploadFile = async (file: File, description?: string): Promise<void> => {
    if (!input.account) return;
    setUploading((n) => n + 1);
    try {
      const attachment = await createMedia(file, await defaultDescription(file, description));
      input.setMedia((prev) => [...prev, attachment].slice(0, 4));
    } catch (err) {
      console.warn("[oltn] upload failed", err);
      toast(t.errorUpload, "error");
    } finally {
      setUploading((n) => n - 1);
    }
  };

  const upload = (files: FileList | File[]): Promise<void> => {
    // Sequential uploads keep the 4-slot cap deterministic; the promise chain
    // keeps `await` out of a loop.
    const slots = Math.max(0, 4 - input.media.length);
    return [...files]
      .slice(0, slots)
      .reduce((chain, file) => chain.then(() => uploadFile(file)), Promise.resolve());
  };

  const pickGif = async (gif: GifResult): Promise<void> => {
    if (!input.account || input.media.length >= 4 || input.poll || uploading) return;
    setUploading((n) => n + 1);
    try {
      await uploadFile(await fetchGifFile(gif), gif.alt || undefined);
    } catch (err) {
      console.warn("[oltn] gif download failed", err);
      toast(t.errorUpload, "error");
    } finally {
      setUploading((n) => n - 1);
    }
  };

  return { uploading, upload, pickGif, describe, flushDescriptions };
}
