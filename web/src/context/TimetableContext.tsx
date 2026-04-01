import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { listRuns, type TimetableRunSummary } from "../api";

interface TimetableCtx {
  runs: TimetableRunSummary[];
  activeRunId: number | null;
  loading: boolean;
  setActiveRunId: (id: number | null) => void;
  refreshRuns: (projectId: number) => Promise<void>;
}

const TimetableContext = createContext<TimetableCtx>({
  runs: [],
  activeRunId: null,
  loading: false,
  setActiveRunId: () => {},
  refreshRuns: async () => {},
});

const STORAGE_KEY = "myzynca_active_run";

export function TimetableProvider({ children }: { children: ReactNode }) {
  const [runs, setRuns] = useState<TimetableRunSummary[]>([]);
  const [activeRunId, _setActiveRunId] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Number(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const setActiveRunId = useCallback((id: number | null) => {
    _setActiveRunId(id);
    if (id !== null) {
      localStorage.setItem(STORAGE_KEY, String(id));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const refreshRuns = useCallback(async (projectId: number) => {
    setLoading(true);
    try {
      const data = await listRuns(projectId);
      setRuns(data.runs);
      // If stored run no longer exists, fall back to latest completed
      if (data.runs.length > 0) {
        const stored = activeRunId;
        const exists = data.runs.some((r) => r.id === stored);
        if (!exists) {
          const latest = data.runs.find((r) => r.status === "completed");
          setActiveRunId(latest?.id ?? data.runs[0].id);
        }
      } else {
        setActiveRunId(null);
      }
    } catch {
      // Silently fail — review page handles empty state
    } finally {
      setLoading(false);
    }
  }, [activeRunId, setActiveRunId]);

  return (
    <TimetableContext.Provider value={{ runs, activeRunId, loading, setActiveRunId, refreshRuns }}>
      {children}
    </TimetableContext.Provider>
  );
}

export function useTimetable() {
  return useContext(TimetableContext);
}
