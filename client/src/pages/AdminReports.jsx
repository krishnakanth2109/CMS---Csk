import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Download, TrendingUp, Calendar, Loader2, Users, ClipboardList, X, ChevronDown } from 'lucide-react';
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

// Normalize API_URL
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API_URL  = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Build last-6-months trend data from all candidates
// Includes: candidates (submissions), joined, selected, rejected, hold
function buildMonthlyTrend(candidates) {
  const now    = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key:        `${d.getFullYear()}-${d.getMonth()}`,
      month:      MONTH_SHORT[d.getMonth()],
      candidates: 0,
      joined:     0,
      selected:   0,
      rejected:   0,
      hold:       0,
    });
  }
  for (const c of candidates) {
    if (!c.createdAt) continue;
    const d   = new Date(c.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const m   = months.find(x => x.key === key);
    if (!m) continue;
    m.candidates += 1;
    const st = Array.isArray(c.status) ? c.status[0] : (c.status || '');
    if (st === 'Joined')   m.joined   += 1;
    if (st === 'Selected') m.selected += 1;
    if (st === 'Rejected') m.rejected += 1;
    if (st === 'Hold')     m.hold     += 1;
  }
  return months;
}

export default function AdminReports() {
  const { toast } = useToast();
  const { authHeaders } = useAuth();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("month");

  // Specific Date Filter State for the main view
  const [selectedDate, setSelectedDate] = useState("");

  // States: For Today's Candidates Card & Modal
  const [todayCandidatesCount, setTodayCandidatesCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalDate, setModalDate] = useState(new Date().toISOString().split('T')[0]);

  // Export / view filter states
  const [exportMonth, setExportMonth]     = useState('current');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-11
  const [selectedWeek, setSelectedWeek]   = useState('1');                   // '1'|'2'|'3'|'4'
  const [isExporting, setIsExporting]     = useState(false);

  const [reportData, setReportData] = useState({
    overview: { totalCandidates: 0, activeRecruiters: 0, conversionRate: '0%' },
    recruiterPerformance: [],
    monthlyData: []
  });

  const getAuthHeader = async () => {
    const ah = await authHeaders();
    return { 'Content-Type': 'application/json', ...ah };
  };

  // 1. Fetch Main Report Data & Today's Initial Count
  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const headers = await getAuthHeader();
        const queryParams = new URLSearchParams({ filter });
        if (selectedDate && filter === 'custom') {
          queryParams.append('date', selectedDate);
        }
        const todayDateStr = new Date().toISOString().split('T')[0];

        // Fetch overview + today count + ALL candidates (for monthly trend) in parallel
        const [res, todayRes, allCandRes] = await Promise.all([
          fetch(`${API_URL}/reports?${queryParams.toString()}`, { headers }),
          fetch(`${API_URL}/candidates?date=${todayDateStr}`, { headers }),
          fetch(`${API_URL}/candidates`, { headers }),
        ]);

        if (res.ok && todayRes.ok) {
          const data      = await res.json();
          const todayData = await todayRes.json();
          // Build rich monthly trend from all candidates (includes selected/rejected/hold)
          if (allCandRes.ok) {
            const allCands = await allCandRes.json();
            data.monthlyData = buildMonthlyTrend(allCands);
          }
          setReportData(data);
          setTodayCandidatesCount(todayData.length);
        } else {
          throw new Error("Failed to fetch reports data");
        }
      } catch (error) {
        console.error(error);
        toast({ title: "Error", description: "Failed to load reports", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [filter, selectedDate, toast]);

  // 2. Fetch Detailed Data when the Modal opens or the Modal Date changes
  useEffect(() => {
    if (isModalOpen) {
      const fetchDateSubmissions = async () => {
        setModalLoading(true);
        try {
          const headers = await getAuthHeader();
          const res = await fetch(`${API_URL}/candidates?date=${modalDate}`, { headers });
          if (res.ok) {
            const data = await res.json();
            setModalData(data);
          } else {
            throw new Error('Failed to fetch day submissions');
          }
        } catch (error) {
          toast({ title: 'Error', description: 'Failed to fetch day submissions', variant: 'destructive' });
        } finally {
          setModalLoading(false);
        }
      };
      fetchDateSubmissions();
    }
  }, [isModalOpen, modalDate, toast]);

  // Handle Export accurately based on the selected month
  const handleExport = async (format) => {
    setIsExporting(true);
    try {
      let dataToExport = reportData.recruiterPerformance;
      let titleSuffix = filter;

      if (exportMonth !== 'current') {
        const headers = await getAuthHeader();
        const res = await fetch(`${API_URL}/candidates`, { headers });
        if (!res.ok) throw new Error("Failed to fetch candidates for accurate export");
        const allCandidates = await res.json();
        const targetMonth = parseInt(exportMonth);
        const now = new Date();
        let targetYear = now.getFullYear();
        if (targetMonth > now.getMonth()) targetYear -= 1;

        const filteredCandidates = allCandidates.filter(c => {
          if (!c.createdAt) return false;
          const d = new Date(c.createdAt);
          return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
        });

        const INTERVIEW_STAGES = [
          'L1 Interview', 'L2 Interview', 'L3 Interview', 'Final Interview',
          'Technical Interview', 'Technical Round', 'HR Interview', 'HR Round', 'Interview'
        ];

        const rMap = new Map();
        for (const c of filteredCandidates) {
          const key = c.recruiterId?._id || c.recruiterId || 'unassigned';
          let name = 'Unassigned';
          if (c.recruiterId && typeof c.recruiterId === 'object') {
            name = `${c.recruiterId.firstName || ''} ${c.recruiterId.lastName || ''}`.trim();
            if (!name) name = c.recruiterId.name || c.recruiterId.username || c.recruiterId.email;
          } else if (c.recruiterName) {
            name = c.recruiterName;
          }
          if (!rMap.has(key)) {
            rMap.set(key, { name: name || 'Unknown', Submissions: 0, Turnups: 0, Selected: 0, Joined: 0 });
          }
          const row = rMap.get(key);
          row.Submissions += 1;
          const currentStatus = c.status || '';
          const hasJoined = currentStatus === 'Joined';
          const hasSelected = hasJoined || currentStatus === 'Offer' || currentStatus === 'Shortlisted';
          const hasTurnedUp = hasSelected || INTERVIEW_STAGES.some(stage => currentStatus.includes(stage));
          if (hasTurnedUp) row.Turnups += 1;
          if (hasSelected) row.Selected += 1;
          if (hasJoined) row.Joined += 1;
        }

        dataToExport = Array.from(rMap.values()).sort((a, b) => b.Submissions - a.Submissions);
        const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        titleSuffix = `${monthNames[targetMonth]}_${targetYear}`;
      }

      if (!dataToExport.length) {
        toast({ title: "No Data", description: `No records found for ${titleSuffix.replace('_', ' ')}.`, variant: "default" });
        setIsExporting(false);
        return;
      }

      if (format === 'excel') {
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Recruiter Report");
        XLSX.writeFile(workbook, `Recruiter_Report_${titleSuffix}.xlsx`);
      } else if (format === 'pdf') {
        const doc = new jsPDF();
        doc.text(`Recruiter Performance Report (${titleSuffix.replace('_', ' ')})`, 14, 16);
        autoTable(doc, {
          startY: 20,
          head: [["Recruiter", "Submissions", "Turnups", "Selected", "Joined"]],
          body: dataToExport.map(r => [r.name, r.Submissions, r.Turnups, r.Selected, r.Joined]),
        });
        doc.save(`Recruiter_Report_${titleSuffix}.pdf`);
      }

      toast({ title: "Success", description: `${format.toUpperCase()} export completed successfully.` });
    } catch (error) {
      console.error(error);
      toast({ title: "Export Failed", description: "Could not generate export data.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      color: '#0f172a',
      fontSize: '12px',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)',
    }
  };

  const filterLabel = filter === 'custom' && selectedDate ? selectedDate : filter;

  const now = new Date();
  const dateDisplay = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#f0f2f8]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#1e2a78]" />
        <p className="text-sm text-slate-500 font-medium">Loading analytics...</p>
      </div>
    </div>
  );

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#f0f2f8] min-h-screen">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── HERO BANNER (navy, with illustration + date) ── */}
        <div className="relative rounded-2xl overflow-hidden bg-[#1e2a78] shadow-lg min-h-[110px]">
          {/* Subtle dot pattern */}
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          />
          <div className="relative flex items-center justify-between px-8 py-6 gap-4">
            {/* Left text */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white leading-tight">Reports & Analysis</h1>
              <p className="text-blue-200 text-sm mt-1 leading-snug max-w-sm">
                Get real-time insights to track performance and make better decisions.
              </p>
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
            {/* Right date */}
            <div className="text-right shrink-0">
              <p className="text-blue-300 text-xs font-medium">Today</p>
              <p className="text-white font-bold text-sm mt-0.5">{dateDisplay}</p>
              <p className="text-blue-300 text-xs mt-0.5">Good to see you..!</p>
            </div>
          </div>
        </div>

        {/* ── FILTER + EXPORT ROW — matches screenshot exactly ── */}
        <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">

          {/* LEFT: Month pill + Week pill + Date picker */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Month dropdown pill */}
            <div className="flex items-center gap-1.5 bg-[#f0f2f8] border border-slate-200 rounded-lg px-3 py-1.5">
              <span className="text-xs font-semibold text-slate-500">Month</span>
              <div className="relative flex items-center">
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(Number(e.target.value));
                    setExportMonth(e.target.value);
                  }}
                  className="appearance-none text-sm font-semibold text-slate-800 bg-transparent border-none outline-none cursor-pointer pr-5"
                >
                  {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m,i) => (
                    <option key={i} value={i}>{m}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>

            {/* Week dropdown pill */}
            <div className="flex items-center gap-1.5 bg-[#f0f2f8] border border-slate-200 rounded-lg px-3 py-1.5">
              <span className="text-xs font-semibold text-slate-500">Week</span>
              <div className="relative flex items-center">
                <select
                  value={selectedWeek}
                  onChange={(e) => {
                    setSelectedWeek(e.target.value);
                    // map week selection to filter
                    const weekMap = { '1': 'week', '2': 'week', '3': 'week', '4': 'week' };
                    setFilter(weekMap[e.target.value] || 'week');
                    setSelectedDate("");
                  }}
                  className="appearance-none text-sm font-semibold text-slate-800 bg-transparent border-none outline-none cursor-pointer pr-5"
                >
                  <option value="1">1st Week</option>
                  <option value="2">2nd Week</option>
                  <option value="3">3rd Week</option>
                  <option value="4">4th Week</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>

            {/* Date filter pill — with calendar icon */}
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 border cursor-pointer transition-all ${
              selectedDate && filter === 'custom'
                ? 'bg-[#1e2a78]/5 border-[#1e2a78]/30'
                : 'bg-[#f0f2f8] border-slate-200'
            }`}>
              <Calendar className={`w-3.5 h-3.5 shrink-0 ${selectedDate && filter === 'custom' ? 'text-[#1e2a78]' : 'text-slate-400'}`} />
              <input
                type="date"
                value={selectedDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => { setSelectedDate(e.target.value); if (e.target.value) setFilter('custom'); else setFilter('week'); }}
                className={`text-sm font-semibold bg-transparent border-none outline-none cursor-pointer w-[120px] ${
                  selectedDate && filter === 'custom' ? 'text-[#1e2a78]' : 'text-slate-500'
                }`}
                placeholder="Pick date"
              />
            </div>

          </div>

          {/* RIGHT: Excel (outline) + Export (navy filled) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleExport('excel')}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50 shadow-sm"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-slate-500" />}
              Excel
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e2a78] text-sm font-semibold text-white hover:bg-[#162060] transition disabled:opacity-50 shadow-sm"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export
            </button>
          </div>

        </div>

        {/* ── TABS ── */}
        <Tabs defaultValue="overview" className="space-y-5">
          <TabsList className="flex w-fit bg-white border border-slate-200 rounded-xl p-1 shadow-sm gap-0.5">
            <TabsTrigger
              value="overview"
              className="px-5 py-2 text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-[#1e2a78] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 hover:text-slate-700"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="recruiters"
              className="px-5 py-2 text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-[#1e2a78] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 hover:text-slate-700"
            >
              Recruiters
            </TabsTrigger>
            <TabsTrigger
              value="trends"
              className="px-5 py-2 text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-[#1e2a78] data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 hover:text-slate-700"
            >
              Trends
            </TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW TAB ── */}
          <TabsContent value="overview" className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

              {/* Card 1 — Total Candidates */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-600">Total Candidates</span>
                  <TrendingUp className="h-4 w-4 text-blue-400" />
                </div>
                <div className="text-3xl font-bold text-slate-900">{reportData.overview.totalCandidates}</div>
                <p className="text-xs text-slate-400 mt-1.5">Filtered by {filterLabel}</p>
              </div>

              {/* Card 2 — Active Recruiters */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-600">Active Recruiters</span>
                  <Users className="h-4 w-4 text-purple-400" />
                </div>
                <div className="text-3xl font-bold text-slate-900">{reportData.overview.activeRecruiters}</div>
                <p className="text-xs text-slate-400 mt-1.5">Total registered</p>
              </div>

              {/* Card 3 — Conversion Rate */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-600">Conversion Rate</span>
                  <Users className="h-4 w-4 text-green-400" />
                </div>
                <div className="text-3xl font-bold text-slate-900">{reportData.overview.conversionRate}</div>
                <p className="text-xs text-slate-400 mt-1.5">Selected → Joined</p>
              </div>

              {/* Card 4 — Today's Submissions (clickable, highlighted) */}
              <div
                onClick={() => setIsModalOpen(true)}
                className="bg-[#eef0fb] rounded-xl border border-[#c9cef2] shadow-sm p-5 cursor-pointer hover:shadow-md hover:bg-[#e6e9f9] transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-[#1e2a78]">Today's Submissions</span>
                  <ClipboardList className="h-4 w-4 text-[#1e2a78]" />
                </div>
                <div className="text-3xl font-bold text-[#1e2a78]">{todayCandidatesCount}</div>
                <p className="text-xs text-[#4a5ab8] mt-1.5">Added today</p>
                <p className="text-[10px] font-bold text-[#7b8ccc] mt-1 uppercase tracking-wider group-hover:text-[#1e2a78] transition-colors">View All →</p>
              </div>

            </div>
          </TabsContent>

          {/* ── RECRUITERS TAB ── */}
          <TabsContent value="recruiters">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-800 text-base mb-1">Recruiter Performance Comparison</h3>
              <p className="text-xs text-slate-400 mb-5">Showing data for: <span className="font-semibold text-slate-600">{filterLabel}</span></p>
              <div className="h-[480px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.recruiterPerformance} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip {...tooltipStyle} />
                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                    <Bar dataKey="Submissions" fill="#3b82f6" radius={[4,4,0,0]} />
                    <Bar dataKey="Turnups"     fill="#a855f7" radius={[4,4,0,0]} />
                    <Bar dataKey="Selected"    fill="#22c55e" radius={[4,4,0,0]} />
                    <Bar dataKey="Joined"      fill="#f97316" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          {/* ── TRENDS TAB — 6 months, X = Oct Nov Dec Jan Feb Mar ── */}
          <TabsContent value="trends">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-800 text-base mb-1">6-Month Trend Analysis</h3>
              <p className="text-xs text-slate-400 mb-5">Submissions · Joined · Selected · Rejected · Hold over time</p>
              <div className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reportData.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    {/* X-axis uses "month" key → Oct, Nov, Dec, Jan, Feb, Mar */}
                    <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff', border: '1px solid #e2e8f0',
                        borderRadius: '8px', color: '#0f172a', fontSize: '12px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)',
                      }}
                      formatter={(value, name) => [`${name} : ${value}`, '']}
                      labelStyle={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
                      iconSize={10} iconType="circle"
                      formatter={(v) => <span style={{ color: '#475569', fontWeight: 600 }}>{v}</span>}
                    />
                    <Line type="monotone" dataKey="candidates" name="Submissions" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="joined"     name="Joined"      stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4, fill: '#22c55e', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="selected"   name="Selected"    stroke="#10b981" strokeWidth={2}   dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
                    <Line type="monotone" dataKey="rejected"   name="Rejected"    stroke="#ef4444" strokeWidth={2}   dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
                    <Line type="monotone" dataKey="hold"       name="Hold"        stroke="#f97316" strokeWidth={2}   dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── MODAL: DAY SUBMISSIONS ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-[#f8faff]">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-[#1e2a78]" />
                  Day Submissions
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Viewing candidates submitted by all recruiters</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Calendar className="absolute left-3 w-3.5 h-3.5 text-slate-400 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={modalDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-[#1e2a78]/20 focus:border-[#1e2a78] focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 bg-slate-100 hover:bg-red-50 hover:text-red-500 text-slate-500 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto bg-white min-h-[300px]">
              {modalLoading ? (
                <div className="flex flex-col h-full min-h-[300px] items-center justify-center gap-3">
                  <div className="animate-spin h-8 w-8 border-4 border-[#1e2a78] border-t-transparent rounded-full" />
                  <p className="text-sm text-slate-500 font-medium">Fetching Submissions...</p>
                </div>
              ) : modalData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center gap-3">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <ClipboardList className="w-8 h-8 text-slate-300" />
                  </div>
                  <div>
                    <h3 className="text-slate-700 font-bold text-sm">No submissions found</h3>
                    <p className="text-xs text-slate-400 mt-1">No candidates were added on {modalDate}</p>
                  </div>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-[#f8faff] text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 text-left">Candidate ID</th>
                      <th className="px-6 py-4 text-left">Candidate Name</th>
                      <th className="px-6 py-4 text-left">Recruiter</th>
                      <th className="px-6 py-4 text-left">Position</th>
                      <th className="px-6 py-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {modalData.map((c) => {
                      const recruiterName = c.recruiterId?.firstName
                        ? `${c.recruiterId.firstName} ${c.recruiterId.lastName || ''}`.trim()
                        : (c.recruiterId?.name || c.recruiterName || 'Unknown');
                      const cStatus = Array.isArray(c.status) ? c.status[0] : c.status;
                      return (
                        <tr key={c._id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-6 py-4 font-bold text-[#1e2a78] text-xs">{c.candidateId || 'N/A'}</td>
                          <td className="px-6 py-4 font-semibold text-slate-800">{c.name || `${c.firstName} ${c.lastName}`}</td>
                          <td className="px-6 py-4 text-slate-600">{recruiterName}</td>
                          <td className="px-6 py-4 text-slate-400">{c.position || '—'}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                              {cStatus || 'SUBMITTED'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            {!modalLoading && modalData.length > 0 && (
              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-xs font-medium text-slate-500">
                <p>Showing {modalData.length} submission(s) for the selected date.</p>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-600 hover:text-[#1e2a78] font-bold uppercase tracking-wider transition-colors"
                >
                  Close Window
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}