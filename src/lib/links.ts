import { hrefFor } from "./identity";
import { navigate } from "./router";

/* Converts clicks on content links (mentions, hashtags, posts,
   external links) into internal navigation when possible. */

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

  const internal = hrefFor.fromExternalUrl(url.host, url.pathname);
  if (internal) {
    navigate(internal);
    return "internal";
  }

  window.open(url.href, "_blank", "noopener,noreferrer");
  return "external";
}
