import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Download, TrendingUp, Calendar, Loader2 } from 'lucide-react';
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

// Normalize API_URL
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API_URL  = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

export default function AdminReports() {
  const { toast } = useToast();
  const { authHeaders } = useAuth();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("month");
  
  // Export states
  const [exportMonth, setExportMonth] = useState('current');
  const [isExporting, setIsExporting] = useState(false);
  
  const [reportData, setReportData] = useState({
    overview: { totalCandidates: 0, activeRecruiters: 0, conversionRate: '0%' },
    recruiterPerformance: [],
    monthlyData: []
  });

  const getAuthHeader = async () => {
    const ah = await authHeaders();
    return { 'Content-Type': 'application/json', ...ah };
  };

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const headers = await getAuthHeader();
        const res = await fetch(`${API_URL}/reports?filter=${filter}`, { headers });
        
        if (res.ok) {
          const data = await res.json();
          setReportData(data);
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
  }, [filter, toast]);

  // Handle Export accurately based on the selected month
  const handleExport = async (format) => {
    setIsExporting(true);
    try {
      let dataToExport = reportData.recruiterPerformance;
      let titleSuffix = filter;

      // If a specific month is selected, fetch all candidates and calculate accurate stats for that month
      if (exportMonth !== 'current') {
        const headers = await getAuthHeader();
        const res = await fetch(`${API_URL}/candidates`, { headers });
        
        if (!res.ok) throw new Error("Failed to fetch candidates for accurate export");
        
        const allCandidates = await res.json();
        const targetMonth = parseInt(exportMonth);
        const now = new Date();
        let targetYear = now.getFullYear();
        
        // Smart Year mapping: If selected month is in the future (e.g. selecting Dec in Jan), pull from last year
        if (targetMonth > now.getMonth()) {
          targetYear -= 1;
        }
        
        // Filter candidates exactly matching the chosen month and year
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
          
          // ACCURATE FUNNEL CALCULATION:
          // If a candidate is Joined, they logically must have been Selected and Turned up.
          const currentStatus = c.status || '';
          const hasJoined = currentStatus === 'Joined';
          const hasSelected = hasJoined || currentStatus === 'Offer' || currentStatus === 'Shortlisted';
          const hasTurnedUp = hasSelected || INTERVIEW_STAGES.some(stage => currentStatus.includes(stage));

          if (hasTurnedUp) row.Turnups += 1;
          if (hasSelected) row.Selected += 1;
          if (hasJoined) row.Joined += 1;
        }
        
        dataToExport = Array.from(rMap.values()).sort((a, b) => b.Submissions - a.Submissions);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        titleSuffix = `${monthNames[targetMonth]}_${targetYear}`;
      }

      if (!dataToExport.length) {
        toast({ title: "No Data", description: `No records found for ${titleSuffix.replace('_', ' ')}.`, variant: "default" });
        setIsExporting(false);
        return;
      }

      // Execute EXCEL Export
      if (format === 'excel') {
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Recruiter Report");
        XLSX.writeFile(workbook, `Recruiter_Report_${titleSuffix}.xlsx`);
      } 
      // Execute PDF Export
      else if (format === 'pdf') {
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
      borderRadius: '0px', 
      color: '#0f172a'
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Reports & Analytics</h1>
            <p className="text-slate-500 mt-1">Comprehensive performance insights</p>
          </div>
          
          <div className="flex flex-col items-end gap-3">
            {/* View Filter Toggle */}
            <div className="bg-slate-200 p-1 flex border border-slate-300 self-start md:self-end">
              {['day', 'week', 'month', 'all'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-sm font-medium capitalize transition ${
                    filter === f 
                      ? 'bg-white shadow text-slate-900' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Export Section with Month Selector */}
            <div className="flex flex-wrap items-center gap-2">
              <select 
                value={exportMonth} 
                onChange={(e) => setExportMonth(e.target.value)}
                className="px-3 py-2 border border-slate-300 bg-white text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 transition"
              >
                <option value="current">Current View</option>
                <option value="0">January</option>
                <option value="1">February</option>
                <option value="2">March</option>
                <option value="3">April</option>
                <option value="4">May</option>
                <option value="5">June</option>
                <option value="6">July</option>
                <option value="7">August</option>
                <option value="8">September</option>
                <option value="9">October</option>
                <option value="10">November</option>
                <option value="11">December</option>
              </select>

              <button
                onClick={() => handleExport('excel')}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50 text-slate-700 transition disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Excel
              </button>
              
              <button
                onClick={() => handleExport('pdf')}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50 text-slate-700 transition disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF
              </button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3 bg-slate-200 border border-slate-300 p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">Overview</TabsTrigger>
            <TabsTrigger value="recruiters" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">Recruiters</TabsTrigger>
            <TabsTrigger value="trends" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">Trends</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="border border-slate-200 bg-white shadow-sm p-6">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-sm font-medium text-slate-500">Total Candidates</span>
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{reportData.overview.totalCandidates}</div>
                <p className="text-xs text-slate-400 mt-1">Filtered by {filter}</p>
              </div>

              <div className="border border-slate-200 bg-white shadow-sm p-6">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-sm font-medium text-slate-500">Active Recruiters</span>
                  <TrendingUp className="h-4 w-4 text-purple-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{reportData.overview.activeRecruiters}</div>
                <p className="text-xs text-slate-400 mt-1">Total registered</p>
              </div>

              <div className="border border-slate-200 bg-white shadow-sm p-6">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-sm font-medium text-slate-500">Conversion Rate</span>
                  <Calendar className="h-4 w-4 text-green-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{reportData.overview.conversionRate}</div>
                <p className="text-xs text-slate-400 mt-1">Selected → Joined</p>
              </div>
            </div>
          </TabsContent>

          {/* Recruiter Performance Tab */}
          <TabsContent value="recruiters">
            <div className="border border-slate-200 bg-white shadow-sm p-6">
              <h3 className="font-semibold text-slate-900 mb-6">Recruiter Performance Comparison ({filter})</h3>
              <div className="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.recruiterPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" className="text-sm font-medium text-slate-600" tick={{fill: '#64748b'}} />
                    <YAxis className="text-sm font-medium text-slate-600" tick={{fill: '#64748b'}} />
                    <Tooltip {...tooltipStyle} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="Submissions" fill="#3b82f6" radius={0} />
                    <Bar dataKey="Turnups" fill="#a855f7" radius={0} />
                    <Bar dataKey="Selected" fill="#22c55e" radius={0} />
                    <Bar dataKey="Joined" fill="#f97316" radius={0} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          {/* Trend Analysis Tab */}
          <TabsContent value="trends">
            <div className="border border-slate-200 bg-white shadow-sm p-6">
              <h3 className="font-semibold text-slate-900 mb-6">6-Month Trend Analysis</h3>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reportData.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" className="text-sm font-medium text-slate-600" tick={{fill: '#64748b'}} />
                    <YAxis className="text-sm font-medium text-slate-600" tick={{fill: '#64748b'}} />
                    <Tooltip {...tooltipStyle} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line type="monotone" dataKey="candidates" name="Submissions" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="joined" name="Joined" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}