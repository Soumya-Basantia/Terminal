import { useEffect, useState } from 'react';
import { TerminalShell } from '../features/terminal/components/TerminalShell';
import { initializeCommands } from '../features/terminal/commands';
import { useAuth } from '../features/auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { TerminalBoot } from '../features/terminal/components/TerminalSystemState';

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
  unreadMessageCount?: number;
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
      <div className="h-screen w-screen bg-[#05060a] flex items-center justify-center font-mono p-4">
        <TerminalBoot
          title="BOOTING TERMINAL-OS v3.4"
          lines={[
            { label: 'VERIFYING STUDENT JWT SESSION', status: 'OK', delay: 0 },
            { label: 'MOUNTING /dev/workspace/student', status: 'OK', delay: 150 },
            { label: 'LOADING PLATFORM GAME ENGINES', status: 'SYNCED', delay: 300 },
            { label: 'SYNCING LIVE SESSION DATA', status: 'OK', delay: 450 },
            { label: 'LAUNCHING STUDENT BASH SHELL tty1', status: 'READY', delay: 600 },
          ]}
        />
      </div>
    );
  }


  return (
    <div className="h-screen w-screen max-h-screen max-w-full overflow-hidden bg-[#05070c] flex flex-col m-0 p-0 text-zinc-100 font-mono select-text relative">
      {/* Background Cyber Grid */}
      <div 
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(0,240,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.015) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          zIndex: 0
        }} 
      />

      {/* Main Terminal Shell - Pure Edge to Edge */}
      <div className="w-full flex-1 flex flex-col h-full min-h-0 relative z-10">
        <TerminalShell 
          username={username} 
          workspaceData={workspace}
          onLogout={handleLogout} 
        />
      </div>
    </div>
  );
}
