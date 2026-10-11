import type { ComponentChildren, JSX } from "preact";
import { useEffect, useMemo } from "preact/hooks";
import { useSnapshot } from "valtio";
import type { Shortcut, ShortcutType } from "../api/types";
import { NotificationsFeed } from "../components/feed/NotificationsFeed";
import { Timeline } from "../components/feed/Timeline";
import { TrendingFeed } from "../components/feed/TrendingFeed";
import { ConversationsFeed } from "../components/feed/ConversationsFeed";
import { Icon } from "../components/ui/Icon";
import { Avatar } from "../components/ui/Avatar";
import { t, type TKey } from "../i18n/pt-BR";
import { useHotkeys } from "../lib/hotkeys";
import { clampWidth, COLUMN_MAX, COLUMN_MIN, moveInOrder, orderColumns } from "../lib/layout";
import { Link, matchRoutes, navigate, useRouter } from "../lib/router";
import { shortcutLabel, shortcutRoute } from "./shortcuts";
import { routes } from "./routes";
import { saveColumnLayout, saveSettings, saveShortcuts } from "../state/boot";
import { accountNS, currentAccount, setCompose, setMediaViewer, store } from "../state/store";
import { useAppState } from "../state/hooks";

export function Shell({ children }: { children?: ComponentChildren }): JSX.Element {
  const state = useAppState();
  const authed = state.auth === "authenticated";
  const showRail = authed || !!currentAccount();
  const expanded = state.settings.railExpanded;
  return (
    <div class={`shell ${showRail ? "" : "shell-no-rail"} ${expanded ? "" : "rail-collapsed"}`}>
      <a
        class="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        {t.skipToContent}
      </a>
      <Rail />
      {children}
      {authed && (
        <>
          <TabBar />
          <ComposeFab />
        </>
      )}
    </div>
  );
}

/* ---------------- navegação ---------------- */

const NAV_ITEMS: {
  id: string;
  href: string;
  icon: string;
  iconActive: string;
  labelKey: TKey;
  badge?: boolean;
  column?: ShortcutType;
  popup?: "search";
}[] = [
  {
    id: "/",
    href: "/",
    icon: "home-3-line",
    iconActive: "home-3-fill",
    labelKey: "home",
    column: "home",
  },
  {
    id: "/notifications",
    href: "/notifications",
    icon: "notification-line",
    iconActive: "notification-fill",
    labelKey: "notifications",
    badge: true,
    column: "notifications",
  },
  {
    id: "/mentions",
    href: "/mentions",
    icon: "at-line",
    iconActive: "at-line",
    labelKey: "mentions",
    column: "mentions",
  },
  {
    id: "/messages",
    href: "/messages",
    icon: "mail-line",
    iconActive: "mail-line",
    labelKey: "messages",
    column: "direct",
  },
  {
    id: "/search",
    href: "/search",
    icon: "search-2-line",
    iconActive: "search-2-fill",
    labelKey: "search",
    popup: "search",
  },
  {
    id: "/trending",
    href: "/trending",
    icon: "trending-up-line",
    iconActive: "trending-up-fill",
    labelKey: "trending",
    column: "trending",
  },
  {
    id: "/boosts",
    href: "/boosts",
    icon: "repeat-line",
    iconActive: "repeat-line",
    labelKey: "boosts",
    column: "boosts",
  },
  {
    id: "/l",
    href: "/l",
    icon: "list-check-line",
    iconActive: "list-check-fill",
    labelKey: "lists",
  },
  {
    id: "/b",
    href: "/b",
    icon: "bookmark-line",
    iconActive: "bookmark-fill",
    labelKey: "bookmarks",
    column: "bookmarks",
  },
  {
    id: "/layouts",
    href: "/layouts",
    icon: "layout-grid-line",
    iconActive: "layout-grid-line",
    labelKey: "layouts",
  },
  {
    id: "/settings",
    href: "/settings",
    icon: "settings-3-line",
    iconActive: "settings-3-fill",
    labelKey: "settingsShort",
  },
];

let navDragSuppress = false;

/* Tipos já representados por botões do nav — não repetir nos atalhos do rail */
const NAV_COLUMN_TYPES = new Set(NAV_ITEMS.flatMap((item) => (item.column ? [item.column] : [])));

function startNavDrag(e: PointerEvent, id: string): void {
  if (e.button > 0) return;
  const target = e.currentTarget as HTMLElement;
  const wrap = target.parentElement;
  if (!wrap) return;
  const els = [...wrap.querySelectorAll<HTMLElement>("a.rail-item")];
  if (els.length < 2) return;
  const ids = els.map((el) => (el.getAttribute("href") ?? "").replace(/^#/, ""));
  const startY = e.clientY;
  const rects = els.map((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: r.height };
  });
  let dragging = false;
  let drop: { index: number; side: "before" | "after" } | null = null;

  const clearDrop = (): void => {
    for (const el of els) el.classList.remove("nav-drop-before", "nav-drop-after");
  };

  const onMove = (ev: PointerEvent): void => {
    const dy = ev.clientY - startY;
    if (!dragging) {
      if (Math.abs(dy) < 6) return;
      dragging = true;
      target.classList.add("nav-dragging");
      try {
        target.setPointerCapture(ev.pointerId);
      } catch {
        /* noop */
      }
    }
    ev.preventDefault();
    target.style.transform = `translateY(${dy}px)`;
    const y = ev.clientY;
    let index = -1;
    let side: "before" | "after" = "before";
    for (let i = 0; i < rects.length; i++) {
      if (y >= rects[i].top && y <= rects[i].bottom) {
        index = i;
        side = y < rects[i].top + rects[i].height / 2 ? "before" : "after";
        break;
      }
    }
    if (index === -1) {
      if (y < rects[0].top) {
        index = 0;
        side = "before";
      } else {
        index = rects.length - 1;
        side = "after";
      }
    }
    clearDrop();
    els[index].classList.add(side === "before" ? "nav-drop-before" : "nav-drop-after");
    drop = { index, side };
  };

  const teardown = (): void => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    target.style.transform = "";
    target.classList.remove("nav-dragging");
    clearDrop();
  };
  const onUp = (): void => {
    const wasDragging = dragging;
    const result = drop;
    teardown();
    if (!wasDragging) return;
    navDragSuppress = true;
    window.setTimeout(() => {
      navDragSuppress = false;
    }, 0);
    if (!result) return;
    const next = moveInOrder(ids, id, ids[result.index], result.side);
    if (next.some((v, i) => v !== ids[i])) {
      store.settings = { ...store.settings, navOrder: next };
      saveSettings();
    }
  };
  const onCancel = (): void => {
    teardown();
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
}

function scrollToColumn(id: string): void {
  document
    .querySelector<HTMLElement>(`[data-shortcut-id="${CSS.escape(id)}"]`)
    ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
}

function usePathActive(): (href: string) => boolean {
  const route = useRouter();
  return (href: string) =>
    href === "/" ? route.path === "/" : route.path === href || route.path.startsWith(`${href}/`);
}

function Rail(): JSX.Element | null {
  const pathActive = usePathActive();
  const route = useRouter();
  const state = useAppState();
  const me = state.me;
  const account = currentAccount();
  const shortcuts = useSnapshot(store).shortcuts;
  const railShortcuts = shortcuts.filter((s) => !NAV_COLUMN_TYPES.has(s.type));
  const expanded = state.settings.railExpanded;
  const multi = route.path === "/";

  if (!account && state.auth !== "authenticated") return null;

  const hasColumn = (type: ShortcutType): boolean => shortcuts.some((s) => s.type === type);

  const orderedNav = orderColumns(NAV_ITEMS, state.settings.navOrder ?? []);

  const openColumn = (item: (typeof NAV_ITEMS)[number]): void => {
    const type = item.column;
    if (!type) return;
    const existing = store.shortcuts.find((s) => s.type === type);
    if (existing) {
      scrollToColumn(existing.id);
      return;
    }
    saveShortcuts([...store.shortcuts, { id: type, type, label: t[item.labelKey] }]);
    window.setTimeout(() => scrollToColumn(type), 60);
  };

  const navActive = (item: (typeof NAV_ITEMS)[number]): boolean =>
    multi && item.column
      ? hasColumn(item.column)
      : item.popup === "search"
        ? pathActive(item.href) || state.ui.searchOpen
        : pathActive(item.href);

  return (
    <nav class={`rail ${expanded ? "" : "collapsed"}`} aria-label={t.navHelp}>
      <Link href="/" class="rail-logo" title="OLTN">
        <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden>
          <circle cx="32" cy="34" r="17" fill="none" stroke="currentColor" strokeWidth="7" />
          <circle cx="32" cy="17" r="8" fill="currentColor" />
        </svg>
      </Link>
      <button
        type="button"
        class="rail-toggle"
        aria-expanded={expanded}
        aria-label={expanded ? t.collapseNav : t.expandNav}
        title={expanded ? t.collapseNav : t.expandNav}
        onClick={() => {
          store.settings = { ...store.settings, railExpanded: !expanded };
          saveSettings();
        }}
      >
        <Icon
          name={expanded ? "layout-leftbar-close-line" : "layout-leftbar-open-line"}
          size={18}
        />
      </button>
      <div class="rail-main">
        {orderedNav.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            class={`rail-item ${navActive(item) ? "active" : ""}`}
            title={t[item.labelKey]}
            ariaCurrent={navActive(item) ? "page" : undefined}
            draggable={false}
            onPointerDown={(e) => startNavDrag(e, item.id)}
            onClick={(e) => {
              if (navDragSuppress) {
                e.preventDefault();
                return;
              }
              if (item.popup === "search") {
                e.preventDefault();
                store.ui.searchOpen = true;
                return;
              }
              if (!multi || !item.column) return;
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              openColumn(item);
            }}
          >
            <span style={{ position: "relative", display: "grid" }}>
              <Icon name={navActive(item) ? item.iconActive : item.icon} size={22} />
              {item.badge && state.notifBadge > 0 && (
                <span class="badge">{state.notifBadge > 99 ? "99+" : state.notifBadge}</span>
              )}
            </span>
            <span>{t[item.labelKey]}</span>
          </Link>
        ))}
      </div>
      {railShortcuts.length > 0 && (
        <div class="rail-shortcuts">
          {railShortcuts.map((shortcut) => (
            <Link
              key={shortcut.id}
              href={shortcutRoute(shortcut)}
              class={`rail-item ${pathActive(shortcutRoute(shortcut)) ? "active" : ""}`}
              title={shortcutLabel(shortcut)}
              ariaCurrent={pathActive(shortcutRoute(shortcut)) ? "page" : undefined}
              onClick={(e) => {
                if (!multi) return;
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                const index = store.shortcuts.findIndex((s) => s.id === shortcut.id);
                if (index >= 0 && index < 6) {
                  e.preventDefault();
                  scrollToColumn(shortcut.id);
                }
              }}
            >
              <Icon name={iconForShortcut(shortcut)} size={20} />
              <span>{shortcutLabel(shortcut)}</span>
            </Link>
          ))}
        </div>
      )}
      <button
        type="button"
        class="rail-compose"
        title={t.composePost}
        aria-label={t.composePost}
        onClick={() => setCompose({ mode: "new" })}
      >
        <Icon name="pencil-fill" size={20} />
      </button>
      {me && account && (
        <div class="rail-account">
          <Link
            href={`/${encodeURIComponent(account.instance)}/a/${me.id}`}
            title={account.handle}
            ariaLabel={account.handle}
          >
            <Avatar
              src={me.avatarStatic || me.avatar}
              name={me.displayName || me.username}
              size={38}
            />
          </Link>
        </div>
      )}
    </nav>
  );
}

function iconForShortcut(shortcut: Shortcut): string {
  switch (shortcut.type) {
    case "home":
      return "home-3-line";
    case "local":
      return "globe-line";
    case "federated":
      return "rocket-line";
    case "notifications":
      return "notification-line";
    case "mentions":
      return "at-line";
    case "direct":
      return "mail-line";
    case "bookmarks":
      return "bookmark-line";
    case "favourites":
      return "heart-line";
    case "trending":
      return "trending-up-line";
    case "list":
      return "list-check-line";
    case "hashtag":
      return "hashtag-line";
    default:
      return "quill-pen-line";
  }
}

function TabBar(): JSX.Element {
  const pathActive = usePathActive();
  const state = useAppState();
  const me = state.me;
  const account = currentAccount();
  const items = [
    { href: "/", icon: "home-3-line", label: t.home },
    {
      href: "/notifications",
      icon: "notification-line",
      label: t.notifications,
      badge: state.notifBadge,
    },
    { href: "/search", icon: "search-2-line", label: t.search, popup: true },
    {
      href: me && account ? `/${encodeURIComponent(account.instance)}/a/${me.id}` : "/login",
      icon: "user-3-line",
      label: t.profile,
    },
  ];
  return (
    <nav class="tabbar" aria-label={t.navHelp}>
      {items.map((item) => (
        <Link
          key={item.href + item.label}
          href={item.href}
          class={`tabbar-item ${pathActive(item.href) ? "active" : ""}`}
          ariaCurrent={pathActive(item.href) ? "page" : undefined}
          onClick={(e) => {
            if (item.popup) {
              e.preventDefault();
              store.ui.searchOpen = true;
            }
          }}
        >
          <span style={{ position: "relative", display: "grid" }}>
            <Icon name={item.icon} size={22} />
            {!!item.badge && <span class="badge">{item.badge > 99 ? "99+" : item.badge}</span>}
          </span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function ComposeFab(): JSX.Element {
  return (
    <button
      type="button"
      class="fab"
      aria-label={t.composePost}
      onClick={() => setCompose({ mode: "new" })}
    >
      <Icon name="pencil-fill" size={22} />
    </button>
  );
}

/* ---------------- multi-coluna (arrastar p/ reordenar e redimensionar) ---------------- */

let activeDndCleanup: (() => void) | null = null;

function columnIds(els: HTMLElement[]): string[] {
  return els.map((el) => el.dataset["shortcutId"] ?? "");
}

export function MultiColumns(): JSX.Element {
  const snap = useSnapshot(store);
  const shortcuts = snap.shortcuts;
  const account = currentAccount();
  const layout = account ? snap.prefs[accountNS(account)] : undefined;
  const widths: Record<string, number> = layout?.columnWidths ?? {};
  const list = orderColumns(shortcuts.slice(0, 6), layout?.columnOrder ?? []);

  useEffect(() => () => activeDndCleanup?.(), []);

  const startReorder = (e: PointerEvent, id: string): void => {
    if (e.button > 0) return;
    const grip = e.currentTarget as HTMLElement;
    const col = grip.closest(".column") as HTMLElement | null;
    const container = col?.parentElement;
    if (!col || !container) return;
    e.preventDefault();
    try {
      grip.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    const els = [...container.querySelectorAll<HTMLElement>(".column")];
    if (!els.length) return;
    const rects = els.map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width };
    });
    const ids = columnIds(els);
    const startX = e.clientX;
    let drop: { index: number; side: "before" | "after" } | null = null;

    const clearDrop = (): void => {
      for (const el of els) el.classList.remove("drop-before", "drop-after");
    };

    const onMove = (ev: PointerEvent): void => {
      col.style.transform = `translateX(${ev.clientX - startX}px)`;
      const x = ev.clientX;
      let index = -1;
      let side: "before" | "after" = "before";
      for (let i = 0; i < rects.length; i++) {
        if (x >= rects[i].left && x <= rects[i].right) {
          index = i;
          side = x < rects[i].left + rects[i].width / 2 ? "before" : "after";
          break;
        }
      }
      if (index === -1) {
        if (x < rects[0].left) {
          index = 0;
          side = "before";
        } else {
          index = rects.length - 1;
          side = "after";
        }
      }
      clearDrop();
      els[index].classList.add(side === "before" ? "drop-before" : "drop-after");
      drop = { index, side };
    };

    const teardown = (commit: boolean): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onEsc, true);
      if (activeDndCleanup === cleanup) activeDndCleanup = null;
      col.style.transform = "";
      col.classList.remove("dragging");
      clearDrop();
      if (!commit || !drop) return;
      const targetId = ids[drop.index];
      const next = moveInOrder(ids, id, targetId, drop.side);
      if (next.some((v, i) => v !== ids[i])) saveColumnLayout(next, widths);
    };
    const onUp = (): void => teardown(true);
    const onCancel = (): void => teardown(false);
    const onEsc = (ev: KeyboardEvent): void => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        teardown(false);
      }
    };
    const cleanup = (): void => teardown(false);

    col.classList.add("dragging");
    activeDndCleanup = cleanup;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onEsc, true);
  };

  const startResize = (e: PointerEvent, id: string): void => {
    if (e.button > 0) return;
    const handle = e.currentTarget as HTMLElement;
    const col = handle.closest(".column") as HTMLElement | null;
    if (!col) return;
    e.preventDefault();
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    const startX = e.clientX;
    const startW = col.getBoundingClientRect().width;
    const baseWidth = widths[id];
    let width = startW;

    const apply = (w: number): void => {
      width = w;
      col.classList.add("with-width");
      col.style.setProperty("--col-w", `${Math.round(w)}px`);
      handle.setAttribute("aria-valuenow", String(Math.round(w)));
    };

    const restoreDom = (): void => {
      if (baseWidth != null) {
        col.style.setProperty("--col-w", `${baseWidth}px`);
        handle.setAttribute("aria-valuenow", String(baseWidth));
      } else {
        col.style.removeProperty("--col-w");
        col.classList.remove("with-width");
        handle.setAttribute("aria-valuenow", String(Math.round(startW)));
      }
    };

    const onMove = (ev: PointerEvent): void => apply(clampWidth(startW + (ev.clientX - startX)));

    const teardown = (commit: boolean): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onEsc, true);
      if (activeDndCleanup === cleanup) activeDndCleanup = null;
      col.classList.remove("resizing");
      if (!commit) {
        restoreDom();
        return;
      }
      if (Math.round(width) !== Math.round(startW) || baseWidth != null) {
        saveColumnLayout(
          list.map((s) => s.id),
          { ...widths, [id]: Math.round(width) },
        );
      }
    };
    const onUp = (): void => teardown(true);
    const onEsc = (ev: KeyboardEvent): void => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        teardown(false);
      }
    };
    const cleanup = (): void => teardown(false);

    col.classList.add("resizing");
    activeDndCleanup = cleanup;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onEsc, true);
  };

  return (
    <div class="columns" id="main" tabindex={-1}>
      {list.map((shortcut) => {
        const width = widths[shortcut.id];
        return (
          <section
            class={`column ${width ? "with-width" : ""}`}
            key={shortcut.id}
            data-shortcut-id={shortcut.id}
            style={width ? `--col-w:${width}px` : undefined}
          >
            <header class="deck-header">
              <button
                type="button"
                class="col-grip"
                title={`${t.reorderColumn}: ${shortcut.label}`}
                aria-label={`${t.reorderColumn}: ${shortcut.label}`}
                onPointerDown={(e) => startReorder(e, shortcut.id)}
              />
              <Icon name={iconForShortcut(shortcut)} size={18} />
              <h1>{shortcutLabel(shortcut)}</h1>
              <div class="spacer" />
              <button
                type="button"
                class="icon-btn col-close"
                title={t.closeColumn}
                aria-label={`${t.closeColumn}: ${shortcutLabel(shortcut)}`}
                onClick={() => saveShortcuts(store.shortcuts.filter((s) => s.id !== shortcut.id))}
              >
                <Icon name="close-line" size={15} />
              </button>
            </header>
            <div class="deck-body">
              <ColumnContent
                shortcut={shortcut}
                instance={account?.instance}
                accountId={account?.id}
              />
            </div>
            <div
              class="col-resize"
              role="separator"
              aria-orientation="vertical"
              aria-label={`${t.resizeColumn}: ${shortcut.label}`}
              aria-valuemin={COLUMN_MIN}
              aria-valuemax={COLUMN_MAX}
              aria-valuenow={width != null ? Math.round(width) : undefined}
              tabIndex={0}
              onPointerDown={(e) => startResize(e, shortcut.id)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                e.preventDefault();
                const col = (e.currentTarget as HTMLElement).closest(
                  ".column",
                ) as HTMLElement | null;
                if (!col) return;
                const current = col.getBoundingClientRect().width;
                const next = clampWidth(current + (e.key === "ArrowRight" ? 16 : -16));
                saveColumnLayout(
                  list.map((s) => s.id),
                  { ...widths, [shortcut.id]: next },
                );
              }}
            />
          </section>
        );
      })}
      {!list.length && (
        <section class="column">
          <div class="center-state">
            <Icon name="list-check-line" size={28} />
            <p>{t.pinHint}</p>
          </div>
        </section>
      )}
    </div>
  );
}

function ColumnContent({
  shortcut,
  instance,
  accountId,
}: {
  shortcut: Shortcut;
  instance?: string;
  accountId?: string;
}): JSX.Element {
  switch (shortcut.type) {
    case "home":
      return <Timeline kind={{ type: "home" }} instance={instance} listenQueue />;
    case "local":
      return <Timeline kind={{ type: "public", local: true }} instance={instance} />;
    case "federated":
      return <Timeline kind={{ type: "public" }} instance={instance} />;
    case "notifications":
      return instance ? <NotificationsFeed instance={instance} /> : <div />;
    case "mentions":
      return instance ? <NotificationsFeed instance={instance} mode="mentions" /> : <div />;
    case "direct":
      return instance ? <ConversationsFeed instance={instance} /> : <div />;
    case "bookmarks":
      return <Timeline kind={{ type: "bookmarks" }} instance={instance} />;
    case "favourites":
      return <Timeline kind={{ type: "favourites" }} instance={instance} />;
    case "boosts":
      return accountId ? (
        <Timeline kind={{ type: "boosts", accountId }} instance={instance} />
      ) : (
        <div />
      );
    case "trending":
      return <TrendingFeed instance={instance} />;
    case "list":
      return <Timeline kind={{ type: "list", listId: shortcut.value ?? "" }} instance={instance} />;
    case "hashtag":
      return <Timeline kind={{ type: "tag", tag: shortcut.value ?? "" }} instance={instance} />;
    default:
      return <div />;
  }
}

/* ---------------- roteamento + guard ---------------- */

export function Routed(): JSX.Element {
  const route = useRouter();
  const state = useAppState();
  const me = state.me;
  const account = currentAccount();

  useEffect(() => {
    if (!state.booted) return;
    if (state.auth === "anonymous" && route.path !== "/login") {
      navigate("/login", { replace: true });
    } else if (state.auth === "authenticated" && route.path === "/login") {
      navigate("/", { replace: true });
    }
  }, [state.booted, state.auth, route.path]);

  const match = matchRoutes(routes, route.path);
  const Page = match?.def.page;
  const needAuth = match?.def.auth;
  const authed = state.auth === "authenticated";

  const profileHref =
    me && account ? `/${encodeURIComponent(account.instance)}/a/${me.id}` : "/login";

  useGotoHotkeys(profileHref);
  useFocusHotkeys();
  useEscapeHotkeys();

  const multi = authed && route.path === "/";

  if (needAuth && !authed) {
    return (
      <main class="deck">
        <div class="center-state" style={{ height: "100%" }}>
          <span class="spinner" />
        </div>
      </main>
    );
  }

  return (
    <Shell>
      {multi ? (
        <MultiColumns />
      ) : (
        <main
          class={`deck ${route.path === "/login" ? "full" : ""} ${match?.def.centered ? "centered" : ""}`}
          id="main"
          tabindex={-1}
        >
          {Page && match ? (
            <Page params={match.params} query={route.query} />
          ) : (
            <>
              <header class="deck-header">
                <h1>{t.pageNotFound}</h1>
              </header>
              <div class="center-state">
                <Icon name="question-line" size={28} />
                <button type="button" class="btn ghost" onClick={() => navigate("/")}>
                  {t.goHome}
                </button>
              </div>
            </>
          )}
        </main>
      )}
    </Shell>
  );
}

/* ---------------- hotkeys globais ---------------- */

function useGotoHotkeys(profileHref: string): void {
  const map = useMemo(
    () => ({
      "g h": () => navigate("/"),
      "g n": () => navigate("/notifications"),
      "g m": () => navigate("/mentions"),
      "g b": () => navigate("/b"),
      "g f": () => navigate("/f"),
      "g l": () => navigate("/l"),
      "g t": () => navigate("/trending"),
      "g s": () => navigate("/settings"),
      "g p": () => navigate(profileHref),
      c: () => setCompose({ mode: "new" }),
      "/": () => {
        store.ui.searchOpen = true;
      },
      "?": () => {
        store.ui.shortcutsHelp = !store.ui.shortcutsHelp;
      },
      "1": () => navigateByShortcutIndex(0),
      "2": () => navigateByShortcutIndex(1),
      "3": () => navigateByShortcutIndex(2),
      "4": () => navigateByShortcutIndex(3),
      "5": () => navigateByShortcutIndex(4),
      "6": () => navigateByShortcutIndex(5),
    }),
    [profileHref],
  );
  useHotkeys(map, true);
}

function navigateByShortcutIndex(index: number): void {
  const shortcut = store.shortcuts[index];
  if (shortcut) navigate(shortcutRoute(shortcut));
}

let focusedIndex = -1;

function visibleCards(): HTMLElement[] {
  return [
    ...document.querySelectorAll<HTMLElement>(
      ".deck-body .status-card, .column .deck-body .status-card",
    ),
  ];
}

function setFocused(index: number): void {
  const cards = visibleCards();
  if (!cards.length) return;
  for (const card of cards) card.classList.remove("is-focused");
  focusedIndex = Math.max(0, Math.min(index, cards.length - 1));
  const card = cards[focusedIndex];
  card.classList.add("is-focused");
  card.scrollIntoView({ block: "nearest" });
}

function useFocusHotkeys(): void {
  useHotkeys(
    {
      j: () => setFocused(focusedIndex + 1),
      k: () => setFocused(focusedIndex - 1),
      o: () => {
        const cards = visibleCards();
        cards[focusedIndex]?.click();
      },
      enter: () => {
        const cards = visibleCards();
        cards[focusedIndex]?.click();
      },
    },
    true,
  );
}

function useEscapeHotkeys(): void {
  useHotkeys(
    {
      esc: () => {
        store.ui.shortcutsHelp = false;
        setCompose(null);
        setMediaViewer(null);
      },
    },
    true,
  );
}
