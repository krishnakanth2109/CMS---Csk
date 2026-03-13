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

// ✅ FIX: Normalize API_URL — VITE_API_URL on Render has no /api suffix
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API_URL  = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

export default function AdminReports() {
  const { toast } = useToast();
  const { authHeaders } = useAuth();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("month");
  
  const [reportData, setReportData] = useState({
    overview: { totalCandidates: 0, activeRecruiters: 0, conversionRate: '0%' },
    recruiterPerformance: [],
    monthlyData: []
  });

  // ✅ FIX: Use authHeaders() from useAuth — same as AdminRecruiters and all other pages
  // This calls Firebase to get a fresh token, works for ALL roles including admin
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

  const exportToExcel = () => {
    if (!reportData.recruiterPerformance.length) return;
    const worksheet = XLSX.utils.json_to_sheet(reportData.recruiterPerformance);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Recruiter Report");
    XLSX.writeFile(workbook, `Recruiter_Report_${filter}.xlsx`);
  };

  const exportToPDF = () => {
    if (!reportData.recruiterPerformance.length) return;
    const doc = new jsPDF();
    doc.text(`Recruiter Performance Report (${filter})`, 14, 16);
    autoTable(doc, {
      startY: 20,
      head: [["Recruiter", "Submissions", "Turnups", "Selected", "Joined"]],
      body: reportData.recruiterPerformance.map(r => [r.name, r.Submissions, r.Turnups, r.Selected, r.Joined]),
    });
    doc.save(`Recruiter_Report_${filter}.pdf`);
  };

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '0px', // Removed border radius
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
          <div className="flex flex-wrap gap-2">
            {/* Filter Toggle - Removed rounded-lg */}
            <div className="bg-slate-200 p-1 flex border border-slate-300">
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
            {/* Buttons - Removed rounded-lg */}
            <button
              onClick={exportToExcel}
              className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50 text-slate-700 transition"
            >
              <Download className="h-4 w-4" /> Excel
            </button>
            <button
              onClick={exportToPDF}
              className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50 text-slate-700 transition"
            >
              <Download className="h-4 w-4" /> PDF
            </button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          {/* TabsList - Removed rounded-lg */}
          <TabsList className="grid w-full max-w-md grid-cols-3 bg-slate-200 border border-slate-300 p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">Overview</TabsTrigger>
            <TabsTrigger value="recruiters" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">Recruiters</TabsTrigger>
            <TabsTrigger value="trends" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">Trends</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Candidates - Removed rounded-xl */}
              <div className="border border-slate-200 bg-white shadow-sm p-6">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-sm font-medium text-slate-500">Total Candidates</span>
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{reportData.overview.totalCandidates}</div>
                <p className="text-xs text-slate-400 mt-1">Filtered by {filter}</p>
              </div>

              {/* Active Recruiters - Removed rounded-xl */}
              <div className="border border-slate-200 bg-white shadow-sm p-6">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-sm font-medium text-slate-500">Active Recruiters</span>
                  <TrendingUp className="h-4 w-4 text-purple-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{reportData.overview.activeRecruiters}</div>
                <p className="text-xs text-slate-400 mt-1">Total registered</p>
              </div>

              {/* Conversion Rate - Removed rounded-xl */}
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
                    {/* Radius set to 0 for square bars */}
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