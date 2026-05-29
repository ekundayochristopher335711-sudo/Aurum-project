import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/layout/Layout'
import LoginPage from './pages/auth/LoginPage'
import AcceptInvitationPage from './pages/invitations/AcceptInvitationPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import ProjectsPage from './pages/projects/ProjectsPage'
import ProjectDetailPage from './pages/projects/ProjectDetailPage'
import EarlyWarningsPage from './pages/early-warnings/EarlyWarningsPage'
import RisksPage from './pages/risks/RisksPage'
import CompensationEventsPage from './pages/compensation-events/CompensationEventsPage'
import NoticesPage from './pages/notices/NoticesPage'
import AuditLogPage from './pages/audit/AuditLogPage'
import CEWhatIfPage from './pages/ce-whatif/CEWhatIfPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/accept-invitation/:token" element={<AcceptInvitationPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="projects/:projectId/early-warnings" element={<EarlyWarningsPage />} />
          <Route path="projects/:projectId/risks" element={<RisksPage />} />
          <Route path="projects/:projectId/compensation-events" element={<CompensationEventsPage />} />
          <Route path="projects/:projectId/notices" element={<NoticesPage />} />
          <Route path="projects/:projectId/audit" element={<AuditLogPage />} />
          <Route path="projects/:projectId/dashboard" element={<DashboardPage />} />
          <Route path="projects/:projectId/ce-whatif" element={<CEWhatIfPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
