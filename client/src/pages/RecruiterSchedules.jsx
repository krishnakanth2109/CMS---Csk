import React, { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar, Clock, MapPin, Video, Phone, Building, Search,
  Calendar as CalendarIcon, List, Grid, Eye, Plus,
  CheckCircle2, AlertCircle, X, Loader2, Mail, Briefcase,
  FileText, UserCircle, Target, Users, Zap, Edit, Pencil, Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// --- Helpers ---
function getStatusBadge(status) {
  const base = "px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5";
  
  if (!status) return <span className={`${base} bg-gray-100 text-gray-800`}><Calendar className="h-3 w-3" />Unknown</span>;

  if (status.includes("L1")) return <span className={`${base} bg-blue-100 text-blue-800 border border-blue-200`}><Zap className="h-3 w-3" />{status}</span>;
  if (status.includes("L2")) return <span className={`${base} bg-indigo-100 text-indigo-800 border border-indigo-200`}><Target className="h-3 w-3" />{status}</span>;
  if (status.includes("L3")) return <span className={`${base} bg-purple-100 text-purple-800 border border-purple-200`}><Target className="h-3 w-3" />{status}</span>;
  if (status.includes("L4") || status.includes("L5")) return <span className={`${base} bg-pink-100 text-pink-800 border border-pink-200`}><Target className="h-3 w-3" />{status}</span>;
  if (status.includes("HR")) return <span className={`${base} bg-orange-100 text-orange-800 border border-orange-200`}><Users className="h-3 w-3" />{status}</span>;
  if (status.includes("Technical")) return <span className={`${base} bg-cyan-100 text-cyan-800 border border-cyan-200`}><Briefcase className="h-3 w-3" />{status}</span>;

  if (status === 'Shortlisted' || status === 'Completed') return <span className={`${base} bg-green-100 text-green-800 border border-green-200`}><CheckCircle2 className="h-3 w-3" />{status}</span>;
  if (status === 'Rejected' || status === 'Cancelled' || status === 'No Show') return <span className={`${base} bg-red-100 text-red-800 border border-red-200`}><X className="h-3 w-3" />{status}</span>;
  if (status === 'Hold') return <span className={`${base} bg-yellow-100 text-yellow-800 border border-yellow-200`}><AlertCircle className="h-3 w-3" />{status}</span>;
  if (status === 'Submitted') return <span className={`${base} bg-sky-100 text-sky-800 border border-sky-200`}><FileText className="h-3 w-3" />{status}</span>;

  return <span className={`${base} bg-gray-100 text-gray-800 border border-gray-200`}><Calendar className="h-3 w-3" />{status}</span>;
}

function getPriorityBadge(priority) {
  const base = "px-2 py-1 rounded-full text-xs font-medium capitalize border";
  const colors = { high: "bg-red-100 text-red-800 border-red-200", medium: "bg-yellow-100 text-yellow-800 border-yellow-200", low: "bg-green-100 text-green-800 border-green-200" };
  return <span className={`${base} ${colors[priority || 'medium']}`}>{priority} Priority</span>;
}

function getTimeStatus(interviewDate) {
  const now = new Date();
  const interviewTime = new Date(interviewDate);
  const diffMs = interviewTime.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffMs < 0) return { status: "completed", text: "Completed", color: "text-gray-500", bg: "bg-gray-100" };
  else if (diffHours <= 24) return { status: "urgent", text: "Within 24h", color: "text-red-600", bg: "bg-red-100" };
  else if (diffDays <= 3) return { status: "upcoming", text: "Upcoming", color: "text-orange-600", bg: "bg-orange-100" };
  else return { status: "scheduled", text: "Scheduled", color: "text-green-600", bg: "bg-green-100" };
}

const StatCard = ({ title, value, icon, gradient, onClick, description }) => (
  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="cursor-pointer" onClick={onClick}>
    <div className={`${gradient} text-white rounded-xl shadow-lg overflow-hidden p-5`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-white/90 text-sm font-medium mb-1">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
          {description && <p className="text-white/70 text-xs mt-1">{description}</p>}
        </div>
        <div className="flex items-center gap-2">{icon}</div>
      </div>
    </div>
  </motion.div>
);

export default function RecruiterSchedules() {
  const { authHeaders } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedInterview, setSelectedInterview] = useState(null);
  const [editInterviewData, setEditInterviewData] = useState(null); 
  const [selectedCandidateFullDetails, setSelectedCandidateFullDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [selectedRecruiterId, setSelectedRecruiterId] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStatFilter, setActiveStatFilter] = useState(null);
  const [showNewInterviewForm, setShowNewInterviewForm] = useState(false);

  const storedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  const sessionRecruiterId = storedUser?._id || storedUser?.id || "";
  const sessionRecruiterName = storedUser?.firstName ? `${storedUser.firstName} ${storedUser.lastName || ''}` : (storedUser?.name || "");

  const [newInterviewForm, setNewInterviewForm] = useState({
    candidateId: "", candidateName: "", candidateEmail: "", candidatePhone: "", position: "",
    round: "L1 Interview", interviewDate: new Date().toISOString().split('T')[0], interviewTime: "10:00",
    type: "Virtual", location: "Remote", duration: "60", recruiterId: sessionRecruiterId,
    notes: "", priority: "medium", meetingLink: "", status: "Scheduled"
  });
  const [formErrors, setFormErrors] = useState({});

  const getAuthHeader = async () => {
    const h = await authHeaders();
    return { 'Content-Type': 'application/json', ...h };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const [resInterviews, resCandidates, resRecruiters] = await Promise.all([
        fetch(`${API_URL}/interviews`, { headers }),
        fetch(`${API_URL}/candidates`, { headers }),
        fetch(`${API_URL}/users/active-list`, { headers })
      ]);

      if (resInterviews.ok) {
        const data = await resInterviews.json();
        setInterviews(data.map((item) => {
          let rName = "Unknown";
          if (item.recruiterId) {
            if (item.recruiterId.firstName) rName = `${item.recruiterId.firstName} ${item.recruiterId.lastName || ''}`;
            else if (item.recruiterId.name) rName = item.recruiterId.name;
            else if ((item.recruiterId._id || item.recruiterId) === sessionRecruiterId) rName = sessionRecruiterName;
          } else if (sessionRecruiterName) {
            rName = sessionRecruiterName;
          }

          return {
            id: item._id, 
            interviewId: item.interviewId,
            candidateIdRaw: item.candidateId?._id || item.candidateId, 
            candidateName: item.candidateId?.name || "Unknown Candidate",
            candidateEmail: item.candidateId?.email || "",
            candidatePhone: item.candidateId?.phone || "",
            position: item.candidateId?.position || "N/A",
            rawStatus: item.status,
            rawRound: item.round,
            status: item.status !== 'Scheduled' ? item.status : (item.round || "Scheduled"),
            interviewDate: item.interviewDate, 
            interviewType: item.type || 'Virtual',
            recruiterId: item.recruiterId?._id || item.recruiterId, 
            recruiterName: rName,
            clientName: item.jobId?.clientName || "N/A",
            notes: item.notes, 
            priority: item.priority, 
            meetingLink: item.meetingLink,
          };
        }));
      }
      if (resCandidates.ok) setCandidates(await resCandidates.json());
      if (resRecruiters.ok) setRecruiters(await resRecruiters.json());
    } catch (error) {
      console.error("Failed to fetch data", error);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredInterviews = useMemo(() => {
    let filtered = interviews;
    if (selectedRecruiterId) filtered = filtered.filter(i => i.recruiterId === selectedRecruiterId);
    if (statusFilter !== "all") filtered = filtered.filter(i => i.status === statusFilter);
    if (priorityFilter !== "all") filtered = filtered.filter(i => i.priority === priorityFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(i => i.candidateName.toLowerCase().includes(q) || (i.interviewId || '').toLowerCase().includes(q));
    }
    const now = new Date();
    if (activeStatFilter === 'upcoming') filtered = filtered.filter(i => new Date(i.interviewDate) >= now);
    if (activeStatFilter === 'highPriority') filtered = filtered.filter(i => i.priority === 'high');
    if (activeStatFilter === 'completed') filtered = filtered.filter(i => new Date(i.interviewDate) < now);
    if (activeStatFilter === 'today') filtered = filtered.filter(i => new Date(i.interviewDate).toDateString() === now.toDateString());

    return filtered.sort((a, b) => new Date(b.interviewDate).getTime() - new Date(a.interviewDate).getTime());
  }, [interviews, selectedRecruiterId, statusFilter, priorityFilter, searchQuery, activeStatFilter]);

  const interviewStats = useMemo(() => {
    const now = new Date();
    return {
      total: interviews.length,
      upcoming: interviews.filter(i => new Date(i.interviewDate) >= now).length,
      completed: interviews.filter(i => new Date(i.interviewDate) < now).length,
      highPriority: interviews.filter(i => i.priority === "high").length,
      today: interviews.filter(i => new Date(i.interviewDate).toDateString() === now.toDateString()).length,
      virtual: interviews.filter(i => i.interviewType === "Virtual").length
    };
  }, [interviews]);

  const handleViewInterview = async (interview) => {
    setSelectedInterview(interview);
    setSelectedCandidateFullDetails(null);
    setLoadingDetails(true);
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_URL}/candidates/${interview.candidateIdRaw}`, { headers });
      if (response.ok) setSelectedCandidateFullDetails(await response.json());
      else toast({ title: "Warning", description: "Could not fetch extended candidate details." });
    } catch {
      toast({ title: "Error", description: "Network error fetching details", variant: "destructive" });
    } finally {
      setLoadingDetails(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    
    // Validate Candidate Selection
    if (!newInterviewForm.candidateId) {
      errors.candidateId = "Please select a candidate first.";
    }

    // Validate Date (Ensure it ignores timezones making 'today' look like 'yesterday')
    if (newInterviewForm.interviewDate) {
      const today = new Date(); 
      today.setHours(0,0,0,0); 
      const [year, month, day] = newInterviewForm.interviewDate.split('-');
      const datePart = new Date(year, month - 1, day);
      
      if (datePart < today) {
        errors.interviewDate = "Date cannot be in the past.";
      }
    } else {
      errors.interviewDate = "Date is required.";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNewInterviewChange = (e) => {
    const { name, value } = e.target;
    setNewInterviewForm(prev => ({ ...prev, [name]: value }));
    // Clear error for the field being typed in
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleCandidateSelect = (e) => {
    const selectedId = e.target.value;
    if (!selectedId) {
      setNewInterviewForm(prev => ({ ...prev, candidateId: "", candidateName: "", candidateEmail: "", candidatePhone: "", position: "" }));
      return;
    }
    const candidate = candidates.find(c => c._id === selectedId || c.id === selectedId);
    if (candidate) {
      setNewInterviewForm(prev => ({
        ...prev, 
        candidateId: selectedId, 
        candidateName: candidate.name || "",
        candidateEmail: candidate.email || "", 
        candidatePhone: candidate.contact || candidate.phone || "",
        position: candidate.position || ""
      }));
      setFormErrors(prev => ({ ...prev, candidateId: '' })); // Clear error
    }
  };

  const handleSubmitNewInterview = async () => {
    if (!validateForm()) { 
        toast({ title: "Validation Error", description: "Please fix the highlighted errors.", variant: "destructive" }); 
        return; 
    }

    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_URL}/interviews`, {
        method: 'POST', headers, body: JSON.stringify(newInterviewForm)
      });
      if (response.ok) {
        toast({ title: "Success", description: "Interview scheduled successfully" });
        setShowNewInterviewForm(false);
        fetchData();
        setNewInterviewForm(prev => ({ ...prev, candidateId: "", candidateName: "", notes: "", meetingLink: "" }));
      } else throw new Error(await response.text());
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteInterview = async (id) => {
    if (!window.confirm("Are you sure you want to completely delete this interview?")) return;
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_URL}/interviews/${id}`, { method: 'DELETE', headers });
      if (response.ok) {
        toast({ title: "Deleted", description: "Interview removed." });
        fetchData();
      } else throw new Error("Failed to delete interview.");
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleUpdateFullInterview = async (id, payload) => {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/interviews/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast({ title: "Updated", description: "Interview updated successfully." });
        fetchData();
        setEditInterviewData(null);
        if (selectedInterview && selectedInterview.id === id) {
          setSelectedInterview(prev => ({ 
            ...prev, 
            rawStatus: payload.status, 
            rawRound: payload.round, 
            status: payload.status !== 'Scheduled' ? payload.status : payload.round 
          }));
        }
      } else {
        toast({ title: "Update Failed", description: "Could not update interview.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950 min-h-screen text-gray-900 dark:text-gray-100">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Interview Schedules</h1>
            <p className="text-gray-500 dark:text-gray-400">Manage your hiring timeline</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setFormErrors({}); setShowNewInterviewForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md text-sm font-medium transition"
            >
              <Plus className="h-4 w-4" /> New Interview
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard title="Total" value={interviewStats.total} icon={<Calendar />} gradient="bg-purple-600" onClick={() => setActiveStatFilter('total')} />
          <StatCard title="Today" value={interviewStats.today} icon={<CalendarIcon />} gradient="bg-orange-600" onClick={() => setActiveStatFilter('today')} />
          <StatCard title="Upcoming" value={interviewStats.upcoming} icon={<Clock />} gradient="bg-green-600" onClick={() => setActiveStatFilter('upcoming')} />
          <StatCard title="Completed" value={interviewStats.completed} icon={<CheckCircle2 />} gradient="bg-blue-600" onClick={() => setActiveStatFilter('completed')} />
          <StatCard title="Hold" value={interviewStats.virtual} icon={<Video />} gradient="bg-indigo-600" onClick={() => setActiveStatFilter('Hold')} />
        </div>

        {/* Filter Bar */}
        <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-transparent"
                placeholder="Search interviews..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-3 items-center w-full md:w-auto">
              <select className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" value={selectedRecruiterId} onChange={(e) => setSelectedRecruiterId(e.target.value)}>
                <option value="">All Recruiters</option>
                {recruiters.map(r => <option key={r._id || r.id} value={r._id || r.id}>{r.firstName ? `${r.firstName} ${r.lastName}` : r.name}</option>)}
              </select>
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button onClick={() => setViewMode("grid")} className={`p-2 rounded transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}><Grid className="h-4 w-4" /></button>
                <button onClick={() => setViewMode("list")} className={`p-2 rounded transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}><List className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
        ) : (
          <AnimatePresence mode="wait">
            {filteredInterviews.length === 0 ? (
              <div className="text-center py-20 text-gray-500 dark:text-gray-400">No interviews found matching your criteria.</div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredInterviews.map((interview) => (
                  <InterviewGridCard 
                    key={interview.id} 
                    interview={interview} 
                    onView={() => handleViewInterview(interview)} 
                    onEdit={() => setEditInterviewData(interview)} 
                    onDelete={() => handleDeleteInterview(interview.id)}
                  />
                ))}
              </div>
            ) : (
              <InterviewListView 
                interviews={filteredInterviews} 
                onView={handleViewInterview} 
                onEdit={(interview) => setEditInterviewData(interview)} 
                onDelete={(id) => handleDeleteInterview(id)}
              />
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Modals */}
      {showNewInterviewForm && (
        <NewInterviewModal
          form={newInterviewForm} errors={formErrors} onChange={handleNewInterviewChange}
          onCandidateSelect={handleCandidateSelect} onSubmit={handleSubmitNewInterview}
          onClose={() => setShowNewInterviewForm(false)} recruiters={recruiters} candidates={candidates}
          onGenerateMeetingLink={() => setNewInterviewForm(p => ({ ...p, meetingLink: `https://meet.google.com/${Math.random().toString(36).substring(7)}` }))}
        />
      )}

      {selectedInterview && (
        <InterviewDetailModal
          interview={selectedInterview} candidateFull={selectedCandidateFullDetails}
          loading={loadingDetails} onClose={() => setSelectedInterview(null)}
          onUpdate={handleUpdateFullInterview}
        />
      )}

      {editInterviewData && (
        <EditInterviewModal 
          interview={editInterviewData} 
          onClose={() => setEditInterviewData(null)} 
          onSave={handleUpdateFullInterview} 
        />
      )}
    </main>
  );
}

// --- Sub Components ---

function InterviewGridCard({ interview, onView, onEdit, onDelete }) {
  const timeStatus = getTimeStatus(interview.interviewDate);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-lg transition-shadow cursor-pointer border-l-4" style={{ borderLeftColor: timeStatus.status === 'urgent' ? '#ef4444' : '#3b82f6' }}>
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10"><AvatarFallback>{interview.candidateName.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate max-w-[150px]">{interview.candidateName}</h3>
              <p className="text-sm text-gray-500">{interview.position}</p>
            </div>
          </div>
          {getStatusBadge(interview.status)}
        </div>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-gray-400" /> {new Date(interview.interviewDate).toLocaleString()}</div>
          <div className="flex items-center gap-2"><UserCircle className="h-4 w-4 text-gray-400" /> {interview.recruiterName}</div>
          <div className="flex items-center gap-2"><Building className="h-4 w-4 text-gray-400" /> {interview.clientName}</div>
        </div>
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
          {getPriorityBadge(interview.priority)}
          <div className="flex gap-2">
            <button onClick={() => onEdit(interview)} className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-gray-800 transition" title="Edit Interview">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={() => onDelete(interview.id)} className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-red-50 hover:text-red-600 dark:hover:bg-gray-800 transition" title="Delete Interview">
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={onView} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-gray-800 dark:hover:text-blue-400 transition">View Details</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InterviewListView({ interviews, onView, onEdit, onDelete }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto shadow-sm">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-100 dark:bg-gray-800">
          <tr>
            {["Candidate", "Position", "Date", "Recruiter", "Status", "Actions"].map(h => (
              <th key={h} className="p-4 font-medium text-gray-600 dark:text-gray-300">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {interviews.map(i => (
            <tr key={i.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
              <td className="p-4 font-medium text-gray-900 dark:text-white">{i.candidateName}</td>
              <td className="p-4 text-gray-600 dark:text-gray-300">{i.position}</td>
              <td className="p-4 text-gray-600 dark:text-gray-300">{new Date(i.interviewDate).toLocaleDateString()}</td>
              <td className="p-4 text-gray-600 dark:text-gray-300">{i.recruiterName}</td>
              <td className="p-4">{getStatusBadge(i.status)}</td>
              <td className="p-4 flex items-center gap-2">
                <button onClick={() => onView(i)} title="View Details" className="p-2 rounded-lg hover:bg-blue-50 text-gray-600 hover:text-blue-600 dark:hover:bg-gray-700 transition">
                  <Eye className="h-4 w-4" />
                </button>
                <button onClick={() => onEdit(i)} title="Edit Interview" className="p-2 rounded-lg hover:bg-orange-50 text-gray-600 hover:text-orange-600 dark:hover:bg-gray-700 transition">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => onDelete(i.id)} title="Delete Interview" className="p-2 rounded-lg hover:bg-red-50 text-gray-600 hover:text-red-600 dark:hover:bg-gray-700 transition">
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditInterviewModal({ interview, onClose, onSave }) {
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    round: interview.rawRound || 'L1 Interview',
    status: interview.rawStatus || 'Scheduled',
    type: interview.interviewType || 'Virtual',
    interviewDate: new Date(interview.interviewDate).toISOString().split('T')[0],
    interviewTime: new Date(interview.interviewDate).toTimeString().substring(0, 5),
    meetingLink: interview.meetingLink || '',
    notes: interview.notes || ''
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    setIsSaving(true);
    await onSave(interview.id, form);
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-t-xl">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Edit className="h-5 w-5 text-blue-600"/> Edit Interview</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"><X className="h-5 w-5" /></button>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Editing details for <span className="font-semibold text-gray-900 dark:text-white">{interview.candidateName}</span></p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Date</label>
              <input type="date" name="interviewDate" value={form.interviewDate} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Time</label>
              <input type="time" name="interviewTime" value={form.interviewTime} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Current Round</label>
              <select name="round" value={form.round} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white">
                <option>L1 Interview</option>
                <option>L2 Interview</option>
                <option>L3 Interview</option>
                <option>L4 Interview</option>
                <option>L5 Interview</option>
                <option>Technical Round</option>
                <option>HR Round</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Interview Status</label>
              <select name="status" value={form.status} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white">
                <option>Scheduled</option>
                <option>Completed</option>
                <option>Shortlisted</option>
                <option>Hold</option>
                <option>Submitted</option>
                <option>Cancelled</option>
                <option>No Show</option>
                <option>Rejected</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Mode</label>
            <select name="type" value={form.type} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white">
              <option value="Virtual">Virtual</option>
              <option value="In-person">In-person</option>
              <option value="Phone">Phone</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Meeting Link</label>
            <input type="text" name="meetingLink" value={form.meetingLink} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Notes</label>
            <Textarea name="notes" value={form.notes} onChange={handleChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-700 dark:text-gray-200">Cancel</button>
          <button onClick={handleSubmit} disabled={isSaving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function InterviewDetailModal({ interview, candidateFull, loading, onClose, onUpdate }) {
  const [editStatus, setEditStatus] = useState(interview.rawStatus || 'Scheduled');
  const [editRound, setEditRound] = useState(interview.rawRound || 'L1 Interview');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveStatus = async () => {
    setIsSaving(true);
    await onUpdate(interview.id, { status: editStatus, round: editRound });
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-start bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-t-2xl">
          <div className="flex gap-4 items-center">
            <Avatar className="h-16 w-16 border-2 border-white/50">
              <AvatarFallback className="text-blue-700 font-bold text-xl bg-white">{interview.candidateName.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                {interview.candidateName}
                {getStatusBadge(interview.status)}
              </h2>
              <div className="flex gap-2 text-blue-100 items-center mt-1 text-sm font-medium">
                <Briefcase className="h-4 w-4" />
                <span>{interview.position} at {interview.clientName}</span>
                <span className="mx-2 opacity-50">•</span>
                <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                  {interview.interviewType}
                </Badge>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-0 flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-500">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
              <p>Fetching candidate profile...</p>
            </div>
          ) : (
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left Column */}
              <div className="space-y-6">
                
                {/* STATUS EDIT BLOCK */}
                <div className="rounded-xl border-l-4 border-l-orange-500 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-4">
                  <h3 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2 mb-3">
                    <Edit className="h-4 w-4" /> Update Status
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Current Round</label>
                      <select value={editRound} onChange={(e) => setEditRound(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:border-blue-500 text-gray-800 dark:text-white">
                        <option>L1 Interview</option>
                        <option>L2 Interview</option>
                        <option>L3 Interview</option>
                        <option>L4 Interview</option>
                        <option>L5 Interview</option>
                        <option>Technical Round</option>
                        <option>HR Round</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Interview Status</label>
                      <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:border-blue-500 text-gray-800 dark:text-white">
                        <option>Scheduled</option>
                        <option>Completed</option>
                        <option>Shortlisted</option>
                        <option>Hold</option>
                        <option>Submitted</option>
                        <option>Cancelled</option>
                        <option>No Show</option>
                        <option>Rejected</option>
                      </select>
                    </div>
                    <button 
                      onClick={handleSaveStatus} 
                      disabled={isSaving}
                      className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition flex justify-center items-center gap-2"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-4">
                  <h3 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2 mb-3"><UserCircle className="h-4 w-4" /> Contact Info</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded"><Mail className="h-4 w-4 text-blue-500" /> <span className="truncate">{candidateFull?.email || interview.candidateEmail}</span></div>
                    <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded"><Phone className="h-4 w-4 text-green-500" /> {candidateFull?.contact || candidateFull?.phone || interview.candidatePhone}</div>
                    <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded"><MapPin className="h-4 w-4 text-red-500" /> {candidateFull?.currentLocation || "Remote"}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-4">
                  <h3 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2 mb-3"><Target className="h-4 w-4" /> Professional Stats</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded"><p className="text-xs text-blue-600 dark:text-blue-400 uppercase font-bold">Total Exp</p><p className="font-semibold text-gray-800 dark:text-gray-200">{candidateFull?.totalExperience || "N/A"} Years</p></div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded"><p className="text-xs text-purple-600 dark:text-purple-400 uppercase font-bold">Relevant</p><p className="font-semibold text-gray-800 dark:text-gray-200">{candidateFull?.relevantExperience || "N/A"} Years</p></div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded"><p className="text-xs text-green-600 dark:text-green-400 uppercase font-bold">Current CTC</p><p className="font-semibold text-gray-800 dark:text-gray-200">{candidateFull?.ctc || "N/A"}</p></div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded"><p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-bold">Expected</p><p className="font-semibold text-gray-800 dark:text-gray-200">{candidateFull?.ectc || "N/A"}</p></div>
                    <div className="col-span-2 bg-orange-50 dark:bg-orange-900/20 p-2 rounded flex justify-between items-center">
                      <span className="text-xs text-orange-600 dark:text-orange-400 uppercase font-bold">Notice Period</span>
                      <span className="font-bold text-orange-700 dark:text-orange-300">{candidateFull?.noticePeriod || "Immediate"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="lg:col-span-2 space-y-6">

                <div className="rounded-xl border-l-4 border-l-blue-500 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-4 grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Interview Date & Mode</p>
                    <p className="font-medium flex items-center gap-2 text-gray-900 dark:text-white">
                      <Calendar className="h-4 w-4 text-blue-600" /> {new Date(interview.interviewDate).toLocaleString()}
                      <span className="text-gray-400 px-2">•</span>
                      <span className="text-sm font-semibold">{interview.interviewType}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Meeting Link</p>
                    {interview.meetingLink ? (
                      <a href={interview.meetingLink} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-100 dark:border-blue-900/30">
                        <Video className="h-4 w-4" /> {interview.meetingLink}
                      </a>
                    ) : <span className="text-gray-400 italic">No link provided</span>}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-4">
                  <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">Skills & Expertise</h3>
                  <div className="flex flex-wrap gap-2">
                    {candidateFull?.skills ? (
                      (Array.isArray(candidateFull.skills) ? candidateFull.skills : candidateFull.skills.split(',')).map((skill, i) => (
                        <Badge key={i} variant="secondary" className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">{skill.trim()}</Badge>
                      ))
                    ) : <span className="text-gray-400 text-sm">No specific skills listed.</span>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-4">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2 mb-2"><FileText className="h-4 w-4" /> Interview Notes</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-3 rounded min-h-[80px]">{interview.notes || "No notes added for this interview."}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-4">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2 mb-2"><FileText className="h-4 w-4" /> Candidate Notes</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-3 rounded min-h-[80px]">{candidateFull?.notes || "No internal notes on candidate."}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-2xl flex justify-end">
          <button onClick={onClose} className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition">Close</button>
        </div>
      </motion.div>
    </div>
  );
}

function NewInterviewModal({ form, errors, onChange, onCandidateSelect, onGenerateMeetingLink, onSubmit, onClose, recruiters, candidates }) {
  const inputCls = (err) => `w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${err ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-blue-700 flex justify-between items-center bg-blue-600 text-white rounded-t-xl">
          <h2 className="text-xl font-bold">Schedule Interview</h2>
          <button onClick={onClose}><X className="h-6 w-6" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1 text-gray-700 dark:text-gray-200">Select Candidate *</label>
            <select className={inputCls(errors.candidateId)} onChange={onCandidateSelect} value={form.candidateId}>
              <option value="">-- Choose a Candidate --</option>
              {candidates.map((c) => <option key={c._id || c.id} value={c._id || c.id}>{c.name || "Unknown"} ({c.email || "No Email"})</option>)}
            </select>
            {errors.candidateId && <p className="text-xs text-red-500 mt-1">{errors.candidateId}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1 text-gray-700 dark:text-gray-200">Candidate Name</label>
              <input name="candidateName" value={form.candidateName} onChange={onChange} disabled={!!form.candidateId} className={inputCls(false) + (form.candidateId ? " opacity-70 cursor-not-allowed" : "")} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1 text-gray-700 dark:text-gray-200">Email</label>
              <input name="candidateEmail" value={form.candidateEmail} onChange={onChange} disabled={!!form.candidateId} className={inputCls(false) + (form.candidateId ? " opacity-70 cursor-not-allowed" : "")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1 text-gray-700 dark:text-gray-200">Date</label>
              <input type="date" name="interviewDate" value={form.interviewDate} onChange={onChange} className={inputCls(errors.interviewDate)} />
              {errors.interviewDate && <p className="text-xs text-red-500 mt-1">{errors.interviewDate}</p>}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1 text-gray-700 dark:text-gray-200">Time</label>
              <input type="time" name="interviewTime" value={form.interviewTime} onChange={onChange} className={inputCls(false)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            
            <div>
              <label className="text-sm font-medium block mb-1 text-gray-700 dark:text-gray-200">Round</label>
              <select name="round" value={form.round} onChange={onChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>L1 Interview</option>
                <option>L2 Interview</option>
                <option>L3 Interview</option>
                <option>L4 Interview</option>
                <option>L5 Interview</option>
                <option>Technical Round</option>
                <option>HR Round</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1 text-gray-700 dark:text-gray-200">Mode</label>
              <select name="type" value={form.type} onChange={onChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Virtual">Virtual</option>
                <option value="In-person">In-person</option>
                <option value="Phone">Phone</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1 text-gray-700 dark:text-gray-200">Status</label>
            <select name="status" value={form.status || "Scheduled"} onChange={onChange} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
              <option value="Shortlisted">Shortlisted</option>
              <option value="Hold">Hold</option>
              <option value="Submitted">Submitted</option>
              <option value="Cancelled">Cancelled</option>
              <option value="No Show">No Show</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1 text-gray-700 dark:text-gray-200">Link</label>
            <div className="flex gap-2">
              <input name="meetingLink" value={form.meetingLink} onChange={onChange} className={inputCls(false)} />
              <button onClick={onGenerateMeetingLink} className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition whitespace-nowrap">Generate</button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1 text-gray-700 dark:text-gray-200">Notes</label>
            <Textarea name="notes" value={form.notes} onChange={onChange} className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 transition">Cancel</button>
          <button onClick={onSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Schedule</button>
        </div>
      </motion.div>
    </div>
  );
}