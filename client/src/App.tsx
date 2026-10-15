import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom';
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

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectTo?: string;
}

function ProtectedRoute({ children, allowedRoles, redirectTo }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center font-mono select-none">
        <div className="flex flex-col items-center gap-4 p-6 border border-[#2d3848] bg-[#0c1017] shadow-[6px_6px_0px_#000] max-w-sm w-full">
          <div className="w-10 h-10 border-2 border-[#00ffcc] border-t-transparent animate-spin" style={{ borderRadius: 0 }} />
          <div className="text-[#00ffcc] text-xs font-black tracking-[0.25em] uppercase">
            // AUTHENTICATING SESSION
          </div>
          <div className="text-[#5e6b7c] text-[10px] tracking-widest text-center uppercase">
            VALIDATING CRYPTOGRAPHIC IDENTITY WITH SERVER
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    const fallbackPath =
      user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
        ? '/admin'
        : user.role === 'GAME_MASTER'
        ? '/gm'
        : '/terminal';
    return <Navigate to={redirectTo || fallbackPath} replace />;
  }

  return <>{children}</>;
}

/**
 * When a designer clicks "Host" from the game list, this:
 *  1. runs the server-side PRE-FLIGHT validation (never hosts a broken game),
 *  2. creates/reuses the live session (idempotent — double-clicks and React
 *     StrictMode double-effects cannot create duplicate sessions),
 *  3. navigates to the host control room.
 *
 * Failures render an actionable terminal screen instead of a silent redirect
 * back to the GM workspace.
 */
type HostPhase = 'validating' | 'creating' | 'ready' | 'preflight-failed' | 'error';
type PreflightIssue = { questionNumber: number; message: string };

function HostGameRedirect() {
  const { id } = useParams<{ id: string }>();
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const firedRef = React.useRef(false);
  const [phase, setPhase] = React.useState<HostPhase>('validating');
  const [errorMessage, setErrorMessage] = React.useState('');
  const [issues, setIssues] = React.useState<PreflightIssue[]>([]);
  const [gameName, setGameName] = React.useState('');

  React.useEffect(() => {
    if (!id || firedRef.current) return;
    firedRef.current = true;

    (async () => {
      try {
        // 1. Pre-flight — structured per-question validation from the server.
        const pre = await api.post(`/games/${id}/preflight`);
        const name = pre.data?.name || '';
        setGameName(name);
        if (!pre.data?.hostable) {
          setIssues(pre.data?.issues || [{ questionNumber: 0, message: 'Game cannot be hosted.' }]);
          setPhase('preflight-failed');
          return;
        }

        // 2. Host (create or safely reuse the active session for this game).
        setPhase('creating');
        const res = await api.post('/sessions', { gameId: id });
        const code = res.data.session.code || res.data.session.roomCode;
        if (!code) throw new Error('Session created without a room code');
        setPhase('ready');
        navigate(`/sessions/${code}/host`, { replace: true });
      } catch (err: any) {
        const body = err?.response?.data;
        if (body?.code === 'PREFLIGHT_FAILED') {
          setIssues(body.preflight?.issues || [{ questionNumber: 0, message: body.error }]);
          setPhase('preflight-failed');
          return;
        }
        setErrorMessage(body?.error || err?.message || 'Failed to host game');
        setPhase('error');
      }
    })();
  }, [id, navigate]);

  const backToEditor = `/${clubId ? `clubs/${clubId}` : 'gm'}`;

  if (phase === 'preflight-failed') {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center p-4 font-mono">
        <div className="w-full max-w-lg bg-[#0f1319] border-2 border-[#fcce0a] shadow-[6px_6px_0px_#000] p-6" style={{ borderRadius: 0 }}>
          <div className="text-[#fcce0a] text-[10px] font-black tracking-[0.3em] uppercase mb-3">// HOST BLOCKED — PRE-FLIGHT FAILED</div>
          <div className="text-white font-black text-lg mb-1">{gameName || 'Game'}</div>
          <div className="text-[#5e6b7c] text-xs mb-4">Fix the issues below in the editor, then host again.</div>
          <div className="flex flex-col gap-2 max-h-64 overflow-auto mb-4">
            {issues.map((iss, i) => (
              <div key={i} className="flex items-start gap-2 bg-[#0a0c10] border border-[#1a222e] px-3 py-2.5 text-xs">
                <span className="text-[#fcce0a] font-black shrink-0">
                  {iss.questionNumber > 0 ? `Q${iss.questionNumber}` : 'GAME'}
                </span>
                <span className="text-[#e6edf3]">{iss.message}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate(backToEditor)}
            className="px-4 py-2.5 text-[11px] font-black bg-[#00ffcc] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#00ffd5] transition-all w-full"
            style={{ borderRadius: 0 }}>
            [ BACK TO EDITOR ]
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center p-4 font-mono">
        <div className="w-full max-w-lg bg-[#0f1319] border-2 border-[#ff3366] shadow-[6px_6px_0px_#000] p-6" style={{ borderRadius: 0 }}>
          <div className="text-[#ff3366] text-[10px] font-black tracking-[0.3em] uppercase mb-3">// HOST ERROR</div>
          <div className="text-white font-black text-lg mb-1">Could not host this game</div>
          <div className="text-[#e6edf3] text-xs mb-5 whitespace-pre-wrap">{errorMessage}</div>
          <button
            onClick={() => { firedRef.current = false; setPhase('validating'); setErrorMessage(''); setIssues([]); }}
            className="px-4 py-2.5 text-[11px] font-black bg-[#00ffcc] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#00ffd5] transition-all w-full mb-2"
            style={{ borderRadius: 0 }}>
            [ RETRY ]
          </button>
          <button
            onClick={() => navigate(backToEditor)}
            className="px-4 py-2.5 text-[11px] font-bold bg-[#161c24] text-[#e6edf3] border border-[#2d3848] hover:border-[#48566a] transition-all w-full"
            style={{ borderRadius: 0 }}>
            [ BACK TO EDITOR ]
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050608] flex items-center justify-center font-mono">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-[#00ffcc] border-t-transparent animate-spin" style={{ borderRadius: 0 }} />
        <div className="text-[#5e6b7c] text-xs tracking-[0.3em] uppercase">
          // {phase === 'creating' ? 'CREATING SESSION...' : 'VALIDATING GAME...'}
        </div>
        {gameName && <div className="text-white font-black text-sm">{gameName}</div>}
      </div>
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
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
          <AdminPage />
        </ProtectedRoute>
      } />

      {/* Game Master Protected Workspace */}
      <Route path="/gm" element={
        <ProtectedRoute allowedRoles={['GAME_MASTER', 'ADMIN', 'SUPER_ADMIN']}>
          <GameMasterWorkspacePage />
        </ProtectedRoute>
      } />
      <Route path="/workspace/gm" element={<Navigate to="/gm" replace />} />

      {/* Student Protected Terminal Workspace */}
      <Route path="/terminal" element={
        <ProtectedRoute allowedRoles={['PLAYER', 'ADMIN', 'SUPER_ADMIN']}>
          <TerminalPage />
        </ProtectedRoute>
      } />
      <Route path="/workspace/student" element={<Navigate to="/terminal" replace />} />
      
      {/* Root redirects to dashboard/clubs */}
      <Route path="/dashboard" element={<Navigate to="/clubs" replace />} />
      <Route path="/games" element={<Navigate to="/clubs" replace />} />
      <Route path="/events" element={<Navigate to="/clubs" replace />} />

      {/* Club Context Routes (Game Master & Admin) */}
      <Route path="/clubs" element={
        <ProtectedRoute allowedRoles={['GAME_MASTER', 'ADMIN', 'SUPER_ADMIN']}>
          <DashboardPage />
        </ProtectedRoute>
      } />
      <Route path="/clubs/:clubId" element={
        <ProtectedRoute allowedRoles={['GAME_MASTER', 'ADMIN', 'SUPER_ADMIN']}>
          <DashboardPage />
        </ProtectedRoute>
      } />
      
      <Route path="/clubs/:clubId/events" element={
        <ProtectedRoute allowedRoles={['GAME_MASTER', 'ADMIN', 'SUPER_ADMIN']}>
          <EventsPage />
        </ProtectedRoute>
      } />
      <Route path="/clubs/:clubId/events/:id/edit" element={
        <ProtectedRoute allowedRoles={['GAME_MASTER', 'ADMIN', 'SUPER_ADMIN']}>
          <EventEditorPage />
        </ProtectedRoute>
      } />
      
      <Route path="/clubs/:clubId/games" element={<Navigate to="/clubs/:clubId" replace />} />
      <Route path="/clubs/:clubId/games/new" element={
        <ProtectedRoute allowedRoles={['GAME_MASTER', 'ADMIN', 'SUPER_ADMIN']}>
          <NewGamePage />
        </ProtectedRoute>
      } />
      <Route path="/clubs/:clubId/games/:id/edit" element={
        <ProtectedRoute allowedRoles={['GAME_MASTER', 'ADMIN', 'SUPER_ADMIN']}>
          <GameEditorPage />
        </ProtectedRoute>
      } />
      <Route path="/clubs/:clubId/games/:id/host" element={
        <ProtectedRoute allowedRoles={['GAME_MASTER', 'ADMIN', 'SUPER_ADMIN']}>
          <HostGameRedirect />
        </ProtectedRoute>
      } />
      <Route path="/clubs/:clubId/sessions/:sessionCode/host" element={
        <ProtectedRoute allowedRoles={['GAME_MASTER', 'ADMIN', 'SUPER_ADMIN']}>
          <SessionHostPage />
        </ProtectedRoute>
      } />

      {/* Legacy fallback - GM & Admin only */}
      <Route path="/games/new" element={
        <ProtectedRoute allowedRoles={['GAME_MASTER', 'ADMIN', 'SUPER_ADMIN']}>
          <NewGamePage />
        </ProtectedRoute>
      } />
      <Route path="/games/:id/edit" element={
        <ProtectedRoute allowedRoles={['GAME_MASTER', 'ADMIN', 'SUPER_ADMIN']}>
          <GameEditorPage />
        </ProtectedRoute>
      } />
      <Route path="/events/:id/edit" element={
        <ProtectedRoute allowedRoles={['GAME_MASTER', 'ADMIN', 'SUPER_ADMIN']}>
          <EventEditorPage />
        </ProtectedRoute>
      } />

      {/* Host control room (require auth) */}
      <Route path="/sessions/:sessionCode/host" element={
        <ProtectedRoute allowedRoles={['GAME_MASTER', 'ADMIN', 'SUPER_ADMIN']}>
          <SessionHostPage />
        </ProtectedRoute>
      } />

      {/* Player routes — session participation */}
      <Route path="/join" element={<JoinPage />} />
      <Route path="/join/:sessionCode" element={<JoinPage />} />
      <Route path="/lobby/:sessionCode" element={<LobbyPage />} />
      <Route path="/play/:sessionCode" element={<PlayPage />} />
      <Route path="/results/:sessionCode" element={<ResultsPage />} />

      {/* Presenter view — typically opened on stage/projector */}
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
