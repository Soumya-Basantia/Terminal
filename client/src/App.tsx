import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import api from './lib/api';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TerminalPage from './pages/TerminalPage';
import NewGamePage from './pages/NewGamePage';
import GameEditorPage from './pages/GameEditorPage';
import SessionHostPage from './pages/SessionHostPage';
import LobbyPage from './pages/LobbyPage';
import PlayPage from './pages/PlayPage';
import PresenterPage from './pages/PresenterPage';
import ResultsPage from './pages/ResultsPage';
import EventsPage from './pages/EventsPage';
import EventEditorPage from './pages/EventEditorPage';
import StagePage from './pages/StagePage';
import JoinPage from './pages/JoinPage';
import AdminPage from './pages/AdminPage';
import GameMasterWorkspacePage from './pages/GameMasterWorkspacePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * When a designer clicks "Host" from the game list, this creates a new
 * live session and redirects to the host control room.
 */
function HostGameRedirect() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!id) return;
    api.post('/sessions', { gameId: id })
      .then(res => navigate(`/sessions/${res.data.session.code}/host`))
      .catch(() => navigate('/terminal'));
  }, [id]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--text-secondary)' }}>Creating session...</div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<LoginPage />} />
      <Route path="/admin/login" element={<Navigate to="/login" replace />} />

      {/* Admin Protected Routes */}
      <Route path="/admin" element={<AdminPage />} />

      {/* Game Master Protected Workspace */}
      <Route path="/gm" element={<ProtectedRoute><GameMasterWorkspacePage /></ProtectedRoute>} />
      <Route path="/workspace/gm" element={<Navigate to="/gm" replace />} />

      {/* Student Protected Terminal Workspace */}
      <Route path="/terminal" element={<ProtectedRoute><TerminalPage /></ProtectedRoute>} />
      <Route path="/workspace/student" element={<Navigate to="/terminal" replace />} />
      
      {/* Root redirects to dashboard/clubs */}
      <Route path="/dashboard" element={<Navigate to="/clubs" replace />} />
      <Route path="/games" element={<Navigate to="/clubs" replace />} />
      <Route path="/events" element={<Navigate to="/clubs" replace />} />

      {/* Club Context Routes */}
      <Route path="/clubs" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/clubs/:clubId" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      
      <Route path="/clubs/:clubId/events" element={<ProtectedRoute><EventsPage /></ProtectedRoute>} />
      <Route path="/clubs/:clubId/events/:id/edit" element={<ProtectedRoute><EventEditorPage /></ProtectedRoute>} />
      
      <Route path="/clubs/:clubId/games" element={<Navigate to="/clubs/:clubId" replace />} />
      <Route path="/clubs/:clubId/games/new" element={<ProtectedRoute><NewGamePage /></ProtectedRoute>} />
      <Route path="/clubs/:clubId/games/:id/edit" element={<ProtectedRoute><GameEditorPage /></ProtectedRoute>} />
      <Route path="/clubs/:clubId/games/:id/host" element={<ProtectedRoute><HostGameRedirect /></ProtectedRoute>} />

      {/* Legacy fallback - some might still use these temporarily */}
      <Route path="/games/new" element={<ProtectedRoute><NewGamePage /></ProtectedRoute>} />
      <Route path="/games/:id/edit" element={<ProtectedRoute><GameEditorPage /></ProtectedRoute>} />
      <Route path="/events/:id/edit" element={<ProtectedRoute><EventEditorPage /></ProtectedRoute>} />

      {/* Host control room (require auth) */}
      <Route path="/sessions/:sessionCode/host" element={<ProtectedRoute><SessionHostPage /></ProtectedRoute>} />

      {/* Player routes — no auth required */}
      <Route path="/join" element={<JoinPage />} />
      <Route path="/join/:sessionCode" element={<JoinPage />} />
      <Route path="/lobby/:sessionCode" element={<LobbyPage />} />
      <Route path="/play/:sessionCode" element={<PlayPage />} />
      <Route path="/results/:sessionCode" element={<ResultsPage />} />

      {/* Presenter view — no auth, typically opened on projector */}
      <Route path="/presenter/:sessionCode" element={<PresenterPage />} />
      <Route path="/stage/:sessionCode" element={<StagePage />} />

      {/* Defaults */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
