import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Download, TrendingUp, Calendar, Loader2,
  Users, ClipboardList, X, ChevronDown, RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API_URL  = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Get safe YYYY-MM-DD from a date value
const getSafeDate = (d) => {
  if (!d) return '';
  if (typeof d === 'string' && d.length >= 10) return d.substring(0, 10);
  try { return new Date(d).toISOString().split('T')[0]; } catch (e) { return ''; }
};

// ── Local YYYY-MM-DD today string
const localDateStr = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#fff', border: '1px solid #e2e8f0',
    borderRadius: '8px', color: '#0f172a', fontSize: '12px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
  },
  formatter: (value, name) => [`${name} : ${value}`, ''],
  labelStyle: { fontWeight: 700, color: '#1e293b', marginBottom: 4 },
};
const LegendLabel = (v) => <span style={{ color: '#475569', fontWeight: 600 }}>{v}</span>;

// ── Recruiter name resolver
const getRecruiterName = (r) => {
  if (!r) return '-';
  if (typeof r === 'object') {
    const first = r.firstName || '';
    const last  = r.lastName  || '';
    if (first || last) return `${first} ${last}`.trim();
    if (r.name)     return r.name;
    if (r.username) return r.username;
    if (r.email)    return r.email;
    return '-';
  }
  return '-';
};

// ═════════════════════════════════════════════════════════════════════════════
// Today Submissions Modal
// ═════════════════════════════════════════════════════════════════════════════
function TodaySubmissionsModal({ candidates, recruiters, onClose }) {
  const todayStr = localDateStr();
  const [selectedDate,    setSelectedDate]    = useState(todayStr);
  const [recruiterFilter, setRecruiterFilter] = useState('all');

  const filtered = useMemo(() => {
    return candidates.filter(c => {
      const d        = c.dateAdded || c.createdAt;
      const dateMatch = getSafeDate(d) === selectedDate;
      if (!dateMatch) return false;
      if (recruiterFilter === 'all') return true;
      const recId = typeof c.recruiterId === 'object' ? c.recruiterId?._id : c.recruiterId;
      return String(recId) === String(recruiterFilter);
    });
  }, [candidates, selectedDate, recruiterFilter]);

  const displayDate = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  const selectedRecruiterName = recruiterFilter === 'all'
    ? 'all recruiters'
    : (() => {
        const found = recruiters.find(r => (r._id || r.id) === recruiterFilter);
        return found ? getRecruiterName(found) : recruiterFilter;
      })();

  const getCandidateId = (c) =>
    c.candidateId || c._id?.substring(c._id.length - 6).toUpperCase();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-violet-500" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Day Submissions</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Viewing candidates submitted by {selectedRecruiterName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={recruiterFilter}
              onChange={e => setRecruiterFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-slate-700 min-w-[150px]"
            >
              <option value="all">All Recruiters</option>
              {recruiters.map(r => (
                <option key={r._id || r.id} value={r._id || r.id}>
                  {getRecruiterName(r)}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5 border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                max={todayStr}
                onChange={e => setSelectedDate(e.target.value)}
                className="border-none outline-none bg-transparent text-sm text-slate-700 cursor-pointer"
              />
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="overflow-auto flex-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Calendar className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">No submissions for {displayDate}</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold border-b sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">CANDIDATE ID</th>
                  <th className="px-4 py-3 whitespace-nowrap">CANDIDATE NAME</th>
                  <th className="px-4 py-3 whitespace-nowrap">RECRUITER</th>
                  <th className="px-4 py-3 whitespace-nowrap">POSITION</th>
                  <th className="px-4 py-3 whitespace-nowrap">CLIENT</th>
                  <th className="px-4 py-3 whitespace-nowrap">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => {
                  const statusArr = Array.isArray(c.status) ? c.status : [c.status || 'Submitted'];
                  return (
                    <tr key={c._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-blue-600 font-bold whitespace-nowrap">
                        {getCandidateId(c)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                        {c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {typeof c.recruiterId === 'object'
                          ? getRecruiterName(c.recruiterId)
                          : c.recruiterName || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.position || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.client || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {statusArr.map(s => (
                            <span key={s}
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                s === 'Selected' || s === 'Joined'
                                  ? 'bg-green-100 text-green-800'
                                  : s === 'Rejected' || s === 'No Show' || s === 'Backout'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-blue-100 text-blue-800'
                              }`}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{filtered.length}</span> submissions.
          </p>
          <button onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-white transition-colors">
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function AdminReports() {
  const { toast }       = useToast();
  const { authHeaders } = useAuth();

  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedWeek,  setSelectedWeek]  = useState('all');
  const [selectedDate,  setSelectedDate]  = useState('');

  // Report data 
  const [overview,      setOverview]      = useState({ totalCandidates: 0, activeRecruiters: 0, conversionRate: '0%' });
  const [recruiterPerf, setRecruiterPerf] = useState([]);
  const [monthlyData,   setMonthlyData]   = useState([]);

  // All candidates + recruiters
  const [allCandidates, setAllCandidates] = useState([]);
  const [allRecruiters, setAllRecruiters] = useState([]);
  const [todayCount,    setTodayCount]    = useState(0);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const getHeaders = useCallback(async () => {
    const ah = await authHeaders();
    return { 'Content-Type': 'application/json', ...ah };
  }, [authHeaders]);

  // ── Main fetch: Fetch candidates directly to build foolproof local charts ──────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const headers = await getHeaders();

      const [candRes, recRes] = await Promise.all([
        fetch(`${API_URL}/candidates`, { headers }),
        fetch(`${API_URL}/recruiters`, { headers }),
      ]);

      if (candRes.ok) {
        const cands = await candRes.json();
        setAllCandidates(Array.isArray(cands) ? cands : []);
      }

      if (recRes.ok) {
        const recs = await recRes.json();
        setAllRecruiters(Array.isArray(recs) ? recs : []);
      }
    } catch (err) {
      console.error('[AdminReports] fetch error:', err);
      setFetchError(true);
      toast({ title: 'Error', description: 'Failed to load reports.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [getHeaders, toast]);

  // Trigger initial fetch
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── This effect recalculates the stats immediately whenever filters change ─────────
  useEffect(() => {
    if (!allCandidates || allCandidates.length === 0) return;

    // 1. Compute today count
    const today = localDateStr();
    const todayCands = allCandidates.filter(c => getSafeDate(c.dateAdded || c.createdAt) === today);
    setTodayCount(todayCands.length);

    // 2. Filter the candidates array by selected month/date/week
    const filtered = allCandidates.filter(c => {
      const d = new Date(c.dateAdded || c.createdAt);
      if (isNaN(d)) return false;

      // Filter by Exact Date
      if (selectedDate) return getSafeDate(d) === selectedDate;

      // Filter by Month
      if (selectedMonth !== 'all') {
        if (d.getMonth() !== parseInt(selectedMonth)) return false;
        
        // Filter by Week
        if (selectedWeek !== 'all') {
           const day = d.getDate();
           const w = Math.ceil(day / 7);
           const assignedWeek = w > 4 ? 4 : w; // Max 4 weeks
           if (assignedWeek !== parseInt(selectedWeek)) return false;
        }
      }
      return true;
    });

    // 3. Compute KPI Overview
    const total = filtered.length;
    let selCount = 0, joinCount = 0;
    filtered.forEach(c => {
       const s = Array.isArray(c.status) ? c.status[0] : c.status;
       if (s?.includes('Select')) selCount++;
       if (s?.includes('Joined')) joinCount++;
    });
    const conv = selCount > 0 ? Math.round((joinCount / selCount) * 100) + '%' : '0%';
    setOverview({ totalCandidates: total, activeRecruiters: allRecruiters.length, conversionRate: conv });

    // 4. Compute Recruiter Performance (Recruiters Tab)
    const rMap = {};
    filtered.forEach(c => {
       const rName = typeof c.recruiterId === 'object' ? getRecruiterName(c.recruiterId) : (c.recruiterName || 'Unknown');
       if (!rMap[rName]) rMap[rName] = { name: rName, Submissions: 0, Turnups: 0, Selected: 0, Joined: 0 };
       
       rMap[rName].Submissions++;
       const s = Array.isArray(c.status) ? c.status[0] : c.status;
       if (s?.includes('Turnup')) rMap[rName].Turnups++;
       if (s?.includes('Select')) rMap[rName].Selected++;
       if (s?.includes('Joined')) rMap[rName].Joined++;
    });
    setRecruiterPerf(Object.values(rMap));

    // 5. Compute Monthly Trends (Trends Tab) - Uses ALL candidates to show full trend
    const mMap = {};
    MONTH_SHORT.forEach(m => mMap[m] = { month: m, candidates: 0, joined: 0, selected: 0, rejected: 0, hold: 0 });
    
    allCandidates.forEach(c => {
       const d = new Date(c.dateAdded || c.createdAt);
       if (isNaN(d)) return;
       const mStr = MONTH_SHORT[d.getMonth()];
       
       if (mMap[mStr]) {
          mMap[mStr].candidates++;
          const s = Array.isArray(c.status) ? c.status[0] : c.status;
          if (s?.includes('Joined')) mMap[mStr].joined++;
          if (s?.includes('Select')) mMap[mStr].selected++;
          if (s?.includes('Reject')) mMap[mStr].rejected++;
          if (s?.includes('Hold')) mMap[mStr].hold++;
       }
    });
    setMonthlyData(Object.values(mMap));

  }, [allCandidates, allRecruiters, selectedMonth, selectedWeek, selectedDate]);


  const handleExport = async (format) => {
    if (!recruiterPerf.length) {
      toast({ title: 'No Data', description: 'No recruiter data for selected period.', variant: 'default' });
      return;
    }
    setIsExporting(true);
    try {
      const mLabel = selectedMonth === 'all' ? 'All' : MONTH_SHORT[parseInt(selectedMonth)];
      const wLabel = selectedWeek  === 'all' ? 'All' : `W${selectedWeek}`;
      const suffix = selectedDate  || `${mLabel}_${wLabel}`;
      if (format === 'excel') {
        const ws = XLSX.utils.json_to_sheet(recruiterPerf);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Recruiter Report');
        XLSX.writeFile(wb, `Recruiter_Report_${suffix}.xlsx`);
      } else {
        const doc = new jsPDF();
        doc.text(`Recruiter Performance Report (${suffix})`, 14, 16);
        autoTable(doc, {
          startY: 20,
          head: [['Recruiter','Submissions','Turnups','Selected','Joined']],
          body: recruiterPerf.map(r => [r.name, r.Submissions, r.Turnups, r.Selected, r.Joined]),
        });
        doc.save(`Recruiter_Report_${suffix}.pdf`);
      }
      toast({ title: 'Success', description: `${format.toUpperCase()} exported.` });
    } catch (err) {
      toast({ title: 'Export Failed', description: 'Could not export.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const now         = new Date();
  const dateDisplay = `${String(now.getDate()).padStart(2,'0')} ${MONTH_SHORT[now.getMonth()]} ${now.getFullYear()}`.toUpperCase();
  const filterLabel = selectedDate
    ? selectedDate
    : `${selectedMonth === 'all' ? 'All Months' : MONTH_NAMES[parseInt(selectedMonth)]} / ${selectedWeek === 'all' ? 'All Weeks' : `Week ${selectedWeek}`}`;

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#f0f2f8]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#1e2a78]" />
        <p className="text-sm text-slate-500 font-medium">Loading analytics...</p>
      </div>
    </div>
  );

  if (fetchError) return (
    <div className="flex h-screen items-center justify-center bg-[#f0f2f8]">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-slate-700 font-semibold">Failed to load reports</p>
        <button onClick={fetchAll}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e2a78] text-white text-sm font-semibold rounded-lg hover:bg-[#162060] transition">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#f0f2f8] min-h-screen">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ─── HERO ─────────────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden bg-[#1e2a78] shadow-lg min-h-[110px]">
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="relative flex items-center justify-between px-8 py-6 gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white leading-tight">Reports & Analysis</h1>
              <p className="text-blue-200 text-sm mt-1">Get real-time insights to track performance and make better decisions.</p>
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
            <div className="text-right shrink-0">
              <p className="text-blue-300 text-xs font-medium">Today</p>
              <p className="text-white font-bold text-sm mt-0.5">{dateDisplay}</p>
              <p className="text-blue-300 text-xs mt-0.5">Good to see you..!</p>
            </div>
          </div>
        </div>

        {/* ─── FILTER + EXPORT ─────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-0 bg-[#f0f2f8] border border-slate-200 rounded-lg overflow-hidden">
              <span className="px-3 py-2 text-xs font-bold text-slate-500 bg-[#e8eaf4] border-r border-slate-200 whitespace-nowrap select-none">Month</span>
              <div className="relative flex items-center px-2 py-1.5">
                <select value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); setSelectedDate(''); }}
                  className="appearance-none text-sm font-semibold text-slate-800 bg-transparent border-none outline-none cursor-pointer pr-6 pl-1 min-w-[80px]">
                  <option value="all">All</option>
                  {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>
            <div className="inline-flex items-center gap-0 bg-[#f0f2f8] border border-slate-200 rounded-lg overflow-hidden">
              <span className="px-3 py-2 text-xs font-bold text-slate-500 bg-[#e8eaf4] border-r border-slate-200 whitespace-nowrap select-none">Week</span>
              <div className="relative flex items-center px-2 py-1.5">
                <select value={selectedWeek} onChange={(e) => { setSelectedWeek(e.target.value); setSelectedDate(''); }}
                  className="appearance-none text-sm font-semibold text-slate-800 bg-transparent border-none outline-none cursor-pointer pr-6 pl-1 min-w-[80px]">
                  <option value="all">All</option>
                  <option value="1">1st Week</option>
                  <option value="2">2nd Week</option>
                  <option value="3">3rd Week</option>
                  <option value="4">4th Week</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>
            <div className={`inline-flex items-center gap-0 rounded-lg overflow-hidden border ${selectedDate ? 'bg-[#eef0fb] border-[#1e2a78]/30' : 'bg-[#f0f2f8] border-slate-200'}`}>
              <span className={`px-3 py-2 text-xs font-bold border-r flex items-center gap-1.5 select-none whitespace-nowrap ${selectedDate ? 'bg-[#e6e9f9] border-[#1e2a78]/20 text-[#1e2a78]' : 'bg-[#e8eaf4] border-slate-200 text-slate-500'}`}>
                <Calendar className="w-3 h-3" /> Date
              </span>
              <input type="date" value={selectedDate} max={localDateStr()}
                onChange={(e) => { setSelectedDate(e.target.value); if (e.target.value) { setSelectedMonth('all'); setSelectedWeek('all'); } }}
                className={`text-sm font-semibold bg-transparent border-none outline-none cursor-pointer px-2 py-2 w-[130px] ${selectedDate ? 'text-[#1e2a78]' : 'text-slate-600'}`} />
            </div>
            <button onClick={() => fetchAll()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => handleExport('excel')} disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2 h-9 rounded-lg bg-white border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50 shadow-sm">
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-slate-500" />} Excel
            </button>
            <button onClick={() => handleExport('pdf')} disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2 h-9 rounded-lg bg-[#1e2a78] text-sm font-semibold text-white hover:bg-[#162060] transition disabled:opacity-50 shadow-sm">
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
            </button>
          </div>
        </div>

        {/* ─── TABS ─────────────────────────────────────────────────── */}
        <Tabs defaultValue="overview" className="space-y-5">
          <TabsList className="flex w-fit bg-white border border-slate-200 rounded-xl p-1 shadow-sm gap-0.5">
            {['overview','recruiters','trends'].map(tab => (
              <TabsTrigger key={tab} value={tab}
                className="px-5 py-2 text-sm font-semibold rounded-lg transition-all capitalize data-[state=active]:bg-[#1e2a78] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 hover:text-slate-700">
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── OVERVIEW ── */}
          <TabsContent value="overview" className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-600">Total Candidates</span>
                  <TrendingUp className="h-4 w-4 text-blue-400" />
                </div>
                <div className="text-3xl font-bold text-slate-900">{overview.totalCandidates}</div>
                <p className="text-xs text-slate-400 mt-1.5 truncate">{filterLabel}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-600">Active Recruiters</span>
                  <Users className="h-4 w-4 text-purple-400" />
                </div>
                <div className="text-3xl font-bold text-slate-900">{overview.activeRecruiters}</div>
                <p className="text-xs text-slate-400 mt-1.5">Total registered</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-600">Conversion Rate</span>
                  <Users className="h-4 w-4 text-green-400" />
                </div>
                <div className="text-3xl font-bold text-slate-900">{overview.conversionRate}</div>
                <p className="text-xs text-slate-400 mt-1.5">Selected → Joined</p>
              </div>

              {/* Today Submissions */}
              <div onClick={() => setIsModalOpen(true)}
                className="bg-[#eef0fb] rounded-xl border border-[#c9cef2] shadow-sm p-5 cursor-pointer hover:shadow-md hover:bg-[#e6e9f9] transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-[#1e2a78]">Today's Submissions</span>
                  <ClipboardList className="h-4 w-4 text-[#1e2a78]" />
                </div>
                <div className="text-3xl font-bold text-[#1e2a78]">{todayCount}</div>
                <p className="text-xs text-[#4a5ab8] mt-1.5">Added today</p>
                <p className="text-[10px] font-bold text-[#7b8ccc] mt-1 uppercase tracking-wider group-hover:text-[#1e2a78] transition-colors">View All →</p>
              </div>
            </div>
          </TabsContent>

          {/* ── RECRUITERS ── */}
          <TabsContent value="recruiters">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-800 text-base mb-1">Recruiter Performance Comparison</h3>
              <p className="text-xs text-slate-400 mb-5">
                Showing data for: <span className="font-semibold text-slate-600">{filterLabel}</span>
                {recruiterPerf.length === 0 && <span className="ml-2 text-amber-500 font-semibold">— No data for selected period</span>}
              </p>
              {recruiterPerf.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-56 gap-3">
                  <Users className="w-10 h-10 text-slate-200" />
                  <p className="text-sm font-medium text-slate-400">No recruiter data for this period</p>
                </div>
              ) : (
                <div className="h-[460px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={recruiterPerf} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip {...tooltipStyle} />
                      <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} iconSize={10} formatter={LegendLabel} />
                      <Bar dataKey="Submissions" name="Submissions" fill="#3b82f6" radius={[4,4,0,0]} />
                      <Bar dataKey="Turnups"     name="Turnups"     fill="#a855f7" radius={[4,4,0,0]} />
                      <Bar dataKey="Selected"    name="Selected"    fill="#22c55e" radius={[4,4,0,0]} />
                      <Bar dataKey="Joined"      name="Joined"      fill="#f97316" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── TRENDS ── */}
          <TabsContent value="trends">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-800 text-base mb-1">6-Month Trend Analysis</h3>
              <p className="text-xs text-slate-400 mb-5">Submissions · Joined · Selected · Rejected · Hold over time</p>
              {monthlyData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-slate-400 text-sm">No trend data available</div>
              ) : (
                <div className="h-[420px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip {...tooltipStyle} />
                      <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} iconSize={10} formatter={LegendLabel} />
                      <Line type="monotone" dataKey="candidates" name="Submissions" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="joined"     name="Joined"      stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4, fill: '#22c55e', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="selected"   name="Selected"    stroke="#10b981" strokeWidth={2}   dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
                      <Line type="monotone" dataKey="rejected"   name="Rejected"    stroke="#ef4444" strokeWidth={2}   dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
                      <Line type="monotone" dataKey="hold"       name="Hold"        stroke="#f97316" strokeWidth={2}   dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Today Submissions Modal */}
      {isModalOpen && (
        <TodaySubmissionsModal
          candidates={allCandidates}
          recruiters={allRecruiters}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}