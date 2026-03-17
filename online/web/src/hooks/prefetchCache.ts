/**
 * prefetchCache — stale-while-revalidate in-memory cache for API data.
 *
 * Usage:
 *   const data = await cachedFetch("key", () => apiCall(), 30_000);
 *   // Returns cached data instantly if available + age < TTL
 *   // Returns stale data + refreshes in background if age > TTL
 *   // Falls back to fresh fetch if no cache
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Get cached data or fetch fresh. Stale data is returned immediately
 * while a background refresh happens.
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 30_000,
): Promise<T> {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();

  if (entry) {
    const age = now - entry.timestamp;
    if (age < ttlMs) {
      // Fresh — return immediately
      return entry.data;
    }
    // Stale — return stale data, refresh in background
    fetcher().then(data => {
      cache.set(key, { data, timestamp: Date.now() });
    }).catch(() => {}); // silent background refresh
    return entry.data;
  }

  // No cache — must fetch
  const data = await fetcher();
  cache.set(key, { data, timestamp: now });
  return data;
}

/**
 * Manually set cache (useful after optimistic updates).
 */
export function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Invalidate a specific cache key.
 */
export function invalidateCache(key: string): void {
  cache.delete(key);
}

/**
 * Invalidate all cache keys matching a prefix.
 */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}
