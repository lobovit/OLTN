import { describe, expect, it } from "vitest";
import type { MediaAttachment, Status } from "../../api/types";
import { galleryItems } from "../gallery";
import { fetchGalleryPage } from "../gallery-feed";
import type { FeedPage } from "../paged-feed";

function image(id: string): MediaAttachment {
  return {
    id,
    type: "image",
    url: `https://media.example/${id}.jpg`,
    previewUrl: `https://media.example/${id}.jpg`,
  } as unknown as MediaAttachment;
}

function status(id: string, media: MediaAttachment[] = []): Status {
  return {
    id,
    uri: `https://example.test/statuses/${id}`,
    mediaAttachments: media,
  } as unknown as Status;
}

describe("fetchGalleryPage", () => {
  it("keeps paging until it has enough images", async () => {
    const cursors: (string | null)[] = [];
    const fetchPage = async (cursor: string | null): Promise<FeedPage<Status>> => {
      cursors.push(cursor);
      const pageNumber = cursors.length;
      const items = Array.from({ length: 20 }, (_, index) =>
        status(`${pageNumber}-${index}`, index < 2 ? [image(`${pageNumber}-${index}`)] : []),
      );
      return { items, hasMore: true };
    };

    const result = await fetchGalleryPage(fetchPage, null);
    expect(cursors).toHaveLength(6);
    expect(cursors[1]).toBe("1-19");
    expect(galleryItems(result.items)).toHaveLength(12);
    expect(result.hasMore).toBe(true);
  });

  it("stops after one page when that page is already full of images", async () => {
    let calls = 0;
    const fetchPage = async (): Promise<FeedPage<Status>> => {
      calls += 1;
      return {
        items: Array.from({ length: 12 }, (_, index) =>
          status(String(index), [image(String(index))]),
        ),
        hasMore: true,
      };
    };

    const result = await fetchGalleryPage(fetchPage, null);
    expect(calls).toBe(1);
    expect(galleryItems(result.items)).toHaveLength(12);
  });

  it("deduplicates statuses across pages and stops at the end", async () => {
    const first = status("1", [image("a")]);
    const fetchPage = async (): Promise<FeedPage<Status>> => ({
      items: [first],
      hasMore: false,
    });

    const result = await fetchGalleryPage(fetchPage, null);
    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });
});
