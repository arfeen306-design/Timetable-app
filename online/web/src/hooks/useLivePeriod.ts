import { useEffect, useRef, useState } from "react";

/* ── Types ── */
export interface SlotInput {
  start_time:     string;              // "HH:MM"
  end_time:       string;              // "HH:MM"
  type:           "lesson" | "break";
  lesson_number?: number;
  period_index?:  number;
  label:          string;
}

export interface LivePeriodState {
  currentSlot:      SlotInput | null;
  currentIndex:     number;   // -1 when between / before / after all slots
  minutesRemaining: number;   // 0 when no current slot
  isOffDay:         boolean;  // true when slots array is empty
}

/* ── Pure helper (exported for unit tests) ── */
export function calculateCurrentSlot(
  slots: SlotInput[],
  nowMinutes: number,
): LivePeriodState {
  if (!slots.length) {
    return { currentSlot: null, currentIndex: -1, minutesRemaining: 0, isOffDay: true };
  }
  for (let i = 0; i < slots.length; i++) {
    const sl = slots[i];
    const [sh, sm] = sl.start_time.split(":").map(Number);
    const [eh, em] = sl.end_time.split(":").map(Number);
    const start = sh * 60 + sm;
    const end   = eh * 60 + em;
    if (nowMinutes >= start && nowMinutes < end) {
      return {
        currentSlot:      sl,
        currentIndex:     i,
        minutesRemaining: end - nowMinutes,
        isOffDay:         false,
      };
    }
  }
  return { currentSlot: null, currentIndex: -1, minutesRemaining: 0, isOffDay: false };
}

/* ── Internal helper ── */
function getNowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/* ── Hook ── */
export function useLivePeriod(slots: SlotInput[]): LivePeriodState {
  // Keep a ref so the 30s interval always sees the latest slots without
  // needing to restart when new API data arrives.
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  const [state, setState] = useState<LivePeriodState>(() =>
    calculateCurrentSlot(slots, getNowMinutes()),
  );

  // Recalculate immediately whenever the API delivers a fresh slot list.
  useEffect(() => {
    setState(calculateCurrentSlot(slots, getNowMinutes()));
  }, [slots]);

  // Tick every 30 s. Cheap: one setInterval for the lifetime of the component.
  useEffect(() => {
    const id = setInterval(() => {
      setState(calculateCurrentSlot(slotsRef.current, getNowMinutes()));
    }, 30_000);
    return () => clearInterval(id);
  }, []); // mount-only — interval never restarts

  return state;
}
