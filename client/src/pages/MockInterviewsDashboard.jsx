import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Brain, Send, Clock, PlayCircle, Plus, X, Search, ChevronRight,
  User, CheckCircle, Video, CheckSquare, Briefcase, Mail, Cpu, Trash2, ExternalLink, Filter, ChevronDown, Copy, Users, RotateCw, CheckCircle2, Shield, Download
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
// Adjust for API format
const API_URL = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

function getFirebaseToken() {
  try {
    const raw = sessionStorage.getItem('currentUser');
    return raw ? JSON.parse(raw)?.idToken : null;
  } catch { return null; }
}

async function apiFetch(path, options = {}) {
  const token = getFirebaseToken();
  const url = `${API_URL}/ai-mock${path}`;
  console.log(`[API Request] fetching: ${url}`);
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    if (!res.ok) {
      console.error(`[API Error] Status: ${res.status} | Path: ${path}`);
      throw new Error(`HTTP ${res.status}: ${res.statusText || 'Request failed'}`);
    }
    return res.json();
  } catch (err) {
    console.error(`[API Call Failed] ${url}:`, err);
    throw err;
  }
}

export default function MockInterviewsDashboard() {
  const { currentUser, userRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [sessionResults, setSessionResults] = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  const handleDownloadPDF = async () => {
    let noPrintElements = [];
    try {
      const element = document.getElementById('printable-results');
      const container = document.getElementById('dashboard-container');
      if (!element) return;

      // 1. Temporarily expand the container so html2canvas doesn't crop anything
      if (container) {
        container.style.overflow = 'visible';
        container.style.height = 'auto';
      }

      // 2. Hide buttons that shouldn't be printed
      noPrintElements = element.querySelectorAll('.no-print');
      noPrintElements.forEach(el => { el.style.display = 'none'; });

      // 4. We will completely bypass html2pdf's buggy A4 pagination limits.
      // Instead, we directly use html2canvas + jsPDF to take ONE precise, full-length screenshot and embed it natively.
      if (!window.html2canvas || !window.jspdf) {
        await Promise.all([
          new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load html2canvas'));
            document.head.appendChild(script);
          }),
          new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load jspdf'));
            document.head.appendChild(script);
          })
        ]);
      }

      // Capture native layout seamlessly
      const canvas = await window.html2canvas(element, {
        scale: 2,
        useCORS: true,
        scrollY: 0,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);

      // Calculate true dimensions (reverting the 2x scale for sharp density)
      const contentWidth = canvas.width / 2;
      const contentHeight = canvas.height / 2;

      // Add gorgeous 40px padding to all four sides
      const padding = 40;
      const pdfWidth = contentWidth + (padding * 2);
      const pdfHeight = contentHeight + (padding * 2);

      // Force PDF library to use EXACT, continuous physical sizing.
      const pdf = new window.jspdf.jsPDF({
        orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: [pdfWidth, pdfHeight]
      });

      // Draw the image onto the custom page with exactly the padding offset applied
      pdf.addImage(imgData, 'JPEG', padding, padding, contentWidth, contentHeight);
      pdf.save(`Interview_Report_${sessionResults?.candidate_name?.replace(/\s+/g, '_') || 'Candidate'}.pdf`);

    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Failed to generate PDF. Check console for details.");
    } finally {
      // 5. Restore the UI back to exactly how it was
      noPrintElements.forEach(el => { el.style.display = ''; });
      const container = document.getElementById('dashboard-container');
      if (container) {
        container.style.overflow = '';
        container.style.height = '';
      }
    }
  };

  // Form State
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [duration, setDuration] = useState('30');

  // Default to current local time for scheduling
  const initialDate = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const initialTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const [scheduledDate, setScheduledDate] = useState(initialDate);
  const [scheduledTime, setScheduledTime] = useState(initialTime);

  const [resumeFile, setResumeFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allCandidates, setAllCandidates] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [recruiters, setRecruiters] = useState([]);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState('all');
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const role = String(userRole || '').toLowerCase();
  const adminId = (role === 'admin' || role === 'manager') ? 'all' : (currentUser?._id || currentUser?.id || 'admin_user');


  const openResults = async (linkId) => {
    setResultsLoading(true);
    setSelectedSessionId(linkId);
    setActiveTab('results');
    try {
      const data = await apiFetch(`/admin/interview/${linkId}`);
      setSessionResults(data);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load results', variant: 'destructive' });
      setActiveTab('overview');
    } finally {
      setResultsLoading(false);
    }
  };

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/admin/sessions?admin_id=${adminId}`);
      if (data.status === 'success') {
        setSessions(data.sessions || []);
        setSelectedSessions([]); // Reset on refresh
      }
    } catch (err) {
      toast({ title: 'Sync Failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [adminId, toast]);

  const fetchRecruiters = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/recruiters`, {
        headers: { 'Authorization': `Bearer ${getFirebaseToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecruiters(Array.isArray(data) ? data : (data.recruiters || []));
      }
    } catch (err) {
      console.error('Failed to fetch recruiters', err);
      setRecruiters([]);
    }
  }, []);

  const fetchAllCandidates = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/candidates`, {
        headers: { 'Authorization': `Bearer ${getFirebaseToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllCandidates(Array.isArray(data) ? data : (data.candidates || []));
      }
    } catch (err) {
      console.error('Failed to fetch candidates', err);
      setAllCandidates([]);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchAllCandidates();
    fetchRecruiters();
  }, [fetchSessions, fetchAllCandidates, fetchRecruiters]);

  const handleSelectCandidate = (id) => {
    setSelectedCandidateId(id);
    const cand = allCandidates.find(c => (c._id || c.id) === id);
    if (cand) {
      setCandidateName(cand.name);
      setCandidateEmail(cand.email);
    } else {
      setCandidateName('');
      setCandidateEmail('');
    }
  };

  const [isUpdatingDecision, setIsUpdatingDecision] = useState(false);

  const handleDecision = async (linkId, decision) => {
    if (isUpdatingDecision) return; // Prevent double clicks strictly

    if (!window.confirm(`Are you sure you want to mark this candidate as ${decision}? This will lock the decision and the action cannot be undone.`)) {
      return;
    }

    setIsUpdatingDecision(true);
    try {
      const data = await apiFetch('/admin/update-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          link_id: linkId,
          decision: decision,
          admin_id: currentUser?._id || currentUser?.id
        })
      });

      if (data.status === 'success') {
        toast({ title: 'Decision Saved', description: `Candidate status permanently updated to ${decision}. Email status: ${data.email_sent ? 'Sent' : 'Failed'}` });

        // INSTANTLY update the UI state so buttons vanish immediately
        if (activeTab === 'results') {
          setSessionResults(prev => prev ? { ...prev, decision: decision } : prev);
        }

        // Refresh the backend data in the background silently
        fetchSessions();
      } else {
        throw new Error(data.detail || 'Update failed');
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsUpdatingDecision(false);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!jobDescription && !resumeFile) {
      toast({ title: 'Validation Error', description: 'Please provide either a Job Description or upload a context file (PDF).', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    let parsedResumeText = '';
    let finalName = candidateName;
    let finalEmail = candidateEmail;

    try {
      if (resumeFile) {
        const formData = new FormData();
        formData.append('file', resumeFile);
        const token = getFirebaseToken();
        const uploadRes = await fetch(`${API_URL}/ai-mock/admin/parse-resume`, {
          method: 'POST',
          headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
          body: formData
        });
        if (!uploadRes.ok) throw new Error('Failed to parse file');
        const uploadData = await uploadRes.json();
        parsedResumeText = uploadData.text;

        if (!finalName && uploadData.name) {
          finalName = uploadData.name;
          setCandidateName(uploadData.name);
        }
        if (!finalEmail && uploadData.email) {
          finalEmail = uploadData.email;
          setCandidateEmail(uploadData.email);
        }
      }

      if (!finalName || !finalEmail) {
        throw new Error('Candidate Name and Email are still required. Please fill them manually or ensure the file contains them.');
      }

      const data = await apiFetch('/admin/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_name: finalName,
          candidate_email: finalEmail,
          job_description: jobDescription || 'JD provided via attached file',
          admin_id: currentUser?._id || currentUser?.id || 'admin_user',
          admin_name: currentUser?.name || 'Admin',
          interview_duration: parseInt(duration),
          resume_text: parsedResumeText,
          scheduled_time: `${scheduledDate}T${scheduledTime}:00`
        })
      });

      if (data.status === 'success') {
        toast({ title: 'Success', description: 'Interview link created successfully.' });
        setCandidateName('');
        setCandidateEmail('');
        setJobDescription('');
        setDuration('30');
        setScheduledTime(new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10));
        setResumeFile(null);
        setActiveTab('overview');
        fetchSessions();
      } else {
        throw new Error(data.detail || 'Creation failed');
      }
    } catch (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSession = async (linkId) => {
    if (!window.confirm("Are you sure you want to delete this interview session? This action cannot be undone.")) return;

    try {
      const data = await apiFetch(`/admin/delete-session/${linkId}`, {
        method: 'DELETE'
      });

      if (data.status === 'success') {
        toast({ title: 'Session Deleted', description: 'The interview session has been permanently removed.' });
        fetchSessions();
        setSelectedSessions(prev => prev.filter(id => id !== linkId));
      } else {
        throw new Error(data.detail || 'Delete failed');
      }
    } catch (err) {
      toast({ title: 'Delete Failed', description: err.message, variant: 'destructive' });
    }
  };

  const toggleSessionSelection = (linkId) => {
    setSelectedSessions(prev =>
      prev.includes(linkId) ? prev.filter(id => id !== linkId) : [...prev, linkId]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedSessions.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedSessions.length} selected sessions? This cannot be undone.`)) return;

    setBulkDeleting(true);
    try {
      const data = await apiFetch('/admin/delete-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link_ids: selectedSessions })
      });

      if (data.status === 'success') {
        toast({ title: 'Bulk Delete Success', description: data.message });
        fetchSessions();
        setSelectedSessions([]);
      } else {
        throw new Error(data.detail || 'Bulk delete failed');
      }
    } catch (err) {
      toast({ title: 'Bulk Delete Failed', description: err.message, variant: 'destructive' });
    } finally {
      setBulkDeleting(false);
    }
  };

  const analytics = useMemo(() => {
    const safeSessions = Array.isArray(sessions) ? sessions : [];
    const total = safeSessions.length;
    const selected = safeSessions.filter(s => s?.decision?.toLowerCase() === 'selected').length;
    const rejected = safeSessions.filter(s => s?.decision?.toLowerCase() === 'rejected').length;

    return { total, selected, rejected };
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    const safeSessions = Array.isArray(sessions) ? sessions : [];
    let filtered = safeSessions;

    // Filter by name
    if (searchQuery) {
      filtered = filtered.filter(s =>
        s?.candidate_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by recruiter
    if (selectedRecruiterId !== 'all') {
      filtered = filtered.filter(s => s?.created_by === selectedRecruiterId);
    }

    // Filter by tab
    if (activeTab === 'qualified') {
      filtered = filtered.filter(s => s?.decision?.toLowerCase() === 'selected');
    } else if (activeTab === 'rejected_tab') {
      filtered = filtered.filter(s => s?.decision?.toLowerCase() === 'rejected');
    }

    return filtered;
  }, [sessions, searchQuery, selectedRecruiterId, activeTab]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black text-[#584ED3] tracking-tight">AI Interview Dashboard</h1>
          <p className="text-gray-400 font-medium mt-1">Real-time candidate evaluation & session management.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSessions}
            className="bg-white border border-gray-200 text-slate-700 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm hover:bg-slate-50 transition-all text-sm"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className="bg-[#4F46E5] hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all text-sm"
          >
            <Send className="w-4 h-4" />
            New Dispatch
          </button>
        </div>
      </div>

      <div className="bg-white/50 p-1.5 rounded-2xl inline-flex items-center gap-2 border border-gray-100/50">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'qualified', label: 'Qualified' },
          { id: 'rejected_tab', label: 'Rejected' },
          { id: 'create', label: 'Create New' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-8 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === tab.id
                ? 'bg-indigo-100/60 text-indigo-600'
                : 'text-slate-400 hover:text-slate-600'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div id="dashboard-container" className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden relative min-h-[500px]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50 -mr-20 -mt-20 pointer-events-none" />

        {activeTab === 'results' ? (
          <div className="p-8 relative z-10 animate-in fade-in slide-in-from-right-4 duration-300">
            {resultsLoading ? (
              <div className="flex flex-col h-[400px] items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-sm font-medium text-gray-400">Analyzing responses...</p>
              </div>
            ) : sessionResults ? (
              <div id="printable-results" className="space-y-8">
                <div className="flex justify-between items-start">
                  <div>
                    <button onClick={() => setActiveTab('overview')} className="text-indigo-600 font-bold text-sm flex items-center gap-2 mb-4 hover:underline no-print">
                      <ChevronRight className="w-4 h-4 rotate-180" /> Back to pipeline
                    </button>
                    <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                      {sessionResults.candidate_name}
                      {sessionResults.decision && sessionResults.decision.toLowerCase() !== 'pending' && (
                        <span className={`text-xs tracking-widest font-black px-4 py-1.5 rounded-full border shadow-sm ${sessionResults.decision.toLowerCase() === 'selected'
                            ? 'bg-emerald-500 text-white border-emerald-400'
                            : 'bg-rose-500 text-white border-rose-400'
                          }`}>
                          {sessionResults.decision.toLowerCase() === 'selected' ? 'ACCEPTED' : 'REJECTED'}
                        </span>
                      )}
                    </h2>
                    <div className="flex flex-col gap-0.5 mt-1">
                      <p className="text-slate-500 font-medium text-sm">Session ID: <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-xs">{sessionResults.id}</span></p>
                      <p className="text-slate-400 font-medium text-sm">Session recorded on {new Date(sessionResults.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4 lg:mt-0 no-print items-center">
                    {(!sessionResults.decision || sessionResults.decision.toLowerCase() === 'pending' || sessionResults.decision === '') ? (
                      <>
                        <button onClick={() => handleDecision(selectedSessionId, 'Selected')} className="bg-[#10B981] hover:bg-emerald-600 text-white px-5 py-2 rounded-xl font-bold text-sm shadow-md transition-all">Accept Candidate</button>
                        <button onClick={() => handleDecision(selectedSessionId, 'Rejected')} className="bg-rose-500 hover:bg-rose-600 text-white px-5 py-2 rounded-xl font-bold text-sm shadow-md transition-all">Reject</button>
                      </>
                    ) : (
                      <div className={`px-6 py-2 rounded-xl font-black text-xs tracking-widest border shadow-sm ${sessionResults.decision.toLowerCase() === 'selected'
                          ? 'bg-emerald-500 text-white border-emerald-400'
                          : 'bg-rose-500 text-white border-rose-400'
                        }`}>
                        {sessionResults.decision.toUpperCase().replace('SELECTED', 'ACCEPTED')}
                      </div>
                    )}
                    <button
                      onClick={handleDownloadPDF}
                      className="bg-slate-800 text-white hover:bg-slate-700 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition shadow-md ml-2"
                    >
                      <Download className="w-4 h-4" /> Download PDF
                    </button>
                  </div>
                </div>

                {/* Score Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-6 rounded-[1.5rem] border border-gray-200 shadow-sm flex flex-col justify-between hover:border-indigo-100 transition-colors pdf-avoid-break">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">Average Score</p>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-5xl font-black ${sessionResults.avg_score >= 60 ? 'text-[#10B981]' : 'text-rose-500'} leading-none`}>
                        {Math.round(sessionResults.avg_score)}
                      </span>
                      <span className="text-xl font-bold text-slate-400">/100</span>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-[1.5rem] border border-gray-200 shadow-sm flex flex-col justify-between hover:border-indigo-100 transition-colors pdf-avoid-break">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">Questions Answered</p>
                    <h3 className="text-5xl font-black text-slate-800 leading-none">
                      {sessionResults.answers.length}
                    </h3>
                  </div>

                  <div className="bg-white p-6 rounded-[1.5rem] border border-gray-200 shadow-sm flex flex-col justify-between hover:border-indigo-100 transition-colors pdf-avoid-break">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">Time Taken</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-black text-slate-800 leading-none">
                        {Math.max(1, Math.round(sessionResults.integrity?.total_time_minutes || 0))}
                      </span>
                      <span className="text-xl font-bold text-slate-400">m</span>
                    </div>
                  </div>
                </div>

                {/* Integrity Metrics */}
                <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 mt-2 pdf-avoid-break">
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-indigo-400" />
                      Integrity & Proctoring Summary
                    </p>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-3 h-3 rounded-full ${sessionResults.integrity?.total_tab_switches > 2 || sessionResults.integrity?.total_face_alerts > 5 ? 'bg-rose-500' : 'bg-[#10B981]'}`} />
                      <span className="text-2xl font-black text-slate-800">
                        {sessionResults.integrity?.total_tab_switches > 2 || sessionResults.integrity?.total_face_alerts > 5 ? 'High Risk' : 'Clean Session'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <div className="text-sm font-medium text-slate-500">
                      Tab Switches: <span className="font-bold text-slate-800 ml-1">{sessionResults.integrity?.total_tab_switches || 0}</span>
                    </div>
                    <div className="text-sm font-medium text-slate-500">
                      Face Alerts: <span className="font-bold text-slate-800 ml-1">{sessionResults.integrity?.total_face_alerts || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Question Details */}
                <div className="space-y-6">
                  <h3 className="text-xl font-black text-slate-800 px-2 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-indigo-500" />
                    Response Breakdown
                  </h3>
                  {sessionResults.answers.map((ans, idx) => (
                    <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4 hover:border-indigo-100 transition-all">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Question {idx + 1}</span>
                          <h4 className="text-lg font-bold text-slate-800 leading-tight pr-8">{ans.question_text}</h4>
                        </div>
                        <div className="text-right">
                          <div className={`text-3xl font-black ${ans.ai_score >= 60 ? 'text-[#10B981]' : 'text-rose-500'}`}>{ans.ai_score}/100</div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">AI Score</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="bg-slate-50 p-6 rounded-3xl space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Candidate Answer</p>
                          <p className="text-sm text-slate-600 leading-relaxed font-medium italic">"{ans.answer_text}"</p>
                        </div>
                        <div className="bg-indigo-50/50 p-6 rounded-3xl space-y-2 border border-indigo-100/50">
                          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">AI Feedback</p>
                          <p className="text-sm text-slate-700 leading-relaxed font-bold">{ans.ai_feedback}</p>
                        </div>
                      </div>

                      {ans.corrected_answer && (
                        <div className="p-6 bg-green-50/30 rounded-3xl border border-green-100/50">
                          <p className="text-[10px] font-black text-[#10B981] uppercase tracking-widest mb-1">Suggested Model Answer</p>
                          <p className="text-sm text-slate-600 leading-relaxed">{ans.corrected_answer}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3 pt-2">
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-100 rounded-full text-[10px] font-bold text-slate-500">
                          <Clock className="w-3 h-3" /> {Math.round(ans.time_spent_seconds)}s
                        </span>
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-100 rounded-full text-[10px] font-bold text-slate-500">
                          <Briefcase className="w-3 h-3" /> {ans.keyword_match_pct}% Match
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-64 items-center justify-center text-center">
                <p className="text-slate-400 font-bold">Results failed to load.</p>
                <button onClick={() => setActiveTab('overview')} className="mt-4 text-indigo-600 underline">Return to Dashboard</button>
              </div>
            )}
          </div>
        ) : activeTab !== 'create' ? (
          <div className="p-8 relative z-10 animate-in fade-in duration-300">
            {/* Header with Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm flex items-center justify-between group hover:border-indigo-100 transition-all">
                <div>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5">Total Sessions</p>
                  <h3 className="text-4xl font-black text-slate-800 leading-none">{analytics.total}</h3>
                </div>
                <div className="p-3.5 bg-indigo-50 rounded-2xl group-hover:scale-110 transition-transform">
                  <Users className="w-7 h-7 text-indigo-500" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm flex items-center justify-between group hover:border-green-100 transition-all">
                <div>
                  <p className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1.5">Selected</p>
                  <h3 className="text-4xl font-black text-slate-800 leading-none">{analytics.selected}</h3>
                </div>
                <div className="p-3.5 bg-green-50 rounded-2xl group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="w-7 h-7 text-green-500" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm flex items-center justify-between group hover:border-rose-100 transition-all">
                <div>
                  <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1.5">Rejected</p>
                  <h3 className="text-4xl font-black text-slate-800 leading-none">{analytics.rejected}</h3>
                </div>
                <div className="p-3.5 bg-rose-50 rounded-2xl group-hover:scale-110 transition-transform">
                  <X className="w-7 h-7 text-rose-500" />
                </div>
              </div>

              {userRole !== 'recruiter' && (
                <div className="bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm flex flex-col justify-center gap-2 hover:border-indigo-50 transition-all">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ">Filter By Recruiter</p>
                  <div className="relative">
                    <select
                      value={selectedRecruiterId}
                      onChange={(e) => setSelectedRecruiterId(e.target.value)}
                      className="w-full bg-slate-50/50 border border-gray-100 py-2.5 px-5 rounded-2xl text-sm font-bold text-slate-700 focus:ring-0 outline-none cursor-pointer appearance-none"
                    >
                      <option value="all">All Recruiters</option>
                      {(Array.isArray(recruiters) ? recruiters : []).map(r => (
                        <option key={r._id || r.id} value={r._id || r.id}>{r.name || r.firstName}</option>
                      ))}
                    </select>
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
                    </div>
                  </div>
                </div>
              )}
            </div>


            <div className="flex justify-between items-center mb-6 px-2">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Interview Pipeline</h2>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter candidates..."
                  className="pl-11 pr-5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm w-64 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {selectedSessions.length > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="flex items-center gap-2 bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2.5 rounded-xl text-sm font-black transition-all border border-rose-200 shadow-sm disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {bulkDeleting ? 'Deleting...' : `Delete ${selectedSessions.length} Selected`}
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex flex-col h-64 items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-sm font-medium text-gray-400">Loading sessions...</p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="flex flex-col h-64 items-center justify-center text-center">
                <div className="p-6 bg-indigo-50 rounded-full mb-4">
                  <Cpu className="w-12 h-12 text-indigo-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-700">No mock interviews scheduled</h3>
                <p className="text-gray-500 text-sm mt-1 max-w-sm">Create an AI mock interview session to automatically assess candidate skills.</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="mt-6 font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-4"
                >
                  Create Your First Session
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-gray-100 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                      <th className="px-6 py-8 text-left bg-white">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          checked={filteredSessions.length > 0 && selectedSessions.length === filteredSessions.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSessions(filteredSessions.map(s => s.link_id));
                            } else {
                              setSelectedSessions([]);
                            }
                          }}
                        />
                      </th>
                      <th className="px-6 py-8 text-left text-gray-400 font-bold text-[10px] uppercase tracking-widest bg-white">Candidate</th>
                      {(userRole === 'admin' || userRole === 'manager') && (
                        <th className="px-6 py-8 text-left text-gray-400 font-bold text-[10px] uppercase tracking-widest bg-white">Recruiter</th>
                      )}
                      <th className="px-6 py-8 text-left text-gray-400 font-bold text-[10px] uppercase tracking-widest bg-white">Date Created</th>
                      <th className="px-6 py-8 text-left text-gray-400 font-bold text-[10px] uppercase tracking-widest bg-white">Status</th>
                      <th className="px-6 py-8 text-left text-gray-400 font-bold text-[10px] uppercase tracking-widest bg-white">Score</th>
                      <th className="px-6 py-8 text-right text-gray-400 font-bold text-[10px] uppercase tracking-widest bg-white">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredSessions.map((s) => {
                      const safeRecs = Array.isArray(recruiters) ? recruiters : [];
                      const rec = safeRecs.find(r => (r?._id || r?.id) === s?.created_by);

                      let recName = s?.created_by_name || 'System';
                      if (rec && (rec.name || rec.firstName)) {
                        if (rec.name) recName = rec.name;
                        else if (rec.firstName) recName = `${rec.firstName} ${rec.lastName || ''}`.trim();
                      } else if (!s?.created_by_name && (s?.created_by === 'admin_user' || s?.created_by === 'all')) {
                        recName = 'Admin';
                      }

                      const recInitial = recName.charAt(0).toUpperCase();

                      return (
                        <tr key={s.link_id} className={`hover:bg-slate-50/50 transition-all border-b border-gray-50 ${selectedSessions.includes(s.link_id) ? 'bg-indigo-50/30' : ''}`}>
                          <td className="px-6 py-8">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              checked={selectedSessions.includes(s.link_id)}
                              onChange={() => toggleSessionSelection(s.link_id)}
                            />
                          </td>
                          <td className="px-6 py-8">
                            <div className="flex items-center gap-2">
                              <p className="font-black text-[#584ED3] text-base uppercase whitespace-nowrap">{s.candidate_name}</p>
                              {s.decision && s.decision !== 'pending' && (
                                <span className={`px-3 py-1 rounded text-[10px] font-black uppercase text-white shadow-md ${s.decision === 'Selected' ? 'bg-[#10B981]' : 'bg-[#EF4444]'
                                  }`}>
                                  {s.decision === 'Selected' ? 'ACCEPTED' : 'REJECTED'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-400 mt-1">
                              <Video className="w-3.5 h-3.5 text-blue-400" />
                              <span className="text-xs font-semibold">{s.interview_duration || 30} min interview</span>
                            </div>
                            {s.decision && s.decision !== 'pending' && (
                              <p className={`text-[9px] font-black uppercase mt-2 opacity-90 ${s.decision === 'Selected' ? 'text-green-500' : 'text-rose-500'}`}>
                                {s.decision.toUpperCase()} BY: {(() => {
                                  const safeRecs = Array.isArray(recruiters) ? recruiters : [];
                                  const dbId = s.decision_by || s.created_by;
                                  const dbRec = safeRecs.find(r => (r?._id || r?.id) === dbId);
                                  if (dbRec) return (dbRec.name || dbRec.firstName).toUpperCase();
                                  return (s.created_by_name || 'SYSTEM').toUpperCase();
                                })()}
                              </p>
                            )}
                          </td>
                          {(userRole === 'admin' || userRole === 'manager') && (
                            <td className="px-6 py-6">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 text-xs font-black border border-indigo-100">
                                  {recInitial}
                                </div>
                                <span className="font-black text-slate-700 text-sm tracking-tight">{recName}</span>
                              </div>
                            </td>
                          )}
                          <td className="px-6 py-6 font-bold text-slate-500 text-sm whitespace-nowrap">
                            {new Date(s.created_at).toLocaleString('en-US', {
                              month: 'numeric',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </td>
                          <td className="px-6 py-6">
                            <span className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                              s.status === 'completed' ? 'bg-green-500 text-white shadow-lg shadow-green-100' :
                              s.status === 'started' ? 'bg-amber-100/50 text-amber-600 border border-amber-200' :
                              'bg-indigo-100/50 text-indigo-400 border border-indigo-50'
                            }`}>
                              {s.status === 'completed' ? 'COMPLETED' : 
                               s.status === 'started' ? 'STARTED' : 'PENDING'}
                            </span>
                          </td>
                          <td className="px-6 py-8 font-black text-base">
                            {s.status === 'completed' ? (
                              <span className={s.avg_score >= 70 ? 'text-green-500' : 'text-rose-500'}>
                                {Math.round(s.avg_score)}%
                              </span>
                            ) : (
                              <span className="text-[#F43F5E]">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-6 text-right">
                            <div className="flex items-center justify-end gap-3">
                              {s.status === 'completed' ? (
                                <div className="flex items-center gap-2">

                                  <button
                                    onClick={() => openResults(s.link_id)}
                                    className="bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-3 py-2 font-black text-[10px] uppercase rounded-lg transition-all shadow-sm"
                                  >
                                    Results
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    // The interview page is served at /index.html on the backend (port 5000)
                                    // not /mock/index.html — that path does not exist
                                    const backendBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api$/, '').replace(/\/$/, '');
                                    window.open(`${backendBase}/index.html?session_id=${s.link_id}`);
                                  }}
                                  className="bg-white border border-gray-100 text-slate-700 hover:bg-slate-50 px-5 py-2.5 font-black text-xs rounded-lg transition-all shadow-sm flex items-center gap-2 whitespace-nowrap"
                                >
                                  <Copy className="w-3 h-3" />
                                  Invite
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteSession(s.link_id)}
                                className="text-slate-300 hover:text-red-500 transition-colors p-2"
                                title="Delete Session"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 relative z-10 max-w-3xl mx-auto bg-white rounded-[2.5rem] my-8 shadow-sm border border-gray-50">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-black text-slate-800 mb-2">Configure Session</h2>
              <p className="text-gray-500 font-medium text-sm max-w-md mx-auto">Provide candidate details and context for the AI engine to generate dynamic questions.</p>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Select Existing Candidate (Optional)</label>
                <select
                  value={selectedCandidateId}
                  onChange={(e) => handleSelectCandidate(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-xl text-sm font-medium transition-all appearance-none cursor-pointer"
                >
                  <option value="">-- Select Candidate --</option>
                  {(allCandidates || []).map(c => (
                    <option key={c._id || c.id} value={c._id || c.id}>{c.name} ({c.email})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Candidate Name <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={candidateName} onChange={e => setCandidateName(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-gray-50 focus:bg-white border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl text-sm font-medium transition-all" placeholder="John Doe" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Candidate Email <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="email" value={candidateEmail} onChange={e => setCandidateEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-gray-50 focus:bg-white border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl text-sm font-medium transition-all" placeholder="john@example.com" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Duration (Minutes)</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="number" min="1" placeholder="e.g. 30" value={duration} onChange={e => setDuration(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-gray-50 focus:bg-white border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl text-sm font-bold text-slate-700 transition-all" />
                  </div>
                </div>
                <div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Scheduled Date</label>
                      <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="w-full px-4 py-3 bg-gray-50 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-xl text-sm font-medium transition-all" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Time</label>
                      <input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} className="w-full px-4 py-3 bg-gray-50 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-xl text-sm font-medium transition-all" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3 flex items-center gap-2">
                    <Download className="w-3.5 h-3.5 text-indigo-400" />
                    Attach PDF (Job Description / Resume)
                  </label>
                  <div className="relative group border-2 border-dashed border-gray-200 rounded-3xl p-8 hover:border-indigo-400 hover:bg-indigo-50/10 transition-all text-center flex-1 flex flex-col justify-center cursor-pointer min-h-[200px]">
                    <input 
                      type="file" 
                      accept=".pdf" 
                      onChange={e => setResumeFile(e.target.files[0])} 
                      className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                    />
                    <div className="flex flex-col items-center gap-4">
                      <div className={`p-5 rounded-full transition-all shadow-sm ${resumeFile ? 'bg-emerald-500 text-white' : 'bg-white text-indigo-500 border border-indigo-100'}`}>
                        {resumeFile ? <CheckCircle2 className="w-9 h-9" /> : <Plus className="w-9 h-9" />}
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-sm font-black text-slate-800 max-w-[220px] truncate mx-auto transition-colors">
                          {resumeFile ? resumeFile.name : 'Choose PDF Document'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-loose">
                          {resumeFile ? 'Ready to process' : 'Or drag and drop here'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3 flex justify-between">
                    <span className="flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                      Job Description Text {!resumeFile && <span className="text-red-500">*</span>}
                    </span>
                    <span className="text-[10px] text-slate-400 font-black px-2 py-0.5 bg-slate-50 rounded italic whitespace-nowrap">OPTIONAL IF FILE IS ATTACHED</span>
                  </label>
                  <div className="relative flex-1">
                    <textarea 
                      rows="8" 
                      value={jobDescription} 
                      onChange={e => setJobDescription(e.target.value)} 
                      className="w-full h-full pl-4 pr-4 py-5 bg-gray-50 focus:bg-white border border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-3xl text-sm font-medium transition-all resize-none shadow-sm placeholder:text-slate-300" 
                      placeholder="Paste full job description requirements here if no file is provided..." 
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button type="submit" disabled={isSubmitting} className="w-full bg-[#283086] hover:bg-black text-white px-6 py-5 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-xl">
                  {isSubmitting ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-6 h-6" />
                      <span className="text-lg">Generate Interview Link</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
