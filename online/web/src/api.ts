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

export function updateSchoolSettings(projectId: number, data: Partial<{ name: string; academic_year: string; days_per_week: number; periods_per_day: number; weekend_days: string; bell_schedule_json: string }>) {
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

export function exportWorkloadPDF(projectId: number, week?: string) {
  const qs = week ? `?week=${week}` : "";
  window.open(`/api/projects/${projectId}/workload/export-pdf${qs}`, "_blank");
}
