import type { ComponentChildren, ComponentType } from "preact";
import { createContext } from "preact";
import { useContext, useEffect, useMemo, useState } from "preact/hooks";

/* Minimal, typed hash-based router. */

export interface ParsedHash {
  path: string;
  query: URLSearchParams;
}

export function parseHash(hash = location.hash): ParsedHash {
  const raw = hash.replace(/^#/, "") || "/";
  const qIndex = raw.indexOf("?");
  const path = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const query = new URLSearchParams(qIndex === -1 ? "" : raw.slice(qIndex + 1));
  return { path: path.startsWith("/") ? path : `/${path}`, query };
}

function matchSegments(
  pattern: string[],
  segments: string[],
  params: Record<string, string>,
): Record<string, string> | null {
  if (pattern.length === 0 && segments.length === 0) return params;
  if (pattern.length === 0) return null;
  const [head, ...restPattern] = pattern;
  if (head.startsWith(":") && head.endsWith("?")) {
    const name = head.slice(1, -1);
    const skipped = matchSegments(restPattern, segments, params);
    if (skipped) return skipped;
    if (segments.length > 0) {
      return matchSegments(restPattern, segments.slice(1), {
        ...params,
        [name]: segments[0],
      });
    }
    return null;
  }
  if (head.startsWith(":")) {
    if (segments.length === 0) return null;
    return matchSegments(restPattern, segments.slice(1), {
      ...params,
      [head.slice(1)]: segments[0],
    });
  }
  if (segments[0] !== head) return null;
  return matchSegments(restPattern, segments.slice(1), params);
}

export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/").filter(Boolean);
  const s = path.split("/").filter(Boolean);
  return matchSegments(p, s, {});
}

export interface RouteMatch<T> {
  def: T;
  params: Record<string, string>;
}

export function matchRoutes<T extends { pattern: string }>(
  routes: T[],
  path: string,
): RouteMatch<T> | null {
  for (const def of routes) {
    const params = matchPath(def.pattern, path);
    if (params) return { def, params };
  }
  return null;
}

/* --- global router state --- */

const listeners = new Set<() => void>();
let current: ParsedHash = parseHash();

function emit() {
  current = parseHash();
  for (const fn of listeners) fn();
}

window.addEventListener("hashchange", emit);

export function navigate(to: string, opts?: { replace?: boolean }): void {
  const path = to.startsWith("/") ? to : `/${to}`;
  const target = `#${path}`;
  if (location.hash === target) return;
  if (opts?.replace) {
    history.replaceState(null, "", target);
    emit();
  } else {
    location.hash = path;
  }
}

export function back(): void {
  history.back();
}

export interface RouterValue extends ParsedHash {
  navigate: typeof navigate;
  back: typeof back;
}

const RouterContext = createContext<RouterValue | null>(null);

export function RouterProvider({ children }: { children: ComponentChildren }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  const value = useMemo<RouterValue>(
    () => ({ path: current.path, query: current.query, navigate, back }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, current.path, current.query.toString()],
  );
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter fora do RouterProvider");
  return ctx;
}

export function Link({
  href,
  children,
  class: className,
  title,
  onClick,
  ariaCurrent,
  ariaLabel,
  draggable,
  onPointerDown,
}: {
  href: string;
  children?: ComponentChildren;
  class?: string;
  title?: string;
  onClick?: (e: MouseEvent) => void;
  ariaCurrent?: "page" | boolean;
  ariaLabel?: string;
  draggable?: boolean;
  onPointerDown?: (e: PointerEvent) => void;
}) {
  return (
    <a
      href={`#${href.startsWith("/") ? href : `/${href}`}`}
      class={className}
      title={title}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      draggable={draggable}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      {children}
    </a>
  );
}

export type PageComponent<P = Record<string, string>> = ComponentType<{
  params: P;
  query: URLSearchParams;
}>;
