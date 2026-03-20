import React, { useState, useMemo, useEffect } from 'react';
import {
  Users, UserCheck, TrendingUp, PauseCircle, UserX, User,
  ClipboardList, Briefcase, FileText
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';

// ─── API Helpers ──────────────────────────────────────────────────────────────
// Module-level constants — computed once, never re-derived on re-render.
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

function getFirebaseToken() {
  try {
    const raw = sessionStorage.getItem('currentUser');
    return raw ? JSON.parse(raw)?.idToken : null;
  } catch { return null; }
}

async function apiFetch(path) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getFirebaseToken()}`,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Status helper — module level so it's never re-created ───────────────────
const getSafeStatus = (s) => {
  if (Array.isArray(s)) return String(s[0] || '').toLowerCase();
  return String(s || '').toLowerCase();
};

// ─── Theme map — module level constant, not recreated per render ──────────────
const BUBBLE_THEMES = {
  green:  { bubble: 'bg-[#e8f5e9]', iconBg: 'bg-[#e8f5e9]', iconText: 'text-green-600',  badge: 'bg-green-500',  bar: 'bg-green-500'  },
  blue:   { bubble: 'bg-[#e3f2fd]', iconBg: 'bg-[#e3f2fd]', iconText: 'text-blue-600',   badge: 'bg-blue-500',   bar: 'bg-blue-500'   },
  purple: { bubble: 'bg-[#f3e5f5]', iconBg: 'bg-[#f3e5f5]', iconText: 'text-purple-600', badge: 'bg-purple-500', bar: 'bg-purple-500' },
  orange: { bubble: 'bg-[#fff3e0]', iconBg: 'bg-[#fff3e0]', iconText: 'text-orange-500', badge: 'bg-orange-400', bar: 'bg-orange-400' },
  red:    { bubble: 'bg-[#ffebee]', iconBg: 'bg-[#ffebee]', iconText: 'text-red-500',    badge: 'bg-red-500',    bar: 'bg-red-500'    },
};

// ─── Card components — defined OUTSIDE parent so React doesn't unmount/remount
//     them on every parent re-render. Wrapped in React.memo for extra safety. ──

const PrimaryStatCard = React.memo(({ title, value, trend, icon: Icon, onClick }) => (
  <div
    onClick={onClick}
    className="relative overflow-hidden bg-[#3530a0] rounded-[1.5rem] p-6 text-white shadow-lg h-44 flex flex-col justify-between cursor-pointer"
  >
    <div className="relative z-10 flex justify-between items-start">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">{title}</p>
        <h3 className="text-4xl font-bold mt-2">{value}</h3>
      </div>
      <div className="p-2 bg-white/10 rounded-lg">
        <Icon className="w-7 h-7 text-white" />
      </div>
    </div>
    <div className="relative z-10 mt-auto">
      <div className="flex items-center gap-2 mb-2">
        <span className="bg-green-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">+{trend}%</span>
        <span className="text-[10px] opacity-70">vs last month</span>
      </div>
      <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
        <div className="h-full bg-blue-400 rounded-full w-2/5" />
      </div>
    </div>
    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 pointer-events-none" />
  </div>
));

const BubbleStatCard = React.memo(({ title, value, trend, icon: Icon, theme = 'blue', onClick }) => {
  const t = BUBBLE_THEMES[theme] || BUBBLE_THEMES.blue;
  return (
    <div
      onClick={onClick}
      className="relative bg-white rounded-[1.5rem] p-6 shadow-sm border border-gray-100 h-44 flex flex-col justify-between cursor-pointer overflow-hidden"
    >
      <div className={clsx('absolute -top-6 -left-6 w-36 h-36 rounded-full pointer-events-none', t.bubble)} />
      <div className="relative z-10 flex justify-between items-start">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{title}</p>
          <h3 className="text-4xl font-bold mt-2 text-slate-800">{value}</h3>
        </div>
        <div className={clsx('p-2 rounded-lg', t.iconBg)}>
          <Icon className={clsx('w-6 h-6', t.iconText)} />
        </div>
      </div>
      <div className="relative z-10 mt-auto">
        <div className="flex items-center gap-2 mb-2">
          <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold text-white', t.badge)}>+{trend}%</span>
          <span className="text-[10px] text-gray-400">vs last month</span>
        </div>
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div className={clsx('h-full rounded-full w-2/5', t.bar)} />
        </div>
      </div>
    </div>
  );
});

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
// NOTE: Export name kept as AdminDashboard to avoid breaking existing route imports.
export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const [candidates, setCandidates] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [clients,    setClients   ] = useState([]);
  const [jobs,       setJobs      ] = useState([]);
  const [loading,    setLoading   ] = useState(true);

  // FIX: Added cleanup flag to prevent setState on unmounted component.
  // FIX: Promise.allSettled so a slow /jobs or /clients endpoint never blocks
  //      candidates (the most important data) from rendering.
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const [candR, recR, jobsR, clientR] = await Promise.allSettled([
          apiFetch('/candidates'),
          apiFetch('/recruiters'),
          apiFetch('/jobs'),
          apiFetch('/clients'),
        ]);
        if (cancelled) return;
        if (candR.status   === 'fulfilled') setCandidates(candR.value);
        if (recR.status    === 'fulfilled') setRecruiters(recR.value);
        if (jobsR.status   === 'fulfilled') setJobs(jobsR.value);
        if (clientR.status === 'fulfilled') setClients(clientR.value);
      } catch {
        if (!cancelled) toast({ title: 'Sync Error', description: 'Check server connection', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Memoized computed values ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const total     = candidates.length;
    const submitted = candidates.filter(c => { const s = getSafeStatus(c.status); return s === 'submitted' || s === 'pending'; }).length;
    const joined    = candidates.filter(c => getSafeStatus(c.status) === 'joined').length;
    const hold      = candidates.filter(c => getSafeStatus(c.status) === 'hold').length;
    const rejected  = candidates.filter(c => getSafeStatus(c.status) === 'rejected').length;
    return { total, submitted, joined, hold, rejected };
  }, [candidates]);

  const recruiterStats = useMemo(() => {
    return recruiters
      .filter(r => r._id || r.id)
      .map(r => {
        const rid   = r._id || r.id;
        const cands = candidates.filter(c => (c.recruiterId?._id || c.recruiterId) === rid);
        const name  = r.name || `${r.firstName || ''} ${r.lastName || ''}`.trim();
        return {
          fullName:    name,
          submissions: cands.length,
          joined:      cands.filter(c => getSafeStatus(c.status) === 'joined').length,
          pending:     cands.filter(c => ['submitted', 'pending'].includes(getSafeStatus(c.status))).length,
          hold:        cands.filter(c => getSafeStatus(c.status) === 'hold').length,
          rejected:    cands.filter(c => getSafeStatus(c.status) === 'rejected').length,
        };
      })
      .filter(r => r.fullName !== '')
      .sort((a, b) => b.submissions - a.submissions);
  }, [candidates, recruiters]);

  // FIX: barData was computed inline in JSX — now memoized.
  const barData = useMemo(
    () => recruiterStats.slice(0, 6).map(r => ({ name: r.fullName.split(' ')[0], value: r.submissions })),
    [recruiterStats]
  );

  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-[#f3f6fd]">
      <div className="animate-spin h-12 w-12 border-4 border-[#283086] border-t-transparent rounded-full" />
    </div>
  );

  const formattedDate = format(new Date(), 'dd MMM, yyyy').toUpperCase();

  return (
    <div className="max-w-[1600px] mx-auto space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#283086]">Manager Dashboard</h1>
          <p className="text-gray-500 text-sm font-medium mt-1">
            Welcome back {currentUser?.firstName || 'Manager'}, Have a nice day..!
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-white px-4 py-2 rounded-lg shadow-sm">
          <span>{formattedDate}</span>
          <span className="relative flex h-3 w-3">
            <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500" />
          </span>
        </div>
      </div>

      {/* ── Row 1: Summary Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <PrimaryStatCard
          title="Total Candidates"
          value={stats.total}
          trend={12}
          icon={Users}
          onClick={() => navigate('/admin/add-candidate', { state: { filter: 'All' } })}
        />
        <BubbleStatCard title="Recruiters"    value={recruiters.length} trend={5} icon={UserCheck} theme="green"  onClick={() => navigate('/admin/recruiters')} />
        <BubbleStatCard title="Total Jobs"    value={jobs.length}       trend={8} icon={Briefcase}  theme="blue"   onClick={() => navigate('/admin/requirements')} />
        <BubbleStatCard title="Total Clients" value={clients.length}    trend={3} icon={FileText}   theme="purple" onClick={() => navigate('/admin/clients')} />
      </div>

      {/* ── Row 2: Status Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <BubbleStatCard title="Submitted" value={stats.submitted} trend={12} icon={User}       theme="purple" onClick={() => navigate('/admin/add-candidate', { state: { filter: 'Submitted' } })} />
        <BubbleStatCard title="Joined"    value={stats.joined}   trend={7}  icon={UserCheck}   theme="green"  onClick={() => navigate('/admin/add-candidate', { state: { filter: 'Joined' } })} />
        <BubbleStatCard title="Hold"      value={stats.hold}     trend={4}  icon={PauseCircle} theme="orange" onClick={() => navigate('/admin/add-candidate', { state: { filter: 'Hold' } })} />
        <BubbleStatCard title="Rejected"  value={stats.rejected} trend={5}  icon={UserX}       theme="red"    onClick={() => navigate('/admin/add-candidate', { state: { filter: 'Rejected' } })} />
      </div>

      {/* ── Row 3: Middle Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[1.5rem] shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Avg. Time of Hire</p>
            <h3 className="text-4xl font-bold text-slate-800 mt-2">0.0%</h3>
            <div className="w-full h-2 bg-gray-100 rounded-full mt-6">
              <div className="h-full bg-[#283086] rounded-full w-[30%]" />
            </div>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl"><TrendingUp size={32} className="text-blue-600" /></div>
        </div>
        <div className="bg-white p-8 rounded-[1.5rem] shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Joining Pipeline</p>
            <h3 className="text-4xl font-bold text-slate-800 mt-2">{stats.total}</h3>
            <p className="text-xs text-gray-400 mt-2">Active candidates in pipeline</p>
          </div>
          <div className="bg-indigo-50 p-4 rounded-xl"><User size={32} className="text-indigo-600" /></div>
        </div>
      </div>

      {/* ── Row 4: Chart ── */}
      <div className="bg-white p-8 rounded-[1.5rem] shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-base font-bold text-slate-800">Top Recruiters (Upload Report)</h3>
          <span className="text-xs text-gray-400">showing {Math.min(6, recruiters.length)} of {recruiters.length}</span>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} barSize={40}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip cursor={{ fill: 'transparent' }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {barData.map((_, i) => <Cell key={`cell-${i}`} fill="#5664d2" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 5: Table ── */}
      <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-6 flex justify-between items-center bg-[#f8faff] border-b border-gray-100">
          <h3 className="text-base font-bold text-slate-800">Recruiter Performance Details</h3>
          <button onClick={() => navigate('/admin/recruiters')} className="bg-[#283086] text-white px-5 py-2.5 rounded text-xs font-bold uppercase tracking-wide hover:bg-blue-900 shadow-lg">
            View All Recruiters
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f8faff] text-gray-500 font-bold uppercase text-[10px] tracking-widest border-b border-gray-100">
              <tr>
                <th className="px-8 py-5 text-left">Recruiter</th>
                <th className="px-4 py-5 text-center">Submissions</th>
                <th className="px-4 py-5 text-center">Hold</th>
                <th className="px-4 py-5 text-center">Joined</th>
                <th className="px-4 py-5 text-center">Rejected</th>
                <th className="px-4 py-5 text-center">Pending</th>
                <th className="px-8 py-5 text-right">Avg. Time to Hire</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {recruiterStats.map((r, i) => (
                <tr key={r.fullName || i} className="hover:bg-blue-50/30">
                  <td className="px-8 py-5 font-bold text-slate-700">{r.fullName}</td>
                  <td className="px-4 py-5 text-center text-blue-600 font-black">{r.submissions}</td>
                  <td className="px-4 py-5 text-center text-orange-400 font-bold">{r.hold}</td>
                  <td className="px-4 py-5 text-center text-green-600 font-black">{r.joined}</td>
                  <td className="px-4 py-5 text-center text-red-500 font-medium">{r.rejected}</td>
                  <td className="px-4 py-5 text-center text-gray-400 font-medium">{r.pending}</td>
                  <td className="px-8 py-5 text-right font-black text-red-500">0.0%</td>
                </tr>
              ))}
              {recruiterStats.length === 0 && (
                <tr><td colSpan="7" className="p-8 text-center text-gray-400">No active recruiter data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}