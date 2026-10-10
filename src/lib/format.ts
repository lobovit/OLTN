const rtfCache = new Map<string, Intl.RelativeTimeFormat>();
const numberCache = new Map<string, Intl.NumberFormat>();
const compactCache = new Map<string, Intl.NumberFormat>();

let currentLocale = "pt-BR";

/** Define o idioma usado na formatação (chamado em applyAppearance). */
export function setFormatLocale(locale: string): void {
  currentLocale = locale;
}

function relativeFormatter(): Intl.RelativeTimeFormat {
  const locale = currentLocale;
  let fmt = rtfCache.get(locale);
  if (!fmt) {
    fmt = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    rtfCache.set(locale, fmt);
  }
  return fmt;
}

function numberFormatter(): Intl.NumberFormat {
  const locale = currentLocale;
  let fmt = numberCache.get(locale);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale);
    numberCache.set(locale, fmt);
  }
  return fmt;
}

function compactFormatter(): Intl.NumberFormat {
  const locale = currentLocale;
  let fmt = compactCache.get(locale);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
    compactCache.set(locale, fmt);
  }
  return fmt;
}

export function timeAgo(iso: string | number | Date, now = Date.now()): string {
  const date = new Date(iso);
  const diffMs = date.getTime() - now;
  const abs = Math.abs(diffMs);
  const sec = Math.round(abs / 1000);
  const rtf = relativeFormatter();
  if (sec < 45) return rtf.format(Math.round(diffMs / 1000), "second");
  const min = Math.round(sec / 60);
  if (min < 60) return rtf.format(Math.round(diffMs / 60000), "minute");
  const hr = Math.round(min / 60);
  if (hr < 24) return rtf.format(Math.round(diffMs / 3600000), "hour");
  const day = Math.round(hr / 24);
  if (day < 7) return rtf.format(Math.round(diffMs / 86400000), "day");
  const week = Math.round(day / 7);
  if (week < 5) return rtf.format(Math.round(diffMs / (86400000 * 7)), "week");
  const month = Math.round(day / 30);
  if (month < 12) return rtf.format(Math.round(diffMs / (86400000 * 30)), "month");
  return rtf.format(Math.round(diffMs / (86400000 * 365)), "year");
}

export function fullDate(iso: string | number | Date): string {
  return new Date(iso).toLocaleString(currentLocale, {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export function shortNumber(n: number): string {
  return compactFormatter().format(n);
}

export function fullNumber(n: number): string {
  return numberFormatter().format(n);
}

export function shortHandle(handle: string): string {
  return handle.startsWith("@") ? handle.slice(1) : handle;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function normalizeInstance(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  // @user@host ou user@host → host
  const atMatch = value.match(/@([^@]+)$/);
  if (atMatch) value = atMatch[1];
  value = value.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  value = value.split("/")[0];
  if (!value) return null;
  if (!/^[a-z0-9.-]+(:\d{2,5})?$/.test(value)) return null;
  if (!value.includes(".") && !value.includes(":")) return null;
  return value;
}

export function extractMention(input: string): {
  host: string;
  username?: string;
} | null {
  const trimmed = input.trim();
  const m = trimmed.match(/^@?([^@\s]+)@([^@\s]+)$/);
  if (m) return { host: normalizeInstance(m[2]) ?? m[2], username: m[1] };
  const host = normalizeInstance(trimmed);
  return host ? { host } : null;
}

/** Converte o HTML de um status em texto editável (usado ao editar post). */
export function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;
  for (const a of [...body.querySelectorAll("a")]) {
    const rawHref = a.getAttribute("href") ?? "";
    const text = a.textContent ?? "";
    const isAbsolute = /^https?:\/\//.test(rawHref);
    const redundant =
      !isAbsolute ||
      rawHref === text ||
      text.includes(rawHref) ||
      text.startsWith("#") ||
      text.startsWith("@");
    a.replaceWith(doc.createTextNode(redundant ? text : `${text} ${rawHref}`));
  }
  for (const br of [...body.querySelectorAll("br")]) br.replaceWith("\n");
  for (const block of [
    ...body.querySelectorAll("p, div, li, blockquote, h1, h2, h3, h4, h5, h6"),
  ]) {
    block.replaceWith(doc.createTextNode(`\n\n${block.textContent ?? ""}`));
  }
  return (body.textContent ?? "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
