import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, Users, Briefcase, UserCheck, Loader2, BarChart2, List } from 'lucide-react';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = `${BASE_URL}/api`;

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

// ─────────────────────────────────────────────────────────────────────────────
// Build last-6-months bar data from candidate array
// X-axis = month name (Jan, Feb … Dec)
// Bars    = Interviews(scheduled) · Selected · Rejected · Hold   (NO Offers)
// ─────────────────────────────────────────────────────────────────────────────
function buildMonthlyBreakdown(candidates, interviewsByMonth) {
  const now    = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      month:       MONTH_SHORT[d.getMonth()],
      _year:       d.getFullYear(),
      _month:      d.getMonth(),
      interviews:  interviewsByMonth?.[`${d.getFullYear()}-${d.getMonth()}`] || 0,
      selected:    0,
      rejected:    0,
      hold:        0,
    });
  }
  for (const c of candidates) {
    if (!c.createdAt) continue;
    const d   = new Date(c.createdAt);
    const row = months.find(m => m._month === d.getMonth() && m._year === d.getFullYear());
    if (!row) continue;
    const st = Array.isArray(c.status) ? c.status[0] : (c.status || '');
    if (st === 'Selected') row.selected += 1;
    if (st === 'Rejected') row.rejected += 1;
    if (st === 'Hold')     row.hold     += 1;
  }
  return months;
}

// Tooltip formatter: shows "FieldName : value" per row
const tooltipFormatter = (value, name) => [`${name} : ${value}`, ''];
const tooltipLabelStyle = { fontWeight: 700, color: '#1e293b', marginBottom: 4 };
const tooltipContentStyle = {
  backgroundColor: '#fff', border: '1px solid #e2e8f0',
  borderRadius: '8px', color: '#0f172a', fontSize: '12px',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)',
};

export default function RecruiterReports() {
  const { currentUser, authHeaders } = useAuth();

  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState('overview');
  const [reportData, setReportData] = useState({
    stats: {
      totalSubmissions: 0,
      totalInterviewsScheduled: 0,
      joined: 0,
      successRate: 0,
    },
    weeklyData:       [],  // W1–W4 for Weekly Activity Trends line chart
    monthlyBreakdown: [],  // Jan–Dec for Monthly Breakdown bar chart
  });

  const [candidates,  setCandidates]  = useState([]);
  const [candLoading, setCandLoading] = useState(false);

  const buildHeaders = useCallback(async () => {
    const ah = await authHeaders();
    return { 'Content-Type': 'application/json', ...ah };
  }, [authHeaders]);

  // ── Fetch stats + candidates on mount ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const headers = await buildHeaders();

        // Fetch recruiter report stats AND all recruiter candidates in parallel
        const [statsRes, candRes] = await Promise.all([
          fetch(`${API_URL}/reports/recruiter`, { headers }),
          fetch(`${API_URL}/candidates`, { headers }),
        ]);

        let statsData = {
          stats: { totalSubmissions: 0, totalInterviewsScheduled: 0, joined: 0, successRate: 0 },
          weeklyData: [],
        };

        if (statsRes.ok) {
          const raw = await statsRes.json();
          statsData.stats = {
            totalSubmissions:         raw.stats?.totalSubmissions         || 0,
            totalInterviewsScheduled: raw.stats?.totalInterviewsScheduled || 0,
            joined:                   raw.stats?.joined                   || 0,
            successRate:              raw.stats?.successRate              || 0,
          };
          // Ensure W1–W4 week labels for Weekly Activity Trends
          if (raw.weeklyData && raw.weeklyData.length > 0) {
            statsData.weeklyData = raw.weeklyData.map((w, i) => ({
              ...w,
              week: w.week || `W${i + 1}`,
            }));
          } else {
            statsData.weeklyData = [
              { week: 'W1', submitted: 0, interviews: 0 },
              { week: 'W2', submitted: 0, interviews: 0 },
              { week: 'W3', submitted: 0, interviews: 0 },
              { week: 'W4', submitted: 0, interviews: 0 },
            ];
          }
        }

        // Build monthly breakdown from candidates
        let allCands = [];
        if (candRes.ok) allCands = await candRes.json();

        // If API didn't return stats, derive from candidates
        if (allCands.length > 0 && statsData.stats.totalSubmissions === 0) {
          statsData.stats.totalSubmissions = allCands.length;
          allCands.forEach(c => {
            const st = Array.isArray(c.status) ? c.status[0] : (c.status || '');
            if (st === 'Joined') statsData.stats.joined += 1;
          });
          if (statsData.stats.totalSubmissions > 0) {
            statsData.stats.successRate = Math.round(
              (statsData.stats.joined / statsData.stats.totalSubmissions) * 100
            );
          }
        }

        setReportData({
          ...statsData,
          monthlyBreakdown: buildMonthlyBreakdown(allCands, null),
        });
      } catch (e) {
        console.error('Error fetching report data:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line

  // ── Fetch candidates for Detailed tab ────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'detailed' || candidates.length > 0) return;
    (async () => {
      setCandLoading(true);
      try {
        const headers = await buildHeaders();
        const res = await fetch(`${API_URL}/candidates`, { headers });
        if (res.ok) setCandidates(await res.json());
      } catch (e) {
        console.error('Error fetching candidates:', e);
      } finally {
        setCandLoading(false);
      }
    })();
  }, [activeTab]); // eslint-disable-line

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-[#f0f2f8] min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#1e2a78]" />
          <p className="text-slate-500 text-sm font-medium">Loading reports...</p>
        </div>
      </div>
    );
  }

  const { stats, weeklyData, monthlyBreakdown } = reportData;
  const displayName = currentUser
    ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email
    : 'Recruiter';

  // ── KPI Cards: Total Candidates · Interviews Scheduled · Joinings · Performance
  // (Offers card REMOVED as requested)
  const kpiCards = [
    { title: 'Total Candidates',     value: stats.totalSubmissions,         sub: 'All time submissions',     Icon: Users      },
    { title: 'Interviews Scheduled', value: stats.totalInterviewsScheduled, sub: 'Total interviews created', Icon: Briefcase  },
    { title: 'Joinings',             value: stats.joined,                   sub: 'Joined',                   Icon: UserCheck  },
    { title: 'Performance',          value: `${stats.successRate}%`,        sub: 'Join to Submission ratio', Icon: TrendingUp },
  ];

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#f0f2f8] min-h-screen">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── HERO BANNER ── */}
        <div className="relative rounded-2xl overflow-hidden bg-[#1e2a78] shadow-lg min-h-[110px]">
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="relative flex items-center justify-between px-8 py-6 gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white leading-tight">My Reports & Analysis</h1>
              <p className="text-blue-200 text-sm mt-1">Performance analytics for <span className="text-white font-semibold">{displayName}</span></p>
            </div>
            {/* Illustration */}
            <div className="hidden md:block w-28 h-20 shrink-0 opacity-90">
              <svg viewBox="0 0 120 88" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                <rect x="8" y="48" width="72" height="36" rx="4" fill="white" fillOpacity="0.12"/>
                <rect x="16" y="56" width="12" height="22" rx="2" fill="white" fillOpacity="0.55"/>
                <rect x="34" y="63" width="12" height="15" rx="2" fill="white" fillOpacity="0.55"/>
                <rect x="52" y="58" width="12" height="20" rx="2" fill="white" fillOpacity="0.55"/>
                <circle cx="96" cy="26" r="16" fill="white" fillOpacity="0.12"/>
                <circle cx="96" cy="21" r="6" fill="white" fillOpacity="0.6"/>
                <path d="M84 44 Q96 34 108 44" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" strokeOpacity="0.55"/>
                <rect x="82" y="44" width="28" height="18" rx="3" fill="white" fillOpacity="0.12"/>
                <line x1="88" y1="53" x2="104" y2="53" stroke="white" strokeWidth="1.5" strokeOpacity="0.4"/>
                <line x1="88" y1="58" x2="100" y2="58" stroke="white" strokeWidth="1.5" strokeOpacity="0.4"/>
              </svg>
            </div>
            {/* Overview / Detailed toggle inside banner */}
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

        {/* ── KPI CARDS — 4 cards (no Offers) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map(({ title, value, sub, Icon }) => (
            <div key={title} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-600 leading-tight">{title}</span>
                <Icon className="h-4 w-4 text-slate-400 shrink-0" />
              </div>
              <div className="text-3xl font-bold text-slate-900">{value}</div>
              <p className="text-xs text-slate-400 mt-1.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Section Divider ── */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">
            {activeTab === 'overview' ? '📊 Charts & Analytics' : '📋 Candidate Breakdown'}
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {/* ════════════════════════════════════════════════════════
            OVERVIEW TAB
            Chart 1 — Weekly Activity Trends   : line, X = W1 W2 W3 W4
            Chart 2 — Monthly Breakdown        : bar,  X = Jan Feb … Dec (last 6 months)
                       Bars = Interviews · Selected · Rejected · Hold  (NO Offers)
        ════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <>
            {/* ── Chart 1: Weekly Activity Trends — W1 W2 W3 W4 ── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="mb-5">
                <h3 className="font-semibold text-slate-800 text-sm">Weekly Activity Trends</h3>
                <p className="text-xs text-slate-400 mt-0.5">Interviews &amp; Submissions per week</p>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    formatter={tooltipFormatter}
                    labelStyle={tooltipLabelStyle}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }}
                    iconSize={10} iconType="circle"
                    formatter={(v) => <span style={{ color: '#475569', fontWeight: 600 }}>{v}</span>}
                  />
                  <Line type="monotone" dataKey="submitted"  name="Submissions" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="interviews" name="Interviews"  stroke="#a855f7" strokeWidth={2} dot={{ r: 4, fill: '#a855f7', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* ── Chart 2: Monthly Breakdown — Jan Feb Mar … (last 6 months) ──
                Bars = Interviews · Selected · Rejected · Hold
                NO Offers bar, NO Submissions bar here
            ── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="mb-5">
                <h3 className="font-semibold text-slate-800 text-sm">Monthly Breakdown (Last 6 Months)</h3>
                <p className="text-xs text-slate-400 mt-0.5">Interviews · Selected · Rejected · Hold per month</p>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                {/* data uses monthlyBreakdown — dataKey="month" gives Jan/Feb/Mar labels */}
                <BarChart data={monthlyBreakdown} barCategoryGap="32%" barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  {/* ✅ X-axis = month names: Oct, Nov, Dec, Jan, Feb, Mar */}
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    formatter={tooltipFormatter}
                    labelStyle={tooltipLabelStyle}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
                    iconType="square" iconSize={10}
                    formatter={(v) => <span style={{ color: '#475569', fontWeight: 600 }}>{v}</span>}
                  />
                  {/* Bars: Interviews · Selected · Rejected · Hold — NO Offers */}
                  <Bar dataKey="interviews" name="Interviews" fill="#a855f7" radius={[4,4,0,0]} />
                  <Bar dataKey="selected"   name="Selected"   fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="rejected"   name="Rejected"   fill="#ef4444" radius={[4,4,0,0]} />
                  <Bar dataKey="hold"       name="Hold"       fill="#f97316" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════
            DETAILED TAB — Candidate table
        ════════════════════════════════════════════════════════ */}
        {activeTab === 'detailed' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-[#f8faff] flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 text-sm">All My Candidates</h3>
              <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
                {candidates.length} records
              </span>
            </div>
            {candLoading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="h-7 w-7 animate-spin text-[#1e2a78]" />
              </div>
            ) : candidates.length === 0 ? (
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
                          <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">{c.client || '—'}</td>
                          <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{c.contact || '—'}</td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[status] || 'bg-slate-100 text-slate-600'}`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-400 text-xs whitespace-nowrap">
                            {(c.dateAdded || c.createdAt)
                              ? new Date(c.dateAdded || c.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
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