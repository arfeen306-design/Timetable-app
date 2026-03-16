import { useState, useEffect, useCallback } from "react";
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

export function useProjectProgress(projectId: number | undefined): ProjectProgress {
  const [data, setData] = useState<Omit<ProjectProgress, "refresh">>(EMPTY);

  const fetch = useCallback(() => {
    if (!projectId) {
      setData({ ...EMPTY, loading: false });
      return;
    }
    setData((prev) => ({ ...prev, loading: true }));

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

      setData({ teachers, subjects, classes, lessons, hasGenerated, loading: false, percent });
    });
  }, [projectId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { ...data, refresh: fetch };
}
