import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, Users, Briefcase, UserCheck,
  CheckCircle2, XCircle, PauseCircle,
  Loader2, BarChart2, List, ChevronDown, RefreshCw,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = `${BASE_URL}/api`;

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STATUS_BADGE = {
  'Submitted':       'bg-blue-100 text-blue-700',
  'Shared Profiles': 'bg-indigo-100 text-indigo-700',
  'Yet to attend':   'bg-amber-100 text-amber-700',
  'Turnups':         'bg-purple-100 text-purple-700',
  'No Show':         'bg-slate-100 text-slate-600',
  'Selected':        'bg-emerald-100 text-emerald-700',
  'Joined':          'bg-green-100 text-green-800',
  'Rejected':        'bg-red-100 text-red-700',
  'Hold':            'bg-orange-100 text-orange-700',
  'Backout':         'bg-rose-100 text-rose-700',
  'Pipeline':        'bg-yellow-100 text-yellow-700',
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    color: '#0f172a',
    fontSize: '12px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
  },
  formatter: (value, name) => [`${name} : ${value}`, ''],
  labelStyle: { fontWeight: 700, color: '#1e293b', marginBottom: 4 },
};

const LegendLabel = (v) => <span style={{ color: '#475569', fontWeight: 600 }}>{v}</span>;

const EMPTY_WEEKLY = [
  { week: 'W1', submitted: 0, interviews: 0, selected: 0, rejected: 0, hold: 0, joined: 0 },
  { week: 'W2', submitted: 0, interviews: 0, selected: 0, rejected: 0, hold: 0, joined: 0 },
  { week: 'W3', submitted: 0, interviews: 0, selected: 0, rejected: 0, hold: 0, joined: 0 },
  { week: 'W4', submitted: 0, interviews: 0, selected: 0, rejected: 0, hold: 0, joined: 0 },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function RecruiterReports() {
  const { currentUser, authHeaders } = useAuth();

  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [activeTab,  setActiveTab]  = useState('overview');

  const [stats, setStats] = useState({
    totalSubmissions: 0, totalInterviewsScheduled: 0,
    joined: 0, selected: 0, rejected: 0, hold: 0, successRate: 0,
  });

  const [weeklyData,  setWeeklyData]  = useState(EMPTY_WEEKLY);
  const [monthlyData, setMonthlyData] = useState([]);

  const [selectedMonth, setSelectedMonth] = useState('all');

  const [candidates,  setCandidates]  = useState([]);
  const [interviews,  setInterviews]  = useState([]);

  const getHeaders = useCallback(async () => {
    const ah = await authHeaders();
    return { 'Content-Type': 'application/json', ...ah };
  }, [authHeaders]);

  // ── Main fetch: Grab everything locally so charts work flawlessly ──────────
  const fetchReports = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const headers = await getHeaders();
      const [candRes, intRes] = await Promise.all([
        fetch(`${API_URL}/candidates`, { headers }),
        fetch(`${API_URL}/interviews`, { headers })
      ]);

      if (candRes.ok) {
        setCandidates(await candRes.json());
      }
      if (intRes.ok) {
        setInterviews(await intRes.json());
      }
    } catch (err) {
      console.error('[RecruiterReports] fetch error:', err);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => { fetchReports(); }, [fetchReports]); 

  // ── Compute all data locally based on selectedMonth ──────────
  useEffect(() => {
    if (!candidates || candidates.length === 0) return;

    // 1. Filter candidates for the current selected month
    const filteredCands = selectedMonth === 'all' 
      ? candidates 
      : candidates.filter(c => {
          const d = new Date(c.dateAdded || c.createdAt);
          return !isNaN(d) && d.getMonth() === parseInt(selectedMonth);
        });

    // 2. Compute KPI Stats
    const totalSubmissions = filteredCands.length;
    let selected = 0, rejected = 0, hold = 0, joined = 0;
    
    filteredCands.forEach(c => {
       const s = Array.isArray(c.status) ? c.status[0] : c.status;
       if (s?.includes('Select')) selected++;
       else if (s?.includes('Reject')) rejected++;
       else if (s?.includes('Hold')) hold++;
       else if (s?.includes('Joined')) joined++;
    });

    const successRate = totalSubmissions > 0 ? Math.round((joined / totalSubmissions) * 100) : 0;

    const filteredInts = selectedMonth === 'all'
      ? interviews
      : interviews.filter(i => {
          const d = new Date(i.interviewDate || i.createdAt);
          return !isNaN(d) && d.getMonth() === parseInt(selectedMonth);
      });

    setStats({
       totalSubmissions,
       totalInterviewsScheduled: filteredInts.length,
       selected, rejected, hold, joined, successRate
    });

    // 3. Compute Monthly Data (All Time Trend)
    const mMap = {};
    MONTH_SHORT.forEach(m => mMap[m] = { month: m, submitted: 0, interviews: 0, selected: 0, rejected: 0, hold: 0, joined: 0 });
    
    candidates.forEach(c => {
       const d = new Date(c.dateAdded || c.createdAt);
       if (isNaN(d)) return;
       const m = MONTH_SHORT[d.getMonth()];
       mMap[m].submitted++;
       
       const s = Array.isArray(c.status) ? c.status[0] : c.status;
       if (s?.includes('Select')) mMap[m].selected++;
       if (s?.includes('Reject')) mMap[m].rejected++;
       if (s?.includes('Hold')) mMap[m].hold++;
       if (s?.includes('Joined')) mMap[m].joined++;
    });

    interviews.forEach(i => {
       const d = new Date(i.interviewDate || i.createdAt);
       if (!isNaN(d)) mMap[MONTH_SHORT[d.getMonth()]].interviews++;
    });

    setMonthlyData(Object.values(mMap));

    // 4. Compute Weekly Data for the selected month (or current month if 'all')
    const targetMonth = selectedMonth === 'all' ? new Date().getMonth() : parseInt(selectedMonth);
    const wMap = {
       'W1': { week: 'W1', submitted: 0, interviews: 0, selected: 0, rejected: 0, hold: 0, joined: 0 },
       'W2': { week: 'W2', submitted: 0, interviews: 0, selected: 0, rejected: 0, hold: 0, joined: 0 },
       'W3': { week: 'W3', submitted: 0, interviews: 0, selected: 0, rejected: 0, hold: 0, joined: 0 },
       'W4': { week: 'W4', submitted: 0, interviews: 0, selected: 0, rejected: 0, hold: 0, joined: 0 },
    };

    candidates.forEach(c => {
       const d = new Date(c.dateAdded || c.createdAt);
       if (isNaN(d) || d.getMonth() !== targetMonth) return;
       
       const day = d.getDate();
       let w = 'W1';
       if (day > 7 && day <= 14) w = 'W2';
       else if (day > 14 && day <= 21) w = 'W3';
       else if (day > 21) w = 'W4';

       wMap[w].submitted++;
       const s = Array.isArray(c.status) ? c.status[0] : c.status;
       if (s?.includes('Select')) wMap[w].selected++;
       if (s?.includes('Reject')) wMap[w].rejected++;
       if (s?.includes('Hold')) wMap[w].hold++;
       if (s?.includes('Joined')) wMap[w].joined++;
    });

    interviews.forEach(i => {
       const d = new Date(i.interviewDate || i.createdAt);
       if (isNaN(d) || d.getMonth() !== targetMonth) return;
       
       const day = d.getDate();
       let w = 'W1';
       if (day > 7 && day <= 14) w = 'W2';
       else if (day > 14 && day <= 21) w = 'W3';
       else if (day > 21) w = 'W4';
       wMap[w].interviews++;
    });

    setWeeklyData(Object.values(wMap));

  }, [candidates, interviews, selectedMonth]);


  const filteredMonthly = selectedMonth === 'all'
    ? monthlyData
    : monthlyData.filter(m => m.month === MONTH_SHORT[parseInt(selectedMonth)]);

  const displayName = currentUser
    ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email
    : 'Recruiter';

  const kpiCards = [
    { title: 'Total Candidates',     value: stats.totalSubmissions,         sub: 'All time submissions',     Icon: Users,        iconCls: 'text-blue-500',    iconBg: 'bg-blue-50'    },
    { title: 'Interviews',           value: stats.totalInterviewsScheduled, sub: 'Interviews scheduled',     Icon: Briefcase,    iconCls: 'text-purple-500',  iconBg: 'bg-purple-50'  },
    { title: 'Selected',             value: stats.selected,                 sub: 'Candidates selected',      Icon: CheckCircle2, iconCls: 'text-emerald-500', iconBg: 'bg-emerald-50' },
    { title: 'Rejected',             value: stats.rejected,                 sub: 'Candidates rejected',      Icon: XCircle,      iconCls: 'text-red-500',     iconBg: 'bg-red-50'     },
    { title: 'Hold',                 value: stats.hold,                     sub: 'On hold',                  Icon: PauseCircle,  iconCls: 'text-orange-500',  iconBg: 'bg-orange-50'  },
    { title: 'Joined',               value: stats.joined,                   sub: 'Successfully joined',      Icon: UserCheck,    iconCls: 'text-green-500',   iconBg: 'bg-green-50'   },
    { title: 'Performance',          value: `${stats.successRate}%`,        sub: 'Join to submission ratio', Icon: TrendingUp,   iconCls: 'text-[#1e2a78]',   iconBg: 'bg-[#eef0fb]'  },
  ];

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-[#f0f2f8] min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#1e2a78]" />
        <p className="text-slate-500 text-sm font-medium">Loading reports...</p>
      </div>
    </div>
  );

  if (fetchError) return (
    <div className="flex-1 flex items-center justify-center bg-[#f0f2f8] min-h-screen">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-slate-700 font-semibold">Failed to load reports</p>
        <p className="text-xs text-slate-400">Check your connection and try again.</p>
        <button onClick={fetchReports}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e2a78] text-white text-sm font-semibold rounded-lg hover:bg-[#162060] transition">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#f0f2f8] min-h-screen">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ─── HERO BANNER ─────────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden bg-[#1e2a78] shadow-lg min-h-[110px]">
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="relative flex items-center justify-between px-8 py-6 gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white leading-tight">My Reports & Analysis</h1>
              <p className="text-blue-200 text-sm mt-1">
                Performance analytics for{' '}
                <span className="text-white font-semibold">{displayName}</span>
              </p>
            </div>
            <div className="hidden md:block w-28 h-20 shrink-0 opacity-90">
              <svg viewBox="0 0 120 88" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                <rect x="8"  y="48" width="72" height="36" rx="4"  fill="white" fillOpacity="0.12"/>
                <rect x="16" y="56" width="12" height="22" rx="2"  fill="white" fillOpacity="0.55"/>
                <rect x="34" y="63" width="12" height="15" rx="2"  fill="white" fillOpacity="0.55"/>
                <rect x="52" y="58" width="12" height="20" rx="2"  fill="white" fillOpacity="0.55"/>
                <circle cx="96" cy="26" r="16" fill="white" fillOpacity="0.12"/>
                <circle cx="96" cy="21" r="6"  fill="white" fillOpacity="0.6"/>
                <path d="M84 44 Q96 34 108 44" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" strokeOpacity="0.55"/>
                <rect x="82" y="44" width="28" height="18" rx="3" fill="white" fillOpacity="0.12"/>
                <line x1="88" y1="53" x2="104" y2="53" stroke="white" strokeWidth="1.5" strokeOpacity="0.4"/>
                <line x1="88" y1="58" x2="100" y2="58" stroke="white" strokeWidth="1.5" strokeOpacity="0.4"/>
              </svg>
            </div>
            <div className="flex items-center bg-white/15 border border-white/20 rounded-xl p-1 gap-0.5 shrink-0">
              <button onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'overview' ? 'bg-white text-[#1e2a78] shadow-sm' : 'text-blue-200 hover:text-white hover:bg-white/10'
                }`}>
                <BarChart2 className="w-4 h-4" /> Overview
              </button>
              <button onClick={() => setActiveTab('detailed')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'detailed' ? 'bg-white text-[#1e2a78] shadow-sm' : 'text-blue-200 hover:text-white hover:bg-white/10'
                }`}>
                <List className="w-4 h-4" /> Detailed
              </button>
            </div>
          </div>
        </div>

        {/* ─── KPI CARDS — 7 metrics ───────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {kpiCards.map(({ title, value, sub, Icon, iconCls, iconBg }) => (
            <div key={title}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 leading-tight">{title}</span>
                <div className={`p-1.5 rounded-lg ${iconBg}`}>
                  <Icon className={`h-3.5 w-3.5 ${iconCls}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900">{value}</div>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">{sub}</p>
            </div>
          ))}
        </div>

        {/* ─── Section Divider ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">
            {activeTab === 'overview' ? '📊 Charts & Analytics' : '📋 Candidate Breakdown'}
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            OVERVIEW TAB
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <>
            {/* Month filter — defaults to "All" so historical data shows */}
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-0 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                <span className="px-3 py-2 text-xs font-bold text-slate-500 bg-[#e8eaf4] border-r border-slate-200 whitespace-nowrap select-none">
                  Month
                </span>
                <div className="relative flex items-center px-2 py-1.5">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="appearance-none text-sm font-semibold text-slate-800 bg-transparent border-none outline-none cursor-pointer pr-6 pl-1 min-w-[90px]"
                  >
                    <option value="all">All</option>
                    {MONTH_NAMES.map((m, i) => (
                      <option key={i} value={i}>{m}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
              <span className="text-xs text-slate-400">
                Showing:{' '}
                <span className="font-semibold text-slate-600">
                  {selectedMonth === 'all' ? 'All Months' : MONTH_NAMES[parseInt(selectedMonth)]}
                </span>
              </span>
              <button onClick={fetchReports}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {/* ── Chart 1: Weekly Activity Trends — W1 W2 W3 W4 ───────── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="mb-5">
                <h3 className="font-semibold text-slate-800 text-sm">Weekly Activity Trends</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Last 4 weeks · Submissions · Interviews · Selected · Rejected · Hold · Joined
                </p>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }} iconSize={10} formatter={LegendLabel} />
                  <Line type="monotone" dataKey="submitted"  name="Submissions" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="interviews" name="Interviews"  stroke="#a855f7" strokeWidth={2} dot={{ r: 4, fill: '#a855f7', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="selected"   name="Selected"   stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
                  <Line type="monotone" dataKey="rejected"   name="Rejected"   stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
                  <Line type="monotone" dataKey="hold"       name="Hold"       stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
                  <Line type="monotone" dataKey="joined"     name="Joined"     stroke="#059669" strokeWidth={2} dot={{ r: 3, fill: '#059669', strokeWidth: 0 }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* ── Chart 2: Monthly Breakdown ──────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="mb-5">
                <h3 className="font-semibold text-slate-800 text-sm">Monthly Breakdown</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Submissions · Interviews · Selected · Rejected · Hold · Joined per month
                </p>
              </div>
              {filteredMonthly.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
                  <p className="text-sm">No data for the selected month</p>
                  <button onClick={() => setSelectedMonth('all')}
                    className="text-xs text-[#1e2a78] font-semibold underline hover:opacity-80">
                    Show all months
                  </button>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={filteredMonthly} barCategoryGap="25%" barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} iconType="square" iconSize={10} formatter={LegendLabel} />
                    <Bar dataKey="submitted"  name="Submissions" fill="#3b82f6" radius={[4,4,0,0]} />
                    <Bar dataKey="interviews" name="Interviews"  fill="#a855f7" radius={[4,4,0,0]} />
                    <Bar dataKey="selected"   name="Selected"    fill="#10b981" radius={[4,4,0,0]} />
                    <Bar dataKey="rejected"   name="Rejected"    fill="#ef4444" radius={[4,4,0,0]} />
                    <Bar dataKey="hold"       name="Hold"        fill="#f97316" radius={[4,4,0,0]} />
                    <Bar dataKey="joined"     name="Joined"      fill="#059669" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            DETAILED TAB
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'detailed' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-[#f8faff] flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 text-sm">All My Candidates</h3>
              <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
                {candidates.length} records
              </span>
            </div>
            {candidates.length === 0 ? (
              <div className="text-center py-20 text-slate-400 text-sm">No candidates found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#f8faff] border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider font-bold">
                    <tr>
                      <th className="px-5 py-4 w-10">#</th>
                      <th className="px-5 py-4">Name</th>
                      <th className="px-5 py-4">Position</th>
                      <th className="px-5 py-4">Client</th>
                      <th className="px-5 py-4">Contact</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Date Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {candidates.map((c, idx) => {
                      const status = Array.isArray(c.status) ? c.status[0] : (c.status || 'Submitted');
                      return (
                        <tr key={c._id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3.5 text-slate-400 text-xs font-mono">{idx + 1}</td>
                          <td className="px-5 py-3.5 font-semibold text-slate-800 whitespace-nowrap">
                            {c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || '—'}
                          </td>
                          <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">{c.position || '—'}</td>
                          <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">{c.client   || '—'}</td>
                          <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{c.contact  || '—'}</td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[status] || 'bg-slate-100 text-slate-600'}`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-400 text-xs whitespace-nowrap">
                            {(c.dateAdded || c.createdAt)
                              ? new Date(c.dateAdded || c.createdAt).toLocaleDateString('en-GB', {
                                  day: '2-digit', month: 'short', year: 'numeric',
                                })
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}