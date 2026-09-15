/** Simple in-memory list/query cache with TTL + invalidate */

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 30_000;

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function cacheSet<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function cacheInvalidate(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cacheKey(parts: Array<string | number | boolean | null | undefined>): string {
  return parts.map((p) => (p == null ? '' : String(p))).join('|');
}

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const PAGE_SIZE_STORAGE = 'goldms_rows_per_page';

export function loadStoredPageSize(fallback: PageSize = 10): PageSize {
  try {
    const n = Number(localStorage.getItem(PAGE_SIZE_STORAGE));
    if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return n as PageSize;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function saveStoredPageSize(size: PageSize): void {
  try {
    localStorage.setItem(PAGE_SIZE_STORAGE, String(size));
  } catch {
    /* ignore */
  }
}
