import type { Dispatch, StateUpdater } from "preact/hooks";
import { useState } from "preact/hooks";
import type { AccountMeta, MediaAttachment } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import type { GifResult } from "../../lib/giphy";
import { clientFor } from "../../lib/identity";
import type { PublishPoll } from "../../lib/publish-plan";
import { toast } from "../../state/store";

/** Downloads the selected GIF into a File for upload. */
async function fetchGifFile(gif: GifResult): Promise<File> {
  const blob = await fetch(gif.url, { referrerPolicy: "no-referrer" }).then((res) => res.blob());
  return new File([blob], "image.gif", { type: blob.type || "image/gif" });
}

export interface MediaUploadState {
  uploading: number;
  upload: (files: FileList | File[]) => Promise<void>;
  pickGif: (gif: GifResult) => Promise<void>;
}

/** Uploads media attachments and GIFs for the composer (max 4 slots). */
export function useMediaUpload(input: {
  instance: string;
  account: AccountMeta | null;
  media: readonly MediaAttachment[];
  poll: PublishPoll | null;
  setMedia: Dispatch<StateUpdater<MediaAttachment[]>>;
}): MediaUploadState {
  const [uploading, setUploading] = useState(0);

  const uploadFile = async (file: File, description?: string): Promise<void> => {
    if (!input.account) return;
    setUploading((n) => n + 1);
    try {
      const attachment = await clientFor(input.instance).client.v1.media.create({
        file,
        description,
      });
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

  return { uploading, upload, pickGif };
}
