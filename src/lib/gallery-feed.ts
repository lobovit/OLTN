/* Gallery pagination: fill each gallery page with enough images, even when a
   server returns sparse media pages for the Home timeline. */

import type { Status } from "../api/types";
import { galleryImageCount } from "./gallery";
import type { FeedPage } from "./paged-feed";

export interface GalleryPageOptions {
  /** Stop after collecting this many image attachments. */
  targetImages?: number;
  /** Safety cap for servers that keep returning pages without images. */
  maxPages?: number;
}

function keyOf(status: Status): string {
  return status.uri || String(status.id);
}

export async function fetchGalleryPage(
  fetchPage: (cursor: string | null) => Promise<FeedPage<Status>>,
  cursor: string | null,
  options: GalleryPageOptions = {},
): Promise<FeedPage<Status>> {
  const targetImages = options.targetImages ?? 12;
  const maxPages = options.maxPages ?? 6;
  const items: Status[] = [];
  const seen = new Set<string>();
  let maxId = cursor;
  let hasMore = false;

  for (let page = 0; page < maxPages; page++) {
    const raw = await fetchPage(maxId);
    if (!raw.items.length) {
      hasMore = false;
      break;
    }
    for (const status of raw.items) {
      const key = keyOf(status);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(status);
    }
    hasMore = raw.hasMore;
    maxId = raw.items[raw.items.length - 1].id;
    if (!hasMore) break;
    const images = items.reduce((count, status) => count + galleryImageCount(status), 0);
    if (images >= targetImages) break;
  }

  return { items, hasMore };
}
