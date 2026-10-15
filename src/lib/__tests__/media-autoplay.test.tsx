import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import type { MediaAttachment } from "../../api/types";
import { MediaGrid } from "../../components/status/Media";
import { DEFAULT_SETTINGS, store } from "../../state/store";

function media(overrides: Partial<MediaAttachment>): MediaAttachment {
  return {
    id: "m1",
    type: "image",
    url: "https://cdn.example/clip.gif",
    previewUrl: "https://cdn.example/preview.jpg",
    description: "gato",
    blurhash: null,
    ...overrides,
  } as unknown as MediaAttachment;
}

function renderGrid(attachment: MediaAttachment): HTMLElement {
  const host = document.createElement("div");
  render(<MediaGrid attachments={[attachment]} instance="my.instance" />, host);
  return host;
}

beforeEach(() => {
  store.settings = { ...DEFAULT_SETTINGS };
});

describe("MediaGrid: GIF autoplay", () => {
  it("plays gifv attachments by default", () => {
    const host = renderGrid(media({ type: "gifv", url: "https://cdn.example/clip.mp4" }));
    expect(host.querySelector("video")?.getAttribute("src")).toBe("https://cdn.example/clip.mp4");
    expect(host.querySelector("img")).toBe(null);
  });

  it("keeps the static preview when autoplay is off", () => {
    store.settings = { ...DEFAULT_SETTINGS, autoplayGifs: false };
    const host = renderGrid(media({ type: "gifv", url: "https://cdn.example/clip.mp4" }));
    expect(host.querySelector("video")).toBe(null);
    expect(host.querySelector("img")?.getAttribute("src")).toBe("https://cdn.example/preview.jpg");
  });

  it("animates GIFs stored as image attachments", () => {
    const host = renderGrid(media({ type: "image" }));
    expect(host.querySelector("img")?.getAttribute("src")).toBe("https://cdn.example/clip.gif");
  });

  it("keeps regular images on the preview url", () => {
    const host = renderGrid(media({ type: "image", url: "https://cdn.example/photo.jpg" }));
    expect(host.querySelector("img")?.getAttribute("src")).toBe("https://cdn.example/preview.jpg");
  });

  it("pauses the gifv video while it is offscreen and resumes when visible", async () => {
    type IOCallback = (entries: { target: Element; isIntersecting: boolean }[]) => void;
    let callback: IOCallback | null = null;
    class FakeObserver {
      constructor(cb: IOCallback) {
        callback = cb;
      }
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);

    const host = renderGrid(media({ type: "gifv", url: "https://cdn.example/clip.mp4" }));
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    const fire = callback as unknown as IOCallback | null;
    expect(fire).not.toBe(null);
    const video = host.querySelector("video") as HTMLVideoElement;
    const pause = vi.fn();
    const play = vi.fn(() => Promise.resolve());
    video.pause = pause;
    video.play = play;

    fire?.([{ target: video, isIntersecting: false }]);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(play).not.toHaveBeenCalled();

    fire?.([{ target: video, isIntersecting: true }]);
    expect(play).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});
