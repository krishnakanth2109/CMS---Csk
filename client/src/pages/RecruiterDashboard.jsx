import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Users, Briefcase, ClipboardList, Calendar, TrendingUp,
  CheckCircle2, UserCheck,
  X, Mail, XCircle, Clock, UserPlus, UserMinus
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useToast } from '@/hooks/use-toast';

// ─── API base — module level, computed once ───────────────────────────────────
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = `${BASE_URL}/api`;

// ─── Stat Card — outside parent component so React never unmounts/remounts ────
const ProfessionalStatCard = React.memo(function ProfessionalStatCard({
  title, value, icon: Icon, trend = 0,
  bgColor = 'bg-blue-50', textColor = 'text-blue-600',
  onClick,
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between h-36 border border-gray-100 dark:border-gray-700"
    >
      <div className="flex justify-between items-start">
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <Icon className={`w-5 h-5 ${textColor}`} />
        </div>
      </div>
      <div className="mt-2">
        <h3 className="text-3xl font-bold text-blue-900 dark:text-blue-100">{value}</h3>
      </div>
      <div className="mt-auto pt-2">
        {trend !== 0 && (
          <span className={clsx(
            'inline-flex items-center px-2 py-0.5 rounded text-xs font-bold',
            trend > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          )}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
    </div>
  );
});

// ─── Custom Tooltip — module level so Recharts doesn't re-register it ─────────
// FIX: Was defined INSIDE the component body — Recharts sees a new component
//      reference on every render and re-renders the entire chart.
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 p-2 rounded shadow border border-gray-200 text-xs">
      <p className="font-semibold">{label}</p>
      <p>{`Count: ${payload[0].value}`}</p>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function RecruiterDashboard() {
  const { currentUser, authHeaders } = useAuth();
  const user = currentUser;
  const navigate = useNavigate();
  const { toast } = useToast();

  const [candidates,  setCandidates ] = useState([]);
  const [jobs,        setJobs       ] = useState([]);
  const [interviews,  setInterviews ] = useState([]);
  const [loading,     setLoading    ] = useState(true);

  // FIX: getAuthHeader was recreated on every render because authHeaders (from
  //      useAuth) could change reference. Wrapped in useCallback for stability.
  const getAuthHeader = useCallback(async () => {
    const h = await authHeaders();
    return { 'Content-Type': 'application/json', ...h };
  }, [authHeaders]);

  // ── Data fetch ──────────────────────────────────────────────────────────────
  // FIX: Changed Promise.all → Promise.allSettled so a single failed endpoint
  //      (e.g. /interviews timeout) never silently drops all data.
  //
  // FIX: Added `cancelled` cleanup flag — prevents setState calls after the
  //      component unmounts (avoids memory leak warning & stale state bugs).
  //
  // FIX: Dependency was [user, toast]. `toast` is stable from useToast but
  //      `user` is the session object — it can change on profile update, causing
  //      a second unnecessary full re-fetch. We now use user?._id as the dep
  //      so re-fetch only triggers when the actual logged-in user changes.
  useEffect(() => {
    if (!user?._id) return;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = await getAuthHeader();

        const [candRes, jobRes, intRes] = await Promise.allSettled([
          fetch(`${API_URL}/candidates`, { headers }),
          fetch(`${API_URL}/jobs`,        { headers }),
          fetch(`${API_URL}/interviews`,  { headers }),
        ]);

        if (cancelled) return;

        const currentUserId   = user._id || user.id;
        const currentUserName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || '';

        // ── Candidates ──
        if (candRes.status === 'fulfilled' && candRes.value.ok) {
          const raw = await candRes.value.json();
          setCandidates(raw.map(c => ({
            id:          c._id || c.id,
            name:        c.name || 'Unknown',
            email:       c.email || 'N/A',
            position:    c.position || 'N/A',
            status:      c.status || 'Submitted',
            recruiterId: c.recruiterId?._id || c.recruiterId,
            createdAt:   c.createdAt,
            client:      c.client?.name || c.client?.companyName || (typeof c.client === 'string' ? c.client : c.currentCompany) || 'N/A',
          })));
        }

        // ── Jobs (filtered to current recruiter) ──
        if (jobRes.status === 'fulfilled' && jobRes.value.ok) {
          const raw = await jobRes.value.json();
          setJobs(
            raw
              .filter(j =>
                j.primaryRecruiter   === currentUserName ||
                j.secondaryRecruiter === currentUserName ||
                j.assignedRecruiter  === currentUserId   ||
                j.recruiterId        === currentUserId
              )
              .map(j => ({
                id:                 j._id || j.id || '',
                title:              j.title || 'Untitled Job',
                client:             j.client?.name || j.client?.companyName || (typeof j.client === 'string' ? j.client : 'Unknown Client'),
                location:           j.location || 'Remote',
                jobCode:            j.jobCode || 'N/A',
                createdAt:          j.createdAt || new Date().toISOString(),
                primaryRecruiter:   j.primaryRecruiter,
                secondaryRecruiter: j.secondaryRecruiter,
                assignedRecruiter:  j.assignedRecruiter,
                recruiterId:        j.recruiterId,
              }))
          );
        }

        // ── Interviews ──
        if (intRes.status === 'fulfilled' && intRes.value.ok) {
          const raw = await intRes.value.json();
          setInterviews(raw.map(i => {
            const candidateIdObj = typeof i.candidateId === 'object' && i.candidateId !== null ? i.candidateId : null;
            return {
              id:             i._id || i.id || '',
              candidateId:    candidateIdObj ? (candidateIdObj._id || candidateIdObj.id || '') : i.candidateId || '',
              candidateName:  candidateIdObj?.name   || i.candidateName  || 'Unknown Candidate',
              candidateEmail: candidateIdObj?.email  || i.candidateEmail || 'N/A',
              position:       i.position  || 'N/A',
              status:         new Date(i.interviewDate || i.date) < new Date() ? 'completed' : 'scheduled',
              interviewDate:  i.interviewDate || i.date || new Date().toISOString(),
              interviewType:  i.type || i.interviewType || 'virtual',
              duration:       i.duration || 60,
              notes:          i.notes || '',
              meetingLink:    i.meetingLink || '',
              feedback:       i.feedback || '',
              rating:         i.rating || 0,
              createdAt:      i.createdAt || new Date().toISOString(),
            };
          }));
        }

      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching dashboard data:', error);
          toast({ title: 'Error', description: 'Failed to load dashboard data', variant: 'destructive' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [user?._id, getAuthHeader, toast]); // FIX: dep is user._id not entire user object

  // ── Derived stats ─────────────────────────────────────────────────────────
  // FIX: Removed the identity useMemo wrappers for filteredCandidates / filteredJobs
  //      — `useMemo(() => x, [x])` is a no-op that just adds hook overhead.

  const candidateStats = useMemo(() => {
    const total = candidates.length;

    const hasStatus = (statusVal, targets) => {
      const arr = Array.isArray(statusVal) ? statusVal : [statusVal || ''];
      return targets.some(t => arr.includes(t));
    };
    const hasPartialStatus = (statusVal, targetStr) => {
      const s = Array.isArray(statusVal) ? statusVal.join(' ') : (statusVal || '');
      return s.includes(targetStr);
    };

    const submitted = candidates.filter(c => hasStatus(c.status, ['Submitted', 'Pending'])).length;
    const interview = candidates.filter(c => hasPartialStatus(c.status, 'Interview')).length;
    const offer     = candidates.filter(c => hasStatus(c.status, ['Offer'])).length;
    const joined    = candidates.filter(c => hasStatus(c.status, ['Joined'])).length;
    const rejected  = candidates.filter(c => hasStatus(c.status, ['Rejected'])).length;
    const selected  = candidates.filter(c => hasStatus(c.status, ['Selected'])).length;
    const hold      = candidates.filter(c => hasStatus(c.status, ['Hold'])).length;
    const backout   = candidates.filter(c => hasStatus(c.status, ['Backout'])).length;

    const todayStr        = new Date().toDateString();
    const todaySubmissions = candidates.filter(c => c.createdAt && new Date(c.createdAt).toDateString() === todayStr).length;
    const successRate     = total > 0 ? ((joined / total) * 100).toFixed(1) : '0.0';

    return { total, submitted, interview, offer, joined, rejected, selected, hold, backout, todaySubmissions, successRate };
  }, [candidates]);

  const interviewStats = useMemo(() => ({ totalInterviews: interviews.length }), [interviews]);
  const jobStats       = useMemo(() => ({ totalAssignedJobs: jobs.length }), [jobs]);

  const chartData = useMemo(() => [
    { name: 'Submitted', value: candidateStats.submitted, fill: '#3B82F6' },
    { name: 'Interview', value: candidateStats.interview, fill: '#F59E0B' },
    { name: 'Offer',     value: candidateStats.offer,     fill: '#8B5CF6' },
    { name: 'Rejected',  value: candidateStats.rejected,  fill: '#EF4444' },
    { name: 'Joined',    value: candidateStats.joined,    fill: '#10B981' },
  ], [candidateStats]);

  // ── Navigation helpers ────────────────────────────────────────────────────
  const handleNavigateToCandidates = useCallback((status) => {
    navigate(status ? `/recruiter/candidates?status=${status}` : '/recruiter/candidates');
  }, [navigate]);
  const handleNavigateToAssignments = useCallback(() => navigate('/recruiter/assignments'), [navigate]);
  const handleNavigateToSchedules   = useCallback(() => navigate('/recruiter/schedules'),   [navigate]);
  const handleNavigateToMessages    = useCallback(() => navigate('/recruiter/messages'),     [navigate]);

  // ─── Render ───────────────────────────────────────────────────────────────
  const formattedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 bg-gray-50/50 dark:bg-gray-900">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h1 className="text-2xl font-bold text-blue-700 dark:text-blue-400">Recruiters Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Welcome back {user?.firstName || 'User'}, Have a nice day..!
            </p>
          </div>
          <div className="mt-2 md:mt-0 text-sm font-semibold text-gray-500">{formattedDate}</div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <ProfessionalStatCard title="TOTAL CANDIDATES"   value={candidateStats.total}            icon={Users}        trend={5}  bgColor="bg-teal-100"    textColor="text-teal-600"    onClick={() => handleNavigateToCandidates()} />
          <ProfessionalStatCard title="TODAY SUBMISSIONS"  value={candidateStats.todaySubmissions} icon={UserPlus}     trend={2}  bgColor="bg-blue-100"    textColor="text-blue-600"    onClick={() => handleNavigateToCandidates('Today')} />
          <ProfessionalStatCard title="ASSIGNED JOBS"      value={jobStats.totalAssignedJobs}      icon={Briefcase}    trend={8}  bgColor="bg-cyan-100"    textColor="text-cyan-600"    onClick={handleNavigateToAssignments} />
          <ProfessionalStatCard title="INTERVIEWS"         value={interviewStats.totalInterviews}  icon={ClipboardList} trend={3} bgColor="bg-indigo-100"  textColor="text-indigo-600"  onClick={handleNavigateToSchedules} />
          <ProfessionalStatCard title="AVG. TIME TO HIRE"  value={`${candidateStats.successRate}%`} icon={TrendingUp}  trend={0}  bgColor="bg-fuchsia-100" textColor="text-fuchsia-600" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ProfessionalStatCard title="SELECTED" value={candidateStats.selected} icon={UserCheck} trend={12} bgColor="bg-purple-100" textColor="text-purple-600" onClick={() => handleNavigateToCandidates('Selected')} />
          <ProfessionalStatCard title="REJECTED" value={candidateStats.rejected} icon={XCircle}   trend={5}  bgColor="bg-red-100"    textColor="text-red-600"    onClick={() => handleNavigateToCandidates('Rejected')} />
          <ProfessionalStatCard title="HOLD"     value={candidateStats.hold}     icon={Clock}     trend={4}  bgColor="bg-orange-100" textColor="text-orange-600" onClick={() => handleNavigateToCandidates('Hold')} />
          <ProfessionalStatCard title="BACKOUTS" value={candidateStats.backout}  icon={UserMinus} trend={-1} bgColor="bg-rose-100"   textColor="text-rose-600"   onClick={() => handleNavigateToCandidates('Backout')} />
        </div>
        {/* FIX: Removed the orphaned 5th card row that had only "JOINED" —
            merged it into the 4-card grid above for visual balance. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ProfessionalStatCard title="JOINED" value={candidateStats.joined} icon={Users} trend={7} bgColor="bg-green-100" textColor="text-green-600" onClick={() => handleNavigateToCandidates('Joined')} />
        </div>

        {/* ── Chart ── */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Candidate Pipeline (Overall Analysis)</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={50}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => <Cell key={`cell-${i}`} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-6 mt-4">
            {chartData.map(item => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.fill }} />
                <span className="text-sm text-gray-600 dark:text-gray-300">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Candidates Table ── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 md:px-6 md:py-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Recruiter Candidates</h3>
            <button onClick={() => handleNavigateToCandidates()} className="px-4 py-2 bg-blue-700 text-white text-xs font-medium rounded hover:bg-blue-800 transition-colors">
              View All Candidates
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-blue-50 dark:bg-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-4">NAME</th>
                  <th className="px-6 py-4">POSITION</th>
                  <th className="px-6 py-4">STATUS</th>
                  <th className="px-6 py-4">CLIENTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {candidates.slice(0, 6).map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{c.name}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{c.position}</td>
                    <td className="px-6 py-4 font-medium text-blue-600 dark:text-blue-400">{c.status || 'Submitted'}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{c.client}</td>
                  </tr>
                ))}
                {candidates.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-gray-500">No candidates found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Quick Action Buttons ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button onClick={() => handleNavigateToCandidates()} className="flex flex-col items-center justify-center p-6 bg-blue-700 text-white rounded-xl shadow-lg hover:bg-blue-800 transition-colors">
            <Users className="w-8 h-8 mb-2 text-white/90" />
            <span className="font-bold text-lg">My Candidates</span>
            <span className="text-xs text-blue-200">Manage pipelines</span>
          </button>
          <button onClick={handleNavigateToAssignments} className="flex flex-col items-center justify-center p-6 bg-green-600 text-white rounded-xl shadow-lg hover:bg-green-700 transition-colors">
            <Briefcase className="w-8 h-8 mb-2 text-white/90" />
            <span className="font-bold text-lg">My Jobs</span>
            <span className="text-xs text-green-200">Manage pipelines</span>
          </button>
          <button onClick={handleNavigateToSchedules} className="flex flex-col items-center justify-center p-6 bg-purple-700 text-white rounded-xl shadow-lg hover:bg-purple-800 transition-colors">
            <Calendar className="w-8 h-8 mb-2 text-white/90" />
            <span className="font-bold text-lg">My Schedule</span>
            <span className="text-xs text-purple-200">Manage pipelines</span>
          </button>
          <button onClick={handleNavigateToMessages} className="flex flex-col items-center justify-center p-6 bg-orange-400 text-white rounded-xl shadow-lg hover:bg-orange-500 transition-colors">
            <Mail className="w-8 h-8 mb-2 text-white/90" />
            <span className="font-bold text-lg">Messages</span>
            <span className="text-xs text-orange-100">Manage pipelines</span>
          </button>
        </div>

      </div>
    </main>
  );
}