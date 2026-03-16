# Myzynca — Project Context & History

> **Last updated:** 2026-03-16  
> **Purpose:** Read this file at the start of every new conversation to recall full project context.  
> **Usage:** Tell the AI: *"Read `online/web/PROJECT_CONTEXT.md` and then help me with…"*

---

## 1. Project Overview

**Myzynca** (formerly Schedulr) is a school timetable management system designed for schools **worldwide**. It generates conflict-free timetables using Google OR-Tools constraint solving and provides daily operations management (substitutions, duty rosters, exam duties, committees, workload tracking).

**Target audience:** School principals, coordinators, administration teams, and school owners.

**Brand identity:** Shield with "Z" logo (minimalistic). Brand tag: "School OS".

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript, Vite, React Router v6, vanilla CSS |
| **Backend** | FastAPI (Python), SQLAlchemy ORM |
| **Database** | PostgreSQL |
| **Solver** | Google OR-Tools (constraint programming) |
| **Hosting** | Railway (backend + static frontend) |
| **Mobile** | Capacitor (iOS + Android wrapper) — app ID: `com.myzynca.app` |
| **Fonts** | Sora (headings), DM Sans (body) via Google Fonts |

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
│   │   │   ├── App.tsx               # All routes (React Router v6)
│   │   │   ├── index.css             # Global styles + dark mode overrides
│   │   │   ├── styles/
│   │   │   │   └── tokens.css        # Design tokens (CSS variables) + dark theme overrides
│   │   │   ├── context/
│   │   │   │   ├── AuthContext.tsx    # JWT auth state
│   │   │   │   ├── ToastContext.tsx   # Toast notifications
│   │   │   │   └── ThemeContext.tsx   # Dark/light mode (localStorage key: myzynca_theme)
│   │   │   ├── components/
│   │   │   │   ├── AppShell.tsx       # Main layout shell (top tabs, theme toggle)
│   │   │   │   ├── AppShell.css
│   │   │   │   ├── Layout.tsx         # Sidebar layout (legacy, used by some views)
│   │   │   │   └── SearchableSelect.tsx  # Reusable searchable dropdown
│   │   │   ├── pages/
│   │   │   │   ├── Login.tsx          # Landing/login page (shield-Z logo, dark + light)
│   │   │   │   ├── Login.css          # Login page styles (dark + light overrides)
│   │   │   │   ├── ZyncaWelcome.tsx   # Zynca welcome page (pie charts, animations, CTA)
│   │   │   │   ├── ZyncaWelcome.css   # Zynca page styles (dark + light)
│   │   │   │   ├── NewTimetableLanding.tsx  # Home page (Start New, Upload, Amend, Load Demo)
│   │   │   │   ├── Dashboard.tsx      # Multi-project dashboard
│   │   │   │   ├── ProjectDashboard.tsx    # Single project dashboard
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
│   │   ├── capacitor.config.ts        # Capacitor config (com.myzynca.app, Railway URL)
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

### Branding
- **Name:** Myzynca (rebranded from Schedulr on 2026-03-16)
- **Logo:** Shield with "Z" — SVG defined inline in `Login.tsx` and `ZyncaWelcome.tsx`
- **All references renamed:** Login, Dashboard, Layout, ProjectDashboard, ThemeContext, index.html, Capacitor config
- **localStorage keys use `myzynca_` prefix** (e.g., `myzynca_theme`, `myzynca_tasks_`)

### Theme System
- `ThemeContext.tsx` manages dark/light mode, persists to `localStorage` key `myzynca_theme`
- Sets `data-theme="dark"` or `data-theme="light"` on `<html>` element
- Design tokens in `tokens.css` use `:root` for defaults and `[data-theme="dark"]` for overrides
- Form element overrides (inputs, buttons, cards) in `index.css` under `[data-theme="dark"]`
- Login page has its own light overrides in `Login.css` under `[data-theme="light"]`
- Theme toggle (🌙/☀️) in `AppShell.tsx` header + login page (top-right)

### Navigation (AppShell tabs, in order)
1. **🛡 Zynca** → `/project/:id/zynca` → `ZyncaWelcome.tsx` (welcome page with charts + CTA)
2. **🗓 Home** → `/project/:id/new-timetable` (has dropdown for sub-pages)
3. **📊 Dashboard** → `/project/:id/dashboard`
4. **🔄 Substitution** → `/project/:id/substitutions`
5. **🛡 Duty Roster** → `/project/:id/duty-roster`
6. **📋 Exam Duties** → `/project/:id/exam-duties`
7. **👥 Committees** → `/project/:id/committees`

### Zynca Welcome Page (`ZyncaWelcome.tsx`)
- **Animated pie charts:** 4 metrics (Teachers Assigned, Rooms Utilized, Clashes Resolved, Periods Covered)
- **Floating animated shapes:** 5 colored blobs with CSS float animation
- **3 value prop cards:** Timetable Generation, Staff & Duty Management, Workload Analytics
- **CTA button:** "Make your first lesson plan with us" → navigates to project settings
- **Target messaging:** Principals, coordinators, school administration teams
- Full dark + light theme support

### SearchableSelect Component
- `components/SearchableSelect.tsx` — reusable dropdown with search filtering
- Replaces native `<select>` for teacher lists across **all** pages:
  - `SubstitutionPage.tsx` — absent teacher checklist (inline search) + cover lesson dropdown
  - `ExamDuties.tsx` — assign teacher modal
  - `Committees.tsx` — add member modal
  - `LessonsTab.tsx` — single lesson + bulk assign modals
- Supports dark mode via CSS variables, closes on outside click

### Capacitor Mobile
- Initialized with app ID `com.myzynca.app`, web dir `dist`
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
- Removed old logo from top bar, added left padding for spacing

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
- Added iOS platform (bumped deployment target to 16.0)
- Added Android platform
- Configured `capacitor.config.ts` to point to Railway production URL

#### Rebrand: Schedulr → Myzynca
- Renamed all references across 11 files: Login.tsx, Dashboard.tsx, Layout.tsx, ProjectDashboard.tsx, ThemeContext.tsx, AppShell.tsx, App.tsx, index.html, capacitor.config.ts
- New **shield-Z SVG logo** on login page (minimalistic)
- Updated Capacitor app ID: `com.schedulr.app` → `com.myzynca.app`
- Updated localStorage keys: `schedulr_theme` → `myzynca_theme`, `schedulr_tasks_` → `myzynca_tasks_`

#### Zynca Welcome Page
- Created `ZyncaWelcome.tsx` — animated welcome page for school administrators
- Created `ZyncaWelcome.css` — full dark/light theme support
- Added **Zynca** tab as first tab in `AppShell.tsx` navigation (before Home)
- Added route in `App.tsx`: `/project/:id/zynca`
- Features: animated pie charts, floating shapes, value prop cards, CTA button targeting principals

### Session: 2026-03-16 (Mobile Responsive Overhaul)

#### Mobile Responsive CSS — AppShell (`AppShell.css`)
- Added **two breakpoints**: `≤768px` (phone/tablet) and `≤480px` (small phones)
- **Tab bar:** horizontal scrollable (swipe left/right), hidden scrollbar
- **Logo:** icon-only on mobile (hides name text)
- **Live Now pill:** hidden on phones
- **Theme toggle + profile:** compacted (28px and 26px)
- **Dropdowns:** full-width on mobile (`position: fixed; left:0; right:0`)
- **Tab badges ("New"):** hidden on mobile

#### Mobile Responsive CSS — Content Pages (`index.css`)
- **Sidebar force-hidden:** `.sidebar`, `.sidebar--open`, `.sidebar--collapsed` → `display: none !important`
- **Forms:** stacked layout (labels above inputs), `font-size: 16px` to prevent iOS zoom
- **Modals:** 95% viewport width on mobile with overflow scroll
- **Tables:** horizontal scroll wrapper + smaller cells
- **Stat cards:** 2-column grid instead of auto-fit
- **Buttons:** 40px min height for touch targets
- **Toasts:** repositioned bottom-center (full width)
- **Headings/cards:** reduced padding and font sizes
- **Global overflow:** `overflow-x: hidden !important` on `body`, `#root`, `.app-shell`, `.app-body`, `.app-main`

#### ProjectDashboard Mobile Fixes (`ProjectDashboard.tsx` + `index.css`)
- **Problem:** Inline `style={{ gridTemplateColumns: "repeat(5,1fr)" }}` overrides CSS classes
- **Solution:** Added CSS class names to inline-styled grid containers; used `!important` overrides
- Classes added: `pd-page`, `pd-stat-grid`, `pd-live-grid`, `pd-body-grid`, `pd-live-header`
- **Stat cards:** 5 → 2 columns on mobile
- **Live teacher cards:** 4 → 2 columns (→ 1 on tiny phones)
- **Body grid + widgets row:** 3 columns → 1 column stacked
- **Live header:** stacks vertically
- **Page wrapper:** `maxWidth: 1100` → `100%` on mobile

#### Dashboard Page Mobile Fixes (`Dashboard.tsx` + `index.css`)
- Classes added: `dash-hero`, `dash-features`, `dash-project-row`, `dash-project-actions`
- **Feature highlights:** 3 → 1 column
- **Project rows:** action buttons wrap below name
- **Hero card:** reduced padding

#### NewTimetableLanding Mobile Fixes (`NewTimetableLanding.css`)
- Enhanced existing `@media (max-width: 768px)` block
- Reduced padding on `.ntl-right`, `.ntl-card`
- Smaller title/subtitle fonts
- Sidebar height capped at 160px on mobile
- Import preview gets compact padding

#### Delete Project Feature (`NewTimetableLanding.tsx` + `.css`)
- Added **✕ delete button** on each project card in the Saved Projects sidebar
- Button appears on hover (desktop), positioned top-right of card
- Clicking shows inline **"Delete '...'? Yes / No"** confirmation bar
- Calls `api.deleteProject()` and removes from state
- If deleting active project, navigates to next available project or home
- CSS: `.project-card-delete`, `.project-delete-confirm`, `.project-delete-yes`, `.project-delete-no`

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

- **Mobile responsive approach:** Inline React styles (`style={{...}}`) require CSS class names + `!important` overrides — all key grids now have `pd-*` and `dash-*` classes for this purpose
- **Mobile delete button:** The ✕ button on project cards uses `:hover` to show — on touch devices it may not be visible (consider making always-visible on mobile)
- **Dashboard auto-redirect:** `Dashboard.tsx` auto-redirects to the first available project — pending user decision on whether to remove this
- **vite.config.js:** Must stay in ESM format (`import`/`export`) since `package.json` has `"type": "module"`
- **Capacitor server URL:** Currently points to Railway — remove `server.url` from `capacitor.config.ts` for offline-first bundled mode
- **iOS deployment target:** Must be ≥ 16.0 for Capacitor 7
- **Brand name:** All user-facing text now says "Myzynca", internal code variable names may still reference older naming conventions
- **Browser cache:** After deploying CSS changes, users may need to clear cache or use incognito to see updates

