import { navigate } from "./router";

/* Converte cliques em links do conteúdo (menções, hashtags, posts,
   links externos) em navegação interna quando possível. */

function pathToInternal(host: string, pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, "");
  // hashtag: /tags/foo | /tag/foo
  const tag = clean.match(/^\/tags?\/([^/]+)$/);
  if (tag) return `/${encodeURIComponent(host)}/t/${encodeURIComponent(tag[1])}`;

  // status: /@user/123 | /users/user/statuses/123
  const status =
    clean.match(/^\/@[^/]+\/(\d+)$/) || clean.match(/^\/users\/[^/]+\/statuses\/(\d+)$/);
  if (status) return `/${encodeURIComponent(host)}/s/${status[1]}`;

  // conta: /@user | /users/user
  const account = clean.match(/^\/@([^/]+)$/) || clean.match(/^\/users\/([^/]+)$/);
  if (account) {
    const username = account[1];
    return `/${encodeURIComponent(host)}/a/@${encodeURIComponent(username)}`;
  }
  return null;
}

export type LinkAction = "internal" | "external" | "ignore";

export function handleContentClick(event: MouseEvent): LinkAction {
  const target = event.target as HTMLElement | null;
  const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor) return "ignore";
  const href = anchor.getAttribute("href");
  if (!href) return "ignore";

  event.preventDefault();
  event.stopPropagation();

  if (href.startsWith("#/")) {
    navigate(href.slice(1));
    return "internal";
  }

  let url: URL;
  try {
    url = new URL(href, location.href);
  } catch {
    window.open(href, "_blank", "noopener");
    return "external";
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    window.open(url.href, "_blank", "noopener");
    return "external";
  }

  const internal = pathToInternal(url.host, url.pathname);
  if (internal) {
    navigate(internal);
    return "internal";
  }

  window.open(url.href, "_blank", "noopener,noreferrer");
  return "external";
}
