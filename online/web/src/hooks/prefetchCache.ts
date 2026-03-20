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

/**
 * Pre-warm cache for a route. Call on tab hover so data is ready
 * when the user navigates. Does nothing if already cached.
 */
export function prefetchRoute(route: string, projectId: number): void {
  // Only import api lazily to avoid circular deps
  import("../api").then(api => {
    const pid = projectId;
    if (route === "dashboard") {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const key = `dash-${pid}`;
      if (!cache.has(key)) {
        api.api(`/api/projects/${pid}/dashboard?tz=${encodeURIComponent(tz)}`)
          .then(d => cache.set(key, { data: d, timestamp: Date.now() }))
          .catch(() => {});
      }
    } else if (route === "substitution") {
      cachedFetch(`sub-teachers-${pid}`, () => api.listTeachers(pid), 60_000).catch(() => {});
      cachedFetch(`sub-weeks-${pid}`, () => api.listAcademicWeeks(pid), 60_000).catch(() => {});
    } else if (route === "exam-duties") {
      cachedFetch(`exam-teachers-${pid}`, () => api.listTeachers(pid), 60_000).catch(() => {});
      cachedFetch(`exam-subjects-${pid}`, () => api.listSubjects(pid), 60_000).catch(() => {});
      cachedFetch(`exam-rooms-${pid}`, () => api.listRooms(pid), 60_000).catch(() => {});
      cachedFetch(`exam-sessions-${pid}`, () => api.listExamSessions(pid), 15_000).catch(() => {});
    } else if (route === "duty-roster") {
      cachedFetch(`duty-teachers-${pid}`, () => api.listTeachers(pid), 60_000).catch(() => {});
      cachedFetch(`duty-areas-${pid}`, () => api.listDutyAreas(pid), 15_000).catch(() => {});
      cachedFetch(`duty-rows-${pid}`, () => api.listDutyRosterRows(pid), 15_000).catch(() => {});
      cachedFetch(`duty-entries-${pid}`, () => api.listDutyEntriesV2(pid), 15_000).catch(() => {});
    } else if (route === "committees") {
      cachedFetch(`comm-teachers-${pid}`, () => api.listTeachers(pid), 60_000).catch(() => {});
      cachedFetch(`comm-list-${pid}`, () => api.listCommittees(pid), 15_000).catch(() => {});
    } else if (route === "review") {
      cachedFetch(`rev-classes-${pid}`, () => api.listClasses(pid), 60_000).catch(() => {});
      cachedFetch(`rev-teachers-${pid}`, () => api.listTeachers(pid), 60_000).catch(() => {});
      cachedFetch(`rev-rooms-${pid}`, () => api.listRooms(pid), 60_000).catch(() => {});
      cachedFetch(`rev-settings-${pid}`, () =>
        fetch(`/api/projects/${pid}/school-settings`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("timetable_token")}` }
        }).then(r => r.json()), 60_000
      ).catch(() => {});
    }
  }).catch(() => {});
}

/**
 * Preload heavy lazy-loaded page chunks so they are cached in the browser.
 * This prevents the delay of fetching JS from Railway on first click.
 */
export function preloadLazyChunks(): void {
  import("../pages/Review").catch(() => {});
  import("../pages/Export").catch(() => {});
  import("../pages/Generate").catch(() => {});
}

/**
 * Pre-warm ALL module tabs at once. Called once when timetable is generated
 * so all tabs open instantly.
 */
export function prefetchAllModules(projectId: number): void {
  for (const route of ["dashboard", "substitution", "duty-roster", "exam-duties", "committees", "review"]) {
    prefetchRoute(route, projectId);
  }
  // Also preload the lazy JS chunks
  preloadLazyChunks();
}
