/* GIPHY search helpers for the compose GIF picker (pure; the component only
   fetches and renders). Search endpoint mirrored from Phanpy; the original
   file is used for attaching. */

export const GIFS_PER_PAGE = 20;

/**
 * Public web key used by giphy.com itself in the browser, so the picker works
 * with zero configuration. Set VITE_GIPHY_API_KEY to use your own key instead.
 */
export const GIPHY_PUBLIC_KEY = "Gc7131jiJuvI7IdN0HZ1D7nh0ow5BU6g";

const SEARCH_ENDPOINT = "https://api.giphy.com/v1/gifs/search";
const TRENDING_ENDPOINT = "https://api.giphy.com/v1/gifs/trending";

export interface GifResult {
  id: string;
  /** Original .gif URL (download source), tracking params stripped. */
  url: string;
  /** Small preview used in the grid. */
  preview: string;
  previewWebp?: string;
  /** Display size of the preview (height capped at 100px). */
  width: number;
  height: number;
  /** alt_text/title from GIPHY, used as media description. */
  alt: string;
}

export interface GiphyPage {
  items: GifResult[];
  offset: number;
  count: number;
  total: number;
}

export function giphySearchUrl(
  apiKey: string,
  query: string,
  offset: number,
  lang: string,
): string {
  const params = new URLSearchParams({
    api_key: apiKey,
    q: query,
    rating: "g",
    limit: String(GIFS_PER_PAGE),
    bundle: "messaging_non_clips",
    offset: String(offset),
    lang: lang.slice(0, 2) || "en",
  });
  return `${SEARCH_ENDPOINT}?${params.toString()}`;
}

export function giphyTrendingUrl(apiKey: string, offset: number, lang: string): string {
  const params = new URLSearchParams({
    api_key: apiKey,
    rating: "g",
    limit: String(GIFS_PER_PAGE),
    offset: String(offset),
    lang: lang.slice(0, 2) || "en",
  });
  return `${TRENDING_ENDPOINT}?${params.toString()}`;
}

function stripQuery(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname;
  } catch {
    return url;
  }
}

interface GiphyImage {
  url?: string;
  webp?: string;
  width?: string | number;
  height?: string | number;
}

interface GiphyItem {
  id?: string;
  title?: string;
  alt_text?: string;
  images?: Record<string, GiphyImage>;
}

interface GiphyPayload {
  data?: GiphyItem[];
  pagination?: { offset?: number; count?: number; total_count?: number };
}

export function parseGiphyPage(data: unknown): GiphyPage {
  const payload = (data ?? {}) as GiphyPayload;
  const items: GifResult[] = [];
  for (const gif of payload.data ?? []) {
    const images = gif.images ?? {};
    const previewImage = images.fixed_height_small?.url
      ? images.fixed_height_small
      : images.fixed_height_downsampled?.url
        ? images.fixed_height_downsampled
        : images.fixed_height;
    const original = images.original ?? previewImage;
    if (!gif.id || !previewImage?.url || !original?.url) continue;
    let width = Number(previewImage.width) || 0;
    let height = Number(previewImage.height) || 0;
    if (height > 100) {
      width = Math.round((width / height) * 100);
      height = 100;
    }
    items.push({
      id: gif.id,
      url: stripQuery(original.url),
      preview: stripQuery(previewImage.url),
      previewWebp: previewImage.webp ? stripQuery(previewImage.webp) : undefined,
      width,
      height,
      alt: gif.alt_text || gif.title || "GIF",
    });
  }
  const pagination = payload.pagination ?? {};
  return {
    items,
    offset: Number(pagination.offset) || 0,
    count: Number(pagination.count) || items.length,
    total: Number(pagination.total_count) || 0,
  };
}
