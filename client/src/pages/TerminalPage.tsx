import { useEffect, useState } from 'react';
import { TerminalShell } from '../features/terminal/components/TerminalShell';
import { initializeCommands } from '../features/terminal/commands';
import { useAuth } from '../features/auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Terminal } from 'lucide-react';

interface StudentWorkspaceData {
  student: {
    id: string;
    name: string;
    username: string;
    usn: string;
    email: string;
    branch: string;
    section: string;
    role: string;
    approvalStatus: string;
  };
  progress: {
    totalScore: number;
    solvedCount: number;
    attemptedCount: number;
    gamesPlayed: number;
  };
  games: any[];
  events: any[];
  sessions: any[];
}

export default function TerminalPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<StudentWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeCommands();

    let isMounted = true;
    async function fetchStudentWorkspace() {
      try {
        const res = await api.get('/workspace/student');
        if (isMounted) {
          setWorkspace(res.data);
        }
      } catch (err) {
        console.error('Failed to load student workspace telemetry:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchStudentWorkspace();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const username = workspace?.student?.name || user?.name || user?.username || 'student';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06080d] flex items-center justify-center font-mono text-cyan-400 p-4">
        <div className="border-2 border-cyan-500/60 bg-[#0e131d] p-6 max-w-md w-full shadow-[0_0_30px_rgba(0,255,204,0.2)]">
          <div className="flex items-center gap-3 mb-4 border-b border-zinc-800 pb-3">
            <Terminal size={22} className="animate-spin text-cyan-400" />
            <span className="text-sm font-bold tracking-widest text-zinc-200 uppercase">
              BOOTING TERMINAL_OS v3.4...
            </span>
          </div>
          <div className="space-y-1.5 text-xs text-zinc-400">
            <div>&gt; Verifying student JWT session... <span className="text-emerald-400">OK</span></div>
            <div>&gt; Mounting /dev/workspace/student... <span className="text-emerald-400">OK</span></div>
            <div>&gt; Syncing platform game engines... <span className="text-cyan-300">SYNCED</span></div>
            <div className="text-emerald-400 animate-pulse pt-2">&gt; Launching bash shell tty1...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05060a] flex flex-col p-2 sm:p-4 md:p-6 text-zinc-100 font-mono select-text">
      {/* Background Cyber Grid */}
      <div 
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(0,255,204,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,204,0.03) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          zIndex: 0
        }} 
      />

      {/* Main Terminal Container */}
      <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col min-h-[90vh] relative z-10">
        <TerminalShell 
          username={username} 
          workspaceData={workspace}
          onLogout={handleLogout} 
        />
      </div>
    </div>
  );
}
