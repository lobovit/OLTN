/* Home gallery items: every image attachment from the media-only timeline. */

import type { MediaAttachment, Status } from "../api/types";

export interface GalleryItem {
  key: string;
  /** Unwrapped status (a boost shows the boosted post). */
  status: Status;
  attachment: MediaAttachment;
  /** All attachments of the status, for the media viewer. */
  attachments: readonly MediaAttachment[];
  index: number;
}

function statusIdentity(status: Status): string {
  return status.uri || String(status.id);
}

function isGalleryAttachment(attachment: MediaAttachment): boolean {
  return (
    (attachment.type === "image" || attachment.type === "gifv") &&
    !!(attachment.previewUrl || attachment.url)
  );
}

/** Number of gallery-eligible images in a status (boosts use the inner post). */
export function galleryImageCount(status: Status): number {
  const target = status.reblog ?? status;
  return (target.mediaAttachments ?? []).filter(isGalleryAttachment).length;
}

export function galleryItems(statuses: readonly Status[]): GalleryItem[] {
  const seen = new Set<string>();
  const items: GalleryItem[] = [];
  for (const outer of statuses) {
    const status = outer.reblog ?? outer;
    const attachments = status.mediaAttachments ?? [];
    for (let index = 0; index < attachments.length; index++) {
      const attachment = attachments[index];
      if (!isGalleryAttachment(attachment)) continue;
      const key = `${statusIdentity(status)}:${attachment.id || attachment.url || index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ key, status, attachment, attachments, index });
    }
  }
  return items;
}
