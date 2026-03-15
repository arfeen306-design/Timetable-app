import { describe, it, expect } from "vitest";
import { calculateCurrentSlot } from "./useLivePeriod";

/* ── Shared fixture ──────────────────────────────────────────────────────────
   Three consecutive slots with NO gap between them:
     L1: 09:00 – 09:45  (lesson)
   Break: 09:45 – 10:00 (break)
     L2: 10:00 – 10:45  (lesson)
   ────────────────────────────────────────────────────────────────────────── */
const SLOTS = [
  { start_time: "09:00", end_time: "09:45", type: "lesson" as const, label: "L1", lesson_number: 1 },
  { start_time: "09:45", end_time: "10:00", type: "break"  as const, label: "Break" },
  { start_time: "10:00", end_time: "10:45", type: "lesson" as const, label: "L2", lesson_number: 2 },
];

describe("calculateCurrentSlot", () => {
  it("mid-lesson: returns the active slot with correct minutesRemaining", () => {
    // 09:20 = 560 min  →  inside L1 (09:00–09:45), 25 min left
    const r = calculateCurrentSlot(SLOTS, 9 * 60 + 20);
    expect(r.currentIndex).toBe(0);
    expect(r.currentSlot?.label).toBe("L1");
    expect(r.minutesRemaining).toBe(25);
    expect(r.isOffDay).toBe(false);
  });

  it("between lessons: returns -1 when nowMinutes falls in a true gap", () => {
    // Custom slots with a gap: L1 ends 09:45, L2 starts 10:00 → gap 09:45–10:00
    const gapped = [
      { start_time: "09:00", end_time: "09:45", type: "lesson" as const, label: "L1" },
      { start_time: "10:00", end_time: "10:45", type: "lesson" as const, label: "L2" },
    ];
    // 09:50 = 590 min  →  between the two lessons
    const r = calculateCurrentSlot(gapped, 9 * 60 + 50);
    expect(r.currentIndex).toBe(-1);
    expect(r.currentSlot).toBeNull();
    expect(r.minutesRemaining).toBe(0);
    expect(r.isOffDay).toBe(false);
  });

  it("before first slot: returns -1 when school has not started", () => {
    // 07:00 = 420 min  →  before 09:00 start
    const r = calculateCurrentSlot(SLOTS, 7 * 60);
    expect(r.currentIndex).toBe(-1);
    expect(r.currentSlot).toBeNull();
    expect(r.isOffDay).toBe(false);
  });

  it("after last slot: returns -1 when school day has ended", () => {
    // 16:00 = 960 min  →  after L2 ends at 10:45
    const r = calculateCurrentSlot(SLOTS, 16 * 60);
    expect(r.currentIndex).toBe(-1);
    expect(r.currentSlot).toBeNull();
    expect(r.minutesRemaining).toBe(0);
  });

  it("empty slot list: returns isOffDay=true regardless of time", () => {
    const r = calculateCurrentSlot([], 10 * 60);
    expect(r.isOffDay).toBe(true);
    expect(r.currentIndex).toBe(-1);
    expect(r.currentSlot).toBeNull();
    expect(r.minutesRemaining).toBe(0);
  });
});
