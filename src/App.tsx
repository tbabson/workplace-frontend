import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { authApi } from './api/auth';
import { Layout } from './components/layout/Layout';
import { PageSpinner } from './components/ui/Spinner';
import Login from './pages/auth/Login';
import Dashboard from './pages/dashboard/Dashboard';
import Users from './pages/users/Users';
import Departments from './pages/departments/Departments';
import Projects from './pages/projects/Projects';
import ProjectDetail from './pages/projects/ProjectDetail';
import Attendance from './pages/attendance/Attendance';
import Overtime from './pages/overtime/Overtime';
import Chat from './pages/chat/Chat';
import Memos from './pages/memos/Memos';
import Queries from './pages/queries/Queries';
import Leaves from './pages/leaves/Leaves';
import Reviews from './pages/reviews/Reviews';
import Claims from './pages/claims/Claims';
import Assets from './pages/assets/Assets';
import Reports from './pages/reports/Reports';
import Profile from './pages/profile/Profile';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 1000 * 60 },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, token, setUser, logout } = useAuthStore();
  // If we have a persisted token, skip the spinner — restore user in background
  const [checking, setChecking] = useState(!isAuthenticated && !token);

  useEffect(() => {
    if (isAuthenticated) return;
    authApi.me()
      .then((r) => setUser(r.data.data))
      .catch(() => logout())
      .finally(() => setChecking(false));
  }, [isAuthenticated, setUser, logout]);

  if (checking) return <PageSpinner />;
  return <>{children}</>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthGate>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="users" element={<Users />} />
              <Route path="departments" element={<Departments />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:id" element={<ProjectDetail />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="overtime" element={<Overtime />} />
              <Route path="chat" element={<Chat />} />
              <Route path="memos" element={<Memos />} />
              <Route path="queries" element={<Queries />} />
              <Route path="leaves" element={<Leaves />} />
              <Route path="reviews" element={<Reviews />} />
              <Route path="claims" element={<Claims />} />
              <Route path="assets" element={<Assets />} />
              <Route path="reports" element={<Reports />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthGate>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { borderRadius: '12px', fontSize: '14px' },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
