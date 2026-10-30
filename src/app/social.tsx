import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import type { Tag, TrendLink } from "../api/types";
import { t } from "../i18n/pt-BR";
import { clientFor, hrefFor } from "../lib/identity";
import { Link, useRouter } from "../lib/router";
import { HomeGallery } from "../components/feed/HomeGallery";
import { HomeGalleryToggle } from "../components/feed/HomeGalleryToggle";
import { Timeline } from "../components/feed/Timeline";
import { Avatar } from "../components/ui/Avatar";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import { currentAccount, setCompose, store } from "../state/store";
import { useAppState } from "../state/hooks";

/** Left navigation for the social (single-feed) desktop layout. */
export function SocialNav(): JSX.Element {
  const route = useRouter();
  const state = useAppState();
  const me = state.me;
  const account = currentAccount();
  const profileHref =
    me && account ? `/${encodeURIComponent(account.instance)}/a/${me.id}` : "/login";
  const active = (href: string): boolean =>
    href === "/" ? route.path === "/" : route.path === href || route.path.startsWith(`${href}/`);
  const links: { href: string; icon: string; label: string; badge?: number; search?: boolean }[] = [
    { href: "/", icon: "home-3-line", label: t.home },
    { href: "/search", icon: "search-2-line", label: t.search, search: true },
    {
      href: "/notifications",
      icon: "notification-line",
      label: t.notifications,
      badge: state.notifBadge,
    },
    { href: "/messages", icon: "mail-line", label: t.messages },
    { href: "/l", icon: "list-check-line", label: t.lists },
    { href: "/b", icon: "bookmark-line", label: t.bookmarks },
    { href: "/trending", icon: "trending-up-line", label: t.trending },
    { href: "/newsletter", icon: "news-line", label: t.newsletter },
  ];
  return (
    <nav class="social-nav" aria-label={t.navHelp}>
      <Link class="social-logo" href="/" title="OLTN">
        <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden>
          <circle cx="32" cy="34" r="17" fill="none" stroke="currentColor" strokeWidth="7" />
          <circle cx="32" cy="17" r="8" fill="currentColor" />
        </svg>
        <span>OLTN</span>
      </Link>
      <div class="social-nav-links">
        {links.map((item) => (
          <Link
            key={item.href + item.label}
            href={item.href}
            class={`social-nav-item ${
              (item.search ? state.ui.searchOpen : false) || active(item.href) ? "active" : ""
            }`}
            ariaCurrent={active(item.href) ? "page" : undefined}
            onClick={(e) => {
              if (!item.search) return;
              e.preventDefault();
              store.ui.searchOpen = true;
            }}
          >
            <span class="social-nav-icon">
              <Icon name={item.icon} size={22} />
              {!!item.badge && <span class="badge">{item.badge > 99 ? "99+" : item.badge}</span>}
            </span>
            <span class="social-nav-label">{item.label}</span>
          </Link>
        ))}
      </div>
      <button
        type="button"
        class="btn primary social-post"
        onClick={() => setCompose({ mode: "new" })}
      >
        <Icon name="pencil-line" size={18} />
        <span>{t.composePost}</span>
      </button>
      <div class="social-nav-bottom">
        <Link
          href={profileHref}
          class={`social-nav-item ${active(profileHref) ? "active" : ""}`}
          ariaCurrent={active(profileHref) ? "page" : undefined}
        >
          <span class="social-nav-icon">
            <Icon name="user-3-line" size={22} />
          </span>
          <span class="social-nav-label">{t.profile}</span>
        </Link>
        <Link
          href="/settings"
          class={`social-nav-item ${active("/settings") ? "active" : ""}`}
          ariaCurrent={active("/settings") ? "page" : undefined}
        >
          <span class="social-nav-icon">
            <Icon name="settings-3-line" size={22} />
          </span>
          <span class="social-nav-label">{t.settingsShort}</span>
        </Link>
      </div>
    </nav>
  );
}

type HomeTab = "home" | "local" | "federated";

/** Single center feed with tabs and an inline compose prompt. */
export function SocialHome(): JSX.Element {
  const account = currentAccount();
  const snap = useSnapshot(store);
  const stream = snap.stream;
  const [tab, setTab] = useState<HomeTab>("home");
  const streamLabel =
    stream === "on"
      ? t.streamingOn
      : stream === "connecting"
        ? t.streamingConnecting
        : t.streamingOff;
  const kind =
    tab === "local"
      ? ({ type: "public", local: true } as const)
      : tab === "federated"
        ? ({ type: "public" } as const)
        : ({ type: "home" } as const);
  const tabs: [HomeTab, string][] = [
    ["home", t.home],
    ["local", t.local],
    ["federated", t.federated],
  ];
  return (
    <PageShell
      title={t.home}
      actions={
        <>
          {account && <HomeGalleryToggle />}
          <span
            class={`stream-dot ${stream === "on" ? "on" : ""}`}
            aria-hidden="true"
            title={streamLabel}
          />
          <span class="sr-only">{streamLabel}</span>
        </>
      }
    >
      {snap.ui.homeGallery ? (
        <HomeGallery instance={account?.instance} />
      ) : (
        <>
          <div class="subtabs social-tabs">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                class={`subtab ${tab === key ? "active" : ""}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" class="social-composer" onClick={() => setCompose({ mode: "new" })}>
            {account && (
              <Avatar src={account.avatar} name={account.displayName || account.handle} size={40} />
            )}
            <span>{t.socialComposePrompt}</span>
          </button>
          <Timeline
            key={tab}
            kind={kind}
            instance={account?.instance}
            listenQueue={tab === "home"}
            emptyTitle={tab === "home" ? t.emptyHome : t.empty}
            emptyHint={tab === "home" ? t.emptyHomeHint : undefined}
          />
        </>
      )}
    </PageShell>
  );
}

/** Right-hand discovery rail: search, trending tags and news links. */
export function SocialSidebar(): JSX.Element {
  const account = currentAccount();
  const instance = account?.instance ?? "";
  const [tags, setTags] = useState<Tag[]>([]);
  const [links, setLinks] = useState<TrendLink[]>([]);

  useEffect(() => {
    if (!instance) return;
    let cancelled = false;
    void (async () => {
      const { client } = clientFor(instance);
      const [tagPage, linkPage] = await Promise.allSettled([
        client.v1.trends.tags.list({ limit: 5 }),
        client.v1.trends.links.list({ limit: 3 }),
      ]);
      if (cancelled) return;
      if (tagPage.status === "fulfilled") setTags(tagPage.value);
      if (linkPage.status === "fulfilled") setLinks(linkPage.value);
    })();
    return () => {
      cancelled = true;
    };
  }, [instance]);

  return (
    <aside class="social-sidebar">
      <button
        type="button"
        class="social-search"
        onClick={() => {
          store.ui.searchOpen = true;
        }}
      >
        <Icon name="search-2-line" size={16} />
        {t.search}
      </button>
      {tags.length > 0 && (
        <section class="social-side-card">
          <h3>{t.trending}</h3>
          {tags.map((tag) => (
            <Link key={tag.name} class="social-side-row" href={hrefFor.tag(tag.name, instance)}>
              <span>#{tag.name}</span>
            </Link>
          ))}
        </section>
      )}
      {links.length > 0 && (
        <section class="social-side-card">
          <h3>{t.news}</h3>
          {links.map((link) => (
            <a
              key={link.url}
              class="social-side-row"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>{link.title}</span>
              <span class="social-side-meta">{link.providerName}</span>
            </a>
          ))}
        </section>
      )}
    </aside>
  );
}
