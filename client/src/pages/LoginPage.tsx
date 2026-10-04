import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Lock, 
  Mail, 
  User, 
  Gamepad2, 
  Brain, 
  Trophy, 
  Users, 
  Zap, 
  Shield, 
  Info,
  X
} from 'lucide-react';
import api from '../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────
type PageMode = 'login' | 'register';
type RegisterType = 'student' | 'gm';

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

  // ── UI states ──────────────────────────────────────────────────────────────
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

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
    if (!loginPassword) {
      setError('Passphrase is required.');
      return;
    }

    setLoading(true);
    try {
      await login(loginIdentifier, loginPassword);

      const stored = localStorage.getItem('terminal_user');
      const u = stored ? JSON.parse(stored) : null;
      const role: string = u?.role ?? '';

      if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
        navigate('/admin');
      } else if (role === 'GAME_MASTER') {
        navigate('/gm');
      } else {
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

    if (!studentForm.name.trim() || !studentForm.usn.trim() || !studentForm.email.trim()) {
      setError('All fields are required.');
      return;
    }
    if (studentForm.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (studentForm.password !== studentForm.confirmPassword) {
      setError('Passphrases do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        name: studentForm.name.trim(),
        usn: studentForm.usn.trim().toUpperCase(),
        email: studentForm.email.trim(),
        branch: studentForm.branch,
        section: studentForm.section,
        password: studentForm.password,
      });

      // Automatically sign in upon registration
      await login(studentForm.usn.trim().toUpperCase(), studentForm.password);
      navigate('/terminal');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Registration failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGmRegister(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();

    if (!gmForm.name.trim() || !gmForm.email.trim() || !gmForm.phoneNumber.trim()) {
      setError('All fields are required.');
      return;
    }
    if (gmForm.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (gmForm.password !== gmForm.confirmPassword) {
      setError('Passphrases do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register-gm', {
        name: gmForm.name.trim(),
        email: gmForm.email.trim(),
        phoneNumber: gmForm.phoneNumber.trim(),
        password: gmForm.password,
      });

      setSuccessNotice(
        res.data.message || 'Game Master application submitted! Your account is pending Administrator approval.'
      );
      setGmForm({ name: '', email: '', phoneNumber: '', password: '', confirmPassword: '' });
      setMode('login');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Game Master registration failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }



  return (
    <div className="relative min-h-screen w-full bg-[#07080d] text-[#F5F3EA] overflow-x-hidden font-sans selection:bg-[#00E5FF] selection:text-[#07080d]">
      
      {/* ── BACKGROUND LAYER ────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Cyberpunk City Artwork */}
        <div 
          className="absolute inset-0 bg-cover bg-no-repeat transition-opacity duration-700"
          style={{
            backgroundImage: `url('/cyberpunk_hero_art.jpg')`,
            backgroundPosition: 'left 20% bottom',
            opacity: 0.90,
          }}
        />

        {/* Ambient atmospheric gradients for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#07080d]/85 via-[#07080d]/40 to-[#07080d]/95 lg:from-[#07080d]/75 lg:via-[#07080d]/20 lg:to-[#07080d]/90" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07080d]/90 via-transparent to-[#07080d]/95" />
        
        {/* Subtle Cyber Grid */}
        <div 
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `linear-gradient(#00E5FF 1px, transparent 1px), linear-gradient(90deg, #00E5FF 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Glowing atmospheric flares */}
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-[#8B5CF6]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-1/4 w-[450px] h-[300px] bg-[#FF2BD6]/15 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-10 w-96 h-96 bg-[#00E5FF]/15 rounded-full blur-3xl" />
      </div>

      {/* ── TOP NAVIGATION ────────────────────────────────────────── */}
      <header className="relative z-20 w-full border-b-2 border-[#1c2433] bg-[#07080d]/90 backdrop-blur-md px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6 sm:gap-10">
          {/* Logo badge */}
          <div className="flex items-center gap-2.5 group cursor-pointer" onClick={() => navigate('/login')}>
            <div className="w-8 h-8 rounded-sm bg-[#00E5FF] text-[#07080d] flex items-center justify-center font-mono font-black text-base border-2 border-black shadow-[2px_2px_0px_#000]">
              &gt;_
            </div>
            <span 
              className="text-xl sm:text-2xl font-black tracking-wider text-white font-['Orbitron',sans-serif] group-hover:text-[#00E5FF] transition-colors"
            >
              TERMINAL
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-5 text-xs font-mono font-bold tracking-widest text-[#8b99aa]">
            <span className="hover:text-[#00E5FF] transition-colors cursor-default">PLAY</span>
            <span className="text-[#344256]">|</span>
            <span className="hover:text-[#8B5CF6] transition-colors cursor-default">LEARN</span>
            <span className="text-[#344256]">|</span>
            <span className="hover:text-[#FF2BD6] transition-colors cursor-default">COMPETE</span>
            <span className="text-[#344256]">|</span>
            <span className="hover:text-[#FFB000] transition-colors cursor-default">CONNECT</span>
          </nav>
        </div>

        {/* Platform version tagline */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono tracking-wider text-[#00E5FF] bg-[#00E5FF]/10 px-3 py-1 border border-[#00E5FF]/40 rounded-sm shadow-[2px_2px_0px_#000]">
            <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
            <span>A STUDENT TECH GAMING PLATFORM // V1.0</span>
          </div>
          <div className="sm:hidden text-[10px] font-mono font-bold text-[#00E5FF] border border-[#00E5FF]/40 px-2 py-0.5 rounded-sm">
            V1.0
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ──────────────────────────────────────────── */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 py-6 md:py-8 lg:py-12 min-h-[calc(100vh-65px)] flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 xl:gap-8 items-center">

          {/* ══════════════════════════════════════════════════════════
              LEFT HERO: BRANDING, SUBTITLE, 4 FEATURE BLOCKS
             ══════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-6 xl:col-span-7 flex flex-col justify-center space-y-5 lg:pr-4">

            {/* Title Block with Glitch Shadow */}
            <div className="space-y-1.5">
              <div className="relative inline-block max-w-full">
                <h1 
                  className="text-4xl sm:text-5xl md:text-6xl xl:text-7xl font-black font-['Orbitron',sans-serif] leading-tight select-none uppercase tracking-normal sm:tracking-tight"
                  style={{
                    background: 'linear-gradient(180deg, #00E5FF 0%, #ffffff 45%, #FF2BD6 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(4px 4px 0px #000000)',
                  }}
                >
                  TERMINAL
                </h1>
                {/* Decorative Pixel Glitch Blocks */}
                <div className="absolute -top-1 -right-2 w-7 h-2 bg-[#FF2BD6] rounded-xs shadow-[2px_2px_0px_#000]" />
                <div className="absolute bottom-2 -left-2 w-5 h-1.5 bg-[#00E5FF] rounded-xs shadow-[1px_1px_0px_#000]" />
              </div>

              {/* Tagline Subtitle */}
              <div className="flex flex-wrap items-center gap-2 font-mono font-bold text-xs sm:text-sm tracking-widest pt-1">
                <span className="text-[#00E5FF]">PLAY</span>
                <span className="text-[#415169]">|</span>
                <span className="text-[#8B5CF6]">LEARN</span>
                <span className="text-[#415169]">|</span>
                <span className="text-[#FF2BD6]">COMPETE</span>
                <span className="text-[#415169]">|</span>
                <span className="text-[#FFB000]">CONNECT</span>
              </div>
            </div>

            {/* Headline Description */}
            <p className="text-xs sm:text-sm md:text-base font-mono uppercase tracking-wider text-[#b8c7d9] max-w-xl leading-relaxed">
              WHERE TECHNICAL CONCEPTS BECOME REAL{' '}
              <span className="text-[#00E5FF] font-bold underline decoration-[#00E5FF]/40 decoration-2 underline-offset-4">
                COMPETITIVE GAMES
              </span>
              .
            </p>

            {/* 4 Feature Blocks (Neo-Brutalist Chunky Cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 max-w-2xl pt-1">
              {/* PLAY */}
              <div className="group bg-[#0c1017]/95 hover:bg-[#111722] border-2 border-[#00E5FF] p-3 rounded-sm shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#00E5FF] transition-all duration-150">
                <div className="w-8 h-8 rounded-sm bg-[#00E5FF]/15 border border-[#00E5FF]/50 flex items-center justify-center text-[#00E5FF] mb-2 group-hover:scale-105 transition-transform">
                  <Gamepad2 className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-black tracking-wider text-[#00E5FF] font-['Orbitron',sans-serif]">PLAY</h2>
                <p className="text-[9px] font-mono text-[#8b99aa] uppercase leading-tight mt-0.5">INTERACTIVE TECH GAMES</p>
              </div>

              {/* LEARN */}
              <div className="group bg-[#0c1017]/95 hover:bg-[#111722] border-2 border-[#8B5CF6] p-3 rounded-sm shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#8B5CF6] transition-all duration-150">
                <div className="w-8 h-8 rounded-sm bg-[#8B5CF6]/15 border border-[#8B5CF6]/50 flex items-center justify-center text-[#8B5CF6] mb-2 group-hover:scale-105 transition-transform">
                  <Brain className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-black tracking-wider text-[#8B5CF6] font-['Orbitron',sans-serif]">LEARN</h2>
                <p className="text-[9px] font-mono text-[#8b99aa] uppercase leading-tight mt-0.5">BUILD REAL SKILLS</p>
              </div>

              {/* COMPETE */}
              <div className="group bg-[#0c1017]/95 hover:bg-[#111722] border-2 border-[#FF2BD6] p-3 rounded-sm shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#FF2BD6] transition-all duration-150">
                <div className="w-8 h-8 rounded-sm bg-[#FF2BD6]/15 border border-[#FF2BD6]/50 flex items-center justify-center text-[#FF2BD6] mb-2 group-hover:scale-105 transition-transform">
                  <Trophy className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-black tracking-wider text-[#FF2BD6] font-['Orbitron',sans-serif]">COMPETE</h2>
                <p className="text-[9px] font-mono text-[#8b99aa] uppercase leading-tight mt-0.5">LIVE EVENTS &amp; BOARDS</p>
              </div>

              {/* CONNECT */}
              <div className="group bg-[#0c1017]/95 hover:bg-[#111722] border-2 border-[#FFB000] p-3 rounded-sm shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#FFB000] transition-all duration-150">
                <div className="w-8 h-8 rounded-sm bg-[#FFB000]/15 border border-[#FFB000]/50 flex items-center justify-center text-[#FFB000] mb-2 group-hover:scale-105 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-black tracking-wider text-[#FFB000] font-['Orbitron',sans-serif]">CONNECT</h2>
                <p className="text-[9px] font-mono text-[#8b99aa] uppercase leading-tight mt-0.5">TEAMS &amp; CLUBS</p>
              </div>
            </div>

            {/* Cyberpunk Environment Decals */}
            <div className="pt-2 space-y-1 font-mono text-[10px] sm:text-[11px] text-[#556980]">
              <div className="flex items-center gap-2">
                <span className="text-[#00E5FF] font-bold">&gt;&gt;</span>
                <span className="text-[#9cb0c7] tracking-widest">// TECH TODAY A BRIGHTER TOMORROW_</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#FF2BD6] font-bold">&gt;&gt;</span>
                <span className="text-[#9cb0c7] tracking-widest">GOOD STUDENTS BUILD BETTER WORLDS //</span>
              </div>
            </div>

          </div>


          {/* ══════════════════════════════════════════════════════════
              RIGHT HERO: NEO-BRUTALIST AUTH CONSOLE + STRIP
             ══════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-6 xl:col-span-5 flex items-center justify-center lg:justify-end">
            <div className="flex items-stretch gap-2.5 sm:gap-3 w-full max-w-[530px]">

              {/* ── Main Auth Console Panel ───────────────────────── */}
              <div className="relative flex-1 bg-[#0b0f17]/95 border-2 sm:border-[3px] border-[#222d3d] rounded-md shadow-[6px_6px_0px_#000000] p-5 sm:p-7 backdrop-blur-xl">

                {/* Decorative Chamfered Corner Brackets */}
                <div className="absolute -top-2 -left-2 w-5 h-5 border-t-[3px] border-l-[3px] border-[#00E5FF] pointer-events-none" />
                <div className="absolute -top-2 -right-2 w-5 h-5 border-t-[3px] border-r-[3px] border-[#FF2BD6] pointer-events-none" />
                <div className="absolute -bottom-2 -left-2 w-5 h-5 border-b-[3px] border-l-[3px] border-[#FF2BD6] pointer-events-none" />
                <div className="absolute -bottom-2 -right-2 w-5 h-5 border-b-[3px] border-r-[3px] border-[#00E5FF] pointer-events-none" />

                {/* Top Tabs & Telemetry Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[#1c2433]">
                  {/* Mode Tabs */}
                  <div className="flex items-center gap-1.5 bg-[#06080d] p-1 border border-[#222c3d] rounded-xs">
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className={`flex items-center gap-1.5 px-3.5 sm:px-5 py-2 text-xs font-mono font-black uppercase transition-all duration-150 cursor-pointer ${
                        mode === 'login'
                          ? 'bg-[#00E5FF] text-[#07080d] shadow-[2px_2px_0px_#000] border border-black'
                          : 'text-[#8b99aa] hover:text-white hover:bg-[#121721]'
                      }`}
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>LOGIN</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className={`flex items-center gap-1.5 px-3.5 sm:px-5 py-2 text-xs font-mono font-black uppercase transition-all duration-150 cursor-pointer ${
                        mode === 'register'
                          ? 'bg-[#FF2BD6] text-black shadow-[2px_2px_0px_#000] border border-black'
                          : 'text-[#8b99aa] hover:text-white hover:bg-[#121721]'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>REGISTER</span>
                    </button>
                  </div>

                  {/* Corner Gateway Tag */}
                  <div className="text-right font-mono text-[9px] leading-tight text-[#00E5FF]/85 tracking-wider">
                    <div>// SECURE</div>
                    <div>// ACCESS</div>
                    <div>// GATEWAY</div>
                  </div>
                </div>

                {/* Status Notice Alerts */}
                {error && (
                  <div className="mt-3.5 p-2.5 bg-[#ff3366]/10 border-2 border-[#ff3366] text-[#ff809f] text-xs font-mono flex items-start gap-2 rounded-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#ff3366]" />
                    <div className="leading-tight">{error}</div>
                  </div>
                )}
                {successNotice && (
                  <div className="mt-3.5 p-2.5 bg-[#00E5FF]/10 border-2 border-[#00E5FF] text-[#00E5FF] text-xs font-mono flex items-start gap-2 rounded-xs">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#00E5FF]" />
                    <div className="leading-tight">{successNotice}</div>
                  </div>
                )}

                {/* ══════════════════════════════════════════════════════
                    LOGIN MODE
                   ══════════════════════════════════════════════════════ */}
                {mode === 'login' && (
                  <form onSubmit={handleLogin} className="mt-5 space-y-4">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black font-['Orbitron',sans-serif] tracking-wide text-white uppercase">
                        WELCOME BACK
                      </h2>
                      <p className="text-xs font-mono text-[#8b99aa] mt-0.5">
                        Enter your credentials to access <span className="text-[#00E5FF] font-bold">TERMINAL</span>
                      </p>
                    </div>

                    {/* Operator ID Field */}
                    <div className="space-y-1.5">
                      <label htmlFor="login-id" className="block text-[11px] font-mono font-bold tracking-wider text-[#00E5FF] uppercase">
                        &gt; OPERATOR ID (Email / USN / root)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5c6e84]">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          id="login-id"
                          type="text"
                          autoComplete="username"
                          value={loginIdentifier}
                          onChange={(e) => setLoginIdentifier(e.target.value)}
                          placeholder="Enter your email, USN or root"
                          required
                          className="w-full bg-[#06080d] border-2 border-[#202938] focus:border-[#00E5FF] focus:outline-hidden text-white placeholder-[#7e91a8] font-mono text-sm pl-11 pr-3.5 py-2.5 sm:py-3 rounded-xs transition-colors"
                        />
                      </div>
                      <p className="text-[10px] font-mono text-[#62758c]">
                        Use your student USN or email. Admins use root.
                      </p>
                    </div>

                    {/* Passphrase Field */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="login-pass" className="block text-[11px] font-mono font-bold tracking-wider text-[#00E5FF] uppercase">
                          &gt; PASSPHRASE
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowForgotModal(true)}
                          className="text-[10px] font-mono text-[#00E5FF]/80 hover:text-[#00E5FF] hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5c6e84]">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          id="login-pass"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="Enter your password"
                          required
                          className="w-full bg-[#06080d] border-2 border-[#202938] focus:border-[#00E5FF] focus:outline-hidden text-white placeholder-[#7e91a8] font-mono text-sm pl-11 pr-11 py-2.5 sm:py-3 rounded-xs transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#5c6e84] hover:text-white transition-colors cursor-pointer"
                          tabIndex={-1}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Primary Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full mt-2 bg-[#00E5FF] hover:bg-[#2cf0ff] active:translate-x-[2px] active:translate-y-[2px] text-[#07080d] border-2 border-black font-mono font-black text-xs sm:text-sm tracking-wider uppercase py-3 px-4 rounded-xs shadow-[4px_4px_0px_#000000] flex items-center justify-between transition-all cursor-pointer disabled:opacity-60"
                    >
                      <span className="flex items-center gap-2">
                        <span>&gt;</span>
                        <span>{loading ? 'AUTHENTICATING...' : 'ACCESS SYSTEM // PROCEED'}</span>
                      </span>
                      <div className="w-6 h-6 bg-black text-[#00E5FF] flex items-center justify-center rounded-2xs">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </button>

                    {/* Divider */}
                    <div className="relative py-1.5 flex items-center justify-center">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-[#1c2433]" />
                      </div>
                      <span className="relative bg-[#0b0f17] px-3 font-mono text-[10px] text-[#556980] uppercase tracking-widest">
                        OR
                      </span>
                    </div>

                    {/* Switch to Register callout */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-mono text-[#8b99aa] leading-tight">
                        New to TERMINAL? Create your account and start playing, learning and competing.
                      </p>
                      <button
                        type="button"
                        onClick={() => switchMode('register')}
                        className="w-full bg-[#FF2BD6] hover:bg-[#ff4de0] active:translate-x-[2px] active:translate-y-[2px] text-black border-2 border-black font-mono font-black text-xs tracking-wider uppercase py-2.5 px-4 rounded-xs shadow-[3px_3px_0px_#000000] flex items-center justify-between transition-all cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5" />
                          <span>CREATE ACCOUNT</span>
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                )}

                {/* ══════════════════════════════════════════════════════
                    REGISTER MODE
                   ══════════════════════════════════════════════════════ */}
                {mode === 'register' && (
                  <div className="mt-5 space-y-4">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black font-['Orbitron',sans-serif] tracking-wide text-white uppercase">
                        INITIALIZE ID
                      </h2>
                      <p className="text-xs font-mono text-[#8b99aa] mt-0.5">
                        Register for access to the <span className="text-[#FF2BD6] font-bold">TERMINAL</span> network
                      </p>
                    </div>

                    {/* Sub-Type Selector */}
                    <div className="grid grid-cols-2 gap-1.5 bg-[#06080d] p-1 border border-[#202938] rounded-xs">
                      <button
                        type="button"
                        onClick={() => { clearMessages(); setRegisterType('student'); }}
                        className={`py-1.5 text-xs font-mono font-bold tracking-wider uppercase transition-colors rounded-2xs cursor-pointer ${
                          registerType === 'student'
                            ? 'bg-[#00E5FF] text-[#07080d] font-black'
                            : 'text-[#8b99aa] hover:text-white'
                        }`}
                      >
                        STUDENT
                      </button>
                      <button
                        type="button"
                        onClick={() => { clearMessages(); setRegisterType('gm'); }}
                        className={`py-1.5 text-xs font-mono font-bold tracking-wider uppercase transition-colors rounded-2xs cursor-pointer ${
                          registerType === 'gm'
                            ? 'bg-[#8B5CF6] text-white font-black'
                            : 'text-[#8b99aa] hover:text-white'
                        }`}
                      >
                        GAME MASTER
                      </button>
                    </div>

                    {/* Student Form */}
                    {registerType === 'student' && (
                      <form onSubmit={handleStudentRegister} className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-mono font-bold text-[#00E5FF] uppercase">&gt; FULL NAME</label>
                            <input
                              type="text"
                              value={studentForm.name}
                              onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                              placeholder="Alex Chen"
                              required
                              className="w-full bg-[#06080d] border-2 border-[#202938] focus:border-[#00E5FF] focus:outline-hidden text-white font-mono text-xs px-3 py-2 rounded-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-mono font-bold text-[#00E5FF] uppercase">&gt; USN / ROLL NO</label>
                            <input
                              type="text"
                              value={studentForm.usn}
                              onChange={(e) => setStudentForm({ ...studentForm, usn: e.target.value.toUpperCase() })}
                              placeholder="1MS21CS001"
                              required
                              className="w-full bg-[#06080d] border-2 border-[#202938] focus:border-[#00E5FF] focus:outline-hidden text-white font-mono text-xs px-3 py-2 rounded-xs uppercase"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-mono font-bold text-[#00E5FF] uppercase">&gt; EMAIL ADDRESS</label>
                          <input
                            type="email"
                            value={studentForm.email}
                            onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                            placeholder="student@campus.edu"
                            required
                            className="w-full bg-[#06080d] border-2 border-[#202938] focus:border-[#00E5FF] focus:outline-hidden text-white font-mono text-xs px-3 py-2 rounded-xs"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-mono font-bold text-[#00E5FF] uppercase">&gt; BRANCH</label>
                            <input
                              type="text"
                              value={studentForm.branch}
                              onChange={(e) => setStudentForm({ ...studentForm, branch: e.target.value })}
                              placeholder="CSE"
                              required
                              className="w-full bg-[#06080d] border-2 border-[#202938] focus:border-[#00E5FF] focus:outline-hidden text-white font-mono text-xs px-3 py-2 rounded-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-mono font-bold text-[#00E5FF] uppercase">&gt; SECTION</label>
                            <input
                              type="text"
                              value={studentForm.section}
                              onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value })}
                              placeholder="A"
                              required
                              className="w-full bg-[#06080d] border-2 border-[#202938] focus:border-[#00E5FF] focus:outline-hidden text-white font-mono text-xs px-3 py-2 rounded-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-mono font-bold text-[#00E5FF] uppercase">&gt; PASSPHRASE</label>
                            <input
                              type="password"
                              value={studentForm.password}
                              onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                              placeholder="Min 6 characters"
                              required
                              className="w-full bg-[#06080d] border-2 border-[#202938] focus:border-[#00E5FF] focus:outline-hidden text-white font-mono text-xs px-3 py-2 rounded-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-mono font-bold text-[#00E5FF] uppercase">&gt; CONFIRM</label>
                            <input
                              type="password"
                              value={studentForm.confirmPassword}
                              onChange={(e) => setStudentForm({ ...studentForm, confirmPassword: e.target.value })}
                              placeholder="Repeat password"
                              required
                              className="w-full bg-[#06080d] border-2 border-[#202938] focus:border-[#00E5FF] focus:outline-hidden text-white font-mono text-xs px-3 py-2 rounded-xs"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full mt-2.5 bg-[#00E5FF] hover:bg-[#2cf0ff] active:translate-x-[2px] active:translate-y-[2px] text-[#07080d] border-2 border-black font-mono font-black text-xs tracking-wider uppercase py-2.5 px-4 rounded-xs shadow-[3px_3px_0px_#000000] flex items-center justify-between transition-all cursor-pointer disabled:opacity-60"
                        >
                          <span>{loading ? 'CREATING...' : 'CREATE STUDENT ACCOUNT'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    )}

                    {/* Game Master Form */}
                    {registerType === 'gm' && (
                      <form onSubmit={handleGmRegister} className="space-y-3">
                        <div className="p-2.5 bg-[#8B5CF6]/10 border border-[#8B5CF6]/40 text-[#cbb2fe] text-[10px] font-mono rounded-xs leading-tight flex items-start gap-1.5">
                          <Info className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0 mt-0.5" />
                          <span>Game Master registrations are reviewed and approved by Platform Administrators.</span>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-mono font-bold text-[#8B5CF6] uppercase">&gt; FULL NAME</label>
                          <input
                            type="text"
                            value={gmForm.name}
                            onChange={(e) => setGmForm({ ...gmForm, name: e.target.value })}
                            placeholder="Prof. or Event Lead"
                            required
                            className="w-full bg-[#06080d] border-2 border-[#202938] focus:border-[#8B5CF6] focus:outline-hidden text-white font-mono text-xs px-3 py-2 rounded-xs"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-mono font-bold text-[#8B5CF6] uppercase">&gt; EMAIL</label>
                            <input
                              type="email"
                              value={gmForm.email}
                              onChange={(e) => setGmForm({ ...gmForm, email: e.target.value })}
                              placeholder="lead@club.org"
                              required
                              className="w-full bg-[#06080d] border-2 border-[#202938] focus:border-[#8B5CF6] focus:outline-hidden text-white font-mono text-xs px-3 py-2 rounded-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-mono font-bold text-[#8B5CF6] uppercase">&gt; PHONE NUMBER</label>
                            <input
                              type="tel"
                              value={gmForm.phoneNumber}
                              onChange={(e) => setGmForm({ ...gmForm, phoneNumber: e.target.value })}
                              placeholder="+91 98765 43210"
                              required
                              className="w-full bg-[#06080d] border-2 border-[#202938] focus:border-[#8B5CF6] focus:outline-hidden text-white font-mono text-xs px-3 py-2 rounded-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-mono font-bold text-[#8B5CF6] uppercase">&gt; PASSPHRASE</label>
                            <input
                              type="password"
                              value={gmForm.password}
                              onChange={(e) => setGmForm({ ...gmForm, password: e.target.value })}
                              placeholder="Min 6 characters"
                              required
                              className="w-full bg-[#06080d] border-2 border-[#202938] focus:border-[#8B5CF6] focus:outline-hidden text-white font-mono text-xs px-3 py-2 rounded-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-mono font-bold text-[#8B5CF6] uppercase">&gt; CONFIRM</label>
                            <input
                              type="password"
                              value={gmForm.confirmPassword}
                              onChange={(e) => setGmForm({ ...gmForm, confirmPassword: e.target.value })}
                              placeholder="Repeat password"
                              required
                              className="w-full bg-[#06080d] border-2 border-[#202938] focus:border-[#8B5CF6] focus:outline-hidden text-white font-mono text-xs px-3 py-2 rounded-xs"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full mt-2.5 bg-[#8B5CF6] hover:bg-[#9e74f8] active:translate-x-[2px] active:translate-y-[2px] text-white border-2 border-black font-mono font-black text-xs tracking-wider uppercase py-2.5 px-4 rounded-xs shadow-[3px_3px_0px_#000000] flex items-center justify-between transition-all cursor-pointer disabled:opacity-60"
                        >
                          <span>{loading ? 'SUBMITTING...' : 'SUBMIT GAME MASTER REGISTRATION'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    )}

                    {/* Back to Login */}
                    <div className="pt-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => switchMode('login')}
                        className="text-xs font-mono text-[#00E5FF] hover:underline cursor-pointer"
                      >
                        &lt;&lt; Already have an account? Sign in
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Console Footer Security Badges ────────────────── */}
                <div className="mt-6 pt-4 border-t border-[#1a2230] grid grid-cols-3 gap-2 text-[9px] sm:text-[10px] font-mono text-[#8b99aa]">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
                    <div className="leading-tight">
                      <span className="text-white font-bold block">SECURE</span>
                      <span>Authentication</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
                    <div className="leading-tight">
                      <span className="text-white font-bold block">ROLE BASED</span>
                      <span>Access Control</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[#FF2BD6] shrink-0" />
                    <div className="leading-tight">
                      <span className="text-white font-bold block">REAL TIME</span>
                      <span>Live Gaming</span>
                    </div>
                  </div>
                </div>

              </div>



            </div>
          </div>

        </div>
      </main>

      {/* ── FORGOT PASSWORD MODAL ─────────────────────────────────── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0c1017] border-2 border-[#00E5FF] p-6 max-w-md w-full rounded-sm shadow-[6px_6px_0px_#000]">
            <div className="flex items-center justify-between pb-3 border-b border-[#1c2433]">
              <span className="font-['Orbitron',sans-serif] text-sm font-black text-[#00E5FF] uppercase">
                // PASSPHRASE RECOVERY
              </span>
              <button 
                type="button" 
                onClick={() => setShowForgotModal(false)}
                className="text-[#8b99aa] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3 font-mono text-xs text-[#b3c1d1]">
              <p>
                In TERMINAL, account credentials and access permissions are managed directly by campus and club administrators.
              </p>
              <div className="p-3 bg-[#07090e] border border-[#222c3d] rounded-sm space-y-1">
                <div className="text-white font-bold">&gt; STUDENT ACCOUNTS:</div>
                <div className="text-[#8b99aa]">Contact your Club Lead or campus Event Coordinator to reset your account password.</div>
              </div>
              <div className="p-3 bg-[#07090e] border border-[#222c3d] rounded-sm space-y-1">
                <div className="text-white font-bold">&gt; GAME MASTER / ADMIN ACCOUNTS:</div>
                <div className="text-[#8b99aa]">Contact the Root Administrator via internal dispatch or request a key rotation.</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="mt-5 w-full bg-[#00E5FF] hover:bg-[#2bf0ff] text-black font-mono font-black text-xs uppercase py-2.5 rounded-sm border border-black shadow-[2px_2px_0px_#000] cursor-pointer"
            >
              ACKNOWLEDGE // CLOSE
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
