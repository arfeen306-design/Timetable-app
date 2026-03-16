import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AppShell from "./components/AppShell";
import Login from "./pages/Login";
import VerifyEmail from "./pages/VerifyEmail";
import Dashboard from "./pages/Dashboard";
import ProjectDashboard from "./pages/ProjectDashboard";
import ProjectEditor from "./pages/ProjectEditor";
import AcademicYearPage from "./pages/AcademicYearPage";
import NewTimetableLanding from "./pages/NewTimetableLanding";

// Heavy pages — code-split, only downloaded when visited
const Generate         = lazy(() => import("./pages/Generate"));
const Review           = lazy(() => import("./pages/Review"));
const Export           = lazy(() => import("./pages/Export"));
const WorkloadPage     = lazy(() => import("./pages/WorkloadPage"));
const SubstitutionPage = lazy(() => import("./pages/SubstitutionPage"));
const DutyRosterPage   = lazy(() => import("./pages/DutyRoster"));
const CommitteesPage   = lazy(() => import("./pages/Committees"));
const ExamDutiesPage   = lazy(() => import("./pages/ExamDuties"));
const ZyncaWelcome     = lazy(() => import("./pages/ZyncaWelcome"));

function PageLoader() {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999 }}>
      <div style={{
        height: 3,
        background: "var(--primary-500, #6366f1)",
        animation: "loadProgress 1.2s ease-in-out infinite",
      }} />
      <style>{`@keyframes loadProgress{0%{width:0%;opacity:1}60%{width:85%;opacity:1}100%{width:100%;opacity:0}}`}</style>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RedirectToDashboard() {
  const { projectId } = useParams();
  return <Navigate to={`/project/${projectId}/dashboard`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="project/:projectId" element={<RedirectToDashboard />} />
        <Route path="project/:projectId/dashboard" element={<ProjectDashboard />} />
        <Route path="project/:projectId/new-timetable" element={<NewTimetableLanding />} />
        <Route path="project/:projectId/settings" element={<ProjectEditor />} />
        <Route path="project/:projectId/subjects" element={<ProjectEditor />} />
        <Route path="project/:projectId/classes" element={<ProjectEditor />} />
        <Route path="project/:projectId/rooms" element={<ProjectEditor />} />
        <Route path="project/:projectId/teachers" element={<ProjectEditor />} />
        <Route path="project/:projectId/lessons" element={<ProjectEditor />} />
        <Route path="project/:projectId/constraints" element={<ProjectEditor />} />
        <Route path="project/:projectId/academic-year" element={<AcademicYearPage />} />
        <Route path="project/:projectId/generate" element={
          <Suspense fallback={<PageLoader />}><Generate /></Suspense>
        } />
        <Route path="project/:projectId/review" element={
          <Suspense fallback={<PageLoader />}><Review /></Suspense>
        } />
        <Route path="project/:projectId/export" element={
          <Suspense fallback={<PageLoader />}><Export /></Suspense>
        } />
        <Route path="project/:projectId/workload" element={
          <Suspense fallback={<PageLoader />}><WorkloadPage /></Suspense>
        } />
        <Route path="project/:projectId/substitutions" element={
          <Suspense fallback={<PageLoader />}><SubstitutionPage /></Suspense>
        } />
        <Route path="project/:projectId/duty-roster" element={
          <Suspense fallback={<PageLoader />}><DutyRosterPage /></Suspense>
        } />
        <Route path="project/:projectId/committees" element={
          <Suspense fallback={<PageLoader />}><CommitteesPage /></Suspense>
        } />
        <Route path="project/:projectId/exam-duties" element={
          <Suspense fallback={<PageLoader />}><ExamDutiesPage /></Suspense>
        } />
        <Route path="project/:projectId/zynca" element={
          <Suspense fallback={<PageLoader />}><ZyncaWelcome /></Suspense>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
