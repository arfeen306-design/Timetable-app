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
