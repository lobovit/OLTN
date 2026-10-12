import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import type { AccountMeta, MediaAttachment } from "../../api/types";
import { useMediaUpload, type MediaUploadState } from "../../components/compose/useMediaUpload";
import type { GifResult } from "../../lib/giphy";
import { exifJpeg } from "./fixtures/image-bytes";

const account = {
  id: "me",
  instance: "test.instance",
  handle: "@me@test.instance",
  displayName: "Me",
  avatar: "",
  accessToken: "tok",
  clientId: "client",
  createdAt: 0,
} as AccountMeta;

interface CreatedMedia {
  file: File;
  description?: string;
}

function renderUploader(created: CreatedMedia[]): MediaUploadState {
  let api: MediaUploadState | null = null;
  function Harness() {
    api = useMediaUpload({
      instance: "test.instance",
      account,
      media: [],
      poll: null,
      setMedia: () => {},
      createMedia: async (file, description) => {
        created.push({ file, description });
        return { id: `m${created.length}` } as unknown as MediaAttachment;
      },
    });
    return null;
  }
  render(<Harness />, document.createElement("div"));
  if (!api) throw new Error("uploader was not rendered");
  return api;
}

function jpegFile(caption: string): File {
  return new File([exifJpeg(caption)], "photo.jpg", { type: "image/jpeg" });
}

describe("useMediaUpload captions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the embedded caption when the upload has no description", async () => {
    const created: CreatedMedia[] = [];
    const uploader = renderUploader(created);

    await uploader.upload([jpegFile("Sunset over the bay")]);

    expect(created[0]?.description).toBe("Sunset over the bay");
  });

  it("keeps the explicit GIF alt text over an embedded caption", async () => {
    const created: CreatedMedia[] = [];
    const uploader = renderUploader(created);
    vi.stubGlobal("fetch", async () => new Response(exifJpeg("Embedded caption")));

    await uploader.pickGif({
      id: "g1",
      url: "https://gif.test/cat.gif",
      alt: "Cat on a keyboard",
    } as GifResult);

    expect(created[0]?.description).toBe("Cat on a keyboard");
  });
});
