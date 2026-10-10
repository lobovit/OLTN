const PREFIX = "oltn.";
const LEGACY_PREFIX = "olanta.";

/** Migra chaves do prefixo antigo (Olanta → OLTN), uma única vez. */
export function migrateLegacyStorage(): void {
  try {
    for (const store of [localStorage, sessionStorage]) {
      for (let index = 0; index < store.length; index++) {
        const key = store.key(index);
        if (!key?.startsWith(LEGACY_PREFIX)) continue;
        const next = PREFIX + key.slice(LEGACY_PREFIX.length);
        if (store.getItem(next) == null) {
          store.setItem(next, store.getItem(key) ?? "");
        }
      }
    }
  } catch {
    /* noop */
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota/privado */
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* noop */
  }
}

export function sessionRead<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function sessionWrite(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

export function sessionRemove(key: string): void {
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch {
    /* noop */
  }
}
