import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { Terminal, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';
import { TerminalPanel, TerminalInput, TerminalButton, TerminalBadge } from '../components/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

type PageMode = 'login' | 'register';
type RegisterType = 'student' | 'gm';

// ─── Component ───────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<PageMode>('login');
  const [registerType, setRegisterType] = useState<RegisterType>('student');

  // ── Login state ────────────────────────────────────────────────────────────
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // ── Student registration state ─────────────────────────────────────────────
  const [studentForm, setStudentForm] = useState({
    name: '',
    usn: '',
    email: '',
    branch: 'CSE',
    section: 'A',
    password: '',
    confirmPassword: '',
  });

  // ── GM registration state ──────────────────────────────────────────────────
  const [gmForm, setGmForm] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });

  // ── Shared UI state ────────────────────────────────────────────────────────
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function clearMessages() {
    setError('');
    setSuccessNotice('');
  }

  function switchMode(m: PageMode) {
    clearMessages();
    setShowPassword(false);
    setMode(m);
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    if (!loginIdentifier.trim()) {
      setError('Operator ID is required.');
      return;
    }
    setLoading(true);
    try {
      await login(loginIdentifier, loginPassword);

      // Role is read from the server-returned user stored in AuthContext.
      // Re-read it from localStorage (AuthContext already wrote it).
      const stored = localStorage.getItem('terminal_user');
      const u = stored ? JSON.parse(stored) : null;
      const role: string = u?.role ?? '';

      if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
        navigate('/admin');
      } else if (role === 'GAME_MASTER') {
        navigate('/gm');
      } else {
        // PLAYER / fallback → Student Terminal
        navigate('/terminal');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error;
      if (msg?.toLowerCase().includes('maintenance')) {
        setError('SYSTEM UNDER MAINTENANCE — Only administrators can log in.');
      } else if (msg?.toLowerCase().includes('blocked') || msg?.toLowerCase().includes('suspended')) {
        setError(msg);
      } else {
        setError('AUTHORIZATION FAILED — Check your Operator ID and passphrase.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleStudentRegister(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();

    if (studentForm.password !== studentForm.confirmPassword) {
      setError('Passphrases do not match.');
      return;
    }
    if (studentForm.password.length < 6) {
      setError('Passphrase must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        name: studentForm.name.trim(),
        usn: studentForm.usn.trim().toUpperCase(),
        email: studentForm.email.trim().toLowerCase(),
        branch: studentForm.branch.trim().toUpperCase(),
        section: studentForm.section.trim().toUpperCase(),
        password: studentForm.password,
      });

      const { user, token } = res.data;
      localStorage.setItem('terminal_token', token);
      localStorage.setItem('terminal_user', JSON.stringify(user));
      navigate('/terminal');
    } catch (err: any) {
      setError(err.response?.data?.error || 'STUDENT REGISTRATION FAILED.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGmRegister(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();

    if (gmForm.password !== gmForm.confirmPassword) {
      setError('Passphrases do not match.');
      return;
    }
    if (gmForm.password.length < 6) {
      setError('Passphrase must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register-gm', {
        name: gmForm.name.trim(),
        email: gmForm.email.trim().toLowerCase(),
        phoneNumber: gmForm.phoneNumber.trim(),
        password: gmForm.password,
      });

      setSuccessNotice(
        'REGISTRATION SUBMITTED — Your Game Master account is PENDING administrator approval. ' +
        'You will be notified when access is granted. Return to Login to sign in once approved.'
      );
      setGmForm({ name: '', email: '', phoneNumber: '', password: '', confirmPassword: '' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'GAME MASTER REGISTRATION FAILED.');
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--term-bg-void)] relative font-mono select-none">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none term-grid-lines -z-10" />
      <div className="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(ellipse_at_center,rgba(0,255,204,0.06)_0%,transparent_75%)] -z-10" />

      <div className="w-full max-w-lg relative z-10 animate-fade-in-scale">

        {/* ── Brand Header ─────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-2 mb-6 text-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 border border-[var(--term-cyan)] bg-[var(--term-bg-elevated)] shadow-[2px_2px_0_0_var(--term-cyan)]">
              <Terminal size={24} className="text-[var(--term-cyan)]" />
            </div>
            <span className="font-mono font-black text-3xl sm:text-4xl tracking-tighter text-white drop-shadow-[0_0_12px_var(--term-cyan-glow)]">
              TERMINAL
            </span>
          </div>
          <div className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-[var(--term-text-secondary)] uppercase">
            SECURE ACCESS GATEWAY // CYBERCORE
          </div>
        </div>

        {/* ── Auth Panel ───────────────────────────────────────────────── */}
        <TerminalPanel
          headerTag="// GATEWAY_DAEMON"
          title="AUTHENTICATION"
          cornerAccents={true}
          variant="cyber"
          headerActions={
            <TerminalBadge variant="cyan" dot={true} pulse={true}>v3.2.0</TerminalBadge>
          }
          className="p-0 overflow-hidden"
        >
          {/* ── Mode tabs: LOGIN / REGISTER ────────────────────────────── */}
          <div className="flex mb-6 border border-[var(--term-border-muted)] bg-[var(--term-bg-base)] p-1 gap-1">
            <button
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 font-mono text-xs font-bold uppercase transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-[var(--term-cyan)] text-black shadow-[2px_2px_0_0_#000]'
                  : 'text-[var(--term-text-secondary)] hover:text-white hover:bg-[var(--term-bg-highlight)]'
              }`}
            >
              LOGIN
            </button>
            <button
              onClick={() => switchMode('register')}
              className={`flex-1 py-2 font-mono text-xs font-bold uppercase transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-[var(--term-cyan)] text-black shadow-[2px_2px_0_0_#000]'
                  : 'text-[var(--term-text-secondary)] hover:text-white hover:bg-[var(--term-bg-highlight)]'
              }`}
            >
              REGISTER
            </button>
          </div>

          {/* ── Notices ───────────────────────────────────────────────── */}
          {successNotice && (
            <div className="mb-5 border border-emerald-500/50 bg-emerald-950/30 p-3 flex items-start gap-2.5 font-mono text-xs text-emerald-300">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
              <span>{successNotice}</span>
            </div>
          )}
          {error && (
            <div className="mb-5 border border-[var(--term-red)] bg-red-950/30 p-3 flex items-start gap-2.5 font-mono text-xs text-[var(--term-red)]">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--term-red)]" />
              <span className="uppercase">{error}</span>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════
              MODE: LOGIN
              ════════════════════════════════════════════════════════════ */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">

              {/* Single identifier — no role selector */}
              <TerminalInput
                label="OPERATOR ID"
                placeholder="USN (1RV22CS001) · Email · root"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                required
                autoFocus
              />

              <TerminalInput
                label="PASSPHRASE"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                endAdornment={
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="text-[var(--term-text-muted)] hover:text-[var(--term-cyan)] cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />

              <TerminalButton
                type="submit"
                disabled={loading}
                variant="primary"
                size="lg"
                className="w-full mt-2"
              >
                {loading ? 'AUTHENTICATING...' : 'ACCESS SYSTEM // PROCEED'}
              </TerminalButton>

              {/* Hint block */}
              <div className="pt-3 border-t border-[var(--term-border-faint)] flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-[var(--term-text-muted)]">
                <div>
                  STUDENT: <span className="text-[var(--term-text-primary)]">USN or Campus Email</span>
                </div>
                <div>
                  GM: <span className="text-[var(--term-text-primary)]">Registered Email</span>
                </div>
                <div>
                  ADMIN: <span className="text-[var(--term-cyan)]">root</span>
                </div>
              </div>
            </form>
          )}

          {/* ════════════════════════════════════════════════════════════
              MODE: REGISTER
              ════════════════════════════════════════════════════════════ */}
          {mode === 'register' && (
            <div className="flex flex-col gap-4">

              {/* Register sub-type selector: STUDENT or GAME MASTER */}
              <div className="flex border border-[var(--term-border-muted)] bg-[var(--term-bg-base)] p-0.5 gap-0.5">
                <button
                  onClick={() => { setRegisterType('student'); clearMessages(); }}
                  className={`flex-1 py-1.5 font-mono text-[11px] font-bold uppercase transition-all cursor-pointer ${
                    registerType === 'student'
                      ? 'bg-[var(--term-cyan)] text-black'
                      : 'text-[var(--term-text-secondary)] hover:text-white hover:bg-[var(--term-bg-highlight)]'
                  }`}
                >
                  STUDENT
                </button>
                <button
                  onClick={() => { setRegisterType('gm'); clearMessages(); }}
                  className={`flex-1 py-1.5 font-mono text-[11px] font-bold uppercase transition-all cursor-pointer ${
                    registerType === 'gm'
                      ? 'bg-[var(--term-blue)] text-black'
                      : 'text-[var(--term-text-secondary)] hover:text-white hover:bg-[var(--term-bg-highlight)]'
                  }`}
                >
                  GAME MASTER
                </button>
              </div>

              {/* ── Student Registration ─────────────────────────────── */}
              {registerType === 'student' && (
                <form onSubmit={handleStudentRegister} className="flex flex-col gap-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <TerminalInput
                      label="FULL NAME"
                      placeholder="Alan Turing"
                      value={studentForm.name}
                      onChange={(e) => setStudentForm(p => ({ ...p, name: e.target.value }))}
                      required
                    />
                    <TerminalInput
                      label="USN"
                      placeholder="1RV22CS001"
                      value={studentForm.usn}
                      onChange={(e) => setStudentForm(p => ({ ...p, usn: e.target.value.toUpperCase() }))}
                      required
                    />
                  </div>

                  <TerminalInput
                    label="CAMPUS EMAIL"
                    type="email"
                    placeholder="student@campus.edu"
                    value={studentForm.email}
                    onChange={(e) => setStudentForm(p => ({ ...p, email: e.target.value }))}
                    required
                  />

                  <div className="grid grid-cols-2 gap-3.5">
                    <TerminalInput
                      label="BRANCH"
                      placeholder="CSE / ISE / ECE"
                      value={studentForm.branch}
                      onChange={(e) => setStudentForm(p => ({ ...p, branch: e.target.value.toUpperCase() }))}
                      required
                    />
                    <TerminalInput
                      label="SECTION"
                      placeholder="A / B / C"
                      value={studentForm.section}
                      onChange={(e) => setStudentForm(p => ({ ...p, section: e.target.value.toUpperCase() }))}
                      required
                    />
                  </div>

                  <TerminalInput
                    label="PASSPHRASE"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="•••••••••••• (min 6 chars)"
                    value={studentForm.password}
                    onChange={(e) => setStudentForm(p => ({ ...p, password: e.target.value }))}
                    required
                    endAdornment={
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="text-[var(--term-text-muted)] hover:text-[var(--term-cyan)] cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />

                  <TerminalInput
                    label="CONFIRM PASSPHRASE"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={studentForm.confirmPassword}
                    onChange={(e) => setStudentForm(p => ({ ...p, confirmPassword: e.target.value }))}
                    required
                  />

                  <TerminalButton
                    type="submit"
                    disabled={loading}
                    variant="primary"
                    size="lg"
                    className="w-full mt-1"
                  >
                    {loading ? 'REGISTERING...' : 'REGISTER STUDENT // INITIALIZE'}
                  </TerminalButton>
                </form>
              )}

              {/* ── Game Master Registration ─────────────────────────── */}
              {registerType === 'gm' && (
                <form onSubmit={handleGmRegister} className="flex flex-col gap-3.5">
                  <div className="border border-blue-500/40 bg-blue-950/20 p-2.5 text-[11px] font-mono text-blue-300 leading-relaxed">
                    GM accounts require <span className="font-bold text-blue-200">Administrator approval</span> before
                    game designer tools are unlocked. Submit your details and await approval.
                  </div>

                  <TerminalInput
                    label="FULL NAME"
                    placeholder="Grace Hopper"
                    value={gmForm.name}
                    onChange={(e) => setGmForm(p => ({ ...p, name: e.target.value }))}
                    required
                  />

                  <TerminalInput
                    label="OFFICIAL EMAIL"
                    type="email"
                    placeholder="gm@campus.edu"
                    value={gmForm.email}
                    onChange={(e) => setGmForm(p => ({ ...p, email: e.target.value }))}
                    required
                  />

                  <TerminalInput
                    label="PHONE NUMBER"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={gmForm.phoneNumber}
                    onChange={(e) => setGmForm(p => ({ ...p, phoneNumber: e.target.value }))}
                    required
                  />

                  <TerminalInput
                    label="PASSPHRASE"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="•••••••••••• (min 6 chars)"
                    value={gmForm.password}
                    onChange={(e) => setGmForm(p => ({ ...p, password: e.target.value }))}
                    required
                    endAdornment={
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="text-[var(--term-text-muted)] hover:text-[var(--term-cyan)] cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />

                  <TerminalInput
                    label="CONFIRM PASSPHRASE"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={gmForm.confirmPassword}
                    onChange={(e) => setGmForm(p => ({ ...p, confirmPassword: e.target.value }))}
                    required
                  />

                  <TerminalButton
                    type="submit"
                    disabled={loading}
                    variant="cyber"
                    size="lg"
                    className="w-full mt-1"
                  >
                    {loading ? 'SUBMITTING...' : 'REGISTER AS GAME MASTER // SUBMIT'}
                  </TerminalButton>
                </form>
              )}

            </div>
          )}
        </TerminalPanel>
      </div>
    </div>
  );
}
