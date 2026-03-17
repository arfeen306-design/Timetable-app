import { useState, useEffect, useCallback, useRef } from "react";
import {
  listTeachers,
  listSubjects,
  listClasses,
  listLessons,
  getTimetableHistory,
} from "../api";

export interface ProjectProgress {
  teachers: number;
  subjects: number;
  classes: number;
  lessons: number;
  hasGenerated: boolean;
  loading: boolean;
  /** 0-100 overall setup progress */
  percent: number;
  /** Refresh the counts */
  refresh: () => void;
}

const EMPTY: ProjectProgress = {
  teachers: 0,
  subjects: 0,
  classes: 0,
  lessons: 0,
  hasGenerated: false,
  loading: true,
  percent: 0,
  refresh: () => {},
};

/* ── Lightweight in-memory cache so we don't re-fetch on every page nav ── */
interface CacheEntry {
  data: Omit<ProjectProgress, "refresh">;
  ts: number;
}
const cache = new Map<number, CacheEntry>();
const CACHE_TTL = 5_000; // 5 seconds

export function useProjectProgress(projectId: number | undefined): ProjectProgress {
  const [data, setData] = useState<Omit<ProjectProgress, "refresh">>(() => {
    if (projectId && cache.has(projectId)) {
      const c = cache.get(projectId)!;
      return { ...c.data, loading: false };
    }
    return EMPTY;
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doFetch = useCallback(() => {
    if (!projectId) {
      setData({ ...EMPTY, loading: false });
      return;
    }

    // If we have fresh cache, skip the fetch
    const cached = cache.get(projectId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setData({ ...cached.data, loading: false });
      return;
    }

    // Only show loading if we have no cached data at all
    if (!cached) {
      setData((prev) => ({ ...prev, loading: true }));
    }

    Promise.all([
      listTeachers(projectId).catch(() => []),
      listSubjects(projectId).catch(() => []),
      listClasses(projectId).catch(() => []),
      listLessons(projectId).catch(() => []),
      getTimetableHistory(projectId).catch(() => []),
    ]).then(([t, s, c, l, h]) => {
      const teachers = Array.isArray(t) ? t.length : 0;
      const subjects = Array.isArray(s) ? s.length : 0;
      const classes = Array.isArray(c) ? c.length : 0;
      const lessons = Array.isArray(l) ? l.length : 0;
      const hasGenerated = Array.isArray(h) && h.length > 0;

      // 5 steps: teachers, subjects, classes, lessons, generated
      let done = 0;
      if (teachers > 0) done++;
      if (subjects > 0) done++;
      if (classes > 0) done++;
      if (lessons > 0) done++;
      if (hasGenerated) done++;
      const percent = Math.round((done / 5) * 100);

      const result = { teachers, subjects, classes, lessons, hasGenerated, loading: false, percent };
      cache.set(projectId, { data: result, ts: Date.now() });
      setData(result);
    });
  }, [projectId]);

  // Debounced refresh — prevents hammering API when adding items quickly
  const refresh = useCallback(() => {
    // Invalidate cache so next fetch is fresh
    if (projectId) {
      cache.delete(projectId);
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doFetch, 300);
  }, [projectId, doFetch]);

  useEffect(() => {
    doFetch();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [doFetch]);

  return { ...data, refresh };
}
