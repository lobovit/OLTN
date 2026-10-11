/* Simple in-memory cache with TTL. */

interface Entry<T> {
  value: T;
  expires: number;
}

export class TtlCache {
  private store = new Map<string, Entry<unknown>>();

  constructor(private ttlMs: number) {}

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export async function asyncMemo<T>(cache: TtlCache, key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get<T>(key);
  if (hit !== undefined) return hit;
  const value = await fn();
  cache.set(key, value);
  return value;
}
