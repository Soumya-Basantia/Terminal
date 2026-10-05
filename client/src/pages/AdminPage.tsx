import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Users, 
  UserCheck, 
  Clock, 
  Search, 
  Terminal, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Database,
  Filter,
  LogOut,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Download,
  Mail,
  FileText,
  Sliders,
  Settings,
  Activity,
  Send,
  Eye,
  Edit2,
  Ban,
  Unlock,
  Check,
  X,
  FileSpreadsheet,
  Layers,
  FolderOpen
} from 'lucide-react';
import api from '../lib/api';
import { TerminalModal, TerminalButton, TerminalBadge, TerminalInput, TerminalPanel } from '../components/ui';

interface AdminStats {
  totalStudents: number;
  totalGameMasters: number;
  pendingGameMasters: number;
  approvedGameMasters: number;
  rejectedGameMasters: number;
  activeSessions: number;
  openReports: number;
  activeEvents: number;
  totalGames: number;
  totalClubs: number;
}

type AdminTab = 'USERS' | 'CONTENT' | 'MESSAGING' | 'REPORTS' | 'AUDIT_LOGS' | 'SYSTEM_CONTROLS';

export default function AdminPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('USERS');
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Global Search state
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // User Management state
  const [target, setTarget] = useState<'students' | 'gamemasters' | 'users'>('students');
  const [search, setSearch] = useState('');
  const [filterField, setFilterField] = useState('');
  const [filterOp, setFilterOp] = useState('EQUALS');
  const [filterValue, setFilterValue] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sqlPreview, setSqlPreview] = useState('');
  const [records, setRecords] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Modals state
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userTimeline, setUserTimeline] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [bulkActionModal, setBulkActionModal] = useState<string | null>(null);

  // Content Management state
  const [contentType, setContentType] = useState<'clubs' | 'games' | 'events' | 'challenges'>('games');
  const [contentList, setContentList] = useState<any[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [editingContent, setEditingContent] = useState<any | null>(null);

  // Direct Messaging state
  const [messageRecipient, setMessageRecipient] = useState<any | null>(null);
  const [messageHistory, setMessageHistory] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [messageUserSearch, setMessageUserSearch] = useState('');
  const [messageUserResults, setMessageUserResults] = useState<any[]>([]);

  // Reports state
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [reportFilterStatus, setReportFilterStatus] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [internalNoteInput, setInternalNoteInput] = useState('');

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditFilterAction, setAuditFilterAction] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);

  // System Controls state
  const [systemSettings, setSystemSettings] = useState<Record<string, string>>({
    student_registration_enabled: 'true',
    gm_registration_enabled: 'true',
    maintenance_mode: 'false',
  });
  const [savingSetting, setSavingSetting] = useState(false);

  // Feedback & Loading
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Student Performance Drawer
  const [studentPerf, setStudentPerf] = useState<any | null>(null);
  const [studentPerfLoading, setStudentPerfLoading] = useState(false);

  // Full Excel Export Panel
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportCount, setExportCount] = useState<number | null>(null);
  const [exportFilters, setExportFilters] = useState({
    branch: '',
    section: '',
    clubSlug: '',
    accountStatus: '',
    minScore: '',
    maxScore: '',
    search: '',
  });
  const [exportSheets, setExportSheets] = useState({
    students: true,
    gamePerformance: true,
    gameSummary: true,
    teams: true,
    clubs: true,
    participation: true,
  });

  // Check admin session
  useEffect(() => {
    const rawUser = localStorage.getItem('terminal_user');
    const token = localStorage.getItem('terminal_token');
    if (!token || !rawUser) {
      navigate('/login');
      return;
    }
    try {
      const user = JSON.parse(rawUser);
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
        navigate('/login');
      }
    } catch {
      navigate('/login');
    }
  }, [navigate]);

  // Load stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data);
    } catch (err: any) {
      console.error('Failed to fetch admin stats', err);
    }
  }, []);

  // Run parameterized query on users/students/GMs
  const executeQuery = useCallback(async (overrides?: { target?: 'students' | 'gamemasters' | 'users'; filters?: any[]; page?: number }) => {
    setLoading(true);
    setFeedback(null);
    try {
      const activeTarget = overrides?.target || target;
      const activePage = overrides?.page !== undefined ? overrides.page : page;

      const filters: any[] = [];
      if (overrides?.filters) {
        filters.push(...overrides.filters);
      } else if (filterField && filterValue.trim()) {
        filters.push({
          field: filterField,
          operator: filterOp,
          value: filterValue.trim(),
        });
      }

      const res = await api.post('/admin/query', {
        target: activeTarget,
        search: search.trim() || undefined,
        filters: filters.length > 0 ? filters : undefined,
        page: activePage,
        pageSize,
        orderBy: { field: 'createdAt', direction: 'desc' },
      });

      setRecords(res.data.records);
      setSqlPreview(res.data.sqlPreview);
      setTotalPages(res.data.totalPages);
      setTotalCount(res.data.total);
      setSelectedUserIds([]);
    } catch (err: any) {
      setFeedback({
        message: err.response?.data?.error || 'Query failed to execute',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [target, page, pageSize, search, filterField, filterOp, filterValue]);

  // Fetch content list
  const fetchContent = useCallback(async (type: 'clubs' | 'games' | 'events' | 'challenges') => {
    setContentLoading(true);
    try {
      const res = await api.get(`/admin/content/${type}`);
      setContentList(res.data.items || []);
    } catch (err: any) {
      setFeedback({ message: 'Failed to fetch content', type: 'error' });
    } finally {
      setContentLoading(false);
    }
  }, []);

  // Fetch reports list
  const fetchReports = useCallback(async (status?: string) => {
    try {
      const params = status ? `?status=${status}` : '';
      const res = await api.get(`/admin/reports${params}`);
      setReportsList(res.data.reports || []);
    } catch (err: any) {
      console.error('Failed to load reports', err);
    }
  }, []);

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async (action?: string) => {
    setAuditLoading(true);
    try {
      const params = action ? `?action=${action}` : '';
      const res = await api.get(`/admin/audit-logs${params}`);
      setAuditLogs(res.data.logs || []);
    } catch (err: any) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  // Fetch system settings
  const fetchSystemSettings = useCallback(async () => {
    try {
      const res = await api.get('/admin/system-settings');
      if (res.data.settings) {
        setSystemSettings(res.data.settings);
      }
    } catch (err: any) {
      console.error('Failed to fetch system settings', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStats();
    if (activeTab === 'USERS') executeQuery();
    else if (activeTab === 'CONTENT') fetchContent(contentType);
    else if (activeTab === 'REPORTS') fetchReports(reportFilterStatus);
    else if (activeTab === 'AUDIT_LOGS') fetchAuditLogs(auditFilterAction);
    else if (activeTab === 'SYSTEM_CONTROLS') fetchSystemSettings();
  }, [activeTab, fetchStats, executeQuery, fetchContent, fetchReports, fetchAuditLogs, fetchSystemSettings, contentType, reportFilterStatus, auditFilterAction]);

  // Global search runner
  async function handleGlobalSearch(term: string) {
    setGlobalSearch(term);
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await api.get(`/admin/search?q=${encodeURIComponent(term.trim())}`);
      setSearchResults(res.data.results || []);
    } catch (err: any) {
      console.error('Search failed', err);
    } finally {
      setSearchLoading(false);
    }
  }

  // Open user details & timeline
  async function openUserDetail(userId: string) {
    try {
      const res = await api.get(`/admin/users/${userId}`);
      setSelectedUser(res.data.user);
      setTimelineLoading(true);
      const timeRes = await api.get(`/admin/users/${userId}/timeline`);
      setUserTimeline(timeRes.data.timeline || []);
    } catch (err: any) {
      setFeedback({ message: 'Failed to open user details', type: 'error' });
    } finally {
      setTimelineLoading(false);
    }
  }

  // Save edited user
  async function saveUserEdit() {
    if (!editingUser) return;
    setActionLoading('edit');
    try {
      await api.patch(`/admin/users/${editingUser.id}`, {
        name: editingUser.name,
        email: editingUser.email,
        usn: editingUser.usn,
        branch: editingUser.branch,
        section: editingUser.section,
        phoneNumber: editingUser.phoneNumber,
      });
      setFeedback({ message: 'User details updated successfully', type: 'success' });
      setEditingUser(null);
      executeQuery();
      fetchStats();
    } catch (err: any) {
      setFeedback({ message: err.response?.data?.error || 'Failed to update user', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  }

  // User Status Toggle (verify, block, suspend, approve)
  async function updateUserStatus(userId: string, data: any, note?: string) {
    setActionLoading(userId);
    try {
      await api.patch(`/admin/users/${userId}/status`, data);
      setFeedback({ message: note || 'User status updated successfully', type: 'success' });
      executeQuery();
      fetchStats();
      if (selectedUser?.id === userId) {
        openUserDetail(userId);
      }
    } catch (err: any) {
      setFeedback({ message: err.response?.data?.error || 'Failed to update status', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  }

  // Bulk action runner
  async function executeBulkAction(action: string) {
    if (selectedUserIds.length === 0) return;
    setActionLoading('bulk');
    try {
      const res = await api.post('/admin/users/bulk-action', {
        userIds: selectedUserIds,
        action,
      });
      setFeedback({ message: res.data.message || `Applied ${action} to ${res.data.updatedCount} users`, type: 'success' });
      setBulkActionModal(null);
      setSelectedUserIds([]);
      executeQuery();
      fetchStats();
    } catch (err: any) {
      setFeedback({ message: err.response?.data?.error || 'Bulk action failed', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  }

  // Excel Export Handler (existing generic)
  async function handleExportExcel(exportTarget: string) {
    try {
      setFeedback({ message: `Generating Excel export for ${exportTarget.toUpperCase()}...`, type: 'success' });
      const response = await api.post(
        `/admin/export/${exportTarget}`,
        { search: search.trim() || undefined },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `terminal_${exportTarget}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      setFeedback({ message: 'Excel export generation failed', type: 'error' });
    }
  }

  // Student Performance Drawer
  async function openStudentPerformance(userId: string) {
    setStudentPerfLoading(true);
    setStudentPerf(null);
    try {
      const res = await api.get(`/admin/students/${userId}/performance`);
      setStudentPerf(res.data);
    } catch (err: any) {
      setFeedback({ message: 'Failed to load student performance data', type: 'error' });
    } finally {
      setStudentPerfLoading(false);
    }
  }

  // Full Multi-Sheet Student Export
  async function handleFullExport() {
    setExportLoading(true);
    try {
      const payload: any = {};
      if (exportFilters.branch.trim()) payload.branch = exportFilters.branch.trim();
      if (exportFilters.section.trim()) payload.section = exportFilters.section.trim();
      if (exportFilters.clubSlug.trim()) payload.clubSlug = exportFilters.clubSlug.trim();
      if (exportFilters.accountStatus) payload.accountStatus = exportFilters.accountStatus;
      if (exportFilters.minScore.trim()) payload.minScore = Number(exportFilters.minScore);
      if (exportFilters.maxScore.trim()) payload.maxScore = Number(exportFilters.maxScore);
      if (exportFilters.search.trim()) payload.search = exportFilters.search.trim();

      const response = await api.post('/admin/export/students-full', payload, { responseType: 'blob' });
      const count = response.headers['x-export-count'];
      if (count) setExportCount(Number(count));
      const url = window.URL.createObjectURL(new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TERMINAL_Students_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setFeedback({ message: `✓ EXPORT COMPLETE — ${count || '?'} students exported across 6 sheets`, type: 'success' });
    } catch (err: any) {
      setFeedback({ message: err.response?.data?.error || 'Export failed', type: 'error' });
    } finally {
      setExportLoading(false);
    }
  }

  // Send Direct Message
  async function handleSendMessage() {
    if (!messageRecipient || !messageInput.trim()) return;
    setActionLoading('sending_message');
    try {
      const res = await api.post('/admin/messages', {
        recipientId: messageRecipient.id,
        content: messageInput.trim(),
      });
      setMessageHistory(prev => [...prev, res.data.message]);
      setMessageInput('');
      setFeedback({ message: `Direct transmission dispatched to ${messageRecipient.name || messageRecipient.email}`, type: 'success' });
    } catch (err: any) {
      setFeedback({ message: err.response?.data?.error || 'Failed to send message', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  }

  // Select user for messaging
  async function selectMessageUser(user: any) {
    setMessageRecipient(user);
    try {
      const res = await api.get(`/admin/messages/${user.id}`);
      setMessageHistory(res.data.messages || []);
    } catch (err: any) {
      console.error('Failed to load message thread', err);
    }
  }

  // Save Content Edit
  async function saveContentEdit() {
    if (!editingContent) return;
    setActionLoading('content_edit');
    try {
      await api.patch(`/admin/content/${contentType}/${editingContent.id}`, editingContent);
      setFeedback({ message: 'Content updated successfully without sending notifications', type: 'success' });
      setEditingContent(null);
      fetchContent(contentType);
    } catch (err: any) {
      setFeedback({ message: err.response?.data?.error || 'Failed to update content', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  }

  // Toggle Content Status
  async function toggleContentStatus(id: string) {
    try {
      await api.patch(`/admin/content/${contentType}/${id}/toggle`);
      setFeedback({ message: 'Content status toggled successfully', type: 'success' });
      fetchContent(contentType);
    } catch (err: any) {
      setFeedback({ message: 'Failed to toggle status', type: 'error' });
    }
  }

  // Update Report Status
  async function updateReportStatus(reportId: string, status: string, notes?: string) {
    try {
      await api.patch(`/admin/reports/${reportId}`, {
        status,
        internalNotes: notes !== undefined ? notes : internalNoteInput,
      });
      setFeedback({ message: `Report marked as ${status}`, type: 'success' });
      setSelectedReport(null);
      fetchReports(reportFilterStatus);
      fetchStats();
    } catch (err: any) {
      setFeedback({ message: 'Failed to update report', type: 'error' });
    }
  }

  // Toggle System Setting
  async function toggleSystemSetting(key: string, currentValue: string) {
    const newValue = currentValue === 'true' ? 'false' : 'true';
    setSavingSetting(true);
    try {
      await api.post('/admin/system-settings', { key, value: newValue });
      setSystemSettings(prev => ({ ...prev, [key]: newValue }));
      setFeedback({ message: `System setting '${key}' updated to ${newValue.toUpperCase()}`, type: 'success' });
    } catch (err: any) {
      setFeedback({ message: 'Failed to update setting', type: 'error' });
    } finally {
      setSavingSetting(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('terminal_token');
    localStorage.removeItem('terminal_user');
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-[#050608] text-[#e6edf3] flex flex-col font-mono" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Cyber Grid */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: 'linear-gradient(rgba(0,255,204,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,204,0.02) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      {/* ── ROOT ADMIN NAVBAR ── */}
      <header className="relative z-50 w-full bg-[#0a0c10] border-b-2 border-[#1a222e] px-4 sm:px-6 py-0 flex flex-wrap items-center justify-between gap-3 shadow-[0_2px_0px_#000]" style={{ minHeight: 52, borderRadius: 0 }}>
        {/* Left: Brand */}
        <div className="flex items-center gap-3 py-2">
          <div className="w-8 h-8 bg-[#ff3366] flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_#000]" style={{ borderRadius: 0 }}>
            <span className="text-white font-black text-xs font-mono">R</span>
          </div>
          <div>
            <div className="font-black text-sm tracking-widest text-white" style={{ fontFamily: "'Orbitron', monospace" }}>
              TERMINAL <span className="text-[#ff3366]">ADMIN</span>
            </div>
            <div className="text-[9px] text-[#5e6b7c] font-mono tracking-[0.2em] uppercase">// ROOT_SINGLETON • SERVER-ENFORCED</div>
          </div>
          <span className="hidden sm:inline text-[9px] font-black px-2 py-0.5 border border-[rgba(255,51,102,0.5)] text-[#ff3366] bg-[rgba(255,51,102,0.08)] tracking-widest" style={{ borderRadius: 0 }}>SUPERADMIN</span>
        </div>

        {/* Center: Global Search */}
        <div className="relative w-full sm:w-72 order-last sm:order-none py-2">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5e6b7c]" />
          <input
            type="text"
            placeholder="Search students, GMs, events, games..."
            value={globalSearch}
            onChange={(e) => handleGlobalSearch(e.target.value)}
            className="w-full bg-[#050608] border border-[#1a222e] text-[11px] font-mono pl-9 pr-3 py-1.5 text-[#e6edf3] placeholder-[#3d4754] focus:border-[rgba(0,255,204,0.5)] outline-none"
            style={{ borderRadius: 0 }}
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a0c10] border-2 border-[rgba(0,255,204,0.4)] shadow-[4px_4px_0px_#000] z-50 max-h-72 overflow-y-auto" style={{ borderRadius: 0 }}>
              {searchResults.map((r, i) => (
                <div
                  key={i}
                  onClick={() => {
                    if (r.linkType === 'user') openUserDetail(r.id);
                    else if (r.linkType === 'game' || r.linkType === 'event') setActiveTab('CONTENT');
                    else if (r.linkType === 'report') setActiveTab('REPORTS');
                    setSearchResults([]);
                  }}
                  className="p-2.5 border-b border-[#1a222e] hover:bg-[#161c24] cursor-pointer font-mono text-xs flex items-center justify-between transition-colors"
                >
                  <div>
                    <div className="text-[#00ffcc] font-bold text-[11px]">{r.title}</div>
                    <div className="text-[#5e6b7c] text-[9px]">{r.subtitle}</div>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 border border-[#2d3848] text-[#8b99aa] uppercase" style={{ borderRadius: 0 }}>{r.category}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2 py-2">
          <Link to="/terminal">
            <button className="text-[10px] font-bold tracking-widest px-2.5 py-1.5 border border-[#2d3848] text-[#8b99aa] bg-[#0f1319] hover:text-white hover:border-[#48566a] transition-all" style={{ borderRadius: 0 }}>PLAYER VIEW</button>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-[10px] font-black tracking-widest px-2.5 py-1.5 border border-[rgba(255,51,102,0.5)] text-[#ff3366] bg-[rgba(255,51,102,0.06)] hover:bg-[rgba(255,51,102,0.15)] transition-all"
            style={{ borderRadius: 0 }}>
            <LogOut size={11} />
            <span className="hidden sm:inline">KILL SESSION</span>
          </button>
        </div>
      </header>

      {/* ── NAVIGATION TABS ── */}
      <div className="relative z-40 bg-[#0a0c10] border-b-2 border-[#1a222e] px-4 sm:px-6 pt-2 flex flex-wrap gap-0 text-xs font-mono select-none">
        {(['USERS', 'CONTENT', 'MESSAGING', 'REPORTS', 'AUDIT_LOGS', 'SYSTEM_CONTROLS'] as AdminTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-[10px] font-black tracking-widest border-t border-l border-r transition-all cursor-pointer ${
              activeTab === tab
                ? 'bg-[#ff3366] text-white border-[#ff3366] shadow-[2px_0px_0px_#000,-1px_0px_0px_#000]'
                : 'bg-[#0f1319] text-[#5e6b7c] border-[#1a222e] hover:text-white hover:bg-[#161c24]'
            }`}
            style={{ borderRadius: 0, marginBottom: '-2px' }}
          >
            {tab === 'USERS' && <Users size={11} />}
            {tab === 'CONTENT' && <Layers size={11} />}
            {tab === 'MESSAGING' && <Mail size={11} />}
            {tab === 'REPORTS' && <FileText size={11} />}
            {tab === 'AUDIT_LOGS' && <Activity size={11} />}
            {tab === 'SYSTEM_CONTROLS' && <Sliders size={11} />}
            <span className="hidden sm:inline">{tab.replace('_', ' ')}</span>
            {tab === 'REPORTS' && (stats?.openReports ?? 0) > 0 && (
              <span className="px-1.5 py-0.5 bg-[#ff3366] text-white text-[8px] font-black" style={{ borderRadius: 0 }}>{stats?.openReports}</span>
            )}
            {tab === 'USERS' && (stats?.pendingGameMasters ?? 0) > 0 && (
              <span className="px-1.5 py-0.5 bg-[#fcce0a] text-black text-[8px] font-black animate-pulse" style={{ borderRadius: 0 }}>{stats?.pendingGameMasters}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── MAIN BODY ── */}
      <main className="relative z-10 flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full flex flex-col gap-5">

        {/* ── TELEMETRY STRIP ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">

          <div className="bg-[#0f131d] border border-[#2d3848] shadow-[3px_3px_0px_#000] p-2.5 sm:p-3.5 flex flex-col gap-1.5 relative min-w-0" style={{ borderRadius: 0 }}>
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#00ffcc]" />
            <div className="flex items-center justify-between"><span className="text-[9px] font-bold tracking-[0.2em] text-[#5e6b7c] uppercase truncate">Students</span><Users size={12} className="text-[#00ffcc] shrink-0" /></div>
            <div className="font-black text-xl sm:text-2xl font-mono text-[#00ffcc] truncate">{stats?.totalStudents ?? '—'}</div>
            <div className="text-[8.5px] sm:text-[9px] text-[#3d4754] font-mono uppercase tracking-widest truncate">ENROLLED PLAYERS</div>
          </div>

          <div className="bg-[#0f1319] border border-[#2d3848] shadow-[3px_3px_0px_#000] p-3.5 flex flex-col gap-1.5 relative" style={{ borderRadius: 0 }}>
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#a855f7]" />
            <div className="flex items-center justify-between"><span className="text-[9px] font-bold tracking-[0.2em] text-[#5e6b7c] uppercase">Game Masters</span><ShieldCheck size={12} className="text-[#a855f7]" /></div>
            <div className="font-black text-2xl font-mono text-[#a855f7]">{stats?.totalGameMasters ?? '—'}</div>
            <div className="text-[9px] text-[#3d4754] font-mono uppercase tracking-widest">HOST IDENTITIES</div>
          </div>

          <div
            onClick={() => { setActiveTab('USERS'); setTarget('gamemasters'); setFilterField('approvalStatus'); setFilterValue('PENDING'); executeQuery({ target: 'gamemasters', filters: [{ field: 'approvalStatus', operator: 'EQUALS', value: 'PENDING' }] }); }}
            className="bg-[#0f1319] border-2 border-[rgba(252,206,10,0.5)] shadow-[3px_3px_0px_#000] p-3.5 flex flex-col gap-1.5 relative cursor-pointer hover:border-[#fcce0a] transition-all"
            style={{ borderRadius: 0 }}>
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#fcce0a]" />
            <div className="flex items-center justify-between"><span className="text-[9px] font-bold tracking-[0.2em] text-[#fcce0a] uppercase">Pending GMs</span><Clock size={12} className="text-[#fcce0a] animate-pulse" /></div>
            <div className="font-black text-2xl font-mono text-[#fcce0a]">{stats?.pendingGameMasters ?? '—'}</div>
            <div className="text-[9px] text-[#fcce0a] font-mono uppercase tracking-widest font-bold">REQUIRES APPROVAL</div>
          </div>

          <div className="bg-[#0f1319] border border-[#2d3848] shadow-[3px_3px_0px_#000] p-3.5 flex flex-col gap-1.5 relative" style={{ borderRadius: 0 }}>
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#ff007f]" />
            <div className="flex items-center justify-between"><span className="text-[9px] font-bold tracking-[0.2em] text-[#5e6b7c] uppercase">Live Sessions</span><Terminal size={12} className="text-[#ff007f]" /></div>
            <div className="font-black text-2xl font-mono text-[#ff007f]">{stats?.activeSessions ?? '—'}</div>
            <div className="text-[9px] text-[#3d4754] font-mono uppercase tracking-widest">RUNNING LIVE</div>
          </div>

          <div
            onClick={() => setActiveTab('REPORTS')}
            className="bg-[#0f1319] border border-[#2d3848] shadow-[3px_3px_0px_#000] p-3.5 flex flex-col gap-1.5 relative cursor-pointer hover:border-[rgba(255,51,102,0.5)] transition-all"
            style={{ borderRadius: 0 }}>
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#ff3366]" />
            <div className="flex items-center justify-between"><span className="text-[9px] font-bold tracking-[0.2em] text-[#5e6b7c] uppercase">Open Reports</span><FileText size={12} className="text-[#ff3366]" /></div>
            <div className="font-black text-2xl font-mono text-[#ff3366]">{stats?.openReports ?? '—'}</div>
            <div className="text-[9px] text-[#3d4754] font-mono uppercase tracking-widest">UNDER REVIEW</div>
          </div>

          <div className="bg-[#0f1319] border border-[#2d3848] shadow-[3px_3px_0px_#000] p-3.5 flex flex-col gap-1.5 relative" style={{ borderRadius: 0 }}>
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#3fb950]" />
            <div className="flex items-center justify-between"><span className="text-[9px] font-bold tracking-[0.2em] text-[#5e6b7c] uppercase">Active Events</span><Activity size={12} className="text-[#3fb950]" /></div>
            <div className="font-black text-2xl font-mono text-[#3fb950]">{stats?.activeEvents ?? '—'}</div>
            <div className="text-[9px] text-[#3d4754] font-mono uppercase tracking-widest">PUBLISHED</div>
          </div>

        </div>

        {/* ── FEEDBACK BANNER ── */}
        {feedback && (
          <div className={`p-3.5 border-2 font-mono text-xs flex items-center justify-between shadow-[3px_3px_0px_#000] ${
            feedback.type === 'success'
              ? 'border-[rgba(63,185,80,0.5)] bg-[rgba(63,185,80,0.08)] text-[#3fb950]'
              : 'border-[rgba(255,51,102,0.5)] bg-[rgba(255,51,102,0.08)] text-[#ff3366]'
          }`} style={{ borderRadius: 0 }}>
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              <span className="font-bold uppercase tracking-wide text-[11px]">{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-[9px] font-bold uppercase border border-current px-2 py-0.5 hover:bg-current hover:text-black transition-all" style={{ borderRadius: 0 }}>DISMISS</button>
          </div>
        )}

        {/* TAB 1: USER MANAGEMENT */}
        {activeTab === 'USERS' && (
          <div className="flex flex-col gap-4">
            {/* PARAMETERIZED QUERY CONSOLE */}
            <div className="bg-[#0f131d] border-2 border-zinc-800 p-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-zinc-400 uppercase">TABLE:</span>
                  <div className="flex border border-zinc-700 bg-[#080a10]">
                    <button
                      onClick={() => { setTarget('students'); setPage(1); }}
                      className={`px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                        target === 'students' ? 'bg-cyan-500 text-black' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      students (PLAYER)
                    </button>
                    <button
                      onClick={() => { setTarget('gamemasters'); setPage(1); }}
                      className={`px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                        target === 'gamemasters' ? 'bg-blue-500 text-white' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      game_masters (GM)
                    </button>
                    <button
                      onClick={() => { setTarget('users'); setPage(1); }}
                      className={`px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                        target === 'users' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      all_users (GLOBAL)
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (target === 'students') {
                        setExportPanelOpen(true);
                      } else {
                        handleExportExcel(target);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600 text-emerald-300 font-mono text-xs font-bold"
                  >
                    <FileSpreadsheet size={13} />
                    <span>{target === 'students' ? 'EXPORT XLSX (6 SHEETS)' : 'EXPORT EXCEL (.XLSX)'}</span>
                  </button>

                  {selectedUserIds.length > 0 && (
                    <button
                      onClick={() => setBulkActionModal('bulk')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950 border border-cyan-500 text-cyan-300 font-mono text-xs font-bold rounded"
                    >
                      <span>BULK ACTIONS ({selectedUserIds.length})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Filter inputs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search keywords..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && executeQuery({ page: 1 })}
                    className="w-full bg-[#080a10] border border-zinc-700 text-white font-mono text-xs pl-8 pr-3 py-2 outline-none focus:border-cyan-400"
                  />
                </div>

                <select
                  value={filterField}
                  onChange={(e) => setFilterField(e.target.value)}
                  className="bg-[#080a10] border border-zinc-700 text-white font-mono text-xs px-3 py-2 outline-none focus:border-cyan-400"
                >
                  <option value="">-- Allowlisted Field --</option>
                  <option value="name">name</option>
                  <option value="email">email</option>
                  {target === 'students' && (
                    <>
                      <option value="usn">usn</option>
                      <option value="branch">branch</option>
                      <option value="section">section</option>
                    </>
                  )}
                  {target === 'gamemasters' && (
                    <>
                      <option value="phoneNumber">phoneNumber</option>
                      <option value="approvalStatus">approvalStatus</option>
                    </>
                  )}
                  <option value="accountStatus">accountStatus</option>
                  <option value="isVerified">isVerified</option>
                </select>

                <select
                  value={filterOp}
                  onChange={(e) => setFilterOp(e.target.value)}
                  className="bg-[#080a10] border border-zinc-700 text-white font-mono text-xs px-3 py-2 outline-none focus:border-cyan-400"
                >
                  <option value="EQUALS">= (EQUALS)</option>
                  <option value="NOT_EQUALS">!= (NOT EQUALS)</option>
                  <option value="CONTAINS">LIKE %val% (CONTAINS)</option>
                  <option value="STARTS_WITH">LIKE val% (STARTS WITH)</option>
                </select>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Value..."
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && executeQuery({ page: 1 })}
                    className="flex-1 bg-[#080a10] border border-zinc-700 text-white font-mono text-xs px-3 py-2 outline-none focus:border-cyan-400"
                  />
                  <button
                    onClick={() => { setPage(1); executeQuery({ page: 1 }); }}
                    disabled={loading}
                    className="bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs px-4 py-2 uppercase flex items-center gap-1 shrink-0"
                  >
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    <span>QUERY</span>
                  </button>
                </div>
              </div>

              {sqlPreview && (
                <div className="bg-[#050608] border border-zinc-800 p-2.5 font-mono text-xs text-cyan-400 flex flex-col gap-1 overflow-x-auto">
                  <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">// SAFE PARAMETERIZED QUERY PREVIEW:</span>
                  <pre className="whitespace-pre-wrap">{sqlPreview}</pre>
                </div>
              )}
            </div>

            {/* USERS DATA TABLE */}
            <div className="bg-[#0f131d] border-2 border-zinc-800 overflow-hidden flex flex-col">
              <div className="p-3 border-b border-zinc-800 flex items-center justify-between font-mono text-xs">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={records.length > 0 && selectedUserIds.length === records.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedUserIds(records.map(r => r.id));
                      else setSelectedUserIds([]);
                    }}
                    className="accent-cyan-500"
                  />
                  <span className="text-zinc-400">
                    Showing <strong className="text-white">{records.length}</strong> of <strong className="text-white">{totalCount}</strong> users
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { if (page > 1) { setPage(page - 1); executeQuery({ page: page - 1 }); } }}
                    disabled={page <= 1 || loading}
                    className="p-1 border border-zinc-700 hover:border-zinc-500 disabled:opacity-30"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-zinc-400">Page {page} / {totalPages}</span>
                  <button
                    onClick={() => { if (page < totalPages) { setPage(page + 1); executeQuery({ page: page + 1 }); } }}
                    disabled={page >= totalPages || loading}
                    className="p-1 border border-zinc-700 hover:border-zinc-500 disabled:opacity-30"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#141824] text-zinc-400 uppercase border-b border-zinc-800">
                      <th className="p-3 w-8"></th>
                      <th className="p-3">Identity</th>
                      {target === 'students' ? (
                        <>
                          <th className="p-3">Handle</th>
                          <th className="p-3">USN</th>
                          <th className="p-3">Branch/Sect</th>
                          <th className="p-3">Status</th>
                        </>
                      ) : (
                        <>
                          <th className="p-3">Email / USN</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Verification</th>
                        </>
                      )}
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-zinc-500 font-mono">
                          No users match the search/filter criteria.
                        </td>
                      </tr>
                    ) : (
                      records.map((user) => (
                        <tr key={user.id} className="hover:bg-[#151c2c]/40 transition-colors group">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(user.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedUserIds(prev => [...prev, user.id]);
                                else setSelectedUserIds(prev => prev.filter(id => id !== user.id));
                              }}
                              className="accent-cyan-500"
                            />
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{user.name || user.username || '—'}</span>
                              <span className="text-[10px] px-1.5 py-0.2 bg-zinc-800 text-zinc-300 font-normal">
                                {user.role || (target === 'students' ? 'PLAYER' : 'GAME_MASTER')}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-600">ID: {user.id.slice(0, 12)}…</div>
                          </td>
                          {target === 'students' ? (
                            <>
                              <td className="p-3">
                                <div className="text-cyan-400 font-bold font-mono text-[11px]">{user.username ? `${user.username}@terminal` : '—'}</div>
                                <div className="text-zinc-500 text-[10px]">{user.email}</div>
                              </td>
                              <td className="p-3">
                                <div className="text-amber-300 font-mono font-bold text-[11px]">{user.usn || '—'}</div>
                              </td>
                              <td className="p-3">
                                <div className="text-zinc-300 text-[11px]">{user.branch || '—'} {user.section ? `/ ${user.section}` : ''}</div>
                                <div className={`mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold ${
                                  user.accountStatus === 'ACTIVE' ? 'text-emerald-400' :
                                  user.accountStatus === 'BLOCKED' ? 'text-red-400' : 'text-amber-400'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    user.accountStatus === 'ACTIVE' ? 'bg-emerald-400' :
                                    user.accountStatus === 'BLOCKED' ? 'bg-red-400' : 'bg-amber-400'
                                  }`}></span>
                                  {user.accountStatus}
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-3">
                                <div className="text-zinc-200">{user.email}</div>
                                {user.usn && <div className="text-cyan-400 font-bold text-[11px]">{user.usn}</div>}
                                {user.phoneNumber && <div className="text-zinc-400 text-[11px]">{user.phoneNumber}</div>}
                              </td>
                              <td className="p-3">
                                <div className="flex flex-col gap-1">
                                  {user.accountStatus === 'ACTIVE' && (
                                    <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-bold">
                                      <CheckCircle2 size={12} /> ACTIVE
                                    </span>
                                  )}
                                  {user.accountStatus === 'BLOCKED' && (
                                    <span className="inline-flex items-center gap-1 text-red-400 text-[11px] font-bold">
                                      <Ban size={12} /> BLOCKED
                                    </span>
                                  )}
                                  {user.accountStatus === 'SUSPENDED' && (
                                    <span className="inline-flex items-center gap-1 text-amber-400 text-[11px] font-bold">
                                      <AlertTriangle size={12} /> SUSPENDED
                                    </span>
                                  )}
                                  {user.approvalStatus === 'PENDING' && (
                                    <span className="inline-flex items-center gap-1 text-amber-300 text-[10px] font-bold bg-amber-950/60 px-1.5 py-0.5 border border-amber-700 animate-pulse">
                                      <Clock size={10} /> GM PENDING
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3">
                                {user.isVerified ? (
                                  <span className="text-cyan-400 font-bold flex items-center gap-1 text-[11px]">
                                    <ShieldCheck size={13} /> VERIFIED
                                  </span>
                                ) : (
                                  <span className="text-zinc-500 text-[11px]">UNVERIFIED</span>
                                )}
                              </td>
                            </>
                          )}
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Student Performance Drawer (students only) */}
                              {target === 'students' && (
                                <button
                                  onClick={() => openStudentPerformance(user.id)}
                                  title="View Student Performance"
                                  className="p-1.5 bg-[#0b1020] hover:bg-emerald-950 border border-emerald-800 text-emerald-400"
                                >
                                  <Activity size={13} />
                                </button>
                              )}
                              {/* Open Details */}
                              <button
                                onClick={() => openUserDetail(user.id)}
                                title="View Details & Timeline"
                                className="p-1.5 bg-[#171b26] hover:bg-cyan-950 border border-zinc-700 text-cyan-300"
                              >
                                <Eye size={13} />
                              </button>

                              {/* Edit details */}
                              <button
                                onClick={() => setEditingUser(user)}
                                title="Edit User"
                                className="p-1.5 bg-[#171b26] hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded"
                              >
                                <Edit2 size={13} />
                              </button>

                              {/* GM Approval Buttons */}
                              {user.approvalStatus === 'PENDING' && (
                                <button
                                  onClick={() => updateUserStatus(user.id, { approvalStatus: 'APPROVED' }, 'Game Master approved')}
                                  title="Approve GM"
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-[10px] rounded"
                                >
                                  APPROVE
                                </button>
                              )}

                              {/* Block / Unblock */}
                              {user.accountStatus === 'BLOCKED' ? (
                                <button
                                  onClick={() => updateUserStatus(user.id, { accountStatus: 'ACTIVE' }, 'User unblocked')}
                                  title="Unblock User"
                                  className="p-1.5 bg-emerald-950 border border-emerald-700 text-emerald-300 rounded"
                                >
                                  <Unlock size={13} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => updateUserStatus(user.id, { accountStatus: 'BLOCKED' }, 'User blocked')}
                                  title="Block User"
                                  className="p-1.5 bg-red-950 border border-red-700 text-red-300 rounded"
                                >
                                  <Ban size={13} />
                                </button>
                              )}

                              {/* Message User */}
                              <button
                                onClick={() => { selectMessageUser(user); setActiveTab('MESSAGING'); }}
                                title="Direct Message"
                                className="p-1.5 bg-[#171b26] hover:bg-blue-950 border border-zinc-700 text-blue-300 rounded"
                              >
                                <Mail size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CONTENT MANAGEMENT */}
        {activeTab === 'CONTENT' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between bg-[#0f131d] border-2 border-zinc-800 p-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-zinc-400 uppercase">CONTENT DOMAIN:</span>
                <div className="flex border border-zinc-700 bg-[#080a10]">
                  {(['games', 'events', 'clubs', 'challenges'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setContentType(t)}
                      className={`px-3 py-1.5 font-mono text-xs font-bold transition-all uppercase ${
                        contentType === t ? 'bg-cyan-500 text-black' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleExportExcel(contentType)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950 border border-emerald-600 text-emerald-300 font-mono text-xs font-bold rounded"
              >
                <FileSpreadsheet size={13} />
                <span>EXPORT {contentType.toUpperCase()} (.XLSX)</span>
              </button>
            </div>

            <div className="bg-[#0f131d] border-2 border-zinc-800 overflow-hidden">
              <div className="p-3 border-b border-zinc-800 text-xs font-mono text-zinc-400">
                Managing <strong className="text-white">{contentList.length}</strong> {contentType}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#141824] text-zinc-400 uppercase border-b border-zinc-800">
                      <th className="p-3">Title / Prompt</th>
                      <th className="p-3">Attributes</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {contentList.map(item => (
                      <tr key={item.id} className="hover:bg-[#151c2c]/40">
                        <td className="p-3">
                          <div className="font-bold text-white">{item.name || item.prompt || 'Untitled'}</div>
                          <div className="text-[10px] text-zinc-500">ID: {item.id}</div>
                        </td>
                        <td className="p-3 text-zinc-300 text-[11px]">
                          {item.template && <div>Template: {item.template}</div>}
                          {item.mode && <div>Mode: {item.mode}</div>}
                          {item.focus && <div>Focus: {item.focus}</div>}
                          {item.points !== undefined && <div>Points: {item.points} PTS</div>}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[10px] font-bold border ${
                            item.status === 'PUBLISHED' || item.status === 'ACTIVE'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}>
                            {item.status || 'ACTIVE'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditingContent(item)}
                              className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] rounded"
                            >
                              EDIT
                            </button>
                            <button
                              onClick={() => toggleContentStatus(item.id)}
                              className="px-2 py-1 bg-cyan-950 border border-cyan-600 hover:bg-cyan-900 text-cyan-300 text-[11px] font-bold rounded"
                            >
                              TOGGLE
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DIRECT MESSAGING */}
        {activeTab === 'MESSAGING' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* User Search & Selection */}
            <div className="bg-[#0f131d] border-2 border-zinc-800 p-4 flex flex-col gap-3">
              <span className="font-mono text-xs font-bold text-cyan-400 uppercase">SELECT RECIPIENT:</span>
              <input
                type="text"
                placeholder="Search user name or email..."
                value={messageUserSearch}
                onChange={async (e) => {
                  setMessageUserSearch(e.target.value);
                  if (e.target.value.trim().length > 1) {
                    const res = await api.get(`/admin/search?q=${encodeURIComponent(e.target.value.trim())}`);
                    setMessageUserResults((res.data.results || []).filter((r: any) => r.linkType === 'user'));
                  } else {
                    setMessageUserResults([]);
                  }
                }}
                className="bg-[#080a10] border border-zinc-700 text-white font-mono text-xs px-3 py-2 outline-none focus:border-cyan-400"
              />

              <div className="flex-1 overflow-y-auto max-h-96 space-y-1.5">
                {messageUserResults.map((u, i) => (
                  <div
                    key={i}
                    onClick={() => selectMessageUser(u.data)}
                    className={`p-2 border cursor-pointer font-mono text-xs transition-colors ${
                      messageRecipient?.id === u.id
                        ? 'bg-cyan-950 border-cyan-400 text-white'
                        : 'bg-[#121622] border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold">{u.title}</div>
                    <div className="text-[10px] text-zinc-500">{u.subtitle}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Conversation Thread */}
            <div className="md:col-span-2 bg-[#0f131d] border-2 border-zinc-800 p-4 flex flex-col justify-between h-[520px]">
              <div>
                <div className="border-b border-zinc-800 pb-2 mb-3 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-white">
                    THREAD WITH: <span className="text-cyan-400">{messageRecipient ? `${messageRecipient.name || messageRecipient.email} (${messageRecipient.role})` : 'Select user on the left'}</span>
                  </span>
                  {messageRecipient && (
                    <span className="text-[10px] font-mono text-zinc-500">ID: {messageRecipient.id}</span>
                  )}
                </div>

                <div className="overflow-y-auto h-[360px] space-y-2 pr-2">
                  {messageHistory.length === 0 ? (
                    <div className="text-center text-zinc-600 font-mono text-xs py-12">
                      No transmission history recorded.
                    </div>
                  ) : (
                    messageHistory.map((m, i) => (
                      <div
                        key={i}
                        className={`p-3 font-mono text-xs max-w-lg rounded border ${
                          m.sender?.role === 'ADMIN' || m.sender?.username === 'root'
                            ? 'ml-auto bg-cyan-950/60 border-cyan-600 text-cyan-200'
                            : 'mr-auto bg-[#141824] border-zinc-700 text-zinc-200'
                        }`}
                      >
                        <div className="text-[10px] text-zinc-400 mb-1 flex items-center justify-between">
                          <span>{m.sender?.name || m.sender?.username || 'Sender'}</span>
                          <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Message Input */}
              <div className="pt-3 border-t border-zinc-800 flex gap-2">
                <input
                  type="text"
                  placeholder={messageRecipient ? "Type transmission to student or GM..." : "Select a recipient first"}
                  disabled={!messageRecipient}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 bg-[#080a10] border border-zinc-700 text-white font-mono text-xs px-3 py-2 outline-none focus:border-cyan-400 disabled:opacity-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageRecipient || !messageInput.trim()}
                  className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black font-mono font-bold text-xs px-4 py-2 flex items-center gap-1.5"
                >
                  <Send size={13} />
                  <span>TRANSMIT</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: REPORTS */}
        {activeTab === 'REPORTS' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between bg-[#0f131d] border-2 border-zinc-800 p-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-zinc-400 uppercase">STATUS FILTER:</span>
                <select
                  value={reportFilterStatus}
                  onChange={(e) => { setReportFilterStatus(e.target.value); fetchReports(e.target.value); }}
                  className="bg-[#080a10] border border-zinc-700 text-white font-mono text-xs px-3 py-1.5 outline-none"
                >
                  <option value="">ALL STATUSES</option>
                  <option value="PENDING">PENDING</option>
                  <option value="REVIEWING">REVIEWING</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>

              <button
                onClick={() => handleExportExcel('reports')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950 border border-emerald-600 text-emerald-300 font-mono text-xs font-bold rounded"
              >
                <FileSpreadsheet size={13} />
                <span>EXPORT REPORTS (.XLSX)</span>
              </button>
            </div>

            <div className="bg-[#0f131d] border-2 border-zinc-800 overflow-hidden">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="bg-[#141824] text-zinc-400 uppercase border-b border-zinc-800">
                    <th className="p-3">Report Details</th>
                    <th className="p-3">Reporter</th>
                    <th className="p-3">Reported User</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {reportsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-zinc-500 font-mono">
                        No incident reports found.
                      </td>
                    </tr>
                  ) : (
                    reportsList.map(r => (
                      <tr key={r.id} className="hover:bg-[#151c2c]/40">
                        <td className="p-3">
                          <div className="font-bold text-white">{r.reason}</div>
                          <div className="text-[10px] text-zinc-400">{r.details || 'No additional details'}</div>
                          <div className="text-[9px] text-zinc-500 mt-0.5">Type: {r.targetType} • Filed: {new Date(r.createdAt).toLocaleString()}</div>
                        </td>
                        <td className="p-3 text-zinc-300">
                          {r.reporter?.name || r.reporter?.email || r.reporterId || 'Anonymous'}
                        </td>
                        <td className="p-3 text-zinc-300">
                          {r.reportedUser?.name || r.reportedUser?.email || r.reportedUserId || 'N/A'}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[10px] font-bold border ${
                            r.status === 'RESOLVED' ? 'bg-emerald-950 text-emerald-300 border-emerald-700' :
                            r.status === 'REVIEWING' ? 'bg-blue-950 text-blue-300 border-blue-700' :
                            r.status === 'REJECTED' ? 'bg-zinc-800 text-zinc-400 border-zinc-700' :
                            'bg-amber-950 text-amber-300 border-amber-700 animate-pulse'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => { setSelectedReport(r); setInternalNoteInput(r.internalNotes || ''); }}
                            className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-600 text-cyan-300 text-xs font-bold rounded"
                          >
                            MANAGE
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: AUDIT LOGS */}
        {activeTab === 'AUDIT_LOGS' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between bg-[#0f131d] border-2 border-zinc-800 p-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-zinc-400 uppercase">ACTION FILTER:</span>
                <select
                  value={auditFilterAction}
                  onChange={(e) => { setAuditFilterAction(e.target.value); fetchAuditLogs(e.target.value); }}
                  className="bg-[#080a10] border border-zinc-700 text-white font-mono text-xs px-3 py-1.5 outline-none"
                >
                  <option value="">ALL ACTIONS</option>
                  <option value="USER_STATUS_CHANGED">USER_STATUS_CHANGED</option>
                  <option value="USER_EDITED">USER_EDITED</option>
                  <option value="GM_APPROVED">GM_APPROVED</option>
                  <option value="GM_REJECTED">GM_REJECTED</option>
                  <option value="CONTENT_EDITED">CONTENT_EDITED</option>
                  <option value="MESSAGE_SENT">MESSAGE_SENT</option>
                  <option value="SYSTEM_CONFIG_CHANGED">SYSTEM_CONFIG_CHANGED</option>
                  <option value="EXPORT_EXCEL">EXPORT_EXCEL</option>
                </select>
              </div>

              <button
                onClick={() => handleExportExcel('audit_logs')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950 border border-emerald-600 text-emerald-300 font-mono text-xs font-bold rounded"
              >
                <FileSpreadsheet size={13} />
                <span>EXPORT AUDIT LOG (.XLSX)</span>
              </button>
            </div>

            <div className="bg-[#0f131d] border-2 border-zinc-800 overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-[#141824] text-zinc-400 uppercase border-b border-zinc-800">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Admin</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Target</th>
                    <th className="p-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {auditLogs.map(l => (
                    <tr key={l.id} className="hover:bg-[#151c2c]/40">
                      <td className="p-3 text-zinc-400 text-[11px]">{new Date(l.createdAt).toLocaleString()}</td>
                      <td className="p-3 font-bold text-cyan-300">{l.adminUsername}</td>
                      <td className="p-3">
                        <span className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-200 text-[10px] font-bold">
                          {l.action}
                        </span>
                      </td>
                      <td className="p-3 text-zinc-300">{l.targetType} {l.targetId ? `(${l.targetId.slice(0, 8)}...)` : ''}</td>
                      <td className="p-3 text-zinc-400 text-[11px] max-w-xs truncate">
                        {l.details ? JSON.stringify(l.details) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: SYSTEM CONTROLS */}
        {activeTab === 'SYSTEM_CONTROLS' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0f131d] border-2 border-zinc-800 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-white uppercase">STUDENT REGISTRATION</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 border ${
                    systemSettings.student_registration_enabled === 'true'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      : 'bg-red-950 text-red-300 border-red-700'
                  }`}>
                    {systemSettings.student_registration_enabled === 'true' ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <p className="text-zinc-400 text-xs font-mono mb-4">
                  Controls whether students can create new accounts. When disabled, the server strictly returns HTTP 403 on registration attempts.
                </p>
              </div>

              <button
                onClick={() => toggleSystemSetting('student_registration_enabled', systemSettings.student_registration_enabled)}
                disabled={savingSetting}
                className={`py-2 text-xs font-mono font-bold uppercase transition-all ${
                  systemSettings.student_registration_enabled === 'true'
                    ? 'bg-red-950 border border-red-700 text-red-300 hover:bg-red-900'
                    : 'bg-emerald-600 text-black hover:bg-emerald-500'
                }`}
              >
                {systemSettings.student_registration_enabled === 'true' ? 'DISABLE REGISTRATION' : 'ENABLE REGISTRATION'}
              </button>
            </div>

            <div className="bg-[#0f131d] border-2 border-zinc-800 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-white uppercase">GAME MASTER REGISTRATION</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 border ${
                    systemSettings.gm_registration_enabled === 'true'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      : 'bg-red-950 text-red-300 border-red-700'
                  }`}>
                    {systemSettings.gm_registration_enabled === 'true' ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <p className="text-zinc-400 text-xs font-mono mb-4">
                  Controls whether new Game Masters can submit registration requests. Approved GMs remain unaffected.
                </p>
              </div>

              <button
                onClick={() => toggleSystemSetting('gm_registration_enabled', systemSettings.gm_registration_enabled)}
                disabled={savingSetting}
                className={`py-2 text-xs font-mono font-bold uppercase transition-all ${
                  systemSettings.gm_registration_enabled === 'true'
                    ? 'bg-red-950 border border-red-700 text-red-300 hover:bg-red-900'
                    : 'bg-emerald-600 text-black hover:bg-emerald-500'
                }`}
              >
                {systemSettings.gm_registration_enabled === 'true' ? 'DISABLE GM REGISTRATION' : 'ENABLE GM REGISTRATION'}
              </button>
            </div>

            <div className="bg-[#0f131d] border-2 border-amber-600/60 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-amber-400 uppercase">MAINTENANCE MODE</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 border ${
                    systemSettings.maintenance_mode === 'true'
                      ? 'bg-red-950 text-red-300 border-red-700 animate-pulse'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}>
                    {systemSettings.maintenance_mode === 'true' ? 'ACTIVE' : 'OFFLINE'}
                  </span>
                </div>
                <p className="text-zinc-400 text-xs font-mono mb-4">
                  Locks the platform. Only the Root Administrator can log in; all other student and Game Master requests receive HTTP 503.
                </p>
              </div>

              <button
                onClick={() => toggleSystemSetting('maintenance_mode', systemSettings.maintenance_mode)}
                disabled={savingSetting}
                className={`py-2 text-xs font-mono font-bold uppercase transition-all ${
                  systemSettings.maintenance_mode === 'true'
                    ? 'bg-emerald-600 text-black hover:bg-emerald-500'
                    : 'bg-amber-600 text-black hover:bg-amber-500'
                }`}
              >
                {systemSettings.maintenance_mode === 'true' ? 'DISABLE MAINTENANCE' : 'ACTIVATE MAINTENANCE'}
              </button>
            </div>
          </div>
        )}

      </main>

      {/* USER DETAIL & TIMELINE MODAL */}
      <TerminalModal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.name || 'USER AUDIT & TELEMETRY'}
        headerTag={`// ROLE_${selectedUser?.role}`}
        maxWidth="4xl"
      >
        {selectedUser && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-[var(--term-bg-base)] p-2.5 border border-[var(--term-border-subtle)]">
                <span className="text-[var(--term-text-muted)] text-[10px] block">NAME</span>
                <span className="text-white font-bold">{selectedUser.name || '—'}</span>
              </div>
              <div className="bg-[var(--term-bg-base)] p-2.5 border border-[var(--term-border-subtle)]">
                <span className="text-[var(--term-text-muted)] text-[10px] block">EMAIL</span>
                <span className="text-zinc-200">{selectedUser.email}</span>
              </div>
              <div className="bg-[var(--term-bg-base)] p-2.5 border border-[var(--term-border-subtle)]">
                <span className="text-[var(--term-text-muted)] text-[10px] block">USN</span>
                <span className="text-[var(--term-cyan)] font-bold">{selectedUser.usn || 'N/A'}</span>
              </div>
              <div className="bg-[var(--term-bg-base)] p-2.5 border border-[var(--term-border-subtle)]">
                <span className="text-[var(--term-text-muted)] text-[10px] block">PHONE</span>
                <span className="text-zinc-200">{selectedUser.phoneNumber || 'N/A'}</span>
              </div>
              <div className="bg-[var(--term-bg-base)] p-2.5 border border-[var(--term-border-subtle)]">
                <span className="text-[var(--term-text-muted)] text-[10px] block">ACCOUNT STATUS</span>
                <TerminalBadge variant={selectedUser.accountStatus === 'ACTIVE' ? 'green' : selectedUser.accountStatus === 'BLOCKED' ? 'red' : 'yellow'}>
                  {selectedUser.accountStatus}
                </TerminalBadge>
              </div>
              <div className="bg-[var(--term-bg-base)] p-2.5 border border-[var(--term-border-subtle)]">
                <span className="text-[var(--term-text-muted)] text-[10px] block">APPROVAL</span>
                <TerminalBadge variant={selectedUser.approvalStatus === 'APPROVED' ? 'green' : 'yellow'}>
                  {selectedUser.approvalStatus}
                </TerminalBadge>
              </div>
              <div className="bg-[var(--term-bg-base)] p-2.5 border border-[var(--term-border-subtle)]">
                <span className="text-[var(--term-text-muted)] text-[10px] block">CREATED</span>
                <span className="text-[var(--term-text-secondary)]">{new Date(selectedUser.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="bg-[var(--term-bg-base)] p-2.5 border border-[var(--term-border-subtle)]">
                <span className="text-[var(--term-text-muted)] text-[10px] block">LAST LOGIN</span>
                <span className="text-[var(--term-text-secondary)]">{selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleDateString() : 'Never'}</span>
              </div>
            </div>

            {/* Lifecycle Timeline */}
            <div className="border-t border-[var(--term-border-subtle)] pt-4">
              <span className="font-mono text-xs font-bold text-[var(--term-cyan)] block mb-3 uppercase">// LIFECYCLE TIMELINE:</span>
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1 scroll-area">
                {timelineLoading ? (
                  <div className="text-center font-mono text-xs text-[var(--term-text-muted)] py-4">Loading timeline...</div>
                ) : userTimeline.length === 0 ? (
                  <div className="text-center font-mono text-xs text-[var(--term-text-muted)] py-4">No timeline events recorded.</div>
                ) : (
                  userTimeline.map((item, idx) => (
                    <div key={idx} className="bg-[var(--term-bg-base)] border border-[var(--term-border-subtle)] p-2.5 font-mono text-xs flex items-start justify-between gap-3">
                      <div>
                        <div className="text-zinc-200 font-bold">{item.title}</div>
                        <div className="text-[10px] text-[var(--term-text-muted)]">{item.type} {item.details ? `• ${JSON.stringify(item.details)}` : ''}</div>
                      </div>
                      <span className="text-[10px] text-[var(--term-text-muted)] shrink-0">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </TerminalModal>

      {/* EDIT USER MODAL */}
      <TerminalModal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="EDIT USER DETAILS"
        headerTag="// IDENTITY_PATCH"
        maxWidth="md"
      >
        {editingUser && (
          <div className="flex flex-col gap-4 font-mono text-xs">
            <TerminalInput
              label="DISPLAY NAME"
              value={editingUser.name || ''}
              onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
            />

            <TerminalInput
              label="EMAIL ADDRESS"
              type="email"
              value={editingUser.email || ''}
              onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
            />

            {editingUser.role === 'PLAYER' && (
              <>
                <TerminalInput
                  label="USN"
                  value={editingUser.usn || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, usn: e.target.value.toUpperCase() })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <TerminalInput
                    label="BRANCH"
                    value={editingUser.branch || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, branch: e.target.value })}
                  />
                  <TerminalInput
                    label="SECTION"
                    value={editingUser.section || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, section: e.target.value })}
                  />
                </div>
              </>
            )}

            {editingUser.role === 'GAME_MASTER' && (
              <TerminalInput
                label="PHONE NUMBER"
                value={editingUser.phoneNumber || ''}
                onChange={(e) => setEditingUser({ ...editingUser, phoneNumber: e.target.value })}
              />
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--term-border-subtle)] mt-2">
              <TerminalButton
                onClick={() => setEditingUser(null)}
                variant="ghost"
                size="sm"
              >
                CANCEL
              </TerminalButton>
              <TerminalButton
                onClick={saveUserEdit}
                disabled={actionLoading === 'edit'}
                variant="primary"
                size="sm"
              >
                SAVE CHANGES
              </TerminalButton>
            </div>
          </div>
        )}
      </TerminalModal>

      {/* BULK ACTION CONFIRMATION MODAL */}
      <TerminalModal
        isOpen={!!bulkActionModal}
        onClose={() => setBulkActionModal(null)}
        title={`BULK ACTION (${selectedUserIds.length} USERS)`}
        headerTag="// BATCH_OPS"
        maxWidth="md"
      >
        <div className="flex flex-col gap-4 font-mono">
          <p className="text-[var(--term-text-secondary)] text-xs">
            Select an action to apply across all {selectedUserIds.length} chosen user accounts:
          </p>

          <div className="grid grid-cols-2 gap-2">
            <TerminalButton
              onClick={() => executeBulkAction('verify')}
              variant="cyber"
              size="sm"
            >
              VERIFY
            </TerminalButton>
            <TerminalButton
              onClick={() => executeBulkAction('unverify')}
              variant="secondary"
              size="sm"
            >
              UNVERIFY
            </TerminalButton>
            <TerminalButton
              onClick={() => executeBulkAction('block')}
              variant="danger"
              size="sm"
            >
              BLOCK
            </TerminalButton>
            <TerminalButton
              onClick={() => executeBulkAction('unblock')}
              variant="primary"
              size="sm"
            >
              UNBLOCK
            </TerminalButton>
            <TerminalButton
              onClick={() => executeBulkAction('suspend')}
              variant="secondary"
              size="sm"
            >
              SUSPEND
            </TerminalButton>
            <TerminalButton
              onClick={() => executeBulkAction('activate')}
              variant="primary"
              size="sm"
            >
              REACTIVATE
            </TerminalButton>
          </div>

          <div className="flex justify-end pt-2 border-t border-[var(--term-border-subtle)] mt-2">
            <TerminalButton
              onClick={() => setBulkActionModal(null)}
              variant="ghost"
              size="sm"
            >
              CLOSE
            </TerminalButton>
          </div>
        </div>
      </TerminalModal>

      {/* REPORT RESOLUTION MODAL */}
      <TerminalModal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title="MANAGE INCIDENT REPORT"
        headerTag="// INCIDENT_REPORT"
        maxWidth="md"
      >
        {selectedReport && (
          <div className="flex flex-col gap-4 font-mono text-xs">
            <div className="text-[var(--term-cyan)] font-bold text-sm">{selectedReport.reason}</div>
            <div className="text-zinc-300 bg-[var(--term-bg-base)] p-3 border border-[var(--term-border-subtle)] leading-relaxed">
              {selectedReport.details || 'No additional details provided'}
            </div>
            
            <div>
              <label className="text-[var(--term-text-muted)] block mb-1 uppercase font-bold text-[10px]">Internal Admin Notes</label>
              <textarea
                value={internalNoteInput}
                onChange={(e) => setInternalNoteInput(e.target.value)}
                placeholder="Record investigation notes..."
                className="w-full bg-[var(--term-bg-base)] border border-[var(--term-border-subtle)] p-2.5 text-white h-24 outline-none focus:border-[var(--term-cyan)]"
              />
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[var(--term-border-subtle)]">
              <TerminalButton
                onClick={() => updateReportStatus(selectedReport.id, 'REJECTED')}
                variant="danger"
                size="sm"
              >
                REJECT
              </TerminalButton>
              <div className="flex gap-2">
                <TerminalButton
                  onClick={() => updateReportStatus(selectedReport.id, 'REVIEWING')}
                  variant="secondary"
                  size="sm"
                >
                  REVIEWING
                </TerminalButton>
                <TerminalButton
                  onClick={() => updateReportStatus(selectedReport.id, 'RESOLVED')}
                  variant="primary"
                  size="sm"
                >
                  RESOLVE
                </TerminalButton>
              </div>
            </div>
          </div>
        )}
      </TerminalModal>

      {/* CONTENT EDIT MODAL */}
      <TerminalModal
        isOpen={!!editingContent}
        onClose={() => setEditingContent(null)}
        title="EDIT CONTENT (NO AUTO-NOTIFICATIONS)"
        headerTag="// SILENT_UPDATE"
        maxWidth="md"
      >
        {editingContent && (
          <div className="flex flex-col gap-4 font-mono text-xs">
            <TerminalInput
              label="TITLE / NAME / PROMPT"
              value={editingContent.name || editingContent.prompt || ''}
              onChange={(e) => setEditingContent({ 
                ...editingContent, 
                ...(editingContent.name !== undefined ? { name: e.target.value } : { prompt: e.target.value })
              })}
            />

            {editingContent.description !== undefined && (
              <div>
                <label className="text-[var(--term-text-muted)] block mb-1 uppercase font-bold text-[10px]">Description</label>
                <textarea
                  value={editingContent.description || ''}
                  onChange={(e) => setEditingContent({ ...editingContent, description: e.target.value })}
                  className="w-full bg-[var(--term-bg-base)] border border-[var(--term-border-subtle)] p-2.5 text-white h-24 outline-none focus:border-[var(--term-cyan)]"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--term-border-subtle)]">
              <TerminalButton
                onClick={() => setEditingContent(null)}
                variant="ghost"
                size="sm"
              >
                CANCEL
              </TerminalButton>
              <TerminalButton
                onClick={saveContentEdit}
                disabled={actionLoading === 'content_edit'}
                variant="primary"
                size="sm"
              >
                SAVE WITHOUT NOTIFICATIONS
              </TerminalButton>
            </div>
          </div>
        )}
      </TerminalModal>

      {/* ── STUDENT PERFORMANCE DRAWER ── */}
      <TerminalModal
        isOpen={studentPerf !== null || studentPerfLoading}
        onClose={() => setStudentPerf(null)}
        title={studentPerf ? `PERFORMANCE: ${studentPerf.student?.username}@terminal` : 'LOADING...'}
        maxWidth="lg"
      >
        {studentPerfLoading && (
          <div className="flex items-center justify-center h-40 text-zinc-500 font-mono text-sm animate-pulse">
            &gt; FETCHING PERFORMANCE DATA...
          </div>
        )}
        {studentPerf && !studentPerfLoading && (
          <div className="space-y-4 font-mono text-xs">
            {/* Identity block */}
            <div className="grid grid-cols-2 gap-3 bg-[#0a0e18] border border-zinc-800 p-4">
              <div>
                <div className="text-zinc-500 text-[10px] uppercase mb-0.5">TERMINAL HANDLE</div>
                <div className="text-cyan-400 font-bold text-base">{studentPerf.student?.handle || `${studentPerf.student?.username}@terminal`}</div>
              </div>
              <div>
                <div className="text-zinc-500 text-[10px] uppercase mb-0.5">FULL NAME</div>
                <div className="text-white font-bold">{studentPerf.student?.name || '—'}</div>
              </div>
              <div>
                <div className="text-zinc-500 text-[10px] uppercase mb-0.5">USN</div>
                <div className="text-amber-300 font-bold">{studentPerf.student?.usn || '—'}</div>
              </div>
              <div>
                <div className="text-zinc-500 text-[10px] uppercase mb-0.5">BRANCH / SECTION</div>
                <div className="text-zinc-200">{studentPerf.student?.branch || '—'} {studentPerf.student?.section ? `/ ${studentPerf.student.section}` : ''}</div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'RANK', value: `#${studentPerf.performance?.rank || '—'}`, color: 'text-yellow-400' },
                { label: 'TOTAL POINTS', value: (studentPerf.performance?.totalScore ?? 0).toLocaleString(), color: 'text-cyan-400' },
                { label: 'GAMES PLAYED', value: studentPerf.performance?.gamesPlayed ?? '0', color: 'text-purple-400' },
                { label: 'SUCCESS RATE', value: `${studentPerf.performance?.successRate ?? 0}%`, color: (studentPerf.performance?.successRate ?? 0) >= 70 ? 'text-emerald-400' : (studentPerf.performance?.successRate ?? 0) >= 40 ? 'text-amber-400' : 'text-red-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-[#0a0e18] border border-zinc-800 p-3 text-center">
                  <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-zinc-500 text-[10px] mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Challenges row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'ATTEMPTED', value: studentPerf.performance?.challengesAttempted ?? 0, color: 'text-zinc-200' },
                { label: 'SOLVED', value: studentPerf.performance?.challengesSolved ?? 0, color: 'text-emerald-400' },
                { label: 'FAILED', value: (studentPerf.performance?.challengesAttempted ?? 0) - (studentPerf.performance?.challengesSolved ?? 0), color: 'text-red-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-[#0a0e18] border border-zinc-800 p-3 text-center">
                  <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-zinc-500 text-[10px] mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Team + Club */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0a0e18] border border-zinc-800 p-3">
                <div className="text-zinc-500 text-[10px] uppercase mb-1">CURRENT TEAM</div>
                {studentPerf.team ? (
                  <div>
                    <div className="text-white font-bold">{studentPerf.team.name}</div>
                    <div className="text-zinc-500 text-[10px] mt-0.5">{studentPerf.team.memberCount} member{studentPerf.team.memberCount !== 1 ? 's' : ''} · {studentPerf.team.role}</div>
                  </div>
                ) : (
                  <div className="text-zinc-600">NO TEAM</div>
                )}
              </div>
              <div className="bg-[#0a0e18] border border-zinc-800 p-3">
                <div className="text-zinc-500 text-[10px] uppercase mb-1">CLUBS</div>
                {studentPerf.clubs?.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {studentPerf.clubs.map((c: any) => (
                      <span key={c.slug} className="text-[10px] bg-purple-950/60 border border-purple-700 text-purple-300 px-1.5 py-0.5">{c.name}</span>
                    ))}
                  </div>
                ) : (
                  <div className="text-zinc-600">NO CLUBS</div>
                )}
              </div>
            </div>

            {/* Game History */}
            {studentPerf.gameHistory?.length > 0 && (
              <div>
                <div className="text-zinc-500 text-[10px] uppercase mb-2 border-b border-zinc-800 pb-1">GAME HISTORY</div>
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {studentPerf.gameHistory.map((g: any, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-[#0a0e18] border border-zinc-800/60 px-3 py-2">
                      <div>
                        <span className="text-white font-bold">{g.gameName}</span>
                        <span className="text-zinc-500 ml-2 text-[10px]">#{g.roomCode}</span>
                        {g.teamName && <span className="text-purple-400 ml-2 text-[10px]">TEAM: {g.teamName}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-cyan-400 font-bold">{g.score} pts</span>
                        <span className={`text-[10px] px-1.5 py-0.5 font-bold border ${
                          g.result === 'COMPLETED' ? 'text-emerald-400 border-emerald-700 bg-emerald-950/50' :
                          g.result === 'PENDING' ? 'text-amber-400 border-amber-700 bg-amber-950/50' :
                          'text-zinc-400 border-zinc-700'
                        }`}>{g.result}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </TerminalModal>

      {/* ── FULL EXCEL EXPORT PANEL ── */}
      {exportPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#090d16] border border-cyan-700 w-full max-w-lg font-mono shadow-2xl shadow-cyan-900/20">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-cyan-700 bg-[#0b1120]">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-emerald-400" />
                <span className="text-white font-bold text-sm">STUDENT DATA EXPORT</span>
                <span className="text-[10px] text-emerald-400 border border-emerald-700 bg-emerald-950/50 px-1.5 py-0.5">6 SHEETS</span>
              </div>
              <button onClick={() => setExportPanelOpen(false)} className="text-zinc-500 hover:text-white">
                <X size={16} />
              </button>
            </div>

            {/* Filters */}
            <div className="p-5 space-y-3">
              <div className="text-zinc-500 text-[10px] uppercase border-b border-zinc-800 pb-1 mb-3">FILTER EXPORT SCOPE</div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-500 text-[10px] uppercase block mb-1">Branch</label>
                  <input
                    className="w-full bg-[#0a0e18] border border-zinc-700 text-white text-xs px-2 py-1.5 focus:outline-none focus:border-cyan-600"
                    placeholder="e.g. CSE"
                    value={exportFilters.branch}
                    onChange={e => setExportFilters(f => ({ ...f, branch: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-zinc-500 text-[10px] uppercase block mb-1">Section</label>
                  <input
                    className="w-full bg-[#0a0e18] border border-zinc-700 text-white text-xs px-2 py-1.5 focus:outline-none focus:border-cyan-600"
                    placeholder="e.g. A"
                    value={exportFilters.section}
                    onChange={e => setExportFilters(f => ({ ...f, section: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-zinc-500 text-[10px] uppercase block mb-1">Club Slug</label>
                  <input
                    className="w-full bg-[#0a0e18] border border-zinc-700 text-white text-xs px-2 py-1.5 focus:outline-none focus:border-cyan-600"
                    placeholder="e.g. circuit-breakers"
                    value={exportFilters.clubSlug}
                    onChange={e => setExportFilters(f => ({ ...f, clubSlug: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-zinc-500 text-[10px] uppercase block mb-1">Account Status</label>
                  <select
                    className="w-full bg-[#0a0e18] border border-zinc-700 text-white text-xs px-2 py-1.5 focus:outline-none focus:border-cyan-600"
                    value={exportFilters.accountStatus}
                    onChange={e => setExportFilters(f => ({ ...f, accountStatus: e.target.value }))}
                  >
                    <option value="">ALL STATUSES</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="BLOCKED">BLOCKED</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
                <div>
                  <label className="text-zinc-500 text-[10px] uppercase block mb-1">Min Score</label>
                  <input
                    type="number"
                    className="w-full bg-[#0a0e18] border border-zinc-700 text-white text-xs px-2 py-1.5 focus:outline-none focus:border-cyan-600"
                    placeholder="0"
                    value={exportFilters.minScore}
                    onChange={e => setExportFilters(f => ({ ...f, minScore: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-zinc-500 text-[10px] uppercase block mb-1">Max Score</label>
                  <input
                    type="number"
                    className="w-full bg-[#0a0e18] border border-zinc-700 text-white text-xs px-2 py-1.5 focus:outline-none focus:border-cyan-600"
                    placeholder="∞"
                    value={exportFilters.maxScore}
                    onChange={e => setExportFilters(f => ({ ...f, maxScore: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-500 text-[10px] uppercase block mb-1">Search (Name / Handle / USN / Email)</label>
                <input
                  className="w-full bg-[#0a0e18] border border-zinc-700 text-white text-xs px-2 py-1.5 focus:outline-none focus:border-cyan-600"
                  placeholder="Search students..."
                  value={exportFilters.search}
                  onChange={e => setExportFilters(f => ({ ...f, search: e.target.value }))}
                />
              </div>

              {/* Sheet preview */}
              <div className="bg-[#0a0e18] border border-zinc-800 p-3 space-y-1">
                <div className="text-zinc-500 text-[10px] uppercase mb-2">SHEETS INCLUDED IN EXPORT</div>
                {['STUDENTS', 'GAME PERFORMANCE', 'GAME SUMMARY', 'TEAMS', 'CLUBS', 'PARTICIPATION'].map((sheet, i) => (
                  <div key={sheet} className="flex items-center gap-2 text-[11px]">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                    <span className="text-emerald-300 font-bold">SHEET {i + 1}</span>
                    <span className="text-zinc-400">{sheet}</span>
                  </div>
                ))}
              </div>

              {exportCount !== null && (
                <div className="text-emerald-400 text-[11px] border border-emerald-700 bg-emerald-950/50 px-3 py-2">
                  ✓ LAST EXPORT: {exportCount} students
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-[#0b1120]">
              <button
                onClick={() => setExportFilters({ branch: '', section: '', clubSlug: '', accountStatus: '', minScore: '', maxScore: '', search: '' })}
                className="text-zinc-500 hover:text-zinc-300 text-xs"
              >
                CLEAR FILTERS
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setExportPanelOpen(false)}
                  className="px-3 py-1.5 border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleFullExport}
                  disabled={exportLoading}
                  className="flex items-center gap-2 px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-black font-bold text-xs"
                >
                  {exportLoading ? (
                    <><RefreshCw size={13} className="animate-spin" /> GENERATING...</>
                  ) : (
                    <><Download size={13} /> EXPORT .XLSX</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
