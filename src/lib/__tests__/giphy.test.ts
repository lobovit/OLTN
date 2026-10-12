import { describe, expect, it } from "vitest";
import { GIFS_PER_PAGE, giphySearchUrl, giphyTrendingUrl, parseGiphyPage } from "../giphy";

describe("giphySearchUrl", () => {
  it("builds the search URL with rating, limit, bundle and offset", () => {
    const url = new URL(giphySearchUrl("KEY", "cat dance", 20, "pt-BR"));
    expect(url.origin + url.pathname).toBe("https://api.giphy.com/v1/gifs/search");
    expect(url.searchParams.get("api_key")).toBe("KEY");
    expect(url.searchParams.get("q")).toBe("cat dance");
    expect(url.searchParams.get("rating")).toBe("g");
    expect(url.searchParams.get("limit")).toBe(String(GIFS_PER_PAGE));
    expect(url.searchParams.get("bundle")).toBe("messaging_non_clips");
    expect(url.searchParams.get("offset")).toBe("20");
    expect(url.searchParams.get("lang")).toBe("pt");
  });
});

describe("giphyTrendingUrl", () => {
  it("builds the trending URL without a query", () => {
    const url = new URL(giphyTrendingUrl("KEY", 40, "en"));
    expect(url.origin + url.pathname).toBe("https://api.giphy.com/v1/gifs/trending");
    expect(url.searchParams.get("api_key")).toBe("KEY");
    expect(url.searchParams.get("q")).toBeNull();
    expect(url.searchParams.get("rating")).toBe("g");
    expect(url.searchParams.get("limit")).toBe(String(GIFS_PER_PAGE));
    expect(url.searchParams.get("offset")).toBe("40");
  });
});

describe("parseGiphyPage", () => {
  const item = {
    id: "abc",
    title: "Cat title",
    alt_text: "a dancing cat",
    images: {
      fixed_height_small: {
        url: "https://media.giphy.com/media/abc/small.gif?cid=track",
        webp: "https://media.giphy.com/media/abc/small.webp?cid=track",
        width: "200",
        height: "150",
      },
      original: { url: "https://media.giphy.com/media/abc/original.gif?cid=track" },
    },
  };

  it("maps items, strips tracking params and caps preview height", () => {
    const page = parseGiphyPage({
      data: [item],
      pagination: { offset: 0, count: 1, total_count: 57 },
    });
    expect(page.offset).toBe(0);
    expect(page.total).toBe(57);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toEqual({
      id: "abc",
      url: "https://media.giphy.com/media/abc/original.gif",
      preview: "https://media.giphy.com/media/abc/small.gif",
      previewWebp: "https://media.giphy.com/media/abc/small.webp",
      width: 133,
      height: 100,
      alt: "a dancing cat",
    });
  });

  it("falls back to smaller images and title, skipping invalid entries", () => {
    const page = parseGiphyPage({
      data: [
        { id: "1", title: "no images" },
        { id: "2", images: { fixed_height: { url: "u", width: 10, height: 10 } } },
      ],
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].preview).toBe("u");
    expect(page.items[0].url).toBe("u");
    expect(page.items[0].alt).toBe("GIF");
    expect(page.count).toBe(1);
  });

  it("tolerates empty payloads", () => {
    expect(parseGiphyPage(null).items).toEqual([]);
    expect(parseGiphyPage({}).total).toBe(0);
  });
});
