import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import api from '../lib/api';
import { TerminalPanel, TerminalInput, TerminalButton, TerminalBadge } from '../components/ui';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/admin/login', {
        login: loginId.trim(),
        password,
      });

      const { user, token } = res.data;
      localStorage.setItem('terminal_token', token);
      localStorage.setItem('terminal_user', JSON.stringify(user));
      navigate('/admin');
    } catch (err: any) {
      setError(err.response?.data?.error || 'ADMINISTRATOR AUTHENTICATION FAILED');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--term-bg-void)] text-white relative font-mono select-none">
      {/* Red ambient security grid */}
      <div 
        className="fixed inset-0 pointer-events-none -z-10" 
        style={{
          backgroundImage: 'linear-gradient(rgba(255,51,102,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,51,102,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} 
      />

      <div className="w-full max-w-md relative z-10 animate-fade-in-scale">
        {/* Terminal Header */}
        <div className="flex flex-col items-center gap-2 mb-6 text-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 border border-[var(--term-red)] bg-[var(--term-bg-elevated)] shadow-[2px_2px_0_0_var(--term-red)]">
              <ShieldAlert size={26} className="text-[var(--term-red)]" />
            </div>
            <span className="font-mono font-black text-3xl tracking-tighter text-white">
              TERMINAL
            </span>
          </div>
          <div className="text-[10px] font-bold tracking-[0.25em] text-[var(--term-red)] uppercase">
            RESTRICTED ROOT ADMINISTRATOR GATEWAY
          </div>
        </div>

        {/* AUTH PANEL */}
        <TerminalPanel
          variant="alert"
          headerTag="// ROOT_ZONE"
          title="ADMINISTRATIVE AUTH"
          cornerAccents={true}
          headerActions={
            <TerminalBadge variant="red" dot={true} pulse={true}>
              CLEARANCE: ROOT
            </TerminalBadge>
          }
          className="p-0 overflow-hidden"
        >
          <p className="font-mono text-xs text-[var(--term-text-secondary)] mb-5 leading-relaxed">
            Restricted area for platform operators. Multi-role user governance, Game Master approvals, and database query inspection.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <TerminalInput
              label="ROOT IDENTIFIER"
              placeholder="root"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
              autoFocus
            />

            <TerminalInput
              label="ROOT PASSPHRASE"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              endAdornment={
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="text-[var(--term-text-muted)] hover:text-[var(--term-red)] cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />

            {error && (
              <div className="border border-[var(--term-red)] bg-red-950/30 p-3 flex items-start gap-2.5 text-xs text-[var(--term-red)] font-mono">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--term-red)]" />
                <span className="uppercase">{error}</span>
              </div>
            )}

            <TerminalButton
              type="submit"
              variant="danger"
              size="lg"
              disabled={loading}
              className="w-full mt-2"
            >
              {loading ? 'VERIFYING CREDENTIALS...' : 'AUTHENTICATE AS ROOT // PROCEED'}
            </TerminalButton>
          </form>

          <div className="mt-6 pt-4 border-t border-[var(--term-border-faint)] flex justify-between items-center text-xs font-mono">
            <Link 
              to="/login" 
              className="text-[var(--term-text-muted)] hover:text-white flex items-center gap-1 transition-colors"
            >
              <ArrowLeft size={14} /> Back to Gateway Login
            </Link>
            <span className="text-[var(--term-text-dim)] text-[10px]">SECURE_LEVEL_3</span>
          </div>
        </TerminalPanel>
      </div>
    </div>
  );
}
