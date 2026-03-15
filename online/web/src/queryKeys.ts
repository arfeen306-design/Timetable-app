/**
 * Central React Query cache key registry.
 * Import `QK` everywhere to keep keys consistent and enable targeted invalidation.
 */
export const QK = {
  teachers:       ['teachers'] as const,
  teacherSlots:   (id: number) => ['teacher-slots', id] as const,
  freeTeachers:   (date?: string, period?: number) =>
                    ['free-teachers', date, period] as const,
  workload:       (weekId?: number | string) => ['workload', weekId] as const,
  workloadYear:   (teacherId: number) => ['workload-year', teacherId] as const,
  absences:       (date: string) => ['absences', date] as const,
  substitutions:  (date: string) => ['substitutions', date] as const,
  academicWeeks:  ['academic-weeks'] as const,
  academicYear:   ['academic-year'] as const,
  projects:       ['projects'] as const,
} as const;
