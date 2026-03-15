import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import VerifyEmail from "./pages/VerifyEmail";
import Dashboard from "./pages/Dashboard";
import ProjectEditor from "./pages/ProjectEditor";
import Generate from "./pages/Generate";
import Review from "./pages/Review";
import Export from "./pages/Export";
import WorkloadPage from "./pages/WorkloadPage";
import SubstitutionPage from "./pages/SubstitutionPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RedirectToSettings() {
  const { projectId } = useParams();
  return <Navigate to={`/project/${projectId}/settings`} replace />;
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
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="project/:projectId" element={<RedirectToSettings />} />
        <Route path="project/:projectId/settings" element={<ProjectEditor />} />
        <Route path="project/:projectId/subjects" element={<ProjectEditor />} />
        <Route path="project/:projectId/classes" element={<ProjectEditor />} />
        <Route path="project/:projectId/rooms" element={<ProjectEditor />} />
        <Route path="project/:projectId/teachers" element={<ProjectEditor />} />
        <Route path="project/:projectId/lessons" element={<ProjectEditor />} />
        <Route path="project/:projectId/constraints" element={<ProjectEditor />} />
        <Route path="project/:projectId/generate" element={<Generate />} />
        <Route path="project/:projectId/review" element={<Review />} />
        <Route path="project/:projectId/export" element={<Export />} />
        <Route path="project/:projectId/workload" element={<WorkloadPage />} />
        <Route path="project/:projectId/substitutions" element={<SubstitutionPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
