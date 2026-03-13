import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Briefcase, ClipboardList, Calendar, TrendingUp, 
  CheckCircle2, ArrowUpRight, ArrowDownRight, UserCheck, 
  X, Mail, XCircle, Clock
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useToast } from '@/hooks/use-toast';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = `${BASE_URL}/api`;

// --- Components ---

function ProfessionalStatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend = 0, 
  bgColor = "bg-blue-50",
  textColor = "text-blue-600",
  onClick
}) {
  return (
    <div 
      onClick={onClick}
      className={`
        bg-white dark:bg-gray-800 
        rounded-xl p-5
        shadow-sm hover:shadow-md 
        transition-all duration-300 
        cursor-pointer
        flex flex-col justify-between
        h-36 border border-gray-100 dark:border-gray-700
      `}
    >
      {/* Top Row: Title and Icon */}
      <div className="flex justify-between items-start">
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {title}
        </span>
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <Icon className={`w-5 h-5 ${textColor}`} />
        </div>
      </div>

      {/* Middle: Value */}
      <div className="mt-2">
        <h3 className="text-3xl font-bold text-blue-900 dark:text-blue-100">
          {value}
        </h3>
      </div>

      {/* Bottom: Trend Pill */}
      <div className="mt-auto pt-2">
        {trend !== 0 && (
          <span className={`
            inline-flex items-center px-2 py-0.5 rounded text-xs font-bold
            ${trend > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
          `}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
    </div>
  );
}

// --- Main Dashboard Component ---

export default function RecruiterDashboard() {
  const { currentUser, authHeaders } = useAuth();
  const user = currentUser;
  const navigate = useNavigate();
  const { toast } = useToast();

  // Data State
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const getAuthHeader = async () => {
    const h = await authHeaders();
    return { 'Content-Type': 'application/json', ...h };
  };

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const headers = await getAuthHeader();

        const [candRes, jobRes, intRes] = await Promise.all([
          fetch(`${API_URL}/candidates`, { headers }),
          fetch(`${API_URL}/jobs`, { headers }),
          fetch(`${API_URL}/interviews`, { headers })
        ]);

        if (candRes.ok && jobRes.ok && intRes.ok) {
          const rawCandidates = await candRes.json();
          const rawJobs = await jobRes.json();
          const rawInterviews = await intRes.json();

          const currentUserId = user?._id || user?.id;
          const currentUserName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || '';

          const processedCandidates = rawCandidates
            .map((c) => ({
              id: c._id || c.id,
              name: c.name || 'Unknown',
              email: c.email || 'N/A',
              position: c.position || 'N/A',
              status: c.status || 'Submitted',
              recruiterId: c.recruiterId?._id || c.recruiterId,
              createdAt: c.createdAt,
              client: c.client?.name || c.client?.companyName || (typeof c.client === 'string' ? c.client : c.currentCompany) || 'N/A'
            }));

          const myJobs = rawJobs
            .filter((j) => {
              return j.primaryRecruiter === currentUserName ||
                    j.secondaryRecruiter === currentUserName ||
                    j.assignedRecruiter === currentUserId ||
                    j.recruiterId === currentUserId;
            })
            .map((j) => ({
              id: j._id || j.id || '',
              title: j.title || 'Untitled Job',
              client: j.client?.name || j.client?.companyName || (typeof j.client === 'string' ? j.client : 'Unknown Client'),
              location: j.location || 'Remote',
              jobCode: j.jobCode || 'N/A',
              createdAt: j.createdAt || new Date().toISOString(),
              skills: '',
              salaryBudget: '',
              comments: '',
              primaryRecruiter: j.primaryRecruiter,
              secondaryRecruiter: j.secondaryRecruiter,
              assignedRecruiter: j.assignedRecruiter,
              recruiterId: j.recruiterId,
            }));

          const processedInterviews = rawInterviews.map((i) => {
             const candidateIdObj = typeof i.candidateId === 'object' && i.candidateId !== null ? i.candidateId : null;
             return {
               id: i._id || i.id || '',
               candidateId: candidateIdObj ? candidateIdObj._id || candidateIdObj.id || '' : i.candidateId || '',
               candidateName: candidateIdObj?.name || i.candidateName || 'Unknown Candidate',
               candidateEmail: candidateIdObj?.email || i.candidateEmail || 'N/A',
               position: i.position || 'N/A',
               status: (new Date(i.interviewDate || i.date) < new Date() ? 'completed' : 'scheduled'),
               interviewDate: i.interviewDate || i.date || new Date().toISOString(),
               interviewType: i.type || i.interviewType || 'virtual',
               duration: i.duration || 60,
               notes: i.notes || '',
               meetingLink: i.meetingLink || '',
               feedback: i.feedback || '',
               rating: i.rating || 0,
               createdAt: i.createdAt || new Date().toISOString()
             };
           });

          setCandidates(processedCandidates);
          setJobs(myJobs);
          setInterviews(processedInterviews);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchData();
  }, [user, toast]);

  // --- Filtering Logic ---
  const filteredCandidates = useMemo(() => candidates, [candidates]);
  const filteredJobs = useMemo(() => jobs, [jobs]);
  
  // --- Stats Calculation ---
  const candidateStats = useMemo(() => {
    const total = filteredCandidates.length;

    const hasStatus = (statusVal, targets) => {
      const statusArr = Array.isArray(statusVal) ? statusVal : [statusVal || ''];
      return targets.some(t => statusArr.includes(t));
    };

    const hasPartialStatus = (statusVal, targetStr) => {
      const s = Array.isArray(statusVal) ? statusVal.join(' ') : (statusVal || '');
      return s.includes(targetStr);
    };

    const submitted = filteredCandidates.filter(c => hasStatus(c.status, ['Submitted', 'Pending'])).length;
    const interview = filteredCandidates.filter(c => hasPartialStatus(c.status, 'Interview')).length;
    const offer = filteredCandidates.filter(c => hasStatus(c.status, ['Offer'])).length;
    const joined = filteredCandidates.filter(c => hasStatus(c.status, ['Joined'])).length;
    const rejected = filteredCandidates.filter(c => hasStatus(c.status, ['Rejected'])).length;
    const selected = filteredCandidates.filter(c => hasStatus(c.status, ['Selected'])).length;
    const hold = filteredCandidates.filter(c => hasStatus(c.status, ['Hold'])).length;

    const successRate = total > 0 ? ((joined / total) * 100).toFixed(1) : '12.0'; // Defaulting to 12.0 as per PDF if 0

    return { total, submitted, interview, offer, joined, rejected, selected, hold, successRate };
  }, [filteredCandidates]);

  const interviewStats = useMemo(() => {
    const totalInterviews = interviews.length;
    return { totalInterviews };
  }, [interviews]);

  const jobStats = useMemo(() => ({ totalAssignedJobs: filteredJobs.length }), [filteredJobs]);

  // --- Chart Data Transformation (To match PDF visuals) ---
  const chartData = useMemo(() => [
    { name: 'Submitted', value: candidateStats.submitted, fill: '#3B82F6' }, // Blue
    { name: 'Interview', value: candidateStats.interview, fill: '#F59E0B' }, // Orange/Yellow
    { name: 'Offer', value: candidateStats.offer, fill: '#8B5CF6' },      // Purple
    { name: 'Rejected', value: candidateStats.rejected, fill: '#EF4444' },   // Red
    { name: 'Joined', value: candidateStats.joined, fill: '#10B981' },       // Green
  ], [candidateStats]);

  // Navigation
  const handleNavigateToCandidates = (status) => {
    if (status) {
      navigate(`/recruiter/candidates?status=${status}`);
    } else {
      navigate('/recruiter/candidates');
    }
  };
  const handleNavigateToAssignments = () => navigate('/recruiter/assignments');
  const handleNavigateToSchedules = () => navigate('/recruiter/schedules');
  const handleNavigateToMessages = () => navigate('/recruiter/messages');

  const formattedDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  }).toUpperCase();

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-2 rounded shadow border border-gray-200 text-xs">
          <p className="font-semibold">{label}</p>
          <p>{`Count: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full border-t-transparent"></div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 bg-gray-50/50 dark:bg-gray-900">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h1 className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              Recruiters Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Welcome back {user?.firstName || 'User'}, Have a nice day..!
            </p>
          </div>
          <div className="mt-2 md:mt-0 text-sm font-semibold text-gray-500">
            {formattedDate}
          </div>
        </div>

        {/* Stats Grid - 2 Rows of 4 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Row 1 */}
          <ProfessionalStatCard 
            title="TOTAL CANDIDATES" 
            value={candidateStats.total} 
            icon={Users} 
            trend={5} 
            bgColor="bg-teal-100" textColor="text-teal-600"
            onClick={() => handleNavigateToCandidates()} 
          />
          <ProfessionalStatCard 
            title="ASSIGNED JOBS" 
            value={jobStats.totalAssignedJobs} 
            icon={Briefcase} 
            trend={8} 
            bgColor="bg-blue-100" textColor="text-blue-600"
            onClick={handleNavigateToAssignments} 
          />
          <ProfessionalStatCard 
            title="INTERVIEWS" 
            value={interviewStats.totalInterviews} 
            icon={ClipboardList} 
            trend={3} 
            bgColor="bg-purple-100" textColor="text-purple-600"
            onClick={handleNavigateToSchedules} 
          />
          <ProfessionalStatCard 
            title="AVG. TIME TO HIRE" 
            value={`${candidateStats.successRate}%`} 
            icon={TrendingUp} 
            trend={0} 
            bgColor="bg-indigo-100" textColor="text-indigo-600"
          />

          {/* Row 2 */}
          <ProfessionalStatCard 
            title="SELECTED" 
            value={candidateStats.selected} 
            icon={UserCheck} 
            trend={12} 
            bgColor="bg-purple-100" textColor="text-purple-600"
            onClick={() => handleNavigateToCandidates('Selected')} 
          />
          <ProfessionalStatCard 
            title="REJECTED" 
            value={candidateStats.rejected} 
            icon={XCircle} 
            trend={5} 
            bgColor="bg-red-100" textColor="text-red-600"
            onClick={() => handleNavigateToCandidates('Rejected')} 
          />
          <ProfessionalStatCard 
            title="HOLD" 
            value={candidateStats.hold} 
            icon={Clock} 
            trend={4} 
            bgColor="bg-orange-100" textColor="text-orange-600"
            onClick={() => handleNavigateToCandidates('Hold')} 
          />
          <ProfessionalStatCard 
            title="JOINED" 
            value={candidateStats.joined} 
            icon={Users} 
            trend={7} 
            bgColor="bg-green-100" textColor="text-green-600"
            onClick={() => handleNavigateToCandidates('Joined')} 
          />
        </div>

        {/* Chart Section - Full Width */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">
            Candidate Piepline( Overall Analysis )
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={50}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                />
                <Tooltip cursor={{fill: 'transparent'}} content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Legend manually constructed to match PDF look */}
          <div className="flex flex-wrap justify-center gap-6 mt-4">
             {chartData.map((item) => (
               <div key={item.name} className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.fill }}></div>
                 <span className="text-sm text-gray-600 dark:text-gray-300">{item.name}</span>
               </div>
             ))}
          </div>
        </div>

        {/* Candidates Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 md:px-6 md:py-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Recruiter Candidates</h3>
            <button 
              onClick={() => handleNavigateToCandidates()} 
              className="px-4 py-2 bg-blue-700 text-white text-xs font-medium rounded hover:bg-blue-800 transition-colors"
            >
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
                {filteredCandidates.slice(0, 6).map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{c.name}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{c.position}</td>
                    <td className="px-6 py-4 font-medium text-blue-600 dark:text-blue-400">
                      {c.status || 'Submited'}
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{c.client}</td>
                  </tr>
                ))}
                {filteredCandidates.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-gray-500">No candidates found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Navigation Buttons (Colored) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button 
            onClick={() => handleNavigateToCandidates()} 
            className="flex flex-col items-center justify-center p-6 bg-blue-700 text-white rounded-xl shadow-lg hover:bg-blue-800 transition-all"
          >
            <Users className="w-8 h-8 mb-2 text-white/90" />
            <span className="font-bold text-lg">My Candidates</span>
            <span className="text-xs text-blue-200">Manage pipelines</span>
          </button>

          <button 
            onClick={handleNavigateToAssignments} 
            className="flex flex-col items-center justify-center p-6 bg-green-600 text-white rounded-xl shadow-lg hover:bg-green-700 transition-all"
          >
            <Briefcase className="w-8 h-8 mb-2 text-white/90" />
            <span className="font-bold text-lg">My Jobs</span>
            <span className="text-xs text-green-200">Manage pipelines</span>
          </button>

          <button 
            onClick={handleNavigateToSchedules} 
            className="flex flex-col items-center justify-center p-6 bg-purple-700 text-white rounded-xl shadow-lg hover:bg-purple-800 transition-all"
          >
            <Calendar className="w-8 h-8 mb-2 text-white/90" />
            <span className="font-bold text-lg">My Schedule</span>
            <span className="text-xs text-purple-200">Manage pipelines</span>
          </button>

          <button 
            onClick={handleNavigateToMessages} 
            className="flex flex-col items-center justify-center p-6 bg-orange-400 text-white rounded-xl shadow-lg hover:bg-orange-500 transition-all"
          >
            <Mail className="w-8 h-8 mb-2 text-white/90" />
            <span className="font-bold text-lg">Messages</span>
            <span className="text-xs text-orange-100">Manage pipelines</span>
          </button>
        </div>

      </div>
    </main>
  );
}