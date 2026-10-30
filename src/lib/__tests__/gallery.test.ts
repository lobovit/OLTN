import { describe, expect, it } from "vitest";
import type { MediaAttachment, Status } from "../../api/types";
import { galleryImageCount, galleryItems } from "../gallery";

function attachment(
  id: string,
  type: MediaAttachment["type"],
  url = `https://media.example/${id}.jpg`,
): MediaAttachment {
  return {
    id,
    type,
    url,
    previewUrl: url,
    description: id,
  } as unknown as MediaAttachment;
}

function status(id: string, attachments: MediaAttachment[], reblog?: Status): Status {
  return {
    id,
    uri: `https://example.test/statuses/${id}`,
    reblog: reblog ?? null,
    mediaAttachments: attachments,
  } as unknown as Status;
}

describe("galleryItems", () => {
  it("keeps image and gifv attachments with their original index", () => {
    const items = galleryItems([
      status("1", [
        attachment("a", "image"),
        attachment("b", "video"),
        attachment("c", "gifv"),
        attachment("d", "audio"),
      ]),
    ]);
    expect(items.map((item) => item.attachment.id)).toEqual(["a", "c"]);
    expect(items.map((item) => item.index)).toEqual([0, 2]);
  });

  it("skips attachments without a usable URL", () => {
    const missing = {
      ...attachment("a", "image"),
      url: null,
      previewUrl: null,
    } as unknown as MediaAttachment;
    expect(galleryItems([status("1", [missing])])).toEqual([]);
  });

  it("unwraps boosted statuses", () => {
    const inner = status("2", [attachment("a", "image")]);
    const items = galleryItems([status("boost", [], inner)]);
    expect(items[0].status).toBe(inner);
  });

  it("deduplicates the same media repeated with the same status", () => {
    const same = status("1", [attachment("a", "image")]);
    expect(galleryItems([same, same])).toHaveLength(1);
  });

  it("counts gallery-eligible attachments, including on boosts", () => {
    const inner = status("2", [
      attachment("a", "image"),
      attachment("b", "video"),
      attachment("c", "gifv"),
    ]);
    expect(galleryImageCount(status("boost", [], inner))).toBe(2);
  });
});
