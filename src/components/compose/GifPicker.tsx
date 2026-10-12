import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "../../i18n/pt-BR";
import {
  GIFS_PER_PAGE,
  giphySearchUrl,
  giphyTrendingUrl,
  parseGiphyPage,
  type GifResult,
  type GiphyPage,
} from "../../lib/giphy";
import { store } from "../../state/store";
import { Icon } from "../ui/Icon";

interface GifPickerProps {
  apiKey: string;
  onSelect: (gif: GifResult) => void;
}

/** Emoji-style GIF picker: trending on open, GIPHY search while typing. */
export function GifPicker({ apiKey, onSelect }: GifPickerProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState<GiphyPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const debounce = useRef<number | undefined>(undefined);
  const seq = useRef(0);

  const load = (value: string, offset: number): void => {
    const q = value.trim();
    const token = ++seq.current;
    setLoading(true);
    setFailed(false);
    void (async () => {
      try {
        const lang = store.settings.language;
        const url = q
          ? giphySearchUrl(apiKey, q, offset, lang)
          : giphyTrendingUrl(apiKey, offset, lang);
        const res = await fetch(url, { referrerPolicy: "no-referrer" });
        if (!res.ok) throw new Error(`giphy_http_${res.status}`);
        const parsed = parseGiphyPage(await res.json());
        if (token !== seq.current) return;
        setPage(parsed);
      } catch (err) {
        if (token !== seq.current) return;
        console.warn("[oltn] giphy load failed", err);
        setFailed(true);
      } finally {
        if (token === seq.current) setLoading(false);
      }
    })();
  };

  useEffect(() => {
    load("", 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onInput = (value: string): void => {
    setQuery(value);
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => load(value, 0), 500);
  };

  useEffect(() => () => window.clearTimeout(debounce.current), []);

  let body: JSX.Element;
  if (failed) {
    body = <p class="gif-state">{t.gifError}</p>;
  } else if (!page) {
    body = (
      <p class="gif-state">
        <span class="spinner" />
      </p>
    );
  } else if (!page.items.length) {
    body = <p class="gif-state">{t.gifNone}</p>;
  } else {
    body = (
      <>
        <div class="gif-grid">
          {page.items.map((gif) => (
            <button
              key={gif.id}
              type="button"
              class="gif-item"
              title={gif.alt}
              onClick={() => onSelect(gif)}
            >
              <picture>
                {gif.previewWebp && <source srcset={gif.previewWebp} type="image/webp" />}
                <img
                  src={gif.preview}
                  width={gif.width}
                  height={gif.height}
                  loading="lazy"
                  decoding="async"
                  alt={gif.alt}
                  referrerpolicy="no-referrer"
                />
              </picture>
            </button>
          ))}
        </div>
        <div class="gif-pager">
          <button
            type="button"
            class="cw-toggle"
            disabled={page.offset <= 0 || loading}
            onClick={() => load(query, Math.max(0, page.offset - GIFS_PER_PAGE))}
          >
            {t.prev}
          </button>
          {loading && <span class="spinner" />}
          <button
            type="button"
            class="cw-toggle"
            disabled={loading || page.offset + page.count >= page.total}
            onClick={() => load(query, page.offset + GIFS_PER_PAGE)}
          >
            {t.next}
          </button>
        </div>
      </>
    );
  }

  return (
    <div class="gif-picker" aria-label={t.gif}>
      <form
        class="gif-search"
        onSubmit={(e) => {
          e.preventDefault();
          load(query, 0);
        }}
      >
        <Icon name="search-2-line" size={16} />
        <input
          class="field gif-query"
          type="search"
          placeholder={t.gifSearch}
          value={query}
          autocomplete="off"
          onInput={(e) => onInput((e.target as HTMLInputElement).value)}
        />
      </form>
      {body}
      <a class="gif-attribution" href="https://giphy.com" target="_blank" rel="noopener noreferrer">
        Powered by GIPHY
      </a>
    </div>
  );
}
