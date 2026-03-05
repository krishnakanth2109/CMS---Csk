import { useState, useEffect, useMemo, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import {
  Search, Plus, Eye, Loader2, MessageCircle,
  ArrowUpDown, ArrowUp, ArrowDown, Users, Download,
  X, Edit, Trash2, Ban, List, LayoutGrid, Calendar, 
  GraduationCap, Award, UserCircle, Target, IndianRupee, 
  Upload, FileUp, AlertTriangle, FileSpreadsheet, Linkedin, 
  Building, Mail, Phone, Briefcase, UserPlus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ── ENV Config ────────────────────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_URL = `${BASE_URL}/api`;

const getAuthHeader = () => {
  try {
    const stored = sessionStorage.getItem('currentUser');
    const token = stored ? JSON.parse(stored)?.idToken : null;
    return {
      Authorization: `Bearer ${token || ''}`,
      'Content-Type': 'application/json',
    };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
};

const inputCls = (err) =>
  `w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${err ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'
  } bg-white dark:bg-slate-800`;

// ── StatCard Component ────────────────────────────────────────────────────────
const StatCard = ({ title, value, colorTheme, active, onClick, hasDot }) => {
  const themes = {
    overall: 'bg-blue-600 text-white border-blue-700 dark:bg-blue-700',
    shared: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/60 dark:text-blue-200',
    turnups: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/60 dark:text-purple-200',
    noshow: 'bg-neutral-300 text-black border-neutral-400 dark:bg-neutral-700 dark:text-white',
    yetToAttend: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200',
    selected: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/60 dark:text-green-200',
    joined: 'bg-emerald-200 text-emerald-900 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-200',
    rejected: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/60 dark:text-red-200',
    backout: 'bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-900/60 dark:text-rose-200',
    hold: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/60 dark:text-orange-200',
    pipeline: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/60 dark:text-amber-200',
  };
  const themeClass = themes[colorTheme] || themes.overall;

  return (
    <div onClick={onClick} className={`relative p-4 rounded-xl shadow-sm border transition-all ${themeClass} ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''} ${active ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500' : ''}`}>
      {hasDot && <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-white opacity-80"></span>}
      <h3 className="text-2xl font-bold">{value}</h3>
      <p className="text-sm mt-1 font-medium opacity-90">{title}</p>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const getInitials = (name = '') => name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);
const getCandidateId = (c) => c.candidateId || c._id?.substring(c._id.length - 6).toUpperCase();
const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
const formatSkills = (skills) => !skills ? 'N/A' : Array.isArray(skills) ? skills.slice(0, 3).join(', ') + (skills.length > 3 ? '...' : '') : skills.length > 50 ? skills.substring(0, 50) + '...' : skills;

// ✅ Helper to safely grab the name since some users only have a 'username'
const getRecruiterName = (r) => {
  if (!r) return 'Unassigned';
  if (r.name) return r.name;
  const first = r.firstName || '';
  const last = r.lastName || '';
  if (first || last) return `${first} ${last}`.trim();
  if (r.username) return r.username;
  return r.email || 'Unknown';
};

// ✅ Returns a display label with role indicator for dropdowns
const getRecruiterLabel = (r) => {
  const name = getRecruiterName(r);
  const roleTag = r.role === 'admin' ? ' (Admin)' : r.role === 'manager' ? ' (Manager)' : '';
  return `${name}${roleTag}`;
};

const ALL_STATUSES = [
  'Submitted', 'Shared Profiles', 'Yet to attend', 'Turnups',
  'No Show', 'Selected', 'Joined', 'Rejected', 'Hold', 'Backout', 'Pipeline'
];

const SOURCES = ['LinkedIn', 'Naukri', 'Indeed', 'Portal', 'Referral', 'Other'];

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminCandidates() {
  const { toast } = useToast();

  const [candidates, setCandidates] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsingResume, setIsParsingResume] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [recruiterFilter, setRecruiterFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [activeStatFilter, setActiveStatFilter] = useState(null);
  const [sortConfig, setSortConfig] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  // Bulk Assign States
  const [bulkRecruiterId, setBulkRecruiterId] = useState('');
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [viewCandidate, setViewCandidate] = useState(null);
  const [errors, setErrors] = useState({});

  // Refs for Top and Bottom Scrollbars
  const topScrollRef = useRef(null);
  const bottomScrollRef = useRef(null);

  const handleTopScroll = () => {
    if (bottomScrollRef.current && topScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleBottomScroll = () => {
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
  };

  const initialFormData = {
    firstName: '', lastName: '', contact: '', alternateNumber: '', email: '',
    currentLocation: '', preferredLocation: '', position: '', client: '', currentCompany: '',
    totalExperience: '', relevantExperience: '',
    ctc: '', currentTakeHome: '', ectc: '', expectedTakeHome: '',
    noticePeriod: '', servingNoticePeriod: 'false', lwd: '',
    reasonForChange: '', offersInHand: 'false', offerPackage: '', source: 'Portal',
    recruiterId: '', status: 'Submitted',
    skills: '', remarks: '' 
  };
  const [formData, setFormData] = useState(initialFormData);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeader();
      const [resCand, resRec, resCli] = await Promise.all([
        fetch(`${API_URL}/candidates`, { headers }),
        // ✅ FIX: /api/recruiters now returns ALL active users (admin + manager + recruiter)
        // so every user can be assigned to candidates
        fetch(`${API_URL}/recruiters`, { headers }),
        fetch(`${API_URL}/clients`, { headers }),
      ]);

      if (resCand.ok) {
        const data = await resCand.json();
        setCandidates(data);
      }
      if (resRec.ok) {
        const data = await resRec.json();
        // Sort: admins first, then managers, then recruiters
        const sorted = data.sort((a, b) => {
          const order = { admin: 0, manager: 1, recruiter: 2 };
          return (order[a.role] ?? 3) - (order[b.role] ?? 3);
        });
        setRecruiters(sorted);
      }
      if (resCli.ok) {
        const data = await resCli.json();
        setClients(data);
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Network error.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'File size must be less than 5MB', variant: 'destructive' });
      return;
    }

    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validExtensions = ['.pdf', '.doc', '.docx'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExt)) {
      toast({ title: 'Error', description: 'Invalid file type. Only PDF, DOC, and DOCX are supported.', variant: 'destructive' });
      return;
    }

    setIsParsingResume(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('resume', file);

      const headers = getAuthHeader();
      delete headers['Content-Type']; 

      const res = await fetch(`${API_URL}/candidates/parse-resume`, {
        method: 'POST',
        headers,
        body: uploadFormData,
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Failed to parse resume');
      }

      const { data } = result;

      let fName = '', lName = '';
      if (data.name) {
        const nameParts = data.name.trim().split(' ');
        fName = nameParts[0] || '';
        lName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      }

      setFormData(prev => ({
        ...prev,
        firstName: prev.firstName || fName,
        lastName: prev.lastName || lName,
        email: prev.email || data.email || '',
        contact: prev.contact || data.contact || '',
        skills: prev.skills || data.skills || '',
        totalExperience: prev.totalExperience || data.totalExperience || '',
        currentCompany: prev.currentCompany || data.currentCompany || '',
        currentLocation: prev.currentLocation || data.currentLocation || '',
      }));

      toast({ title: 'Success', description: 'Resume parsed successfully. Fields auto-filled.' });
    } catch (error) {
      console.error('Parsing error:', error);
      toast({ title: 'Warning', description: 'Could not parse some details. Please fill manually.', variant: 'default' });
    } finally {
      setIsParsingResume(false);
      e.target.value = ''; 
    }
  };

  const validateForm = () => {
    const e = {};
    const d = formData;
    if (!d.firstName.trim()) e.firstName = 'First Name required';
    if (!d.lastName.trim()) e.lastName = 'Last Name required';
    if (!d.email.trim()) e.email = 'Email required';
    if (!d.contact.trim()) e.contact = 'Phone required';
    if (!d.position.trim()) e.position = 'Role required';
    if (!d.client.trim()) e.client = 'Client required';
    if (d.servingNoticePeriod === 'true' && !d.lwd) e.lwd = 'LWD required';
    if (d.offersInHand === 'true' && !d.offerPackage) e.offerPackage = 'Enter offer package';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const url = isEditMode ? `${API_URL}/candidates/${selectedCandidateId}` : `${API_URL}/candidates`;
      const method = isEditMode ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        offersInHand: formData.offersInHand === 'true',
        servingNoticePeriod: formData.servingNoticePeriod === 'true',
      };

      const res = await fetch(url, {
        method, headers: getAuthHeader(), body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());
      toast({ title: 'Success', description: `Candidate ${isEditMode ? 'updated' : 'added'}` });
      setIsDialogOpen(false);
      fetchData();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this candidate?')) return;
    try {
      await fetch(`${API_URL}/candidates/${id}`, { method: 'DELETE', headers: getAuthHeader() });
      toast({ title: 'Deleted', description: 'Candidate removed' });
      fetchData();
    } catch (err) {
      toast({ title: 'Error', description: 'Delete failed', variant: 'destructive' });
    }
  };

  const openAddDialog = () => {
    setIsEditMode(false);
    setSelectedCandidateId(null);
    setFormData(initialFormData);
    setErrors({});
    setIsDialogOpen(true);
  };

  const openEditDialog = (c) => {
    setIsEditMode(true);
    setSelectedCandidateId(c._id);
    setFormData({
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      contact: c.contact || '',
      alternateNumber: c.alternateNumber || '',
      email: c.email || '',
      currentLocation: c.currentLocation || '',
      preferredLocation: c.preferredLocation || '',
      position: c.position || '',
      client: c.client || '',
      currentCompany: c.currentCompany || '',
      totalExperience: c.totalExperience || '',
      relevantExperience: c.relevantExperience || '',
      ctc: c.ctc || '',
      currentTakeHome: c.currentTakeHome || '',
      ectc: c.ectc || '',
      expectedTakeHome: c.expectedTakeHome || '',
      noticePeriod: c.noticePeriod || '',
      servingNoticePeriod: c.servingNoticePeriod ? 'true' : 'false',
      lwd: c.lwd ? new Date(c.lwd).toISOString().split('T')[0] : '',
      reasonForChange: c.reasonForChange || '',
      offersInHand: c.offersInHand ? 'true' : 'false',
      offerPackage: c.offerPackage || '',
      source: c.source || 'Portal',
      status: Array.isArray(c.status) ? c.status[0] : c.status || 'Submitted',
      recruiterId: typeof c.recruiterId === 'object' ? c.recruiterId?._id : c.recruiterId || '',
      skills: Array.isArray(c.skills) ? c.skills.join(', ') : c.skills || '',
      remarks: c.remarks || ''
    });
    setErrors({});
    setIsDialogOpen(true);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ field }) => {
    if (!sortConfig || sortConfig.key !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 text-blue-500" /> : <ArrowDown className="h-3 w-3 ml-1 text-blue-500" />;
  };

  const filteredCandidates = useMemo(() => {
    let result = candidates.filter((c) => {
      const matchSearch = (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.candidateId || '').toLowerCase().includes(searchTerm.toLowerCase());

      const statusArr = Array.isArray(c.status) ? c.status : [c.status || ''];
      const matchStatus = statusFilter === 'all' || statusArr.includes(statusFilter);

      const recId = typeof c.recruiterId === 'object' ? c.recruiterId?._id : c.recruiterId;
      const matchRec = recruiterFilter === 'all' || recId === recruiterFilter;

      const matchClient = clientFilter === 'all' || c.client === clientFilter;

      const statMatch = activeStatFilter ? statusArr.includes(activeStatFilter) : true;

      return matchSearch && matchStatus && matchRec && matchClient && statMatch;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        const av = a[sortConfig.key] || '';
        const bv = b[sortConfig.key] || '';
        if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
        if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [candidates, searchTerm, statusFilter, recruiterFilter, clientFilter, activeStatFilter, sortConfig]);

  const stats = useMemo(() => {
    const count = (s) => candidates.filter((c) => (Array.isArray(c.status) ? c.status : [c.status || '']).includes(s)).length;
    return {
      total: candidates.length, turnups: count('Turnups'), noShow: count('No Show'), yetToAttend: count('Yet to attend'),
      selected: count('Selected'), rejected: count('Rejected'), hold: count('Hold'), pipeline: count('Pipeline'),
      joined: count('Joined'), backout: count('Backout'), sharedProfiles: count('Shared Profiles'),
    };
  }, [candidates]);

  // ── Export functionality ──────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (filteredCandidates.length === 0) {
      toast({ title: 'No Data', description: 'No candidates available to export.', variant: 'destructive' });
      return;
    }

    const headers = [
      'Candidate ID', 'First Name', 'Last Name', 'Full Name', 'Email', 'Contact', 'Alternate Contact',
      'Role/Position', 'Client', 'Assigned Recruiter', 'Status', 'Current Location', 'Preferred Location',
      'Total Experience', 'Relevant Experience', 'Current Company', 'Reason For Change',
      'Current CTC', 'Current Take Home', 'Expected CTC', 'Expected Take Home',
      'Notice Period', 'Serving Notice', 'LWD', 'Offers In Hand', 'Offer Package', 'Source', 'Skills'
    ];

    const csvRows = [headers.join(',')];

    filteredCandidates.forEach(c => {
      const recruiterName = typeof c.recruiterId === 'object'
        ? getRecruiterName(c.recruiterId)
        : c.recruiterName || '';

      const statusStr = Array.isArray(c.status) ? c.status.join(' | ') : (c.status || '');
      const skillsStr = Array.isArray(c.skills) ? c.skills.join(' | ') : (c.skills || '');

      const rowData = [
        getCandidateId(c), c.firstName || '', c.lastName || '', c.name || '', c.email || '',
        c.contact || '', c.alternateNumber || '', c.position || '', c.client || '',
        recruiterName, statusStr, c.currentLocation || '', c.preferredLocation || '',
        c.totalExperience || '', c.relevantExperience || '', c.currentCompany || '', c.reasonForChange || '',
        c.ctc || '', c.currentTakeHome || '', c.ectc || '', c.expectedTakeHome || '',
        c.noticePeriod || '', c.servingNoticePeriod ? 'Yes' : 'No',
        c.lwd ? new Date(c.lwd).toLocaleDateString() : '', c.offersInHand ? 'Yes' : 'No',
        c.offerPackage || '', c.source || '', skillsStr
      ].map(val => {
        const stringVal = String(val).replace(/"/g, '""');
        return `"${stringVal}"`;
      });

      csvRows.push(rowData.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Candidates_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Bulk Selection Helpers ──────────────────────────────────────────────────
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredCandidates.map(c => c._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (e, id) => {
    if (e.target.checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkRecruiterId) {
      toast({ title: 'Error', description: 'Please select a recruiter first', variant: 'destructive' });
      return;
    }
    setIsBulkAssigning(true);
    try {
      const res = await fetch(`${API_URL}/candidates/bulk-assign`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify({
          candidateIds: selectedIds,
          recruiterId: bulkRecruiterId
        })
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      toast({ title: 'Success', description: data.message || `Successfully assigned ${selectedIds.length} candidates` });
      setSelectedIds([]);
      setBulkRecruiterId('');
      fetchData();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to assign candidates', variant: 'destructive' });
    } finally {
      setIsBulkAssigning(false);
    }
  };

  const handleWhatsApp = (c) => {
    if (!c.contact) return;
    let phone = c.contact.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;
    const msg = `Hi ${c.firstName || c.name.split(' ')[0]}, regarding your application for ${c.position} at ${c.client}.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="flex-1 p-6 pb-48 overflow-y-auto bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-[1800px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Candidate Database</h1>
            <p className="text-slate-500 mt-1">Manage and track pipeline across all sources</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-slate-900 transition shadow-sm">
              <Download className="h-4 w-4" /> Export Excel
            </button>
            <button onClick={openAddDialog} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm">
              <Plus className="h-4 w-4" /> Add Candidate
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Overall Candidates" value={stats.total} colorTheme="overall" hasDot={true} active={activeStatFilter === null} onClick={() => { setActiveStatFilter(null); setStatusFilter('all'); }} />
          <StatCard title="Turnups" value={stats.turnups} colorTheme="turnups" active={activeStatFilter === 'Turnups'} onClick={() => { setActiveStatFilter('Turnups'); setStatusFilter('all'); }} />
          <StatCard title="No Show" value={stats.noShow} colorTheme="noshow" active={activeStatFilter === 'No Show'} onClick={() => { setActiveStatFilter('No Show'); setStatusFilter('all'); }} />
          <StatCard title="Yet to attend" value={stats.yetToAttend} colorTheme="yetToAttend" active={activeStatFilter === 'Yet to attend'} onClick={() => { setActiveStatFilter('Yet to attend'); setStatusFilter('all'); }} />
          <StatCard title="Selected" value={stats.selected} colorTheme="selected" active={activeStatFilter === 'Selected'} onClick={() => { setActiveStatFilter('Selected'); setStatusFilter('all'); }} />
          <StatCard title="Rejected" value={stats.rejected} colorTheme="rejected" active={activeStatFilter === 'Rejected'} onClick={() => { setActiveStatFilter('Rejected'); setStatusFilter('all'); }} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-2">
          <StatCard title="Hold" value={stats.hold} colorTheme="hold" active={activeStatFilter === 'Hold'} onClick={() => { setActiveStatFilter('Hold'); setStatusFilter('all'); }} />
          <StatCard title="Pipeline" value={stats.pipeline} colorTheme="pipeline" active={activeStatFilter === 'Pipeline'} onClick={() => { setActiveStatFilter('Pipeline'); setStatusFilter('all'); }} />
          <StatCard title="Joined" value={stats.joined} colorTheme="joined" active={activeStatFilter === 'Joined'} onClick={() => { setActiveStatFilter('Joined'); setStatusFilter('all'); }} />
          <StatCard title="Backout" value={stats.backout} colorTheme="backout" active={activeStatFilter === 'Backout'} onClick={() => { setActiveStatFilter('Backout'); setStatusFilter('all'); }} />
          <StatCard title="Shared Profiles" value={stats.sharedProfiles} colorTheme="shared" active={activeStatFilter === 'Shared Profiles'} onClick={() => { setActiveStatFilter('Shared Profiles'); setStatusFilter('all'); }} />
        </div>

        {/* Filters */}
        <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white shadow-sm flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search name, email, ID..." className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full md:w-auto">
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
              <option value="all">All Clients</option>
              {clients.map((c) => <option key={c._id || c.id} value={c.companyName || c.name}>{c.companyName || c.name}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
              <option value="all">All Status</option>
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={recruiterFilter} onChange={(e) => setRecruiterFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
              <option value="all">All Users</option>
              {recruiters.map((r) => <option key={r._id || r.id} value={r._id || r.id}>{getRecruiterLabel(r)}</option>)}
            </select>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-4 flex-wrap animate-in fade-in slide-in-from-top-2">
            <span className="text-sm font-semibold text-blue-800 bg-blue-100 px-3 py-1 rounded-full">
              {selectedIds.length} Selected
            </span>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <select
                value={bulkRecruiterId}
                onChange={(e) => setBulkRecruiterId(e.target.value)}
                className="border border-blue-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[200px]"
              >
                <option value="">Assign to User...</option>
                {recruiters.map((r) => (
                  <option key={r._id || r.id} value={r._id || r.id}>
                    {getRecruiterLabel(r)}
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkAssign}
                disabled={!bulkRecruiterId || isBulkAssigning}
                className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {isBulkAssigning && <Loader2 className="h-3 w-3 animate-spin" />}
                Assign Candidates
              </button>
            </div>
            <button
              onClick={() => setSelectedIds([])}
              className="ml-auto text-sm text-slate-500 hover:text-slate-800 font-medium px-2 py-1"
            >
              Clear Selection
            </button>
          </div>
        )}

        {/* Table Area With Double Horizontal Scroll Bar */}
        <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white flex flex-col">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
          ) : (
            <>
              {/* TOP SCROLLBAR */}
              <div 
                ref={topScrollRef} 
                onScroll={handleTopScroll} 
                className="overflow-x-auto overflow-y-hidden"
                style={{ height: '14px' }}
              >
                <div style={{ width: '1800px', height: '1px' }}></div>
              </div>

              {/* TABLE CONTAINER */}
              <div ref={bottomScrollRef} onScroll={handleBottomScroll} className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse min-w-[1800px]">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0}
                          onChange={handleSelectAll}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('candidateId')}>ID <SortIcon field="candidateId" /></th>
                      <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('name')}>Name <SortIcon field="name" /></th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Skills</th>
                      <th className="px-4 py-3">Date Added</th>
                      <th className="px-4 py-3">Assigned To</th>
                      <th className="px-4 py-3">Experience</th>
                      <th className="px-4 py-3">CTC / ECTC</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Remarks</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCandidates.map((c) => {
                      const statusArr = Array.isArray(c.status) ? c.status : [c.status || 'Submitted'];
                      const isSelected = selectedIds.includes(c._id);
                      return (
                        <tr key={c._id} className={`transition-colors ${isSelected ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'}`}>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleSelectOne(e, c._id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-blue-600 font-bold cursor-pointer" onClick={() => { navigator.clipboard.writeText(getCandidateId(c)); toast({ title: "Copied ID" }); }}>{getCandidateId(c)}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{c.name}</td>
                          <td className="px-4 py-3 text-slate-600">
                            <div className="flex items-center gap-2">
                              {c.contact || '-'}
                              {c.contact && <MessageCircle className="h-3.5 w-3.5 text-green-500 cursor-pointer" onClick={() => handleWhatsApp(c)} />}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500"><span className="truncate max-w-[150px] block" title={c.email}>{c.email || '-'}</span></td>
                          <td className="px-4 py-3 text-slate-600 font-medium">{c.client || '-'}</td>
                          <td className="px-4 py-3 text-xs text-slate-500 max-w-[150px] truncate" title={Array.isArray(c.skills) ? c.skills.join(', ') : c.skills}>
                            {!c.skills ? 'N/A' : Array.isArray(c.skills) ? c.skills.slice(0, 3).join(', ') + (c.skills.length > 3 ? '...' : '') : c.skills.length > 50 ? c.skills.substring(0, 50) + '...' : c.skills}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{c.dateAdded ? new Date(c.dateAdded).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : (c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-')}</td>
                          {/* ✅ USING getRecruiterName HELPER HERE */}
                          <td className="px-4 py-3 text-sm font-medium text-slate-700">
                             {typeof c.recruiterId === 'object' ? getRecruiterName(c.recruiterId) : c.recruiterName || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">{c.totalExperience ? `${c.totalExperience} Yrs` : '-'}</td>
                          <td className="px-4 py-3 text-xs"><div>{c.ctc || '-'}</div><div className="text-green-600">{c.ectc || '-'}</div></td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {statusArr.map((s) => (
                                <span key={s} className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 mr-1">{s}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-[100px]">{c.remarks || '-'}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end items-center gap-2">
                              <Eye className="h-4 w-4 text-blue-600 cursor-pointer" onClick={() => setViewCandidate(c) || setIsViewDialogOpen(true)} />
                              <Edit className="h-4 w-4 text-slate-600 cursor-pointer" onClick={() => openEditDialog(c)} />
                              <Trash2 className="h-4 w-4 text-red-500 cursor-pointer" onClick={() => handleDelete(c._id)} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredCandidates.length === 0 && !loading && (
                  <div className="text-center py-12 text-slate-500">No candidates match your search filters.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Add / Edit Full Screen Dialog ──────────────────────────────────── */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{isEditMode ? 'Edit Candidate' : 'Add New Candidate'}</h2>
                <p className="text-sm text-slate-500 mt-0.5">Fill out all the details required for the candidate profile.</p>
              </div>
              <button onClick={() => setIsDialogOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xl px-2">×</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-8 pb-48">
              {!isEditMode && (
                <section>
                  <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Upload Resume (Auto Fill)</h3>
                  <div className="border-2 border-dashed border-blue-200 rounded-xl p-6 flex flex-col items-center justify-center bg-blue-50/50 hover:bg-blue-50 transition-colors">
                    {isParsingResume ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
                        <p className="text-sm text-blue-800 font-medium">Parsing resume details...</p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-white p-3 rounded-full mb-3 shadow-sm border border-blue-100">
                          <Plus className="h-6 w-6 text-blue-600" />
                        </div>
                        <p className="text-sm text-slate-600 mb-4 text-center">
                          Upload a CV to automatically fill candidate details.<br />
                          <span className="text-xs text-slate-400">Supported: PDF, DOC, DOCX (Max 5MB)</span>
                        </p>
                        <input
                          type="file"
                          id="resume-upload"
                          className="hidden"
                          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          onChange={handleResumeUpload}
                        />
                        <label
                          htmlFor="resume-upload"
                          className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 cursor-pointer transition shadow-sm"
                        >
                          Browse Files
                        </label>
                      </>
                    )}
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">First Name *</label>
                    <input type="text" value={formData.firstName} onChange={(e) => handleInputChange('firstName', e.target.value)} className={inputCls(errors.firstName)} />
                    {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Last Name *</label>
                    <input type="text" value={formData.lastName} onChange={(e) => handleInputChange('lastName', e.target.value)} className={inputCls(errors.lastName)} />
                    {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Contact Number *</label>
                    <input type="text" value={formData.contact} onChange={(e) => handleInputChange('contact', e.target.value)} className={inputCls(errors.contact)} />
                    {errors.contact && <p className="text-xs text-red-500 mt-1">{errors.contact}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Alternate Number</label>
                    <input type="text" value={formData.alternateNumber} onChange={(e) => handleInputChange('alternateNumber', e.target.value)} className={inputCls(false)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-slate-700">Email Address *</label>
                    <input type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} className={inputCls(errors.email)} />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Current Location</label>
                    <input type="text" value={formData.currentLocation} onChange={(e) => handleInputChange('currentLocation', e.target.value)} className={inputCls(false)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Preferred Location</label>
                    <input type="text" value={formData.preferredLocation} onChange={(e) => handleInputChange('preferredLocation', e.target.value)} className={inputCls(false)} />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Professional Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Role (Position) *</label>
                    <input type="text" value={formData.position} onChange={(e) => handleInputChange('position', e.target.value)} className={inputCls(errors.position)} />
                    {errors.position && <p className="text-xs text-red-500 mt-1">{errors.position}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Client / Target Company *</label>
                    <select value={formData.client} onChange={(e) => handleInputChange('client', e.target.value)} className={inputCls(errors.client)}>
                      <option value="">Select Client</option>
                      {clients.map(c => (
                        <option key={c._id} value={c.companyName || c.name}>{c.companyName || c.name}</option>
                      ))}
                    </select>
                    {errors.client && <p className="text-xs text-red-500 mt-1">{errors.client}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Current Company</label>
                    <input type="text" value={formData.currentCompany} onChange={(e) => handleInputChange('currentCompany', e.target.value)} className={inputCls(false)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Reason for Change</label>
                    <input type="text" value={formData.reasonForChange} onChange={(e) => handleInputChange('reasonForChange', e.target.value)} className={inputCls(false)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Total Experience (Years)</label>
                    <input type="text" value={formData.totalExperience} onChange={(e) => handleInputChange('totalExperience', e.target.value)} className={inputCls(false)} placeholder="e.g. 5" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Relevant Experience (Years)</label>
                    <input type="text" value={formData.relevantExperience} onChange={(e) => handleInputChange('relevantExperience', e.target.value)} className={inputCls(false)} placeholder="e.g. 3" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-slate-700">Skills (Comma Separated)</label>
                    <input type="text" value={formData.skills} onChange={(e) => handleInputChange('skills', e.target.value)} className={inputCls(false)} placeholder="React, Node, Python..." />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Financial & Availability</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="w-full sm:w-1/2">
                      <label className="block text-sm font-medium mb-1 text-slate-700">Current CTC</label>
                      <input type="text" value={formData.ctc} onChange={(e) => handleInputChange('ctc', e.target.value)} className={inputCls(false)} placeholder="e.g. 10 LPA" />
                    </div>
                    <div className="w-full sm:w-1/2">
                      <label className="block text-sm font-medium mb-1 text-slate-700">Current Take Home</label>
                      <input type="text" value={formData.currentTakeHome} onChange={(e) => handleInputChange('currentTakeHome', e.target.value)} className={inputCls(false)} placeholder="e.g. 60k/mo" />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="w-full sm:w-1/2">
                      <label className="block text-sm font-medium mb-1 text-slate-700">Expected CTC</label>
                      <input type="text" value={formData.ectc} onChange={(e) => handleInputChange('ectc', e.target.value)} className={inputCls(false)} placeholder="e.g. 15 LPA" />
                    </div>
                    <div className="w-full sm:w-1/2">
                      <label className="block text-sm font-medium mb-1 text-slate-700">Expected Take Home</label>
                      <input type="text" value={formData.expectedTakeHome} onChange={(e) => handleInputChange('expectedTakeHome', e.target.value)} className={inputCls(false)} placeholder="e.g. 90k/mo" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Notice Period (N/P)</label>
                    <input type="text" value={formData.noticePeriod} onChange={(e) => handleInputChange('noticePeriod', e.target.value)} className={inputCls(false)} placeholder="e.g. 30 Days" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Serving Notice Period?</label>
                    <select value={formData.servingNoticePeriod} onChange={(e) => handleInputChange('servingNoticePeriod', e.target.value)} className={inputCls(false)}>
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </div>

                  {formData.servingNoticePeriod === 'true' && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">LWD (Last Working Day) *</label>
                      <input type="date" value={formData.lwd} onChange={(e) => handleInputChange('lwd', e.target.value)} className={inputCls(errors.lwd)} />
                      {errors.lwd && <p className="text-xs text-red-500 mt-1">{errors.lwd}</p>}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Offer in Hand?</label>
                    <select value={formData.offersInHand} onChange={(e) => handleInputChange('offersInHand', e.target.value)} className={inputCls(false)}>
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </div>

                  {formData.offersInHand === 'true' && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-slate-700">Package in Hand *</label>
                      <input type="text" value={formData.offerPackage} onChange={(e) => handleInputChange('offerPackage', e.target.value)} className={inputCls(errors.offerPackage)} placeholder="e.g. 15 LPA" />
                      {errors.offerPackage && <p className="text-xs text-red-500 mt-1">{errors.offerPackage}</p>}
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Tracking & Assignment</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Source</label>
                    <select value={formData.source} onChange={(e) => handleInputChange('source', e.target.value)} className={inputCls(false)}>
                      {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Status</label>
                    <select value={formData.status} onChange={(e) => handleInputChange('status', e.target.value)} className={inputCls(false)}>
                      {ALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-slate-700">Assign to User</label>
                    <select value={formData.recruiterId} onChange={(e) => handleInputChange('recruiterId', e.target.value)} className={inputCls(false)}>
                      <option value="">Select User</option>
                      {recruiters.map((r) => <option key={r._id || r.id} value={r._id || r.id}>{getRecruiterLabel(r)}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-slate-700">Remarks</label>
                    <Textarea value={formData.remarks} onChange={(e) => handleInputChange('remarks', e.target.value)} className={inputCls(false)} placeholder="Add any comments or remarks here..." rows={3} />
                  </div>
                </div>
              </section>

            </div>

            <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsDialogOpen(false)} className="px-5 py-2.5 border border-slate-300 bg-white rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition">Cancel</button>
              <button onClick={handleSubmit} disabled={isSubmitting} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Saving...' : isEditMode ? 'Update Profile' : 'Save Candidate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Full Details Dialog ────────────────────────────────────────── */}
      {isViewDialogOpen && viewCandidate && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{viewCandidate.name}</h2>
                <p className="text-sm font-mono text-blue-600 mt-1">{getCandidateId(viewCandidate)}</p>
              </div>
              <button onClick={() => setIsViewDialogOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold leading-none px-2">×</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['First Name', viewCandidate.firstName],
                  ['Last Name', viewCandidate.lastName],
                  ['Email', viewCandidate.email],
                  ['Contact', viewCandidate.contact],
                  ['Alt Contact', viewCandidate.alternateNumber],
                  ['Role', viewCandidate.position],
                  ['Client', viewCandidate.client],
                  ['Current Company', viewCandidate.currentCompany],
                  ['Current Location', viewCandidate.currentLocation],
                  ['Preferred Location', viewCandidate.preferredLocation],
                  ['Total Exp', viewCandidate.totalExperience ? `${viewCandidate.totalExperience} Yrs` : null],
                  ['Relevant Exp', viewCandidate.relevantExperience ? `${viewCandidate.relevantExperience} Yrs` : null],
                  ['Current CTC', viewCandidate.ctc],
                  ['Current Take Home', viewCandidate.currentTakeHome],
                  ['Expected CTC', viewCandidate.ectc],
                  ['Expected Take Home', viewCandidate.expectedTakeHome],
                  ['Notice Period', viewCandidate.noticePeriod],
                  ['Serving Notice?', viewCandidate.servingNoticePeriod ? 'Yes' : 'No'],
                  ['LWD', viewCandidate.lwd ? new Date(viewCandidate.lwd).toLocaleDateString() : null],
                  ['Reason for Change', viewCandidate.reasonForChange],
                  ['Offers in Hand', viewCandidate.offersInHand ? `Yes (${viewCandidate.offerPackage})` : 'No'],
                  ['Source', viewCandidate.source],
                  // ✅ USING getRecruiterName HELPER HERE
                  ['Assigned Recruiter', typeof viewCandidate.recruiterId === 'object' ? getRecruiterName(viewCandidate.recruiterId) : viewCandidate.recruiterName],
                  ['Status', Array.isArray(viewCandidate.status) ? viewCandidate.status.join(', ') : viewCandidate.status],
                  ['Remarks', viewCandidate.remarks]
                ].map(([label, val]) => val ? (
                  <div key={label} className="col-span-2 md:col-span-1 border-b border-slate-100 pb-2">
                    <span className="block text-xs font-semibold text-slate-500 uppercase mb-1">{label}</span>
                    <span className="text-slate-900 font-medium">{val}</span>
                  </div>
                ) : null)}
              </div>
            </div>
            <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => { setIsViewDialogOpen(false); openEditDialog(viewCandidate); }} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Edit Details</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}