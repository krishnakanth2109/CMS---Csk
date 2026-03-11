import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, Users, Briefcase, Award, Loader2, UserCheck, BarChart2, List } from 'lucide-react';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = `${BASE_URL}/api`;

const STATUS_COLORS = {
  'Submitted':       '#3b82f6',
  'Shared Profiles': '#6366f1',
  'Yet to attend':   '#f59e0b',
  'Turnups':         '#8b5cf6',
  'No Show':         '#94a3b8',
  'Selected':        '#10b981',
  'Joined':          '#059669',
  'Rejected':        '#ef4444',
  'Hold':            '#f97316',
  'Backout':         '#f43f5e',
  'Pipeline':        '#eab308',
};

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

export default function RecruiterReports() {
  const { currentUser, authHeaders } = useAuth();

  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState('overview');
  const [reportData,  setReportData]  = useState({
    stats: {
      totalSubmissions: 0, activeInterviews: 0,
      totalInterviewsScheduled: 0, offers: 0, joined: 0, successRate: 0,
    },
    statusData: [],
    weeklyData: [],
  });

  const [candidates,  setCandidates]  = useState([]);
  const [candLoading, setCandLoading] = useState(false);

  const buildHeaders = useCallback(async () => {
    const ah = await authHeaders();
    return { 'Content-Type': 'application/json', ...ah };
  }, [authHeaders]);

  // ── Fetch report stats ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const headers  = await buildHeaders();
        const response = await fetch(`${API_URL}/reports/recruiter`, { headers });
        if (response.ok) setReportData(await response.json());
      } catch (e) {
        console.error('Error fetching report data:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line

  // ── Fetch candidates when Detailed tab is opened ───────────────────────────
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

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: '#ffffff', border: '1px solid #e2e8f0',
      borderRadius: '8px', color: '#0f172a',
    },
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-slate-500">Loading reports...</p>
        </div>
      </div>
    );
  }

  const { stats, statusData, weeklyData } = reportData;
  const displayName = currentUser
    ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email
    : 'Recruiter';

  // KPI card definitions — used in BOTH tabs
  const kpiCards = [
    { title: 'Total Candidates',     value: stats.totalSubmissions,         sub: 'All time submissions',     Icon: Users      },
    { title: 'Interviews Scheduled', value: stats.totalInterviewsScheduled, sub: 'Total interviews created', Icon: Briefcase  },
    { title: 'Offers',               value: stats.offers,                   sub: 'Offers Extended',          Icon: Award      },
    { title: 'Joinings',             value: stats.joined,                   sub: 'Joined',                   Icon: UserCheck  },
    { title: 'Performance',          value: `${stats.successRate}%`,        sub: 'Join to Submission ratio', Icon: TrendingUp },
  ];

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Reports</h1>
            <p className="text-slate-500 mt-1">Performance analytics for {displayName}</p>
          </div>

          {/* ── Tab Switcher ─────────────────────────────────────────────── */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm gap-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('detailed')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'detailed'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <List className="w-4 h-4" />
              Detailed
            </button>
          </div>
        </div>

        {/* ── KPI Cards — always visible on BOTH tabs ───────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {kpiCards.map(({ title, value, sub, Icon }) => (
            <div
              key={title}
              className={`rounded-xl border bg-white shadow-sm p-6 transition-all ${
                activeTab === 'overview' ? 'border-slate-200' : 'border-blue-100 ring-1 ring-blue-50'
              }`}
            >
              <div className="flex items-center justify-between pb-2">
                <span className="text-sm font-medium text-slate-500">{title}</span>
                <Icon className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{value}</div>
              <p className="text-xs text-slate-400 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Section label ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">
            {activeTab === 'overview' ? '📊 Charts & Analytics' : '📋 Candidate Breakdown'}
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {/* ════════════════════════════════════════════════════════════════
            OVERVIEW TAB — Charts
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <>
            {/* Row 1: Line + Pie */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
                <h3 className="font-semibold text-slate-900 mb-6">Weekly Activity Trends</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="week" tick={{ fill: '#64748b' }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#64748b' }} />
                    <Tooltip {...tooltipStyle} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line type="monotone" dataKey="submitted"  name="Submissions" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="interviews" name="Interviews"  stroke="#a855f7" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
                <h3 className="font-semibold text-slate-900 mb-6">Current Pipeline Status</h3>
                {statusData.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px] text-slate-400">
                    No candidate data yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusData} cx="50%" cy="50%" labelLine={false}
                        label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                        outerRadius={100} dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || STATUS_COLORS[entry.name] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip {...tooltipStyle} />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

            </div>

            {/* Row 2: Bar */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
              <h3 className="font-semibold text-slate-900 mb-6">Monthly Breakdown (Last 4 Weeks)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" tick={{ fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tick={{ fill: '#64748b' }} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="submitted"  name="Submissions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="interviews" name="Interviews"  fill="#a855f7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="offers"     name="Offers"      fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            DETAILED TAB — Candidate Table
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'detailed' && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">

            {/* Table header bar */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">All My Candidates</h3>
              <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full">
                {candidates.length} records
              </span>
            </div>

            {candLoading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
              </div>
            ) : candidates.length === 0 ? (
              <div className="text-center py-20 text-slate-400">No candidates found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-4 font-medium w-10">#</th>
                      <th className="px-5 py-4 font-medium">Name</th>
                      <th className="px-5 py-4 font-medium">Position</th>
                      <th className="px-5 py-4 font-medium">Client</th>
                      <th className="px-5 py-4 font-medium">Contact</th>
                      <th className="px-5 py-4 font-medium">Status</th>
                      <th className="px-5 py-4 font-medium">Date Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {candidates.map((c, idx) => {
                      const status = Array.isArray(c.status) ? c.status[0] : (c.status || 'Submitted');
                      return (
                        <tr key={c._id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3 text-slate-400 text-xs font-mono">{idx + 1}</td>
                          <td className="px-5 py-3 font-semibold text-slate-800 whitespace-nowrap">
                            {c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || '—'}
                          </td>
                          <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{c.position || '—'}</td>
                          <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{c.client || '—'}</td>
                          <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{c.contact || '—'}</td>
                          <td className="px-5 py-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[status] || 'bg-slate-100 text-slate-600'}`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">
                            {(c.dateAdded || c.createdAt)
                              ? new Date(c.dateAdded || c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
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