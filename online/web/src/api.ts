const API_BASE = "";

function getToken(): string | null {
  return localStorage.getItem("timetable_token");
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem("timetable_token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiBlob(path: string): Promise<Blob> {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  return res.blob();
}

// Auth
export function login(email: string, password: string) {
  return api<{ access_token: string; user: { email: string; name: string; school_id: number } }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) }
  );
}

export function me() {
  return api<{ id: number; email: string; name: string; school_id: number }>("/api/auth/me");
}

// Projects
export function listProjects() {
  return api<{ id: number; name: string; academic_year: string }[]>("/api/projects");
}

export function getProject(id: number) {
  return api<{ id: number; name: string; academic_year: string }>(`/api/projects/${id}`);
}

export function createProject(data: { name: string; academic_year: string }) {
  return api<{ id: number; name: string; academic_year: string }>("/api/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function createDemoProject() {
  return api<{ id: number; name: string; academic_year: string }>("/api/projects/demo", { method: "POST" });
}

export function deleteProject(id: number) {
  return api<{ ok: boolean; message: string }>(`/api/projects/${id}`, { method: "DELETE" });
}

export function exportProject(id: number, filename: string) {
  return apiBlob(`/api/projects/${id}/export`).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
}

export async function importProject(file: File) {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/projects/import", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  return res.json() as Promise<{ id: number; name: string; academic_year: string }>;
}

// School settings
export function getSchoolSettings(projectId: number) {
  return api<{
    id: number; project_id: number; name: string; academic_year: string;
    days_per_week: number; periods_per_day: number; weekend_days: string; bell_schedule_json: string;
  }>(`/api/projects/${projectId}/school-settings`);
}

export function updateSchoolSettings(projectId: number, data: Partial<{
  name: string; academic_year: string; days_per_week: number; periods_per_day: number;
  period_duration_minutes: number; weekend_days: string; working_days: string;
  school_start_time: string; school_end_time: string;
  friday_start_time: string | null; friday_end_time: string | null;
  saturday_start_time: string | null; saturday_end_time: string | null;
  bell_schedule_json: string; breaks_json: string;
  daily_limits_json: string;
}>) {
  return api(`/api/projects/${projectId}/school-settings`, { method: "PUT", body: JSON.stringify(data) });
}

export type PeriodSlot = { period_index: number; start_time: string; end_time: string; is_break: boolean; break_name: string | null };
export type DaySlots = { day_index: number; day_name: string; slots: PeriodSlot[] };

export function getPeriodSlots(projectId: number) {
  return api<{ days: DaySlots[] }>(`/api/projects/${projectId}/school-settings/period-slots`);
}

// Subjects
export type Subject = { id: number; name: string; code: string; color: string; category: string; max_per_day: number; double_allowed: boolean; preferred_room_type: string };

export function listSubjects(projectId: number) {
  return api<Subject[]>(`/api/projects/${projectId}/subjects`);
}

export function createSubject(projectId: number, data: { name: string; code?: string; color?: string; category?: string; max_per_day?: number; double_allowed?: boolean; preferred_room_type?: string }) {
  return api<Subject>(`/api/projects/${projectId}/subjects`, { method: "POST", body: JSON.stringify(data) });
}

export function updateSubject(projectId: number, id: number, data: Partial<{ name: string; code: string; color: string; category: string; max_per_day: number; double_allowed: boolean; preferred_room_type: string }>) {
  return api<Subject>(`/api/projects/${projectId}/subjects/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteSubject(projectId: number, id: number) {
  return api(`/api/projects/${projectId}/subjects/${id}`, { method: "DELETE" });
}

// Classes
export type SchoolClass = { id: number; name: string; grade: string; section: string; stream: string; code: string; color: string; strength: number; class_teacher_id: number | null; home_room_id: number | null };

export function listClasses(projectId: number) {
  return api<SchoolClass[]>(`/api/projects/${projectId}/classes`);
}

export function createClass(projectId: number, data: { grade: string; section?: string; stream?: string; name?: string; code?: string; color?: string; strength?: number; class_teacher_id?: number | null; home_room_id?: number | null }) {
  return api<SchoolClass>(`/api/projects/${projectId}/classes`, { method: "POST", body: JSON.stringify(data) });
}

export function updateClass(projectId: number, id: number, data: Partial<{ grade: string; section: string; stream: string; name: string; code: string; color: string; strength: number; class_teacher_id: number | null; home_room_id: number | null }>) {
  return api<SchoolClass>(`/api/projects/${projectId}/classes/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteClass(projectId: number, id: number) {
  return api(`/api/projects/${projectId}/classes/${id}`, { method: "DELETE" });
}

export function bulkCreateClasses(projectId: number, items: { grade: string; section?: string; stream?: string; name?: string; code?: string; color?: string; strength?: number }[]) {
  return api<{ created: number; errors: { row: number; message: string }[] }>(`/api/projects/${projectId}/classes/bulk`, { method: "POST", body: JSON.stringify({ items }) });
}

export function bulkDeleteClasses(projectId: number, ids: number[]) {
  return api<{ deleted: number; failed: number[] }>(`/api/projects/${projectId}/classes/bulk`, { method: "DELETE", body: JSON.stringify({ ids }) });
}

export async function importClassesExcel(projectId: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  const token = localStorage.getItem("timetable_token");
  const res = await fetch(`/api/projects/${projectId}/classes/import-excel`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (res.status === 401) {
    localStorage.removeItem("timetable_token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  return res.json() as Promise<{ success_count: number; total_rows: number; errors: { row: number; message: string }[] }>;
}

// Rooms
export type Room = { id: number; name: string; code: string; room_type: string; capacity: number; color: string };

export function listRooms(projectId: number) {
  return api<Room[]>(`/api/projects/${projectId}/rooms`);
}

export function createRoom(projectId: number, data: { name: string; code?: string; room_type?: string; capacity?: number }) {
  return api<{ id: number }>(`/api/projects/${projectId}/rooms`, { method: "POST", body: JSON.stringify(data) });
}

export function updateRoom(projectId: number, id: number, data: Partial<{ name: string; code: string; room_type: string; capacity: number }>) {
  return api(`/api/projects/${projectId}/rooms/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteRoom(projectId: number, id: number) {
  return api(`/api/projects/${projectId}/rooms/${id}`, { method: "DELETE" });
}

// Teachers
export function listTeachers(projectId: number) {
  return api<{ id: number; first_name: string; last_name: string; code: string; title: string; color: string; max_periods_day: number; max_periods_week: number }[]>(`/api/projects/${projectId}/teachers`);
}

export function createTeacher(projectId: number, data: { first_name: string; last_name?: string; code?: string; title?: string; color?: string; max_periods_day?: number; max_periods_week?: number }) {
  return api<{ id: number }>(`/api/projects/${projectId}/teachers`, { method: "POST", body: JSON.stringify(data) });
}

export function updateTeacher(projectId: number, id: number, data: Partial<{ first_name: string; last_name: string; code: string; title: string; color: string; max_periods_day: number; max_periods_week: number }>) {
  return api(`/api/projects/${projectId}/teachers/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteTeacher(projectId: number, id: number) {
  return api(`/api/projects/${projectId}/teachers/${id}`, { method: "DELETE" });
}

export function bulkCreateTeachers(projectId: number, items: { first_name: string; last_name?: string; code?: string; title?: string; color?: string; max_periods_day?: number; max_periods_week?: number }[]) {
  return api<{ created: number; errors: { row: number; message: string }[] }>(`/api/projects/${projectId}/teachers/bulk`, { method: "POST", body: JSON.stringify({ items }) });
}

export function bulkDeleteTeachers(projectId: number, ids: number[]) {
  return api<{ deleted: number; failed: number[] }>(`/api/projects/${projectId}/teachers/bulk`, { method: "DELETE", body: JSON.stringify({ ids }) });
}

export function getTeacherSubjects(projectId: number, teacherId: number) {
  return api<number[]>(`/api/projects/${projectId}/teachers/${teacherId}/subjects`);
}

export function setTeacherSubjects(projectId: number, teacherId: number, subjectIds: number[]) {
  return api(`/api/projects/${projectId}/teachers/${teacherId}/subjects`, {
    method: "PUT",
    body: JSON.stringify({ subject_ids: subjectIds }),
  });
}

export async function importTeachersExcel(projectId: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  const token = localStorage.getItem("timetable_token");
  const res = await fetch(`/api/projects/${projectId}/teachers/import-excel`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (res.status === 401) {
    localStorage.removeItem("timetable_token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  return res.json() as Promise<{ success_count: number; total_rows: number; errors: { row: number; message: string }[] }>;
}

// Lessons
export function listLessons(projectId: number) {
  return api<{ id: number; teacher_id: number; subject_id: number; class_id: number; periods_per_week: number }[]>(`/api/projects/${projectId}/lessons`);
}

// Project counts (lightweight — returns numbers only)
export function getProjectCounts(projectId: number) {
  return api<{ teachers: number; subjects: number; classes: number; lessons: number; has_generated: boolean }>(`/api/projects/${projectId}/counts`);
}

export function createLesson(projectId: number, data: { teacher_id: number; subject_id: number; class_id: number; periods_per_week?: number }) {
  return api<{ id: number }>(`/api/projects/${projectId}/lessons`, { method: "POST", body: JSON.stringify(data) });
}

export function deleteLesson(projectId: number, id: number) {
  return api(`/api/projects/${projectId}/lessons/${id}`, { method: "DELETE" });
}

/** Bulk assign: one teacher + one subject to many classes (same as desktop). */
export function bulkCreateLessons(
  projectId: number,
  data: { teacher_id: number; subject_id: number; classes: { class_id: number; periods_per_week?: number }[] }
) {
  return api<{ created: number; errors: { row: number; message: string }[] }>(`/api/projects/${projectId}/lessons/bulk`, {
    method: "POST",
    body: JSON.stringify({ ...data, classes: data.classes.map((c) => ({ class_id: c.class_id, periods_per_week: c.periods_per_week ?? 1 })) }),
  });
}

/** Copy all lessons from one class to other classes (same as desktop). */
export function copyLessonsFromClass(projectId: number, sourceClassId: number, targetClassIds: number[]) {
  return api<{ copied: number }>(`/api/projects/${projectId}/lessons/copy-from-class`, {
    method: "POST",
    body: JSON.stringify({ source_class_id: sourceClassId, target_class_ids: targetClassIds }),
  });
}

// Constraints
export type Constraint = { id: number; entity_type: string; entity_id: number; day_index: number; period_index: number; constraint_type: string; weight: number; is_hard: boolean };

export function listConstraints(projectId: number) {
  return api<Constraint[]>(`/api/projects/${projectId}/constraints`);
}

export function createConstraint(projectId: number, data: { entity_type: string; entity_id: number; day_index: number; period_index: number; is_hard?: boolean }) {
  return api<Constraint>(`/api/projects/${projectId}/constraints`, { method: "POST", body: JSON.stringify(data) });
}

export function deleteConstraint(projectId: number, id: number) {
  return api(`/api/projects/${projectId}/constraints/${id}`, { method: "DELETE" });
}

// Generate
export function validateProject(projectId: number) {
  return api<{ is_valid: boolean; errors: string[]; warnings: string[]; grouped_errors: Record<string, string[]>; readiness_summary: Record<string, unknown> }>(
    `/api/projects/${projectId}/generate/validate`,
    { method: "POST" }
  );
}

export function generateTimetable(projectId: number) {
  return api<{ success: boolean; message: string; run_id?: number; entries_count?: number; messages?: string[]; validation?: unknown }>(
    `/api/projects/${projectId}/generate`,
    { method: "POST" }
  );
}

export function getLatestRun(projectId: number) {
  return api<{ run: { id: number; status: string; entries_count: number; finished_at: string | null } | null }>(`/api/projects/${projectId}/generate/runs/latest`);
}

// Review
export function getRunSummary(projectId: number) {
  return api<{ run: { id: number; status: string; entries_count: number; finished_at: string | null } | null }>(`/api/projects/${projectId}/review/run-summary`);
}

export function getClassTimetable(projectId: number, classId: number) {
  return api<{ class_id: number; entries: unknown[]; grid: unknown[][]; days: number; periods: number }>(`/api/projects/${projectId}/review/class/${classId}`);
}

export function getTeacherTimetable(projectId: number, teacherId: number) {
  return api<{ teacher_id: number; entries: unknown[]; grid: unknown[][]; days: number; periods: number }>(`/api/projects/${projectId}/review/teacher/${teacherId}`);
}

export function getRoomTimetable(projectId: number, roomId: number) {
  return api<{ room_id: number; entries: unknown[]; grid: unknown[][]; days: number; periods: number }>(`/api/projects/${projectId}/review/room/${roomId}`);
}

export function getMasterTimetable(projectId: number) {
  return api<{ entries: unknown[]; grid: unknown[][][]; days: number; periods: number }>(`/api/projects/${projectId}/review/master`);
}

export function getWorkload(projectId: number) {
  return api<{ workload: { teacher_id: number; teacher_name: string; periods_scheduled: number }[] }>(`/api/projects/${projectId}/review/workload`);
}

// Move entry (drag & drop)
export function moveEntry(projectId: number, entryId: number, newDayIndex: number, newPeriodIndex: number, force = false) {
  return api<{ success: boolean; conflicts: { type: string; message: string }[]; message?: string }>(
    `/api/projects/${projectId}/review/move-entry`,
    { method: "POST", body: JSON.stringify({ entry_id: entryId, new_day_index: newDayIndex, new_period_index: newPeriodIndex, force }) }
  );
}

// Templates — download Excel templates for bulk import (same as desktop)
export function downloadTemplate(type: "teachers" | "classes") {
  const filename = type === "teachers" ? "teachers_template.xlsx" : "classes_template.xlsx";
  return apiBlob(`/api/templates/${type}.xlsx`).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// Export — trigger download
export function downloadExport(projectId: number, format: "excel" | "pdf" | "csv", filename: string) {
  return apiBlob(`/api/projects/${projectId}/exports/${format}`).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `timetable.${format === "excel" ? "xlsx" : format}`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// PDF export with specific view
export function downloadPdfView(projectId: number, params: { class_id?: number; teacher_id?: number; room_id?: number }, filename: string) {
  const qs = new URLSearchParams();
  if (params.class_id) qs.set("class_id", String(params.class_id));
  if (params.teacher_id) qs.set("teacher_id", String(params.teacher_id));
  if (params.room_id) qs.set("room_id", String(params.room_id));
  return apiBlob(`/api/projects/${projectId}/exports/pdf?${qs.toString()}`).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// PDF all classes / all teachers
export function downloadPdfAll(projectId: number, type: "all-classes" | "all-teachers", filename: string) {
  return apiBlob(`/api/projects/${projectId}/exports/pdf/${type}`).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ─── Academic Year ──────────────────────────────────────────────────────────
export type AcademicWeekInfo = {
  id: number; week_number: number; label: string;
  start_date: string; end_date: string; is_current: boolean;
  status?: string;
};

export type AcademicYearData = {
  active: boolean;
  year: { id: number; name: string; week_1_start_date: string; week_1_label: string; total_weeks: number } | null;
  weeks: AcademicWeekInfo[];
};

export function createAcademicYear(projectId: number, data: {
  name: string; week_1_start_date: string; week_1_label?: string; total_weeks?: number;
}) {
  return api<{ ok: boolean; id: number; name: string; weeks_created: number }>(
    `/api/projects/${projectId}/academic-year`,
    { method: "POST", body: JSON.stringify(data) }
  );
}

export function getAcademicYear(projectId: number) {
  return api<AcademicYearData>(`/api/projects/${projectId}/academic-year`);
}

export function listAcademicWeeks(projectId: number) {
  return api<AcademicWeekInfo[]>(`/api/projects/${projectId}/academic-year/weeks`);
}

// ─── Workload ───────────────────────────────────────────────────────────────
export type WorkloadEntry = {
  teacher_id: number; teacher_name: string; teacher_code: string;
  scheduled: number; substitutions: number; total: number; max: number; utilization_pct: number;
};

export type FreeTeacher = WorkloadEntry & {
  initials: string;
  subject: string;
  periods_today: number;
  subs_this_week: number;
  best_fit: boolean;
  free_in_period: boolean;
  free_period_label: string;
  sub_limit_reached: boolean;
};

export type YearlyWeek = {
  week_number: number; start_date: string;
  scheduled: number; substitutions: number; total: number; max: number;
};

export type YearlyWorkload = {
  teacher_id: number; teacher_name: string; max: number;
  weeks: YearlyWeek[];
};

export function getWorkloadOverview(projectId: number, week?: string) {
  const qs = week ? `?week=${week}` : "";
  return api<WorkloadEntry[]>(`/api/projects/${projectId}/workload/overview${qs}`);
}

export function getTeacherWorkload(projectId: number, teacherId: number, week?: string) {
  const qs = week ? `?week=${week}` : "";
  return api<WorkloadEntry>(`/api/projects/${projectId}/workload/${teacherId}${qs}`);
}

export function getYearlyWorkload(projectId: number, teacherId: number) {
  return api<YearlyWorkload>(`/api/projects/${projectId}/workload/${teacherId}/yearly`);
}

// ─── Substitutions ──────────────────────────────────────────────────────────
export type AbsentSlot = {
  entry_id: number; period_index: number; room_id: number | null;
  lesson_id: number; teacher_id: number; subject_id: number; class_id: number;
  subject_name: string; class_name: string; room_name: string;
};

export type SubstitutionRecord = {
  id: number; period_index: number;
  absent_teacher_id: number; absent_teacher_name: string;
  sub_teacher_id: number; sub_teacher_name: string;
  lesson_id: number; room_id: number | null; notes: string;
};

export type AbsenceRecord = {
  id: number; teacher_id: number; teacher_name: string; reason: string;
};

export function markAbsent(projectId: number, data: { date: string; teacher_ids: number[]; reason?: string }) {
  return api<{ ok: boolean; absences_created: number[]; date: string; day_index: number; slots: AbsentSlot[] }>(
    `/api/projects/${projectId}/substitutions/absent`,
    { method: "POST", body: JSON.stringify(data) }
  );
}

export function getFreeTeachers(projectId: number, dt: string, period: number, absentIds: number[], week?: string) {
  const qs = new URLSearchParams({ date: dt, period: String(period), absent_ids: absentIds.join(",") });
  if (week) qs.set("week", week);
  return api<FreeTeacher[]>(`/api/projects/${projectId}/substitutions/free-teachers?${qs}`);
}

export function assignSubstitute(projectId: number, data: {
  date: string; period_index: number; absent_teacher_id: number;
  sub_teacher_id: number; lesson_id: number; room_id?: number | null; notes?: string;
  force_override?: boolean;
}) {
  return api<{ ok: boolean; id: number; message: string; is_override: boolean; sub_count: number; override_count: number; sub_workload: WorkloadEntry }>(
    `/api/projects/${projectId}/substitutions/assign`,
    { method: "POST", body: JSON.stringify(data) }
  );
}

export function listSubstitutions(projectId: number, dt: string) {
  return api<SubstitutionRecord[]>(`/api/projects/${projectId}/substitutions?date=${dt}`);
}

export function listAbsences(projectId: number, dt: string) {
  return api<AbsenceRecord[]>(`/api/projects/${projectId}/substitutions/absences?date=${dt}`);
}

export function deleteSubstitution(projectId: number, subId: number) {
  return api<{ ok: boolean }>(`/api/projects/${projectId}/substitutions/${subId}`, { method: "DELETE" });
}

export function removeAbsence(projectId: number, absenceId: number) {
  return api<{ ok: boolean }>(`/api/projects/${projectId}/substitutions/absence/${absenceId}`, { method: "DELETE" });
}

export function getTeacherSlots(projectId: number, dt: string, teacherId: number) {
  return api<AbsentSlot[]>(`/api/projects/${projectId}/substitutions/teacher-slots?date=${dt}&teacher_id=${teacherId}`);
}

export function listPendingSlots(projectId: number, dt: string) {
  return api<AbsentSlot[]>(`/api/projects/${projectId}/substitutions/pending?date=${dt}`);
}

export type SuggestionTeacher = {
  teacher_id: number; teacher_name: string; initials: string;
  subject: string; periods_today: number; subs_this_week: number;
  sub_limit_reached: boolean; best_fit: boolean;
};

export type PendingWithSuggestions = {
  slots: AbsentSlot[];
  suggestions: Record<string, SuggestionTeacher[]>;
};

export function listPendingWithSuggestions(projectId: number, dt: string) {
  return api<PendingWithSuggestions>(`/api/projects/${projectId}/substitutions/pending-with-suggestions?date=${dt}`);
}

// ─── Substitution History ─────────────────────────────────────────────────

export type HistoryRecord = {
  id: number; date: string; period_index: number;
  absent_teacher_id: number; absent_teacher_name: string;
  sub_teacher_id: number; sub_teacher_name: string;
  subject_name: string; class_name: string; room_name: string;
  is_override: boolean; reason: string; notes: string; created_at: string;
};

export function getSubstitutionHistory(projectId: number, dateFrom?: string, dateTo?: string, teacherId?: number) {
  const qs = new URLSearchParams();
  if (dateFrom) qs.set("date_from", dateFrom);
  if (dateTo) qs.set("date_to", dateTo);
  if (teacherId) qs.set("teacher_id", String(teacherId));
  return api<HistoryRecord[]>(`/api/projects/${projectId}/substitutions/history?${qs}`);
}

export function exportHistoryPDF(projectId: number, dateFrom?: string, dateTo?: string, teacherId?: number) {
  const qs = new URLSearchParams();
  if (dateFrom) qs.set("date_from", dateFrom);
  if (dateTo) qs.set("date_to", dateTo);
  if (teacherId) qs.set("teacher_id", String(teacherId));
  window.open(`/api/projects/${projectId}/substitutions/history/export-pdf?${qs}`, "_blank");
}

export function exportWorkloadPDF(projectId: number, week?: string) {
  const qs = week ? `?week=${week}` : "";
  window.open(`/api/projects/${projectId}/workload/export-pdf${qs}`, "_blank");
}

// ─── Exam Duties ────────────────────────────────────────────────────────────
export type ExamDutyConfig = {
  id: number | null;
  project_id: number;
  total_exam_rooms: number;
  duty_duration_minutes: number;
  invigilators_per_room: number;
  exempt_teacher_ids: number[];
};

export type ExamSession = {
  id: number;
  project_id: number;
  subject_id: number;
  subject_name: string;
  subject_color: string;
  date: string;
  start_time: string;
  end_time: string;
  room_ids: number[];
  slot_count: number;
  slots_needed: number;
};

export type ExamSlot = {
  id: number;
  session_id: number;
  teacher_id: number;
  room_id: number | null;
  duty_start: string;
  duty_end: string;
  is_override: boolean;
  teacher_name: string;
  room_name: string;
};

export type TeacherExamSummary = {
  teacher_id: number;
  teacher_name: string;
  sessions_assigned: number;
  duty_minutes_total: number;
  exempt: boolean;
  excluded_subjects: { id: number; name: string }[];
};

export function getExamDutyConfig(projectId: number) {
  return api<ExamDutyConfig>(`/api/projects/${projectId}/exam-duties/config`);
}
export function saveExamDutyConfig(projectId: number, data: Omit<ExamDutyConfig, "id" | "project_id">) {
  return api<ExamDutyConfig>(`/api/projects/${projectId}/exam-duties/config`, { method: "POST", body: JSON.stringify(data) });
}
export function listExamSessions(projectId: number) {
  return api<ExamSession[]>(`/api/projects/${projectId}/exam-duties/sessions`);
}
export function createExamSession(projectId: number, data: { subject_id: number; date: string; start_time: string; end_time: string; room_ids: number[] }) {
  return api<ExamSession>(`/api/projects/${projectId}/exam-duties/sessions`, { method: "POST", body: JSON.stringify(data) });
}
export function deleteExamSession(projectId: number, sessionId: number) {
  return api(`/api/projects/${projectId}/exam-duties/sessions/${sessionId}`, { method: "DELETE" });
}
export function listExamSlots(projectId: number, sessionId: number) {
  return api<ExamSlot[]>(`/api/projects/${projectId}/exam-duties/sessions/${sessionId}/slots`);
}
export function assignExamSlot(projectId: number, sessionId: number, data: { teacher_id: number; room_id?: number; is_override?: boolean }) {
  return api<ExamSlot>(`/api/projects/${projectId}/exam-duties/sessions/${sessionId}/slots`, { method: "POST", body: JSON.stringify(data) });
}
export function removeExamSlot(projectId: number, sessionId: number, slotId: number) {
  return api(`/api/projects/${projectId}/exam-duties/sessions/${sessionId}/slots/${slotId}`, { method: "DELETE" });
}
export function autoAssignExamDuties(projectId: number, sessionId: number) {
  return api<{ assigned: { room_id: number; teacher_id: number; teacher_name: string }[]; unassigned_rooms: number[]; warnings: string[] }>(
    `/api/projects/${projectId}/exam-duties/sessions/${sessionId}/auto-assign`,
    { method: "POST" }
  );
}
export function getTeacherExamSummary(projectId: number, teacherId: number) {
  return api<TeacherExamSummary>(`/api/projects/${projectId}/exam-duties/teacher-summary/${teacherId}`);
}

export interface TeacherDutySummary {
  teacher_id:        number;
  teacher_name:      string;
  subject:           string;
  initials:          string;
  exam_duty_count:   number;
  exam_duty_minutes: number;
  roster_duty_count: number;
  total_duty_events: number;
  is_exempt:         boolean;
}
export function getTeacherDutySummary(projectId: number) {
  return api<TeacherDutySummary[]>(`/api/projects/${projectId}/exam-duties/teacher-duty-summary`);
}

export function exportExamDutiesPdf(projectId: number): Promise<void> {
  return apiBlob(`/api/projects/${projectId}/exam-duties/export-pdf`).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `exam_duties.pdf`; a.click();
    URL.revokeObjectURL(url);
  });
}
export function exportCommitteesPdf(projectId: number): Promise<void> {
  return apiBlob(`/api/projects/${projectId}/committees/export-pdf`).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `committees.pdf`; a.click();
    URL.revokeObjectURL(url);
  });
}

// ─── Date Sheet Upload ───────────────────────────────────────────────────────
export interface ParsedExamRow {
  date_str:   string;
  subject:    string;
  start_time: string;
  end_time:   string;
  confidence: number;
  warning:    string | null;
  raw_text:   string;
}

export interface ParsedDateSheet {
  rows:         ParsedExamRow[];
  total_found:  number;
  warnings:     string[];
  file_type:    string;
  parser_notes: string;
}

export async function uploadDateSheet(projectId: number, file: File): Promise<ParsedDateSheet> {
  const token = getToken();
  const form  = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/exam-duties/parse-date-sheet`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (res.status === 401) {
    localStorage.removeItem("timetable_token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  return res.json();
}

export function confirmDateSheet(
  projectId: number,
  rows: Pick<ParsedExamRow, "date_str" | "subject" | "start_time" | "end_time">[]
) {
  return api<{ created: number; skipped: number; errors: string[] }>(
    `/api/projects/${projectId}/exam-duties/confirm-date-sheet`,
    { method: "POST", body: JSON.stringify(rows) }
  );
}

// ─── Duty Roster ────────────────────────────────────────────────────────────
export type DutyEntry = {
  id: number;
  project_id: number;
  teacher_id: number;
  duty_type: string;
  day_of_week: number;
  period_index: number;
  notes: string | null;
};

export function listDutyRoster(projectId: number) {
  return api<DutyEntry[]>(`/api/projects/${projectId}/duty-roster`);
}

export function createDutyEntry(
  projectId: number,
  data: { teacher_id: number; duty_type: string; day_of_week: number; period_index: number; notes?: string }
) {
  return api<DutyEntry>(`/api/projects/${projectId}/duty-roster`, { method: "POST", body: JSON.stringify(data) });
}

export function updateDutyEntry(
  projectId: number,
  entryId: number,
  data: Partial<{ teacher_id: number; duty_type: string; day_of_week: number; period_index: number; notes: string }>
) {
  return api<DutyEntry>(`/api/projects/${projectId}/duty-roster/${entryId}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteDutyEntry(projectId: number, entryId: number) {
  return api(`/api/projects/${projectId}/duty-roster/${entryId}`, { method: "DELETE" });
}

// ─── Duty Roster v2 ─────────────────────────────────────────────────────────
export type DutyArea = {
  id: number; project_id: number; name: string; color: string; position: number;
};
export type DutyRosterRow = {
  id: number; project_id: number; row_order: number;
  label: string; date_start: string | null; date_end: string | null;
};
export type DutyEntryV2 = {
  id: number; project_id: number;
  row_id: number; column_index: number;
  teacher_id: number; teacher_name: string; teacher_code: string;
  duty_type: string; notes: string | null;
};

// Duty Areas
export function listDutyAreas(pid: number) {
  return api<DutyArea[]>(`/api/projects/${pid}/duty-roster/duty-areas`);
}
export function createDutyArea(pid: number, data: { name: string; color?: string }) {
  return api<DutyArea>(`/api/projects/${pid}/duty-roster/duty-areas`, { method: "POST", body: JSON.stringify(data) });
}
export function deleteDutyArea(pid: number, areaId: number) {
  return api(`/api/projects/${pid}/duty-roster/duty-areas/${areaId}`, { method: "DELETE" });
}

// Duty Roster Rows
export function listDutyRosterRows(pid: number) {
  return api<DutyRosterRow[]>(`/api/projects/${pid}/duty-roster/duty-roster-rows`);
}
export function createDutyRosterRow(pid: number, data?: Partial<DutyRosterRow>) {
  return api<DutyRosterRow>(`/api/projects/${pid}/duty-roster/duty-roster-rows`, { method: "POST", body: JSON.stringify(data ?? {}) });
}
export function updateDutyRosterRow(pid: number, rowId: number, patch: { date_start?: string | null; date_end?: string | null; label?: string }) {
  return api<DutyRosterRow>(`/api/projects/${pid}/duty-roster/duty-roster-rows/${rowId}`, { method: "PATCH", body: JSON.stringify(patch) });
}
export function deleteDutyRosterRow(pid: number, rowId: number) {
  return api(`/api/projects/${pid}/duty-roster/duty-roster-rows/${rowId}`, { method: "DELETE" });
}
export function reorderDutyRosterRows(pid: number, items: { id: number; row_order: number }[]) {
  return api<{ ok: boolean }>(`/api/projects/${pid}/duty-roster/duty-roster-rows/reorder`, { method: "PUT", body: JSON.stringify(items) });
}

// Duty Entries v2
export function listDutyEntriesV2(pid: number) {
  return api<DutyEntryV2[]>(`/api/projects/${pid}/duty-roster/v2/entries`);
}
export function createDutyEntryV2(pid: number, data: { row_id: number; column_index: number; teacher_id: number; duty_type: string; notes?: string }) {
  return api<DutyEntryV2>(`/api/projects/${pid}/duty-roster/v2/entries`, { method: "POST", body: JSON.stringify(data) });
}
export function deleteDutyEntryV2(pid: number, entryId: number) {
  return api(`/api/projects/${pid}/duty-roster/v2/entries/${entryId}`, { method: "DELETE" });
}

// ─── Committees ─────────────────────────────────────────────────────────────
export type CommitteeMemberItem = { id: number; teacher_id: number; role: string };

export type Committee = {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  members: CommitteeMemberItem[];
};

export function listCommittees(projectId: number) {
  return api<Committee[]>(`/api/projects/${projectId}/committees`);
}

export function createCommittee(projectId: number, data: { name: string; description?: string }) {
  return api<Committee>(`/api/projects/${projectId}/committees`, { method: "POST", body: JSON.stringify(data) });
}

export function updateCommittee(projectId: number, committeeId: number, data: Partial<{ name: string; description: string }>) {
  return api<Committee>(`/api/projects/${projectId}/committees/${committeeId}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteCommittee(projectId: number, committeeId: number) {
  return api(`/api/projects/${projectId}/committees/${committeeId}`, { method: "DELETE" });
}

export function addCommitteeMember(projectId: number, committeeId: number, data: { teacher_id: number; role?: string }) {
  return api<CommitteeMemberItem>(
    `/api/projects/${projectId}/committees/${committeeId}/members`,
    { method: "POST", body: JSON.stringify(data) }
  );
}

export function updateMemberRole(projectId: number, committeeId: number, memberId: number, role: string) {
  return api<CommitteeMemberItem>(
    `/api/projects/${projectId}/committees/${committeeId}/members/${memberId}`,
    { method: "PATCH", body: JSON.stringify({ role }) }
  );
}

export function removeCommitteeMember(projectId: number, committeeId: number, memberId: number) {
  return api(
    `/api/projects/${projectId}/committees/${committeeId}/members/${memberId}`,
    { method: "DELETE" }
  );
}

// ─── Tasks ───────────────────────────────────────────────────────────────────
export interface TaskItem {
  id: number;
  title: string;
  due_date: string | null;
  priority: string;
  completed: boolean;
  created_at: string | null;
}

export function listTasks(projectId: number) {
  return api<TaskItem[]>(`/api/projects/${projectId}/tasks`);
}

export function createTask(projectId: number, data: { title: string; due_date?: string; priority?: string }) {
  return api<TaskItem>(`/api/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(data) });
}

export function updateTask(projectId: number, taskId: number, data: Partial<{ title: string; due_date: string; priority: string; completed: boolean }>) {
  return api<TaskItem>(`/api/projects/${projectId}/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteTask(projectId: number, taskId: number) {
  return api<{ ok: boolean }>(`/api/projects/${projectId}/tasks/${taskId}`, { method: "DELETE" });
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────
export interface DashboardStats {
  total_teachers: number;
  present_today: number;
  absent_today: number;
  total_classes: number;
  total_lessons: number;
  substitutions_today: number;
}

export function getDashboardStats(projectId: number) {
  return api<DashboardStats>(`/api/projects/${projectId}/dashboard/stats`);
}

// ─── Timetable History ──────────────────────────────────────────────────────
export interface HistoryEntry {
  id: number;
  action: string;
  description: string;
  created_by: string;
  created_at: string | null;
  clash_count: number;
  teacher_count: number;
  class_count: number;
  is_current: boolean;
}

export function getTimetableHistory(projectId: number) {
  return api<HistoryEntry[]>(`/api/projects/${projectId}/history`);
}

// ─── Timetable Import ──────────────────────────────────────────────────────
export interface ImportPreview {
  teachers: { name: string }[];
  classes: { name: string; grade?: string; section?: string }[];
  subjects: { name: string }[];
  periods: number;
  days: number;
  slots: { period: number; col: number; raw: string }[];
  warnings: string[];
}

export async function importTimetableFile(projectId: number, file: File): Promise<ImportPreview> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/projects/${projectId}/import-timetable`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (res.status === 401) {
    localStorage.removeItem("timetable_token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  return res.json();
}

export function confirmTimetableImport(projectId: number, data: { teachers: { name: string }[]; subjects: { name: string }[]; classes: { name: string; grade?: string; section?: string }[] }) {
  return api<{ ok: boolean; created_teachers: number; created_subjects: number; created_classes: number }>(
    `/api/projects/${projectId}/confirm-import`,
    { method: "POST", body: JSON.stringify(data) }
  );
}

// ─── Per-project Demo Data ─────────────────────────────────────────────────
export function loadDemoData(projectId: number) {
  return api<{ ok: boolean; message: string; teachers: number; classes: number; subjects: number; classrooms: number }>(
    `/api/projects/${projectId}/load-demo`,
    { method: "POST" }
  );
}

// ─── Share ───────────────────────────────────────────────────────────────────
export async function uploadPdfForSharing(blob: Blob, filename: string): Promise<{ url: string; uid: string; expires_at: string }> {
  const token = getToken();
  const form = new FormData();
  form.append("file", blob, filename);
  const res = await fetch("/api/share/upload-pdf", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  return res.json();
}
