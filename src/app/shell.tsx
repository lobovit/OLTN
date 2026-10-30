import type { ComponentChildren, JSX } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import type { ShortcutType } from "../api/types";
import { HomeGalleryToggle } from "../components/feed/HomeGalleryToggle";
import { Icon } from "../components/ui/Icon";
import { Avatar } from "../components/ui/Avatar";
import { Sheet } from "../components/ui/Sheet";
import { t, type TKey } from "../i18n/pt-BR";
import { focusableCards, nextFocusIndex } from "../lib/deck-focus";
import { bringToFront, stackOrder } from "../lib/floats";
import { formatDuration } from "../lib/format";
import { useHotkeys } from "../lib/hotkeys";
import { beginPointerDrag, dropTarget, type DropTarget } from "../lib/pointer-drag";
import {
  clampWidth,
  COLUMN_LIMIT,
  ensureColumnVisible,
  moveInOrder,
  orderColumns,
  routeMode,
} from "../lib/layout";
import { backOrHome, Link, matchRoutes, navigate, useRouter } from "../lib/router";
import { shortcutLabel, shortcutRoute } from "./shortcuts";
import { routes } from "./routes";
import { ColumnContent, iconForShortcut } from "./column-content";
import { SocialHome, SocialNav, SocialSidebar } from "./social";
import { FloatCanvas } from "./floats";
import { PanelColorButton } from "./panel-color";
import { saveColumnLayout, saveFloatLayout, saveSettings, saveShortcuts } from "../state/boot";
import { accountNS, currentAccount, setCompose, setMediaViewer, store } from "../state/store";
import { useAppState, useIsDesktop } from "../state/hooks";

export function Shell({
  children,
  social = false,
}: {
  children?: ComponentChildren;
  social?: boolean;
}): JSX.Element {
  const state = useAppState();
  const authed = state.auth === "authenticated";
  const showRail = authed || !!currentAccount();
  return (
    <div class={`shell ${showRail ? "rail-collapsed" : "shell-no-rail"} ${social ? "social" : ""}`}>
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
      {!social && <Rail />}
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

/* ---------------- navigation ---------------- */

const NAV_ITEMS: {
  id: string;
  href: string;
  icon: string;
  iconActive: string;
  labelKey: TKey;
  badge?: boolean;
  column?: ShortcutType;
  popup?: "search";
  action?: "timer" | "help";
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
    id: "/p/l",
    href: "/p/l",
    icon: "globe-line",
    iconActive: "globe-line",
    labelKey: "local",
    column: "local",
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
    id: "/newsletter",
    href: "/newsletter",
    icon: "news-line",
    iconActive: "news-fill",
    labelKey: "newsletter",
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
    id: "/apps",
    href: "/apps",
    icon: "planet-line",
    iconActive: "planet-fill",
    labelKey: "fediverseApps",
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
    id: "/scheduled",
    href: "/scheduled",
    icon: "calendar-line",
    iconActive: "calendar-line",
    labelKey: "scheduledPosts",
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
  {
    id: "/pomodoro",
    href: "/pomodoro",
    icon: "time-line",
    iconActive: "time-line",
    labelKey: "pomodoro",
    action: "timer",
  },
  {
    id: "/help",
    href: "/help",
    icon: "question-line",
    iconActive: "question-line",
    labelKey: "help",
    action: "help",
  },
];

let navDragSuppress = false;

/* Types already represented by nav buttons — do not repeat in rail shortcuts */
const NAV_COLUMN_TYPES = new Set(NAV_ITEMS.flatMap((item) => (item.column ? [item.column] : [])));

function startNavDrag(e: PointerEvent, id: string): void {
  const target = e.currentTarget as HTMLElement;
  const wrap = target.parentElement;
  if (!wrap) return;
  const els = [...wrap.querySelectorAll<HTMLElement>("a.rail-item, button.rail-item")];
  if (els.length < 2) return;
  const ids = els.map(
    (el) => el.dataset.navId ?? (el.getAttribute("href") ?? "").replace(/^#/, ""),
  );
  const extents = els.map((el) => {
    const r = el.getBoundingClientRect();
    return { start: r.top, end: r.bottom };
  });
  let drop: DropTarget | null = null;

  const clearDrop = (): void => {
    for (const el of els) el.classList.remove("nav-drop-before", "nav-drop-after");
  };

  beginPointerDrag(e, {
    threshold: 6,
    onStart: () => {
      target.classList.add("nav-dragging");
    },
    onMove: (ctx) => {
      target.style.transform = `translateY(${ctx.delta.y}px)`;
      drop = dropTarget(extents, ctx.event.clientY);
      clearDrop();
      if (drop) {
        els[drop.index].classList.add(
          drop.side === "before" ? "nav-drop-before" : "nav-drop-after",
        );
      }
    },
    onCommit: () => {
      target.style.transform = "";
      target.classList.remove("nav-dragging");
      clearDrop();
      if (!drop) return;
      navDragSuppress = true;
      window.setTimeout(() => {
        navDragSuppress = false;
      }, 0);
      const next = moveInOrder(ids, id, ids[drop.index], drop.side);
      if (next.some((v, i) => v !== ids[i])) {
        store.settings = { ...store.settings, navOrder: next };
        saveSettings();
      }
    },
    onCancel: () => {
      target.style.transform = "";
      target.classList.remove("nav-dragging");
      clearDrop();
    },
  });
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
  const desktop = useIsDesktop();
  const me = state.me;
  const account = currentAccount();
  const shortcuts = useSnapshot(store).shortcuts;
  const railShortcuts = shortcuts.filter((s) => !NAV_COLUMN_TYPES.has(s.type));
  const mode = routeMode(
    route.path,
    state.auth === "authenticated",
    state.settings.layout,
    desktop,
  );

  if (!account && state.auth !== "authenticated") return null;

  const hasColumn = (type: ShortcutType): boolean => shortcuts.some((s) => s.type === type);

  const orderedNav = orderColumns(NAV_ITEMS, state.settings.navOrder ?? []);

  const openColumn = (item: (typeof NAV_ITEMS)[number]): void => {
    const type = item.column;
    if (!type) return;
    const existing = store.shortcuts.find((s) => s.type === type);
    const shortcut = existing ?? { id: type, type, label: t[item.labelKey] };
    const next = ensureColumnVisible(store.shortcuts, shortcut);
    const changed =
      next.length !== store.shortcuts.length ||
      next.some((s, index) => s.id !== store.shortcuts[index]?.id);
    if (changed) saveShortcuts(next);
    // Waits for the render when order/list changed before scrolling to the column.
    window.setTimeout(() => scrollToColumn(shortcut.id), changed ? 60 : 0);
  };

  const openFloat = (item: (typeof NAV_ITEMS)[number]): void => {
    const type = item.column;
    if (!type || !account) return;
    const existing = store.shortcuts.find((s) => s.type === type);
    const shortcut = existing ?? { id: type, type, label: t[item.labelKey] };
    const next = ensureColumnVisible(store.shortcuts, shortcut);
    const changed =
      next.length !== store.shortcuts.length ||
      next.some((s, index) => s.id !== store.shortcuts[index]?.id);
    if (changed) saveShortcuts(next);
    bringShortcutFront(shortcut.id);
  };

  const bringShortcutFront = (id: string): void => {
    if (!account) return;
    const prev = store.prefs[accountNS(account)];
    const ids = orderColumns(store.shortcuts.slice(0, COLUMN_LIMIT), prev?.columnOrder ?? []).map(
      (s) => s.id,
    );
    const order = stackOrder(prev?.floatOrder ?? [], ids);
    if (order[order.length - 1] !== id) {
      saveFloatLayout(prev?.floats ?? {}, bringToFront(order, id));
    }
  };

  const navActive = (item: (typeof NAV_ITEMS)[number]): boolean => {
    if (mode !== "page" && item.column) return hasColumn(item.column);
    if (item.popup === "search") return pathActive(item.href) || state.ui.searchOpen;
    return pathActive(item.href);
  };

  return (
    <nav class="rail collapsed" aria-label={t.navHelp}>
      <Link href="/" class="rail-logo" title="OLTN">
        <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden>
          <circle cx="32" cy="34" r="17" fill="none" stroke="currentColor" strokeWidth="7" />
          <circle cx="32" cy="17" r="8" fill="currentColor" />
        </svg>
      </Link>
      <div class="rail-main">
        {orderedNav.map((item) => {
          if (item.action) {
            const running = item.action === "timer" && state.timer.remainingMs > 0;
            return (
              <button
                key={item.id}
                type="button"
                class={`rail-item ${item.action === "timer" ? "timer-item" : "help-item"} ${
                  running ? "active" : ""
                }`}
                title={t[item.labelKey]}
                aria-label={t[item.labelKey]}
                data-nav-id={item.id}
                onPointerDown={(e) => startNavDrag(e, item.id)}
                onClick={() => {
                  if (navDragSuppress) return;
                  if (item.action === "timer") {
                    store.ui.timerOpen = true;
                  } else {
                    store.ui.helpOpen = true;
                  }
                }}
              >
                <Icon name={item.action === "timer" ? "time-line" : "question-line"} size={22} />
                <span>{running ? formatDuration(state.timer.remainingMs) : t[item.labelKey]}</span>
              </button>
            );
          }
          return (
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
                // Clicking the button of the page you are on closes it.
                if (item.href !== "/" && pathActive(item.href)) {
                  e.preventDefault();
                  backOrHome();
                  return;
                }
                if (!item.column || mode === "page") return;
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                if (mode === "deck") openColumn(item);
                else openFloat(item);
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
          );
        })}
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
                if (mode === "page") return;
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                const index = store.shortcuts.findIndex((s) => s.id === shortcut.id);
                if (index >= 0 && index < 6) {
                  e.preventDefault();
                  if (mode === "deck") scrollToColumn(shortcut.id);
                  else bringShortcutFront(shortcut.id);
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

function TabBar(): JSX.Element {
  const pathActive = usePathActive();
  const state = useAppState();
  const me = state.me;
  const account = currentAccount();
  const [menuOpen, setMenuOpen] = useState(false);
  const items: {
    href: string;
    icon: string;
    label: string;
    badge?: number;
    popup?: boolean;
    menu?: boolean;
  }[] = [
    { href: "/", icon: "home-3-line", label: t.home },
    {
      href: "/notifications",
      icon: "notification-line",
      label: t.notifications,
      badge: state.notifBadge,
    },
    { href: "/search", icon: "search-2-line", label: t.search, popup: true },
    { href: "/menu", icon: "menu-line", label: t.more, menu: true },
    {
      href: me && account ? `/${encodeURIComponent(account.instance)}/a/${me.id}` : "/login",
      icon: "user-3-line",
      label: t.profile,
    },
  ];
  return (
    <>
      <nav class="tabbar" aria-label={t.navHelp}>
        {items.map((item) => {
          const active = item.menu ? menuOpen : pathActive(item.href);
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              class={`tabbar-item ${active ? "active" : ""}`}
              ariaCurrent={active && !item.menu ? "page" : undefined}
              onClick={(e) => {
                if (item.menu) {
                  e.preventDefault();
                  setMenuOpen(true);
                  return;
                }
                if (item.popup) {
                  e.preventDefault();
                  store.ui.searchOpen = true;
                  return;
                }
                // Clicking the button of the page you are on closes it.
                if (item.href !== "/" && pathActive(item.href)) {
                  e.preventDefault();
                  backOrHome();
                }
              }}
            >
              <span style={{ position: "relative", display: "grid" }}>
                <Icon name={item.icon} size={22} />
                {!!item.badge && <span class="badge">{item.badge > 99 ? "99+" : item.badge}</span>}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      {menuOpen && <MoreMenu onClose={() => setMenuOpen(false)} />}
    </>
  );
}

/** Mobile-only sheet with the pinned shortcuts and the remaining nav links. */
function MoreMenu({ onClose }: { onClose: () => void }): JSX.Element {
  const shortcuts = useSnapshot(store).shortcuts;
  const pinned = shortcuts.filter(
    (shortcut) => shortcut.type !== "home" && shortcut.type !== "notifications",
  );
  const pinnedTypes = new Set(pinned.map((shortcut) => shortcut.type));
  const navItems = NAV_ITEMS.filter(
    (item) =>
      item.href !== "/" &&
      item.href !== "/notifications" &&
      !item.popup &&
      !(item.column && pinnedTypes.has(item.column)),
  );
  return (
    <Sheet title={t.more} onClose={onClose} class="mobile-menu">
      {pinned.length > 0 && (
        <section class="menu-section">
          <h3 class="menu-title">{t.shortcuts}</h3>
          {pinned.map((shortcut) => (
            <Link
              key={shortcut.id}
              href={shortcutRoute(shortcut)}
              class="menu-row"
              onClick={onClose}
            >
              <Icon name={iconForShortcut(shortcut)} size={18} />
              <span>{shortcutLabel(shortcut)}</span>
            </Link>
          ))}
        </section>
      )}
      <section class="menu-section">
        <h3 class="menu-title">{t.navigation}</h3>
        {navItems.map((item) =>
          item.action ? (
            <button
              key={item.id}
              type="button"
              class="menu-row"
              onClick={() => {
                if (item.action === "timer") store.ui.timerOpen = true;
                else store.ui.helpOpen = true;
                onClose();
              }}
            >
              <Icon name={item.icon} size={18} />
              <span>{t[item.labelKey]}</span>
            </button>
          ) : (
            <Link key={item.id} href={item.href} class="menu-row" onClick={onClose}>
              <Icon name={item.icon} size={18} />
              <span>{t[item.labelKey]}</span>
            </Link>
          ),
        )}
      </section>
    </Sheet>
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

/* ---------------- multi-column (drag to reorder and resize) ---------------- */

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
  const colors: Record<string, string> = layout?.colors ?? {};
  const list = orderColumns(shortcuts.slice(0, COLUMN_LIMIT), layout?.columnOrder ?? []);

  useEffect(() => () => activeDndCleanup?.(), []);

  const startReorder = (e: PointerEvent, id: string): void => {
    const grip = e.currentTarget as HTMLElement;
    const col = grip.closest(".column") as HTMLElement | null;
    const container = col?.parentElement;
    if (!col || !container) return;
    const els = [...container.querySelectorAll<HTMLElement>(".column")];
    if (!els.length) return;
    const extents = els.map((el) => {
      const r = el.getBoundingClientRect();
      return { start: r.left, end: r.right };
    });
    const ids = columnIds(els);
    let drop: DropTarget | null = null;

    const clearDrop = (): void => {
      for (const el of els) el.classList.remove("drop-before", "drop-after");
    };
    const finish = (commit: boolean): void => {
      col.style.transform = "";
      col.classList.remove("dragging");
      clearDrop();
      if (!commit || !drop) return;
      const targetId = ids[drop.index];
      const next = moveInOrder(ids, id, targetId, drop.side);
      if (next.some((v, i) => v !== ids[i])) saveColumnLayout(next, widths);
    };
    activeDndCleanup = beginPointerDrag(e, {
      onStart: () => col.classList.add("dragging"),
      onMove: (ctx) => {
        col.style.transform = `translateX(${ctx.delta.x}px)`;
        drop = dropTarget(extents, ctx.event.clientX);
        clearDrop();
        if (drop) {
          els[drop.index].classList.add(drop.side === "before" ? "drop-before" : "drop-after");
        }
      },
      onCommit: () => finish(true),
      onCancel: () => finish(false),
    });
  };

  const startResize = (e: PointerEvent, id: string): void => {
    const handle = e.currentTarget as HTMLElement;
    const col = handle.closest(".column") as HTMLElement | null;
    if (!col) return;
    const startW = col.getBoundingClientRect().width;
    const baseWidth = widths[id];
    let width = startW;

    const apply = (w: number): void => {
      width = w;
      col.classList.add("with-width");
      col.style.setProperty("--col-w", `${Math.round(w)}px`);
    };

    const finish = (commit: boolean): void => {
      col.classList.remove("resizing");
      if (!commit) {
        if (baseWidth != null) {
          col.style.setProperty("--col-w", `${baseWidth}px`);
        } else {
          col.style.removeProperty("--col-w");
          col.classList.remove("with-width");
        }
        return;
      }
      if (Math.round(width) !== Math.round(startW) || baseWidth != null) {
        saveColumnLayout(
          list.map((s) => s.id),
          { ...widths, [id]: Math.round(width) },
        );
      }
    };
    activeDndCleanup = beginPointerDrag(e, {
      onStart: () => col.classList.add("resizing"),
      onMove: (ctx) => apply(clampWidth(startW + ctx.delta.x)),
      onCommit: () => finish(true),
      onCancel: () => finish(false),
    });
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
            data-panel-color={colors[shortcut.id]}
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
              {shortcut.type === "home" && <HomeGalleryToggle />}
              <button
                type="button"
                class="icon-btn col-refresh"
                title={t.refresh}
                aria-label={`${t.refresh}: ${shortcutLabel(shortcut)}`}
                onClick={() => {
                  store.ui.feedsRevision += 1;
                }}
              >
                <Icon name="refresh-2-line" size={15} />
              </button>
              <PanelColorButton
                id={shortcut.id}
                color={colors[shortcut.id]}
                label={shortcutLabel(shortcut)}
              />
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
              <ColumnContent shortcut={shortcut} instance={account?.instance} />
            </div>
            <button
              type="button"
              class="col-resize"
              title={`${t.resizeColumn}: ${shortcutLabel(shortcut)}`}
              aria-label={`${t.resizeColumn}: ${shortcutLabel(shortcut)}${
                width ? ` (${Math.round(width)}px)` : ""
              }`}
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

/* ---------------- routing + guard ---------------- */

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

  const desktop = useIsDesktop();
  const mode = routeMode(route.path, authed, state.settings.layout, desktop);
  const wide = !!match?.def.wide;
  // With the float layout, pages center themselves (login keeps its full layout).
  const centerPage =
    !wide && mode === "page" && state.settings.layout === "floats" && route.path !== "/login";

  if (needAuth && !authed) {
    return (
      <main class="deck">
        <div class="center-state" style={{ height: "100%" }}>
          <span class="spinner" />
        </div>
      </main>
    );
  }

  const content =
    Page && match ? (
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
    );

  return (
    <Shell social={mode === "social"}>
      {mode === "social" ? (
        <div class="social-shell">
          <SocialNav />
          <main class="deck social-deck" id="main" tabindex={-1}>
            {route.path === "/" ? <SocialHome /> : content}
          </main>
          <SocialSidebar />
        </div>
      ) : mode === "deck" ? (
        <MultiColumns />
      ) : mode === "floats" ? (
        <FloatCanvas />
      ) : (
        <main
          class={`deck ${route.path === "/login" ? "full" : ""} ${
            !wide && (match?.def.centered || centerPage) ? "centered" : ""
          } ${wide ? "wide" : ""}`}
          id="main"
          tabindex={-1}
        >
          {content}
        </main>
      )}
    </Shell>
  );
}

/* ---------------- global hotkeys ---------------- */

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

function setFocused(index: number): void {
  const cards = focusableCards();
  if (!cards.length) return;
  for (const card of cards) card.classList.remove("is-focused");
  focusedIndex = nextFocusIndex(index, 0, cards.length);
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
        const cards = focusableCards();
        cards[focusedIndex]?.click();
      },
      enter: () => {
        const cards = focusableCards();
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
