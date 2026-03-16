# Schedulr — Project Context & History

> **Last updated:** 2026-03-16  
> **Purpose:** Read this file at the start of every new conversation to recall full project context.

---

## 1. Project Overview

**Schedulr** is a school timetable management system designed for schools **worldwide** (not region-specific). It generates conflict-free timetables using Google OR-Tools constraint solving and provides daily operations management (substitutions, duty rosters, exam duties, committees, workload tracking).

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript, Vite, React Router v6, vanilla CSS |
| **Backend** | FastAPI (Python), SQLAlchemy ORM |
| **Database** | PostgreSQL |
| **Solver** | Google OR-Tools (constraint programming) |
| **Hosting** | Railway (backend + static frontend) |
| **Mobile** | Capacitor (iOS + Android wrapper) — app ID: `com.schedulr.app` |

### Key URLs
- **Production API:** `https://timetable-api-production-9ad4.up.railway.app`
- **GitHub:** `https://github.com/arfeen306-design/Timetable-app`

---

## 3. Folder Structure

```
Timetable app/
├── online/
│   ├── web/                          # React frontend (Vite)
│   │   ├── src/
│   │   │   ├── api.ts                # All backend API calls
│   │   │   ├── main.tsx              # App entry (wrapped in ThemeProvider)
│   │   │   ├── index.css             # Global styles + dark mode overrides
│   │   │   ├── styles/
│   │   │   │   └── tokens.css        # Design tokens (CSS variables) + dark theme overrides
│   │   │   ├── context/
│   │   │   │   ├── AuthContext.tsx    # JWT auth state
│   │   │   │   ├── ToastContext.tsx   # Toast notifications
│   │   │   │   └── ThemeContext.tsx   # Dark/light mode (localStorage + system pref)
│   │   │   ├── components/
│   │   │   │   ├── AppShell.tsx       # Main layout shell (top tabs, sidebar, theme toggle)
│   │   │   │   ├── AppShell.css
│   │   │   │   └── SearchableSelect.tsx  # Reusable searchable dropdown (replaces native <select>)
│   │   │   ├── pages/
│   │   │   │   ├── Login.tsx          # Landing/login page (dark + light themes)
│   │   │   │   ├── Login.css          # Login page styles (dark + light overrides)
│   │   │   │   ├── NewTimetableLanding.tsx  # Home page (Start New, Upload, Amend, Load Demo)
│   │   │   │   ├── Dashboard.tsx      # Project dashboard
│   │   │   │   ├── SubstitutionPage.tsx    # Teacher absence + substitutions
│   │   │   │   ├── DutyRoster.tsx     # Daily duty assignments
│   │   │   │   ├── ExamDuties.tsx     # Exam invigilator management
│   │   │   │   ├── Committees.tsx     # School committee management
│   │   │   │   ├── WorkloadPage.tsx   # Teacher workload analytics
│   │   │   │   ├── Generate.tsx       # Timetable generation (OR-Tools)
│   │   │   │   ├── Review.tsx         # View generated timetable
│   │   │   │   └── Export.tsx         # Export timetable
│   │   │   └── pages/tabs/
│   │   │       ├── TeachersTab.tsx
│   │   │       ├── SubjectsTab.tsx
│   │   │       ├── ClassesTab.tsx
│   │   │       ├── RoomsTab.tsx
│   │   │       ├── LessonsTab.tsx     # Lesson assignments (uses SearchableSelect)
│   │   │       └── ConstraintsTab.tsx
│   │   ├── capacitor.config.ts        # Capacitor config (points to Railway URL)
│   │   ├── vite.config.js             # Vite config (ESM format, proxy to :8000)
│   │   ├── ios/                       # Capacitor iOS project (deployment target 16.0)
│   │   └── android/                   # Capacitor Android project
│   └── api/                           # FastAPI backend
│       ├── main.py
│       ├── models.py                  # SQLAlchemy models
│       ├── schemas.py                 # Pydantic schemas
│       ├── routers/                   # API route handlers
│       └── solver/                    # OR-Tools timetable solver
└── desktop/                           # Electron desktop app (legacy)
```

---

## 4. Key Architecture Decisions

### Theme System
- `ThemeContext.tsx` manages dark/light mode, persists to `localStorage` key `schedulr-theme`
- Sets `data-theme="dark"` or `data-theme="light"` on `<html>` element
- Design tokens in `tokens.css` use `:root` for defaults and `[data-theme="dark"]` for overrides
- Form element overrides (inputs, buttons, cards) in `index.css` under `[data-theme="dark"]`
- Login page has its own light overrides in `Login.css` under `[data-theme="light"]`

### Navigation
- `AppShell.tsx` has horizontal top tab bar: **Home → Dashboard → Substitution → Duty Roster → Exam Duties → Committees**
- Schedulr logo was **removed** from the top bar (user preference)
- Left padding added to `.top-tabs` for spacing
- Theme toggle (🌙/☀️) sits between "Live Now" pill and profile section

### SearchableSelect Component
- `components/SearchableSelect.tsx` — reusable dropdown with search filtering
- Replaces native `<select>` for teacher lists across **all** pages:
  - `SubstitutionPage.tsx` — absent teacher checklist (inline search) + cover lesson dropdown
  - `ExamDuties.tsx` — assign teacher modal
  - `Committees.tsx` — add member modal
  - `LessonsTab.tsx` — single lesson + bulk assign modals
- Supports dark mode via CSS variables, closes on outside click

### Capacitor Mobile
- Initialized with `npx cap init "Schedulr" "com.schedulr.app" --web-dir dist`
- iOS deployment target: **16.0** (required by Capacitor 7)
- CocoaPods installed via Homebrew
- Config points to live Railway URL (can switch to offline by removing `server.url`)
- Open Xcode: `npx cap open ios` | Android Studio: `npx cap open android`
- Workflow: `npm run build && npx cap sync` before opening native IDE

---

## 5. Backend API Endpoints (in `api.ts`)

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `listTeachers` | `GET /api/projects/{pid}/teachers` | All teachers |
| `listSubjects` | `GET /api/projects/{pid}/subjects` | All subjects |
| `listClasses` | `GET /api/projects/{pid}/classes` | All classes |
| `listRooms` | `GET /api/projects/{pid}/rooms` | All rooms |
| `listLessons` | `GET /api/projects/{pid}/lessons` | All lesson assignments |
| `createLesson` | `POST /api/projects/{pid}/lessons` | Single lesson |
| `bulkCreateLessons` | `POST /api/projects/{pid}/lessons/bulk` | Bulk assign |
| `copyLessonsFromClass` | `POST /api/projects/{pid}/lessons/copy` | Copy from class |
| `markAbsent` | `POST /api/projects/{pid}/absences` | Mark teachers absent |
| `getFreeTeachers` | `GET /api/projects/{pid}/free-teachers` | Available subs |
| `assignSubstitute` | `POST /api/projects/{pid}/substitutions` | Assign sub |
| `listSubstitutions` | `GET /api/projects/{pid}/substitutions` | Active subs |
| `listAbsences` | `GET /api/projects/{pid}/absences` | Active absences |
| `listAcademicWeeks` | `GET /api/projects/{pid}/academic-weeks` | Week list |
| `validateProject` | `POST /api/projects/{pid}/validate` | Pre-generation check |
| `generateTimetable` | `POST /api/projects/{pid}/generate` | Run OR-Tools solver |
| `listExamSessions` | `GET /api/projects/{pid}/exam-sessions` | Exam date sheet |
| `createExamSession` | `POST /api/projects/{pid}/exam-sessions` | Add exam paper |
| `autoAssignExamDuties` | `POST /api/projects/{pid}/exam-sessions/{sid}/auto-assign` | Auto invigilators |
| `listCommittees` | `GET /api/projects/{pid}/committees` | All committees |
| `createCommittee` | `POST /api/projects/{pid}/committees` | New committee |
| `addCommitteeMember` | `POST /api/projects/{pid}/committees/{cid}/members` | Add member |
| `getTeacherDutySummary` | `GET /api/projects/{pid}/teacher-duty-summary` | Duty load summary |
| `exportExamDutiesPdf` | `GET /api/projects/{pid}/exam-duties/export-pdf` | PDF export |

---

## 6. Conversation History (Changes Made)

### Session: 2026-03-14 → 2026-03-16

#### Navigation & Layout Fixes
- Fixed dropdown menu not opening on `/new-timetable` (removed early return in `handleTabClick`)
- Fixed sidebar project switch navigating to wrong route
- Reordered tabs: **Home** before **Dashboard**
- Removed **Schedulr** logo from top bar, added left padding for spacing

#### Grouped Errors Display
- `Generate.tsx`: replaced `JSON.stringify(validation.grouped_errors)` with formatted categorized list

#### Dark/Light Theme Implementation
- Created `ThemeContext.tsx` (provider + `useTheme` hook)
- Added dark theme CSS variable overrides to `tokens.css`
- Added dark mode form element overrides to `index.css` (inputs, buttons, cards, headings, scrollbar)
- Added theme toggle button to `AppShell.tsx` header
- Added full dark + light theme support to `Login.tsx` / `Login.css`

#### Teacher Search Feature
- Created `SearchableSelect.tsx` reusable component
- Added inline search filter to teacher checklist in `SubstitutionPage.tsx`
- Replaced all native teacher `<select>` dropdowns with `SearchableSelect` in:
  - `ExamDuties.tsx` (assign teacher modal)
  - `Committees.tsx` (add member modal)
  - `SubstitutionPage.tsx` (cover lesson section)
  - `LessonsTab.tsx` (single + bulk assign modals)

#### Login Page Globalization
- Changed "Built for Pakistani schools" → "Built for schools worldwide"
- Changed "sample Pakistani O-Level school data" → "sample school data"
- Added ☀️/🌙 theme toggle to login page (top-right corner)

#### Capacitor Mobile Setup
- Installed `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`
- Installed CocoaPods via Homebrew
- Fixed `vite.config.js` (CommonJS → ESM format)
- Initialized Capacitor: app ID `com.schedulr.app`, web dir `dist`
- Added iOS platform (bumped deployment target to 16.0)
- Added Android platform
- Configured `capacitor.config.ts` to point to Railway production URL

---

## 7. Common Commands

```bash
# Dev server (frontend)
cd online/web && npm run dev          # → http://localhost:3987

# Dev server (backend)
cd online/api && uvicorn main:app --reload --port 8000

# Build for production
cd online/web && npm run build

# Capacitor sync (after build)
cd online/web && npx cap sync

# Open native IDEs
cd online/web && npx cap open ios
cd online/web && npx cap open android

# Git push
cd "Timetable app" && git add online/ && git commit -m "message" && git push origin master
```

---

## 8. Known Considerations

- **Dashboard auto-redirect:** `Dashboard.tsx` auto-redirects to the first available project — pending user decision on whether to remove this
- **vite.config.js:** Must stay in ESM format (`import`/`export`) since `package.json` has `"type": "module"`
- **Capacitor server URL:** Currently points to Railway — remove `server.url` from `capacitor.config.ts` for offline-first bundled mode
- **iOS deployment target:** Must be ≥ 16.0 for Capacitor 7
