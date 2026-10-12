import { describe, expect, it } from "vitest";
import { extractImageCaption } from "../image-caption";
import { exifJpeg, pngWithText, webpWithExif, withIptcCaption } from "./fixtures/image-bytes";

describe("extractImageCaption", () => {
  it("reads the EXIF ImageDescription from a JPEG", () => {
    expect(extractImageCaption(exifJpeg("Sunset over the bay"))).toBe("Sunset over the bay");
  });

  it("prefers the IPTC caption over the EXIF description", () => {
    const jpeg = withIptcCaption(exifJpeg("EXIF fallback"), "IPTC caption wins");
    expect(extractImageCaption(jpeg)).toBe("IPTC caption wins");
  });

  it("reads the PNG tEXt Description", () => {
    expect(extractImageCaption(pngWithText("Description", "Rio at dawn"))).toBe("Rio at dawn");
  });

  it("falls back to the PNG tEXt Title", () => {
    expect(extractImageCaption(pngWithText("Title", "Harbor lights"))).toBe("Harbor lights");
  });

  it("reads the EXIF description from a WebP", () => {
    expect(extractImageCaption(webpWithExif("Trail at dusk"))).toBe("Trail at dusk");
  });
});
