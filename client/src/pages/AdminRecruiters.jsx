import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, UserPlus, Search, Mail, Phone, TrendingUp,
  Download, Grid3X3, List, Edit, Trash2, UserX, UserCheck,
  Camera, Briefcase, MoreVertical, Users, Eye, EyeOff, ArrowUpDown, ShieldAlert
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

// ── ENV ───────────────────────────────────────────────────────────────────────
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = `${BASE_URL}/api`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const getInitials = (fName = '', lName = '') =>
  `${fName.charAt(0)}${lName.charAt(0)}`.toUpperCase();

// ═════════════════════════════════════════════════════════════════════════════
export default function AdminRecruiters() {
  const navigate = useNavigate();
  const { authHeaders } = useAuth();

  // ── Auth helper ──────────────────────────────────────────────────────────
  const getAuthHeader = async () => {
    const ah = await authHeaders();   // ← await the async authHeaders()
    return {
      'Content-Type': 'application/json',
      ...ah,                          // ← spreads { Authorization: 'Bearer <token>' }
    };
  };

  // ── Data ──────────────────────────────────────────────────────────────────
  const [recruiters,  setRecruiters]  = useState([]);
  const [candidates,  setCandidates]  = useState([]);
  const [isLoading,   setIsLoading]   = useState(true);

  // ── UI State ──────────────────────────────────────────────────────────────
  const [searchTerm,  setSearchTerm]  = useState("");
  const [viewMode,    setViewMode]    = useState("grid");
  const [sortField,   setSortField]   = useState("name");
  const [sortOrder,   setSortOrder]   = useState("asc");

  // ── Modals ────────────────────────────────────────────────────────────────
  const [showModal,            setShowModal]            = useState(false);
  const [showEditModal,        setShowEditModal]        = useState(false);
  const [showDeleteModal,      setShowDeleteModal]      = useState(false);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [showStatsModal,       setShowStatsModal]       = useState(false);
  const [showCandidatesModal,  setShowCandidatesModal]  = useState(false);

  const [selectedStatsRecruiters, setSelectedStatsRecruiters] = useState([]);
  const [statsModalTitle,         setStatsModalTitle]         = useState("");
  const [candidatesModalTitle,    setCandidatesModalTitle]    = useState("");
  const [candidateFilterType,     setCandidateFilterType]     = useState(null);
  const [selectedRecruiter,       setSelectedRecruiter]       = useState(null);
  const [recruiterToDelete,       setRecruiterToDelete]       = useState(null);
  const [recruiterToToggle,       setRecruiterToToggle]       = useState(null);
  const [showDeactivateModal,     setShowDeactivateModal]     = useState(false);

  const fileInputRef     = useRef(null);
  const editFileInputRef = useRef(null);

  // ── Password visibility ───────────────────────────────────────────────────
  const [showPassword,     setShowPassword]     = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // ── Errors ────────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState({});

  // ── Success Banner ────────────────────────────────────────────────────────
  const [successBanner, setSuccessBanner] = useState({ show: false, message: '' });
  const showSuccess = (message) => {
    setSuccessBanner({ show: true, message });
    setTimeout(() => setSuccessBanner({ show: false, message: '' }), 4000);
  };

  // ── Form State ────────────────────────────────────────────────────────────
  const EMPTY_RECRUITER = {
    recruiterId: "", firstName: "", lastName: "", email: "", phone: "",
    username: "", password: "", profilePicture: "", role: "recruiter",
  };

  const [newRecruiter,  setNewRecruiter]  = useState(EMPTY_RECRUITER);
  const [editRecruiter, setEditRecruiter] = useState({ id: "", ...EMPTY_RECRUITER });

  // ── Performance ───────────────────────────────────────────────────────────
  const [startDate,       setStartDate]       = useState("");
  const [endDate,         setEndDate]         = useState("");
  const [performanceData, setPerformanceData] = useState([]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const headers = await getAuthHeader();
      const [rr, rc] = await Promise.all([
        fetch(`${API_URL}/recruiters`, { headers }),
        fetch(`${API_URL}/candidates`, { headers }),
      ]);

      if (!rr.ok) { const e = await rr.json().catch(() => ({})); throw new Error(e.message || 'Failed to fetch users'); }
      if (!rc.ok) { const e = await rc.json().catch(() => ({})); throw new Error(e.message || 'Failed to fetch candidates'); }

      const recruiterData = await rr.json();
      const candidateData = await rc.json();

      const allUsers = recruiterData
        .filter((user) => ['recruiter', 'admin'].includes(user.role))
        .map((r) => ({ ...r, id: r._id }));

      setRecruiters(allUsers);
      setCandidates(candidateData.map((c) => ({ ...c, id: c._id })));
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  const validateForm = (data, isEdit = false) => {
    const e = {};
    const nameRegex = /^[A-Za-z\s\-'.]+$/;

    // First Name
    if (!data.firstName.trim())
      e.firstName = "First name is required";
    else if (!nameRegex.test(data.firstName.trim()))
      e.firstName = "First name must contain letters only";
    else if (data.firstName.trim().length < 2)
      e.firstName = "First name must be at least 2 characters";

    // Last Name
    if (!data.lastName.trim())
      e.lastName = "Last name is required";
    else if (!nameRegex.test(data.lastName.trim()))
      e.lastName = "Last name must contain letters only";
    else if (data.lastName.trim().length < 2)
      e.lastName = "Last name must be at least 2 characters";

    // Email
    if (!data.email.trim())
      e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
      e.email = "Enter a valid email address";

    // Phone (optional but must be 10 digits if filled)
    if (data.phone && !/^[6-9]\d{9}$/.test(data.phone))
      e.phone = "Enter a valid 10-digit mobile number";

    // Username (optional but letters only if filled)
    if (data.username && data.username.trim()) {
      if (/[^A-Za-z]/.test(data.username.trim()))
        e.username = "Username must contain letters only";
      else if (data.username.trim().length < 2)
        e.username = "Username must be at least 2 characters";
    }

    // Password
    if (!isEdit && !data.password)
      e.password = "Password is required";
    else if (data.password && data.password.length < 6)
      e.password = "Password must be at least 6 characters";

    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleInputChange = (field, value, isEdit) => {
    // Block digits + special chars in name fields — letters, spaces, hyphens, apostrophes only
    if ((field === 'firstName' || field === 'lastName') && value && /[^A-Za-z\s\-'.]/.test(value)) return;

    // Username: letters only — no digits, no special characters
    if (field === 'username' && value && /[^A-Za-z]/.test(value)) return;

    // Phone: digits only, max 10
    if (field === 'phone' && value && !/^\d*$/.test(value)) return;
    if (field === 'phone' && value.length > 10) return;

    if (errors[field]) setErrors((p) => { const n = { ...p }; delete n[field]; return n; });

    if (isEdit) setEditRecruiter((p) => ({ ...p, [field]: value }));
    else        setNewRecruiter((p)  => ({ ...p, [field]: value }));
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleAddRecruiter = async () => {
    if (!validateForm(newRecruiter)) return;
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/recruiters`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newRecruiter), // role is dynamic from form
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create user');

      const addedName = `${newRecruiter.firstName} ${newRecruiter.lastName}`;
      const addedRole = newRecruiter.role;
      // Update local state directly — no full refetch needed
      setRecruiters(prev => [...prev, { ...data, id: data._id }]);
      setShowModal(false);
      setNewRecruiter(EMPTY_RECRUITER);
      setErrors({});
      showSuccess(`✅ ${addedName} has been added successfully as ${addedRole}.`);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEditRecruiter = async () => {
    if (!validateForm(editRecruiter, true)) return;
    try {
      const headers = await getAuthHeader();
      const payload = { ...editRecruiter };
      if (!payload.password) delete payload.password; // Don't send blank password

      const res = await fetch(`${API_URL}/recruiters/${editRecruiter.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update user');

      const editedName = `${editRecruiter.firstName} ${editRecruiter.lastName}`;
      // Update local state directly
      setRecruiters(prev => prev.map(r => r.id === editRecruiter.id ? { ...r, ...data, id: data._id || r.id } : r));
      setShowEditModal(false);
      setErrors({});
      showSuccess(`✅ ${editedName}'s profile has been updated successfully.`);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteRecruiter = async () => {
    if (!recruiterToDelete) return;
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/recruiters/${recruiterToDelete.id}`, {
        method: 'DELETE', headers,
      });
      if (!res.ok) throw new Error('Failed to delete user');

      const deletedName = `${recruiterToDelete.firstName} ${recruiterToDelete.lastName}`;
      // Remove from local state directly
      setRecruiters(prev => prev.filter(r => r.id !== recruiterToDelete.id));
      setShowDeleteModal(false);
      setRecruiterToDelete(null);
      showSuccess(`🗑️ ${deletedName} has been permanently deleted.`);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleStatus = async () => {
    if (!recruiterToToggle) return;
    const wasActive = isActive(recruiterToToggle);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/recruiters/${recruiterToToggle.id}/status`, {
        method: 'PATCH', headers,
      });
      if (!res.ok) throw new Error('Failed to update status');
      const toggledName = `${recruiterToToggle.firstName} ${recruiterToToggle.lastName}`;
      // Toggle active in local state directly
      setRecruiters(prev => prev.map(r => r.id === recruiterToToggle.id ? { ...r, active: !wasActive } : r));
      setShowDeactivateModal(false);
      setRecruiterToToggle(null);
      showSuccess(wasActive
        ? `🔴 ${toggledName} has been deactivated.`
        : `🟢 ${toggledName} has been activated.`);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // ── Modal openers ─────────────────────────────────────────────────────────
  const openEditModal = (r) => {
    setEditRecruiter({
      id: r.id, recruiterId: r.recruiterId || "",
      firstName: r.firstName, lastName: r.lastName,
      email: r.email, phone: r.phone || "", username: r.username || "",
      profilePicture: r.profilePicture || "", role: r.role || "recruiter", password: "",
    });
    setErrors({});
    setShowEditModal(true);
  };

  // ── Profile Picture ───────────────────────────────────────────────────────
  const handleFileUpload = (e, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (isEdit) setEditRecruiter((p) => ({ ...p, profilePicture: result }));
      else        setNewRecruiter((p)  => ({ ...p, profilePicture: result }));
    };
    reader.readAsDataURL(file);
  };

  // ── Pre-computed stats map — runs ONCE when candidates change, not on every sort ──
  // Old calcStats was called inside .sort() = O(n²) candidate scans per render
  const statsMap = useMemo(() => {
    const map = {};
    candidates.forEach(c => {
      const rid = typeof c.recruiterId === 'object' ? c.recruiterId?._id : c.recruiterId;
      if (!rid) return;
      if (!map[rid]) map[rid] = { total: 0, joined: 0, selected: 0, rejected: 0, turnups: 0, noShow: 0 };
      const sa = Array.isArray(c.status) ? c.status : [c.status || ''];
      map[rid].total++;
      if (sa.includes('Joined'))   map[rid].joined++;
      if (sa.includes('Selected')) map[rid].selected++;
      if (sa.includes('Rejected')) map[rid].rejected++;
      if (sa.includes('Turnups'))  map[rid].turnups++;
      if (sa.includes('No Show'))  map[rid].noShow++;
    });
    return map;
  }, [candidates]);

  const calcStats = useCallback((recruiterId) => {
    return statsMap[recruiterId] || { total: 0, joined: 0, selected: 0, rejected: 0, turnups: 0, noShow: 0 };
  }, [statsMap]);

  // ── Sort / Filter — memoized so it only recalculates when deps change ────────
  const toggleSort = (field) => {
    if (sortField === field) setSortOrder((o) => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const SortIcon = ({ field }) =>
    sortField !== field
      ? <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
      : <span className="ml-1 text-blue-500">{sortOrder === 'asc' ? '↑' : '↓'}</span>;

  const filteredRecruiters = useMemo(() => recruiters
    .filter((r) => {
      const q        = searchTerm.toLowerCase();
      const fullName = `${r.firstName || ''} ${r.lastName || ''}`.toLowerCase();
      return fullName.includes(q) ||
             (r.email      || '').toLowerCase().includes(q) ||
             (r.username   || '').toLowerCase().includes(q) ||
             (r.recruiterId || '').toLowerCase().includes(q) ||
             (r.role       || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const sa = calcStats(a.id), sb = calcStats(b.id);
      let av = '', bv = '';
      switch (sortField) {
        case 'name':     av = a.firstName;  bv = b.firstName;  break;
        case 'email':    av = a.email;      bv = b.email;      break;
        case 'id':       av = a.recruiterId || ''; bv = b.recruiterId || ''; break;
        case 'total':    av = sa.total;     bv = sb.total;     break;
        case 'joined':   av = sa.joined;    bv = sb.joined;    break;
        case 'selected': av = sa.selected;  bv = sb.selected;  break;
        default: break;
      }
      return (av > bv ? 1 : -1) * (sortOrder === 'asc' ? 1 : -1);
    }), [recruiters, searchTerm, sortField, sortOrder, calcStats]);

  // ── Candidate modal filter — memoized, not recalculated on every render ──────
  const filteredCandidatesForModal = useMemo(() => {
    if (!selectedRecruiter) return [];
    let list = candidates.filter((c) => {
      const rid = typeof c.recruiterId === 'object' ? c.recruiterId?._id : c.recruiterId;
      return rid === selectedRecruiter.id;
    });
    if (candidateFilterType === 'joined')   list = list.filter((c) => (Array.isArray(c.status) ? c.status : [c.status]).includes('Joined'));
    if (candidateFilterType === 'selected') list = list.filter((c) => (Array.isArray(c.status) ? c.status : [c.status]).includes('Selected'));
    if (candidateFilterType === 'rejected') list = list.filter((c) => (Array.isArray(c.status) ? c.status : [c.status]).includes('Rejected'));
    return list;
  }, [candidates, selectedRecruiter, candidateFilterType]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  // isActive: true when active===true OR active===undefined/null (legacy docs)
  // isInactive: ONLY when active is explicitly false (boolean false or string 'false')
  const isActive   = (r) => r.active !== false && r.active !== 'false';
  const isInactive = (r) => r.active === false  || r.active === 'false';

  const totalR    = recruiters.length;
  const activeR   = recruiters.filter(isActive).length;
  const inactiveR = recruiters.filter(isInactive).length;

  // ── Status badge ──────────────────────────────────────────────────────────
  const StatusBadge = ({ recruiter }) => {
    const active = recruiter.active !== false && recruiter.active !== 'false';
    return (
      <Badge variant="secondary"
        className={active
          ? "bg-green-100 text-green-800 border border-green-200"
          : "bg-red-100 text-red-800 border border-red-200"}>
        {active
          ? <><UserCheck className="h-3 w-3 mr-1" />Active</>
          : <><UserX    className="h-3 w-3 mr-1" />Inactive</>}
      </Badge>
    );
  };

  // ── Performance report ────────────────────────────────────────────────────
  const generatePerformanceData = () => {
    if (!startDate || !endDate) {
      toast({ title: "Error", description: "Select start and end dates.", variant: "destructive" });
      return;
    }
    const data = [];
    for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
      data.push({
        date:        d.toISOString().split("T")[0],
        submissions: Math.floor(Math.random() * 5),
        turnups:     Math.floor(Math.random() * 3),
        joined:      Math.floor(Math.random() * 2),
      });
    }
    setPerformanceData(data);
  };

  const downloadPDF = () => {
    if (!selectedRecruiter || !performanceData.length) return;
    const doc = new jsPDF();
    doc.text(`Performance Report: ${selectedRecruiter.firstName} ${selectedRecruiter.lastName}`, 14, 20);
    autoTable(doc, {
      startY: 30,
      head:   [["Date", "Submissions", "Turnups", "Joined"]],
      body:   performanceData.map((d) => [d.date, d.submissions, d.turnups, d.joined]),
    });
    doc.save(`${selectedRecruiter.firstName}_${selectedRecruiter.lastName}_report.pdf`);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Success Banner ───────────────────────────────────────────── */}
        {successBanner.show && (
          <div style={{
            position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
            background: 'linear-gradient(135deg, #166534, #15803d)',
            color: 'white', borderRadius: '12px',
            padding: '16px 20px', minWidth: '320px', maxWidth: '420px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
            display: 'flex', alignItems: 'center', gap: '12px',
            animation: 'slideInRight 0.3s ease',
          }}>
            <style>{`
              @keyframes slideInRight {
                from { transform: translateX(120%); opacity: 0; }
                to   { transform: translateX(0);    opacity: 1; }
              }
            `}</style>
            <div style={{
              background: 'rgba(255,255,255,0.2)', borderRadius: '50%',
              width: '36px', height: '36px', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>Success</div>
              <div style={{ fontSize: '13px', opacity: 0.9 }}>{successBanner.message}</div>
            </div>
            <button onClick={() => setSuccessBanner({ show: false, message: '' })}
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer',
                opacity: 0.7, fontSize: '18px', lineHeight: 1, padding: '0 4px' }}>
              ✕
            </button>
          </div>
        )}

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              Users Management
            </h1>
            <p className="text-gray-500 mt-1">Manage Admins, Managers, and Recruiters</p>
          </div>
          <Button
            onClick={() => { setShowModal(true); setErrors({}); setNewRecruiter(EMPTY_RECRUITER); }}
            className="bg-blue-600 hover:bg-blue-700">
            <UserPlus className="h-4 w-4 mr-2" /> Add User
          </Button>
        </div>

        {/* ── Summary Cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="bg-blue-600 text-white cursor-pointer hover:bg-blue-700 transition"
            onClick={() => { setSelectedStatsRecruiters(recruiters); setStatsModalTitle("All Users"); setShowStatsModal(true); }}>
            <CardContent className="p-4 flex justify-between items-center">
              <div><p className="text-blue-100 text-sm">Total</p><p className="text-3xl font-bold">{totalR}</p></div>
              <Users className="h-10 w-10 opacity-70" />
            </CardContent>
          </Card>
          <Card className="bg-green-600 text-white cursor-pointer hover:bg-green-700 transition"
            onClick={() => { setSelectedStatsRecruiters(recruiters.filter(isActive)); setStatsModalTitle("Active Users"); setShowStatsModal(true); }}>
            <CardContent className="p-4 flex justify-between items-center">
              <div><p className="text-green-100 text-sm">Active</p><p className="text-3xl font-bold">{activeR}</p></div>
              <UserCheck className="h-10 w-10 opacity-70" />
            </CardContent>
          </Card>
          <Card className="bg-red-500 text-white cursor-pointer hover:bg-red-600 transition"
            onClick={() => { setSelectedStatsRecruiters(recruiters.filter(isInactive)); setStatsModalTitle("Inactive Users"); setShowStatsModal(true); }}>
            <CardContent className="p-4 flex justify-between items-center">
              <div><p className="text-red-100 text-sm">Inactive</p><p className="text-3xl font-bold">{inactiveR}</p></div>
              <UserX className="h-10 w-10 opacity-70" />
            </CardContent>
          </Card>
        </div>

        {/* ── Controls ─────────────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, ID, role…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={sortField} onValueChange={setSortField}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="id">User ID</SelectItem>
                  <SelectItem value="total">Candidates</SelectItem>
                  <SelectItem value="joined">Joined</SelectItem>
                  <SelectItem value="selected">Selected</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex border rounded-md overflow-hidden">
                <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('grid')}><Grid3X3 className="h-4 w-4" /></Button>
                <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('list')}><List    className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Loading / Empty / Content ─────────────────────────────────── */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin h-10 w-10 border-4 border-blue-500 rounded-full border-t-transparent" />
          </div>
        ) : filteredRecruiters.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No users found</p>
          </div>
        ) : (
          <>
            {/* ── Grid View ──────────────────────────────────────────────── */}
            {viewMode === "grid" && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredRecruiters.map((r) => {
                  const st = calcStats(r.id);
                  const isAdmin = r.role === 'admin';
                  return (
                    <Card key={r.id} className={`hover:shadow-lg transition-shadow relative ${
                      !isActive(r) ? 'opacity-70 border-red-200 bg-red-50/20' :
                      isAdmin ? 'border-purple-200 bg-purple-50/10' : ''
                    }`}>
                      <CardHeader className="flex flex-row items-start justify-between pb-2">
                        <div className="flex items-start gap-3">
                          <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0 mt-0.5 ${isAdmin ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-blue-500 to-cyan-500'}`}>
                            {r.profilePicture
                              ? <img src={r.profilePicture} className="w-full h-full object-cover" alt="pfp" />
                              : getInitials(r.firstName, r.lastName)}
                          </div>
                          <div className="flex flex-col">
                            <CardTitle className="text-base leading-tight">
                              <span className="flex items-center gap-1">
                                {r.firstName} {r.lastName}
                                {isAdmin && <ShieldAlert className="h-4 w-4 text-purple-600 flex-shrink-0" />}
                              </span>
                            </CardTitle>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              {r.recruiterId && <Badge variant="outline" className="text-xs flex-shrink-0">{r.recruiterId}</Badge>}
                              <StatusBadge recruiter={r} />
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditModal(r)}>
                              <Edit className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedRecruiter(r); setShowPerformanceModal(true); setPerformanceData([]); }}>
                              <TrendingUp className="h-4 w-4 mr-2" /> Performance Report
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedRecruiter(r);
                              setCandidatesModalTitle(`All Candidates — ${r.firstName} ${r.lastName}`);
                              setCandidateFilterType(null);
                              setShowCandidatesModal(true);
                            }}>
                              <Users className="h-4 w-4 mr-2" /> View Candidates
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => { setRecruiterToToggle(r); setShowDeactivateModal(true); }}
                              className={isActive(r) ? 'text-orange-600' : 'text-green-600'}>
                              {isActive(r)
                                ? <><UserX className="h-4 w-4 mr-2" />Deactivate</>
                                : <><UserCheck className="h-4 w-4 mr-2" />Activate</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600"
                              onClick={() => { setRecruiterToDelete(r); setShowDeleteModal(true); }}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardHeader>

                      <CardContent>
                        <div className="space-y-1.5 text-sm text-gray-500 mb-4">
                          <div className="flex items-center gap-2"><Mail      className="h-4 w-4 flex-shrink-0" /> {r.email}</div>
                          {r.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 flex-shrink-0" /> {r.phone}</div>}
                          <div className="flex items-center gap-2 capitalize">
                            <Briefcase className="h-4 w-4 flex-shrink-0" />
                            {isAdmin ? <span className="text-purple-600 font-medium">Admin</span> : (r.role || 'Recruiter')}
                          </div>
                        </div>

                        {/* Per-recruiter mini stats */}
                        <div className="grid grid-cols-4 gap-2 border-t pt-3 text-center">
                          {[
                            { label: 'Total',    val: st.total,    filter: null,       color: 'text-blue-600' },
                            { label: 'Turnups',  val: st.turnups,  filter: 'turnups',  color: 'text-teal-600' },
                            { label: 'Selected', val: st.selected, filter: 'selected', color: 'text-purple-600' },
                            { label: 'Joined',   val: st.joined,   filter: 'joined',   color: 'text-green-600' },
                          ].map(({ label, val, filter, color }) => (
                            <div key={label}
                              className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded p-1 transition"
                              onClick={() => {
                                setSelectedRecruiter(r);
                                setCandidatesModalTitle(`${label} — ${r.firstName} ${r.lastName}`);
                                setCandidateFilterType(filter);
                                setShowCandidatesModal(true);
                              }}>
                              <div className={`font-bold text-lg ${color}`}>{val}</div>
                              <div className="text-[10px] text-gray-500">{label}</div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* ── List View ──────────────────────────────────────────────── */}
            {viewMode === "list" && (
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('name')}>
                          <span className="flex items-center">User <SortIcon field="name" /></span>
                        </th>
                        <th className="px-4 py-3 cursor-pointer" onClick={() => toggleSort('id')}>
                          <span className="flex items-center">ID <SortIcon field="id" /></span>
                        </th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-center cursor-pointer" onClick={() => toggleSort('total')}>
                          <span className="flex items-center justify-center">Total <SortIcon field="total" /></span>
                        </th>
                        <th className="px-4 py-3 text-center">Turnups</th>
                        <th className="px-4 py-3 text-center cursor-pointer" onClick={() => toggleSort('selected')}>
                          <span className="flex items-center justify-center">Selected <SortIcon field="selected" /></span>
                        </th>
                        <th className="px-4 py-3 text-center cursor-pointer" onClick={() => toggleSort('joined')}>
                          <span className="flex items-center justify-center">Joined <SortIcon field="joined" /></span>
                        </th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecruiters.map((r) => {
                        const st = calcStats(r.id);
                        const isAdmin = r.role === 'admin';
                        return (
                          <tr key={r.id} className={`border-b hover:bg-gray-50 dark:hover:bg-gray-800 ${
                            !isActive(r) ? 'opacity-60 bg-red-50/30' :
                            isAdmin ? 'bg-purple-50/20' : ''
                          }`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0 text-white ${isAdmin ? 'bg-purple-500' : 'bg-blue-500'}`}>
                                  {r.profilePicture
                                    ? <img src={r.profilePicture} className="w-full h-full object-cover rounded-full" alt="pfp" />
                                    : getInitials(r.firstName, r.lastName)}
                                </div>
                                <div>
                                  <div className="font-medium flex items-center gap-1">
                                    {r.firstName} {r.lastName}
                                    {isAdmin && <ShieldAlert className="h-3 w-3 text-purple-600" />}
                                  </div>
                                  <div className="text-xs text-gray-500">{r.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-500">{r.recruiterId || '-'}</td>
                            <td className="px-4 py-3 capitalize">
                              <span className={isAdmin ? 'text-purple-600 font-medium' : 'text-gray-600'}>
                                {r.role}
                              </span>
                            </td>
                            <td className="px-4 py-3"><StatusBadge recruiter={r} /></td>
                            <td className="px-4 py-3 text-center font-bold text-blue-600 cursor-pointer hover:underline"
                              onClick={() => { setSelectedRecruiter(r); setCandidatesModalTitle(`All — ${r.firstName} ${r.lastName}`); setCandidateFilterType(null); setShowCandidatesModal(true); }}>
                              {st.total}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-teal-600">{st.turnups}</td>
                            <td className="px-4 py-3 text-center font-bold text-purple-600 cursor-pointer hover:underline"
                              onClick={() => { setSelectedRecruiter(r); setCandidatesModalTitle(`Selected — ${r.firstName} ${r.lastName}`); setCandidateFilterType('selected'); setShowCandidatesModal(true); }}>
                              {st.selected}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-green-600 cursor-pointer hover:underline"
                              onClick={() => { setSelectedRecruiter(r); setCandidatesModalTitle(`Joined — ${r.firstName} ${r.lastName}`); setCandidateFilterType('joined'); setShowCandidatesModal(true); }}>
                              {st.joined}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditModal(r)}>
                                    <Edit className="h-4 w-4 mr-2" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedRecruiter(r); setShowPerformanceModal(true); setPerformanceData([]); }}>
                                    <TrendingUp className="h-4 w-4 mr-2" /> Performance
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => { setRecruiterToToggle(r); setShowDeactivateModal(true); }}
                                    className={isActive(r) ? 'text-orange-600' : 'text-green-600'}>
                                    {isActive(r)
                                      ? <><UserX className="h-4 w-4 mr-2" />Deactivate</>
                                      : <><UserCheck className="h-4 w-4 mr-2" />Activate</>}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-red-600"
                                    onClick={() => { setRecruiterToDelete(r); setShowDeleteModal(true); }}>
                                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════
            MODALS
        ════════════════════════════════════════════════════════════ */}

        {/* ── Add User ──────────────────────────────────────────── */}
        <Dialog open={showModal} onClose={() => setShowModal(false)} className="relative z-50">
          <DialogBackdrop className="fixed inset-0 bg-black/50" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
              <DialogTitle className="text-xl font-bold mb-1">Add User</DialogTitle>
              <p className="text-sm text-gray-500 mb-4">First name, last name, email & password are required.</p>

              <div className="space-y-4">
                {/* Profile picture */}
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                    {newRecruiter.profilePicture
                      ? <img src={newRecruiter.profilePicture} className="w-full h-full object-cover" alt="preview" />
                      : <Camera className="h-6 w-6 text-gray-400" />}
                  </div>
                  <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => handleFileUpload(e, false)} />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>Upload Photo</Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">User ID</label>
                    <Input value={newRecruiter.recruiterId}
                      onChange={(e) => handleInputChange('recruiterId', e.target.value, false)}
                      placeholder="e.g. REC001" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Role <span className="text-red-500">*</span></label>
                    <Select value={newRecruiter.role} onValueChange={(val) => handleInputChange('role', val, false)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recruiter">Recruiter</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">First Name <span className="text-red-500">*</span></label>
                    <Input value={newRecruiter.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value, false)}
                      placeholder="Letters only"
                      className={errors.firstName ? "border-red-500" : ""} />
                    {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Last Name <span className="text-red-500">*</span></label>
                    <Input value={newRecruiter.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value, false)}
                      placeholder="Letters only"
                      className={errors.lastName ? "border-red-500" : ""} />
                    {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Email <span className="text-red-500">*</span></label>
                  <Input type="email" value={newRecruiter.email}
                    onChange={(e) => handleInputChange('email', e.target.value, false)}
                    className={errors.email ? "border-red-500" : ""} />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Phone</label>
                    <Input value={newRecruiter.phone} maxLength={10}
                      onChange={(e) => handleInputChange('phone', e.target.value, false)}
                      className={errors.phone ? "border-red-500" : ""}
                      placeholder="10 digits" />
                    {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Username</label>
                    <Input value={newRecruiter.username}
                      onChange={(e) => handleInputChange('username', e.target.value, false)}
                      placeholder="Letters only"
                      className={errors.username ? "border-red-500" : ""} />
                    {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"}
                      value={newRecruiter.password}
                      onChange={(e) => handleInputChange('password', e.target.value, false)}
                      className={errors.password ? "border-red-500 pr-10" : "pr-10"}
                      placeholder="Min 6 characters" />
                    <button type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button onClick={handleAddRecruiter} className="bg-blue-600 hover:bg-blue-700">Save User</Button>
                </div>
              </div>
            </DialogPanel>
          </div>
        </Dialog>

        {/* ── Edit User ─────────────────────────────────────────── */}
        <Dialog open={showEditModal} onClose={() => setShowEditModal(false)} className="relative z-50">
          <DialogBackdrop className="fixed inset-0 bg-black/50" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
              <DialogTitle className="text-xl font-bold mb-4">Edit User</DialogTitle>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                    {editRecruiter.profilePicture
                      ? <img src={editRecruiter.profilePicture} className="w-full h-full object-cover" alt="edit-preview" />
                      : <Camera className="h-6 w-6 text-gray-400" />}
                  </div>
                  <input type="file" ref={editFileInputRef} hidden accept="image/*" onChange={(e) => handleFileUpload(e, true)} />
                  <Button variant="outline" size="sm" onClick={() => editFileInputRef.current?.click()}>Change Photo</Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">User ID</label>
                    <Input value={editRecruiter.recruiterId}
                      onChange={(e) => handleInputChange('recruiterId', e.target.value, true)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Role <span className="text-red-500">*</span></label>
                    <Select value={editRecruiter.role} onValueChange={(val) => handleInputChange('role', val, true)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recruiter">Recruiter</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">First Name <span className="text-red-500">*</span></label>
                    <Input value={editRecruiter.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value, true)}
                      placeholder="Letters only"
                      className={errors.firstName ? "border-red-500" : ""} />
                    {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Last Name <span className="text-red-500">*</span></label>
                    <Input value={editRecruiter.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value, true)}
                      placeholder="Letters only"
                      className={errors.lastName ? "border-red-500" : ""} />
                    {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Email <span className="text-red-500">*</span></label>
                  <Input type="email" value={editRecruiter.email}
                    onChange={(e) => handleInputChange('email', e.target.value, true)}
                    className={errors.email ? "border-red-500" : ""} />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Phone</label>
                    <Input value={editRecruiter.phone} maxLength={10}
                      onChange={(e) => handleInputChange('phone', e.target.value, true)}
                      className={errors.phone ? "border-red-500" : ""} />
                    {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Username</label>
                    <Input value={editRecruiter.username}
                      onChange={(e) => handleInputChange('username', e.target.value, true)}
                      placeholder="Letters only"
                      className={errors.username ? "border-red-500" : ""} />
                    {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">
                    New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
                  </label>
                  <div className="relative">
                    <Input type={showEditPassword ? "text" : "password"}
                      value={editRecruiter.password}
                      onChange={(e) => handleInputChange('password', e.target.value, true)}
                      className={`pr-10 ${errors.password ? "border-red-500" : ""}`}
                      placeholder="Leave blank to keep current" />
                    <button type="button"
                      onClick={() => setShowEditPassword((p) => !p)}
                      className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600">
                      {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
                  <Button onClick={handleEditRecruiter} className="bg-blue-600 hover:bg-blue-700">Update User</Button>
                </div>
              </div>
            </DialogPanel>
          </div>
        </Dialog>

        {/* ── Delete Confirm ─────────────────────────────────────────── */}
        <Dialog open={showDeleteModal} onClose={() => setShowDeleteModal(false)} className="relative z-50">
          <DialogBackdrop className="fixed inset-0 bg-black/50" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full shadow-2xl">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="h-7 w-7 text-red-600" />
                </div>
                <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white">
                  Delete User?
                </DialogTitle>
                <p className="text-gray-500 text-sm">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {recruiterToDelete?.firstName} {recruiterToDelete?.lastName}
                  </span>?
                  <br />
                  <span className="text-red-500 text-xs font-medium">This action cannot be undone.</span>
                </p>
              </div>
              <div className="flex gap-3 mt-6">
                <Button className="flex-1" variant="outline"
                  onClick={() => { setShowDeleteModal(false); setRecruiterToDelete(null); }}>
                  No, Cancel
                </Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleDeleteRecruiter}>
                  Yes, Delete
                </Button>
              </div>
            </DialogPanel>
          </div>
        </Dialog>

        {/* ── Deactivate / Activate Confirm ──────────────────────────── */}
        <Dialog open={showDeactivateModal} onClose={() => setShowDeactivateModal(false)} className="relative z-50">
          <DialogBackdrop className="fixed inset-0 bg-black/50" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full shadow-2xl">
              <div className="flex flex-col items-center text-center gap-3">
                <div className={`h-14 w-14 rounded-full flex items-center justify-center ${
                  recruiterToToggle && isActive(recruiterToToggle)
                    ? 'bg-orange-100' : 'bg-green-100'
                }`}>
                  {recruiterToToggle && isActive(recruiterToToggle)
                    ? <UserX className="h-7 w-7 text-orange-600" />
                    : <UserCheck className="h-7 w-7 text-green-600" />}
                </div>
                <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white">
                  {recruiterToToggle && isActive(recruiterToToggle) ? 'Deactivate User?' : 'Activate User?'}
                </DialogTitle>
                <p className="text-gray-500 text-sm">
                  Are you sure you want to{" "}
                  <span className={`font-semibold ${
                    recruiterToToggle && isActive(recruiterToToggle) ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {recruiterToToggle && isActive(recruiterToToggle) ? 'deactivate' : 'activate'}
                  </span>{" "}
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {recruiterToToggle?.firstName} {recruiterToToggle?.lastName}
                  </span>?
                  {recruiterToToggle && isActive(recruiterToToggle) && (
                    <><br /><span className="text-orange-500 text-xs font-medium">
                      They will not be able to log in while inactive.
                    </span></>
                  )}
                </p>
              </div>
              <div className="flex gap-3 mt-6">
                <Button className="flex-1" variant="outline"
                  onClick={() => { setShowDeactivateModal(false); setRecruiterToToggle(null); }}>
                  No, Cancel
                </Button>
                <Button
                  className={`flex-1 text-white ${
                    recruiterToToggle && isActive(recruiterToToggle)
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                  onClick={handleToggleStatus}>
                  {recruiterToToggle && isActive(recruiterToToggle) ? 'Yes, Deactivate' : 'Yes, Activate'}
                </Button>
              </div>
            </DialogPanel>
          </div>
        </Dialog>

        {/* ── Performance Modal ──────────────────────────────────────── */}
        <Dialog open={showPerformanceModal} onClose={() => setShowPerformanceModal(false)} className="relative z-50">
          <DialogBackdrop className="fixed inset-0 bg-black/50" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="bg-white dark:bg-gray-900 w-full max-w-3xl rounded-xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
              <DialogTitle className="text-xl font-bold mb-4">
                Performance Report — {selectedRecruiter?.firstName} {selectedRecruiter?.lastName}
              </DialogTitle>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Start Date</label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">End Date</label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={generatePerformanceData} className="w-full">Generate</Button>
                  </div>
                </div>

                {performanceData.length > 0 ? (
                  <>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="p-2 text-left">Date</th>
                            <th className="p-2 text-center">Submissions</th>
                            <th className="p-2 text-center">Turnups</th>
                            <th className="p-2 text-center">Joined</th>
                          </tr>
                        </thead>
                        <tbody>
                          {performanceData.map((d, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-2">{d.date}</td>
                              <td className="p-2 text-center">{d.submissions}</td>
                              <td className="p-2 text-center">{d.turnups}</td>
                              <td className="p-2 text-center">{d.joined}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={downloadPDF} variant="outline">
                        <Download className="h-4 w-4 mr-2" /> Download PDF
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    Select dates and click Generate to view performance data.
                  </div>
                )}

                <div className="flex justify-end">
                  <Button variant="ghost" onClick={() => setShowPerformanceModal(false)}>Close</Button>
                </div>
              </div>
            </DialogPanel>
          </div>
        </Dialog>

        {/* ── Stats Modal ────────────────────────────────────────────── */}
        <Dialog open={showStatsModal} onClose={() => setShowStatsModal(false)} className="relative z-50">
          <DialogBackdrop className="fixed inset-0 bg-black/50" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="bg-white dark:bg-gray-900 w-full max-w-xl rounded-xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
              <DialogTitle className="text-xl font-bold mb-4">{statsModalTitle}</DialogTitle>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {selectedStatsRecruiters.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden text-white ${r.role === 'admin' ? 'bg-purple-500' : 'bg-blue-500'}`}>
                        {r.profilePicture
                          ? <img src={r.profilePicture} className="w-full h-full object-cover" alt="pfp" />
                          : getInitials(r.firstName, r.lastName)}
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-1">
                          {r.firstName} {r.lastName}
                          {r.role === 'admin' && <ShieldAlert className="h-3 w-3 text-purple-600" />}
                        </div>
                        <div className="text-xs text-gray-500 capitalize">{r.role} • {r.email}</div>
                      </div>
                    </div>
                    <StatusBadge recruiter={r} />
                  </div>
                ))}
                {selectedStatsRecruiters.length === 0 && (
                  <p className="text-center text-gray-400 py-6">No users in this category.</p>
                )}
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={() => setShowStatsModal(false)}>Close</Button>
              </div>
            </DialogPanel>
          </div>
        </Dialog>

        {/* ── Candidates Modal ───────────────────────────────────────── */}
        <Dialog open={showCandidatesModal} onClose={() => setShowCandidatesModal(false)} className="relative z-50">
          <DialogBackdrop className="fixed inset-0 bg-black/50" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="bg-white dark:bg-gray-900 w-full max-w-4xl rounded-xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
              <DialogTitle className="text-xl font-bold mb-4">{candidatesModalTitle}</DialogTitle>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">Role / Client</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCandidatesForModal.length > 0
                      ? filteredCandidatesForModal.map((c, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="p-3 font-medium">{c.name}</td>
                          <td className="p-3">
                            <div>{c.position}</div>
                            <div className="text-xs text-gray-400">{c.client}</div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {(Array.isArray(c.status) ? c.status : [c.status || '']).map((s) => (
                                <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 text-gray-500">{c.email}</td>
                          <td className="p-3 text-gray-500">{c.contact}</td>
                        </tr>
                      ))
                      : (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-gray-400">
                            No candidates found.
                          </td>
                        </tr>
                      )
                    }
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={() => setShowCandidatesModal(false)}>Close</Button>
              </div>
            </DialogPanel>
          </div>
        </Dialog>

      </div>
    </div>
  );
}