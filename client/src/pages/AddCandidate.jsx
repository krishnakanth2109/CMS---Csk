import { useState, useEffect, useMemo, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import * as XLSX from 'xlsx';
import {
  Search, Plus, Eye, Loader2, MessageCircle,
  ArrowUpDown, ArrowUp, ArrowDown, Users, Download,
  X, Edit, Trash2, Ban, List, LayoutGrid, Calendar, 
  GraduationCap, Award, UserCircle, Target, IndianRupee, 
  Upload, FileUp, AlertTriangle, FileSpreadsheet, Linkedin, 
  Building, Mail, Phone, Briefcase, UserPlus,
  CheckCircle2, FileText, Sparkles
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
    today: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/60 dark:text-violet-200',
  };
  const themeClass = themes[colorTheme] || themes.overall;

  return (
    <div onClick={onClick} className={`relative p-4 rounded-xl shadow-sm border ${themeClass} ${onClick ? 'cursor-pointer' : ''} ${active ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500' : ''}`}>
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

// ✅ Robust Date Extractor
const getSafeDate = (d) => {
  if (!d) return '';
  if (typeof d === 'string' && d.length >= 10) return d.substring(0, 10);
  try { return new Date(d).toISOString().split('T')[0]; } catch(e) { return ''; }
};

// ✅ Returns firstName only for recruiter column display
const getRecruiterName = (r) => {
  if (!r) return 'Unassigned';
  if (r.firstName) return r.firstName;
  if (r.username) return r.username;
  if (r.name) return r.name.split(' ')[0];
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
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [resumeSuccess, setResumeSuccess] = useState({ show: false, fileName: '', fieldsCount: 0 });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [recruiterFilter, setRecruiterFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [activeStatFilter, setActiveStatFilter] = useState(null);
  const [sortConfig, setSortConfig] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  // --- Pagination States ---
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 100;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, recruiterFilter, clientFilter, activeStatFilter]);

  // Bulk Assign States
  const [bulkRecruiterId, setBulkRecruiterId] = useState('');
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [viewCandidate, setViewCandidate] = useState(null);
  const [errors, setErrors] = useState({});

  // Today Submissions modal (Admin)
  const [isTodaySubOpen, setIsTodaySubOpen] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);

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

  // Today in YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  const initialFormData = {
    firstName: '', lastName: '', contact: '', alternateNumber: '', email: '',
    dateOfBirth: '', dateAdded: todayStr,
    currentLocation: '', preferredLocation: '', position: '', positionOther: '', client: '', currentCompany: '',
    totalExperience: '', relevantExperience: '',
    ctc: '', currentTakeHome: '', ectc: '', expectedTakeHome: '',
    noticePeriod: '', servingNoticePeriod: 'false', lwd: '',
    reasonForChange: '', offersInHand: 'false', offerPackage: '', source: 'Portal',
    recruiterId: '', status: ['Submitted'], // 🔴 Multi-Select Array
    skills: '', remarks: '' 
  };
  const [formData, setFormData] = useState(initialFormData);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeader();
      const [resCand, resRec, resCli, resJobs] = await Promise.all([
        fetch(`${API_URL}/candidates`, { headers }),
        fetch(`${API_URL}/recruiters`, { headers }),
        fetch(`${API_URL}/clients`, { headers }),
        fetch(`${API_URL}/jobs`, { headers }),
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
      if (resJobs.ok) {
        const data = await resJobs.json();
        setJobs(Array.isArray(data) ? data : data.jobs || []);
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

  // ✅ Status Multi-Select Handlers
  const addStatus = (newStatus) => {
    if (!newStatus) return;
    if (newStatus === 'SELECT_ALL') {
      setFormData(prev => ({ ...prev, status: [...ALL_STATUSES] }));
    } else if (!formData.status.includes(newStatus)) {
      setFormData(prev => ({ ...prev, status: [...prev.status, newStatus] }));
    }
    if (errors.status) setErrors(prev => { const n = { ...prev }; delete n.status; return n; });
  };

  const removeStatus = (statusToRemove) => {
    setFormData(prev => ({ ...prev, status: prev.status.filter(s => s !== statusToRemove) }));
  };

  // ── Email duplicate check (called onBlur) ──────────────────────────────────
  const checkEmailDuplicate = async (email) => {
    // 🔴 Strict TLD regex
    if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())) return;
    setIsCheckingEmail(true);
    try {
      const headers = getAuthHeader();
      const excludeParam = isEditMode && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
      const res = await fetch(`${API_URL}/candidates/check-email?email=${encodeURIComponent(email.trim())}${excludeParam}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (data.exists) {
        setErrors(prev => ({
          ...prev,
          email: `A candidate with this email already exists (ID: ${data.candidateId}${data.name ? ' — ' + data.name : ''})`,
        }));
      }
    } catch (_) {
      // silently ignore network errors during check
    } finally {
      setIsCheckingEmail(false);
    }
  };

  // ── Phone duplicate check (called onBlur on contact field) ─────────────────
  const checkPhoneDuplicate = async (phone) => {
    const digits = phone ? phone.replace(/\D/g, '').slice(-10) : '';
    if (!digits || digits.length !== 10) return;
    setIsCheckingPhone(true);
    try {
      const headers = getAuthHeader();
      const excludeParam = isEditMode && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
      const res = await fetch(`${API_URL}/candidates/check-phone?phone=${encodeURIComponent(digits)}${excludeParam}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (data.exists) {
        setErrors(prev => ({
          ...prev,
          contact: `A candidate with this phone already exists (ID: ${data.candidateId}${data.name ? ' — ' + data.name : ''})`,
        }));
      }
    } catch (_) {
    } finally {
      setIsCheckingPhone(false);
    }
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

      setResumeSuccess({
        show: true,
        fileName: file.name,
        fieldsCount: Object.values({
          name: data.name, email: data.email, contact: data.contact,
          skills: data.skills, experience: data.totalExperience,
          company: data.currentCompany, location: data.currentLocation,
        }).filter(Boolean).length,
      });
      setTimeout(() => setResumeSuccess(s => ({ ...s, show: false })), 5000);
    } catch (error) {
      console.error('Parsing error:', error);
      toast({ title: 'Warning', description: 'Could not parse resume automatically. Please fill in details manually.', variant: 'default' });
    } finally {
      setIsParsingResume(false);
      e.target.value = '';
    }
  };

  const validateForm = () => {
    const e = {};
    const d = formData;

    if (!d.firstName.trim()) {
      e.firstName = 'First Name is required';
    } else if (!/^[a-zA-Z\s'\-]{2,50}$/.test(d.firstName.trim())) {
      e.firstName = 'First Name must be 2–50 characters (letters only)';
    }

    if (!d.lastName.trim()) {
      e.lastName = 'Last Name is required';
    } else if (!/^[a-zA-Z\s'\-]{1,50}$/.test(d.lastName.trim())) {
      e.lastName = 'Last Name must be letters only';
    }

    // 🔴 Strict Email validation
    if (!d.email.trim()) {
      e.email = 'Email address is required';
    } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(d.email.trim())) {
      e.email = 'Enter a valid email ending with .com, .in, etc.';
    } else if (errors.email && errors.email.includes('already exists')) {
      e.email = errors.email;
    }

    if (!d.contact.trim()) {
      e.contact = 'Contact number is required';
    } else if (!/^[6-9]\d{9}$/.test(d.contact.replace(/[\s\-+]/g, ''))) {
      e.contact = 'Enter a valid 10-digit Indian mobile number (starts with 6–9)';
    } else if (errors.contact && errors.contact.includes('already exists')) {
      e.contact = errors.contact;
    }

    if (d.alternateNumber.trim()) {
      if (!/^[6-9]\d{9}$/.test(d.alternateNumber.replace(/[\s\-+]/g, ''))) {
        e.alternateNumber = 'Enter a valid 10-digit mobile number';
      } else if (d.contact.replace(/[\s\-+]/g, '') === d.alternateNumber.replace(/[\s\-+]/g, '')) {
        e.alternateNumber = 'Alternate number must be different from primary contact';
      }
    }

    if (!d.position.trim()) {
      e.position = 'Role / Position is required';
    } else if (d.position === 'Other') {
      if (!d.positionOther.trim()) {
        e.positionOther = 'Please enter the job opening name';
      } else if (d.positionOther.trim().length < 2) {
        e.positionOther = 'Position must be at least 2 characters';
      }
    } else if (d.position.trim().length < 2) {
      e.position = 'Position must be at least 2 characters';
    }

    if (!d.client.trim()) e.client = 'Please select a Client';

    if (d.totalExperience.trim() !== '') {
      const totalExp = Number(d.totalExperience);
      if (isNaN(totalExp) || !/^\d+(\.\d+)?$/.test(d.totalExperience.trim())) {
        e.totalExperience = 'Must be a number (e.g. 5 or 5.5)';
      } else if (totalExp < 0 || totalExp > 60) {
        e.totalExperience = 'Experience must be between 0 and 60 years';
      }
    }

    if (d.relevantExperience.trim() !== '') {
      const relExp = Number(d.relevantExperience);
      if (isNaN(relExp) || !/^\d+(\.\d+)?$/.test(d.relevantExperience.trim())) {
        e.relevantExperience = 'Must be a number (e.g. 3 or 3.5)';
      } else if (relExp < 0 || relExp > 60) {
        e.relevantExperience = 'Experience must be between 0 and 60 years';
      } else if (
        d.totalExperience.trim() !== '' &&
        !isNaN(Number(d.totalExperience)) &&
        relExp > Number(d.totalExperience)
      ) {
        e.relevantExperience = 'Relevant experience cannot exceed total experience';
      }
    }

    if (d.servingNoticePeriod === 'true' && !d.lwd) {
      e.lwd = 'Last Working Day is required when serving notice period';
    }

    if (d.offersInHand === 'true' && !d.offerPackage.trim()) {
      e.offerPackage = 'Please enter the offer package amount';
    }

    if (d.dateOfBirth) {
      const todayDateStr = new Date().toLocaleDateString('en-CA');
      if (d.dateOfBirth >= todayDateStr) {
        e.dateOfBirth = 'Date of Birth must be in the past (not today or future)';
      } else {
        const dob = new Date(d.dateOfBirth);
        const ageYears = (new Date() - dob) / (1000 * 60 * 60 * 24 * 365.25);
        if (ageYears < 18) {
          e.dateOfBirth = 'Candidate must be at least 18 years old';
        } else if (ageYears > 80) {
          e.dateOfBirth = 'Please enter a valid Date of Birth';
        }
      }
    }

    if (!d.dateAdded) {
      e.dateAdded = 'Date Added is required';
    } else {
      const todayDateStr = new Date().toLocaleDateString('en-CA');
      if (d.dateAdded > todayDateStr) {
        e.dateAdded = 'Date Added cannot be a future date — only today or earlier is allowed';
      }
    }

    // 🔴 Validation for Multi-Select Status
    if (!d.status || d.status.length === 0) {
      e.status = 'At least one status is required';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    // 🔴 Strict validation before submitting
    if (formData.email && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email.trim())) {
      try {
        const dupHeaders = getAuthHeader();
        const excludeParam = isEditMode && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
        const dupRes = await fetch(`${API_URL}/candidates/check-email?email=${encodeURIComponent(formData.email.trim())}${excludeParam}`, { headers: dupHeaders });
        if (dupRes.ok) {
          const dupData = await dupRes.json();
          if (dupData.exists) {
            const dupMsg = `A candidate with this email already exists (ID: ${dupData.candidateId}${dupData.name ? ' — ' + dupData.name : ''})`;
            setErrors(prev => ({ ...prev, email: dupMsg }));
            toast({ title: 'Duplicate Email', description: 'This email is already registered to another candidate.', variant: 'destructive' });
            return;
          }
        }
      } catch (_) {}
    }

    if (formData.contact) {
      const digits = formData.contact.replace(/\D/g, '').slice(-10);
      if (digits.length === 10) {
        try {
          const phHeaders = getAuthHeader();
          const excludeParam = isEditMode && selectedCandidateId ? `&excludeId=${selectedCandidateId}` : '';
          const phRes = await fetch(`${API_URL}/candidates/check-phone?phone=${encodeURIComponent(digits)}${excludeParam}`, { headers: phHeaders });
          if (phRes.ok) {
            const phData = await phRes.json();
            if (phData.exists) {
              const phMsg = `A candidate with this phone already exists (ID: ${phData.candidateId}${phData.name ? ' — ' + phData.name : ''})`;
              setErrors(prev => ({ ...prev, contact: phMsg }));
              toast({ title: 'Duplicate Phone', description: 'This phone number is already registered to another candidate.', variant: 'destructive' });
              return;
            }
          }
        } catch (_) {}
      }
    }

    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const url = isEditMode ? `${API_URL}/candidates/${selectedCandidateId}` : `${API_URL}/candidates`;
      const method = isEditMode ? 'PUT' : 'POST';

      const computedName = `${formData.firstName || ''} ${formData.lastName || ''}`.trim();
      const resolvedPosition = formData.position === 'Other'
        ? formData.positionOther.trim()
        : formData.position;

      const payload = {
        ...formData,
        name: computedName,
        position: resolvedPosition,
        offersInHand: formData.offersInHand === 'true',
        servingNoticePeriod: formData.servingNoticePeriod === 'true',
        status: formData.status // Sending array directly for multi-select
      };
      delete payload.positionOther; 

      const fd = new FormData();
      Object.entries(payload).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          fd.append(key, String(val));
        }
      });

      const headers = getAuthHeader();
      delete headers['Content-Type'];

      const res = await fetch(url, { method, headers, body: fd });
      if (!res.ok) throw new Error(await res.text());

      const savedCandidate = await res.json();

      if (isEditMode) {
        setCandidates(prev =>
          prev.map(c => c._id === selectedCandidateId ? { ...c, ...savedCandidate } : c)
        );
      } else {
        // Prepend new candidate to top of list — no full refetch needed
        setCandidates(prev => [savedCandidate, ...prev]);
      }

      toast({ title: 'Success', description: `Candidate ${isEditMode ? 'updated' : 'added'}` });
      setIsDialogOpen(false);
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('e11000')) {
        setErrors(prev => ({ ...prev, email: 'A candidate with this email already exists in the database.' }));
        toast({ title: 'Duplicate Email', description: 'This email is already registered to another candidate.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this candidate?')) return;
    try {
      await fetch(`${API_URL}/candidates/${id}`, { method: 'DELETE', headers: getAuthHeader() });
      toast({ title: 'Deleted', description: 'Candidate removed' });
      setCandidates(prev => prev.filter(c => c._id !== id));
    } catch (err) {
      toast({ title: 'Error', description: 'Delete failed', variant: 'destructive' });
    }
  };

  const openAddDialog = () => {
    setIsEditMode(false);
    setSelectedCandidateId(null);
    setFormData(initialFormData);
    setErrors({});
    setResumeSuccess({ show: false, fileName: '', fieldsCount: 0 });
    setIsDialogOpen(true);
  };

  const openEditDialog = (c) => {
    setIsEditMode(true);
    setSelectedCandidateId(c._id);

    const savedPosition = c.position || '';
    const jobTitles = jobs.map(j => j.title || j.jobTitle || j.position || '').filter(Boolean);
    const isKnownJob = jobTitles.includes(savedPosition);
    const positionValue = isKnownJob || !savedPosition ? savedPosition : 'Other';
    const positionOtherValue = !isKnownJob && savedPosition ? savedPosition : '';

    setFormData({
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      contact: c.contact || '',
      alternateNumber: c.alternateNumber || '',
      email: c.email || '',
      dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth).toISOString().split('T')[0] : '',
      currentLocation: c.currentLocation || '',
      preferredLocation: c.preferredLocation || '',
      position: positionValue,
      positionOther: positionOtherValue,
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
      // 🔴 Array for Multi-select
      status: Array.isArray(c.status) ? c.status : [c.status || 'Submitted'],
      recruiterId: typeof c.recruiterId === 'object' ? c.recruiterId?._id : c.recruiterId || '',
      skills: Array.isArray(c.skills) ? c.skills.join(', ') : c.skills || '',
      remarks: c.remarks || '',
      dateAdded: c.dateAdded ? new Date(c.dateAdded).toISOString().split('T')[0] : '',
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
    const todayDate = getSafeDate(new Date());
    const todayCount = candidates.filter(c => {
      const d = c.dateAdded || c.createdAt;
      return getSafeDate(d) === todayDate;
    }).length;

    return {
      total: candidates.length, turnups: count('Turnups'), noShow: count('No Show'), yetToAttend: count('Yet to attend'),
      selected: count('Selected'), rejected: count('Rejected'), hold: count('Hold'), pipeline: count('Pipeline'),
      joined: count('Joined'), backout: count('Backout'), sharedProfiles: count('Shared Profiles'),
      todaySubmissions: todayCount,
    };
  }, [candidates]);

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(filteredCandidates.length / ITEMS_PER_PAGE);
  const paginatedCandidates = filteredCandidates.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // ── Export functionality ──────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (filteredCandidates.length === 0) {
      toast({ title: 'No Data', description: 'No candidates available to export.', variant: 'destructive' });
      return;
    }

    try {
      const rows = filteredCandidates.map(c => {
        const recruiterName = typeof c.recruiterId === 'object'
          ? getRecruiterName(c.recruiterId)
          : c.recruiterName || '';

        return {
          'Candidate ID':      c.candidateId || c._id?.slice(-6).toUpperCase() || '',
          'First Name':        c.firstName || '',
          'Last Name':         c.lastName || '',
          'Full Name':         c.name || '',
          'Recruiter':         recruiterName,
          'Email':             c.email || '',
          'Contact':           c.contact || '',
          'Status':            Array.isArray(c.status) ? c.status.join(' | ') : (c.status || ''),
          'Current Location':  c.currentLocation || '',
          'Preferred Location': c.preferredLocation || '',
          'Total Experience':  c.totalExperience || '',
          'Relevant Experience': c.relevantExperience || '',
          'Current Company':   c.currentCompany || '',
          'Reason For Change': c.reasonForChange || '',
          'Current CTC':       c.ctc || '',
          'Current Take Home': c.currentTakeHome || '',
          'Expected CTC':      c.ectc || '',
          'Expected Take Home': c.expectedTakeHome || '',
          'Notice Period':     c.noticePeriod || '',
          'Serving Notice':    c.servingNoticePeriod ? 'Yes' : 'No',
          'LWD':               c.lwd ? new Date(c.lwd).toLocaleDateString('en-GB') : '',
          'Offers In Hand':    c.offersInHand ? 'Yes' : 'No',
          'Offer Package':     c.offerPackage || '',
          'Source':            c.source || '',
          'Skills':            Array.isArray(c.skills) ? c.skills.join(' | ') : (c.skills || ''),
          'Date Added':        (c.dateAdded || c.createdAt) ? new Date(c.dateAdded || c.createdAt).toLocaleDateString('en-GB') : '',
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);

      // Auto-size columns based on content
      const colWidths = Object.keys(rows[0] || {}).map(key => ({
        wch: Math.max(key.length, ...rows.map(r => String(r[key] || '').length), 10)
      }));
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Candidates');
      XLSX.writeFile(wb, `Candidates_Export_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast({ title: 'Exported!', description: `${rows.length} candidate(s) exported to Excel.` });
    } catch (err) {
      console.error('Export error:', err);
      toast({ title: 'Export failed', description: 'Could not export file.', variant: 'destructive' });
    }
  };

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
      // Update recruiterId in local state for all reassigned candidates
      setRecruiters(prev => {
        const rec = prev.find(r => (r._id || r.id) === bulkRecruiterId);
        if (!rec) return prev;
        return prev;
      });
      setCandidates(prev => prev.map(c =>
        selectedIds.includes(c._id) ? { ...c, recruiterId: bulkRecruiterId } : c
      ));
      setSelectedIds([]);
      setBulkRecruiterId('');
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
    <div className="flex-1 grid grid-cols-1 min-w-0 w-full p-6 pb-48 overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="w-full max-w-full mx-auto space-y-6">

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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-2">
          <StatCard title="Hold" value={stats.hold} colorTheme="hold" active={activeStatFilter === 'Hold'} onClick={() => { setActiveStatFilter('Hold'); setStatusFilter('all'); }} />
          <StatCard title="Pipeline" value={stats.pipeline} colorTheme="pipeline" active={activeStatFilter === 'Pipeline'} onClick={() => { setActiveStatFilter('Pipeline'); setStatusFilter('all'); }} />
          <StatCard title="Joined" value={stats.joined} colorTheme="joined" active={activeStatFilter === 'Joined'} onClick={() => { setActiveStatFilter('Joined'); setStatusFilter('all'); }} />
          <StatCard title="Backout" value={stats.backout} colorTheme="backout" active={activeStatFilter === 'Backout'} onClick={() => { setActiveStatFilter('Backout'); setStatusFilter('all'); }} />
          <StatCard title="Shared Profiles" value={stats.sharedProfiles} colorTheme="shared" active={activeStatFilter === 'Shared Profiles'} onClick={() => { setActiveStatFilter('Shared Profiles'); setStatusFilter('all'); }} />
          <StatCard title="Today Submissions" value={stats.todaySubmissions} colorTheme="today" active={false} onClick={() => setIsTodaySubOpen(true)} />
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

        <style>{`
          .tbl-scroll::-webkit-scrollbar { height: 10px; }
          .tbl-scroll::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 10px; }
          .tbl-scroll::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; border: 2px solid #e2e8f0; }
          .tbl-scroll::-webkit-scrollbar-thumb:hover { background: #1e293b; }
          .tbl-scroll { scrollbar-width: thin; scrollbar-color: #475569 #e2e8f0; }
        `}</style>

        <div className="w-full overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white flex flex-col">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
          ) : (
            <>
              {/* TOP SCROLLBAR */}
              <div 
                ref={topScrollRef} 
                onScroll={handleTopScroll} 
                className="tbl-scroll rounded-t-xl bg-slate-100 border-b border-slate-200 w-full"
                style={{ overflowX: 'auto', overflowY: 'hidden', height: '18px' }}
              >
                <div style={{ width: '1800px', height: '1px' }}></div>
              </div>

              {/* TABLE CONTAINER */}
              <div ref={bottomScrollRef} onScroll={handleBottomScroll} className="tbl-scroll w-full" style={{ overflowX: 'auto' }}>
                <table className="w-full text-sm text-left border-collapse min-w-[1800px]">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0}
                          onChange={handleSelectAll}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3 cursor-pointer whitespace-nowrap" onClick={() => handleSort('candidateId')}>ID <SortIcon field="candidateId" /></th>
                      <th className="px-4 py-3 cursor-pointer whitespace-nowrap" onClick={() => handleSort('name')}>Candidate Name <SortIcon field="name" /></th>
                      <th className="px-4 py-3 whitespace-nowrap text-blue-600 font-bold">Recruiter</th>
                      <th className="px-4 py-3 whitespace-nowrap">Client</th>
                      <th className="px-4 py-3 whitespace-nowrap">Skills</th>
                      <th className="px-4 py-3 whitespace-nowrap">Date Added</th>
                      <th className="px-4 py-3 whitespace-nowrap">Experience</th>
                      <th className="px-4 py-3 whitespace-nowrap">CTC / ECTC</th>
                      <th className="px-4 py-3 whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 whitespace-nowrap">Remarks</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Render Paginated Candidates */}
                    {paginatedCandidates.map((c) => {
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
                          <td className="px-4 py-3 font-mono text-xs text-blue-600 font-bold cursor-pointer whitespace-nowrap" onClick={() => { navigator.clipboard.writeText(getCandidateId(c)); toast({ title: "Copied ID" }); }}>{getCandidateId(c)}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{c.name}</td>
                          <td className="px-4 py-3 text-[#283086] font-bold whitespace-nowrap italic">{typeof c.recruiterId === 'object' ? getRecruiterName(c.recruiterId) : c.recruiterName || '-'}</td>
                          <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap">{c.client || '-'}</td>
                          <td className="px-4 py-3 text-xs text-slate-500 max-w-[150px] truncate" title={Array.isArray(c.skills) ? c.skills.join(', ') : c.skills}>
                            {!c.skills ? 'N/A' : Array.isArray(c.skills) ? c.skills.slice(0, 3).join(', ') + (c.skills.length > 3 ? '...' : '') : c.skills.length > 50 ? c.skills.substring(0, 50) + '...' : c.skills}
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.dateAdded ? new Date(c.dateAdded).toLocaleDateString('en-GB') : (c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB') : '-')}</td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap">{c.totalExperience ? `${c.totalExperience} Yrs` : '-'}</td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap"><div>{c.ctc || '-'}</div><div className="text-green-600">{c.ectc || '-'}</div></td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1 min-w-[120px]">
                              {statusArr.map((s) => (
                                <span key={s} className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 mr-1 whitespace-nowrap">{s}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-[100px]">{c.remarks || '-'}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex justify-end items-center gap-2">
                              <Eye className="h-4 w-4 text-blue-600 cursor-pointer" onClick={() => { setViewCandidate(c); setIsViewDialogOpen(true); }} />
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
              
              {/* --- PAGINATION CONTROLS --- */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-slate-200 bg-white gap-4">
                  <span className="text-sm text-slate-500">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredCandidates.length)} of {filteredCandidates.length} entries
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
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
              {/* ── Resume Extracted Success Banner (inline, top of form) ── */}
              {resumeSuccess.show && (
                <div style={{
                  background: 'linear-gradient(to right, #f0fdf4, #ecfdf5, #f0fdf4)',
                  border: '1.5px solid #86efac',
                  borderRadius: '12px',
                  boxShadow: '0 4px 24px rgba(34,197,94,0.13)',
                  overflow: 'hidden',
                  animation: 'resumeSlideIn 0.35s cubic-bezier(0.16,1,0.3,1)'
                }}>
                  <div style={{display:'flex', alignItems:'flex-start', gap:'12px', padding:'14px 16px'}}>
                    {/* Icon */}
                    <div style={{
                      flexShrink:0, width:'40px', height:'40px', borderRadius:'50%',
                      background:'#dcfce7', border:'2px solid #86efac',
                      display:'flex', alignItems:'center', justifyContent:'center'
                    }}>
                      <CheckCircle2 style={{width:'20px',height:'20px',color:'#16a34a'}} />
                    </div>
                    {/* Text */}
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{display:'flex', alignItems:'center', gap:'6px', marginBottom:'2px'}}>
                        <Sparkles style={{width:'14px',height:'14px',color:'#22c55e'}} />
                        <p style={{fontSize:'14px', fontWeight:700, color:'#14532d', margin:0}}>
                          Resume Extracted Successfully!
                        </p>
                      </div>
                      <p style={{fontSize:'12px', color:'#15803d', margin:'3px 0 0 0', display:'flex', alignItems:'center', gap:'4px'}}>
                        <FileText style={{width:'12px',height:'12px',flexShrink:0}} />
                        <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:500}}>
                          {resumeSuccess.fileName}
                        </span>
                      </p>
                      {resumeSuccess.fieldsCount > 0 && (
                        <p style={{fontSize:'12px', color:'#16a34a', margin:'5px 0 0 0'}}>
                          ✓ {resumeSuccess.fieldsCount} field{resumeSuccess.fieldsCount !== 1 ? 's' : ''} auto-filled — please review and complete any missing details.
                        </p>
                      )}
                    </div>
                    {/* Close */}
                    <button
                      onClick={() => setResumeSuccess(s => ({ ...s, show: false }))}
                      style={{
                        flexShrink:0, background:'none', border:'none', cursor:'pointer',
                        padding:'4px', borderRadius:'6px', color:'#4ade80', lineHeight:1
                      }}
                      onMouseEnter={e => e.currentTarget.style.background='#bbf7d0'}
                      onMouseLeave={e => e.currentTarget.style.background='none'}
                    >
                      <X style={{width:'16px',height:'16px'}} />
                    </button>
                  </div>
                  {/* Progress bar */}
                  <div style={{height:'3px', background:'#bbf7d0'}}>
                    <div style={{
                      height:'100%', background:'#22c55e',
                      animation:'resumeBarShrink 5s linear forwards'
                    }} />
                  </div>
                </div>
              )}

              <style>{`
                @keyframes resumeSlideIn {
                  from { opacity: 0; transform: translateY(-12px); }
                  to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes resumeBarShrink {
                  from { width: 100%; }
                  to   { width: 0%; }
                }
              `}</style>

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
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.contact}
                        onChange={(e) => handleInputChange('contact', e.target.value)}
                        onBlur={(e) => checkPhoneDuplicate(e.target.value)}
                        className={inputCls(errors.contact)}
                      />
                      {isCheckingPhone && (
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Checking...
                        </span>
                      )}
                    </div>
                    {errors.contact && <p className="text-xs text-red-500 mt-1">{errors.contact}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Alternate Number</label>
                    <input type="text" value={formData.alternateNumber} onChange={(e) => handleInputChange('alternateNumber', e.target.value)} className={inputCls(errors.alternateNumber)} placeholder="e.g. 9876543210" />
                    {errors.alternateNumber && <p className="text-xs text-red-500 mt-1">{errors.alternateNumber}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-slate-700">Email Address *</label>
                    <div className="relative">
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        onBlur={(e) => checkEmailDuplicate(e.target.value)}
                        className={inputCls(errors.email)}
                      />
                      {isCheckingEmail && (
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Checking...
                        </span>
                      )}
                    </div>
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
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Date of Birth</label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                      max={new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0]}
                      className={inputCls(errors.dateOfBirth)}
                    />
                    {errors.dateOfBirth && <p className="text-xs text-red-500 mt-1">{errors.dateOfBirth}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Date Added</label>
                    <input
                      type="date"
                      value={formData.dateAdded}
                      onChange={(e) => handleInputChange('dateAdded', e.target.value)}
                      max={todayStr}
                      className={inputCls(errors.dateAdded)}
                    />
                    <p className="text-xs text-slate-400 mt-1">Cannot be a future date. Defaults to today.</p>
                    {errors.dateAdded && <p className="text-xs text-red-500 mt-1">{errors.dateAdded}</p>}
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-base font-semibold text-blue-700 border-b border-blue-100 pb-2 mb-4">Professional Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Role (Position) *</label>
                    <select
                      value={formData.position}
                      onChange={(e) => {
                        handleInputChange('position', e.target.value);
                        if (e.target.value !== 'Other') handleInputChange('positionOther', '');
                      }}
                      className={inputCls(errors.position)}
                    >
                      <option value="">Select Job Opening</option>
                      {jobs.map((j) => {
                        const title = j.title || j.jobTitle || j.position || '';
                        return title ? (
                          <option key={j._id} value={title}>{title}{j.client ? ` — ${j.client}` : ''}</option>
                        ) : null;
                      })}
                      <option value="Other">Other (type manually)</option>
                    </select>
                    {errors.position && <p className="text-xs text-red-500 mt-1">{errors.position}</p>}
                    {formData.position === 'Other' && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={formData.positionOther}
                          onChange={(e) => handleInputChange('positionOther', e.target.value)}
                          className={inputCls(errors.positionOther)}
                          placeholder="Enter job opening name..."
                          autoFocus
                        />
                        {errors.positionOther && <p className="text-xs text-red-500 mt-1">{errors.positionOther}</p>}
                      </div>
                    )}
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
                    <input type="text" value={formData.totalExperience} onChange={(e) => handleInputChange('totalExperience', e.target.value)} className={inputCls(errors.totalExperience)} placeholder="e.g. 5" />
                    {errors.totalExperience && <p className="text-xs text-red-500 mt-1">{errors.totalExperience}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700">Relevant Experience (Years)</label>
                    <input type="text" value={formData.relevantExperience} onChange={(e) => handleInputChange('relevantExperience', e.target.value)} className={inputCls(errors.relevantExperience)} placeholder="e.g. 3" />
                    {errors.relevantExperience && <p className="text-xs text-red-500 mt-1">{errors.relevantExperience}</p>}
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

                  {/* 🔴 Multi-Select Status UI */}
                  <div className="space-y-1">
                    <label className="block text-sm font-medium mb-1 text-slate-700">Status (Multi-select) *</label>
                    <div className={`border rounded-lg p-2 min-h-[42px] flex flex-wrap gap-2 bg-white ${errors.status ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`}>
                      {formData.status.length > 0 ? formData.status.map(status => (
                        <span key={status} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {status}
                          <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => removeStatus(status)} />
                        </span>
                      )) : <span className="text-sm text-slate-400 p-1">No status selected</span>}
                    </div>
                    <select value="" onChange={(e) => addStatus(e.target.value)} className={inputCls(errors.status)}>
                      <option value="">Add a status...</option>
                      <option value="SELECT_ALL">✓ Select All</option>
                      {ALL_STATUSES.map(status => <option key={status} value={status} disabled={formData.status.includes(status)}>{status}</option>)}
                    </select>
                    {errors.status && <p className="text-xs text-red-500 mt-1">{errors.status}</p>}
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

      {/* Today Submissions Modal — Admin only */}
      {isTodaySubOpen && (
        <AdminTodaySubmissionsModal
          candidates={candidates}
          recruiters={recruiters}
          onClose={() => setIsTodaySubOpen(false)}
          getCandidateId={getCandidateId}
        />
      )}
    </div>
  );
}

// ── Admin Today Submissions Modal ─────────────────────────────────────────────
function AdminTodaySubmissionsModal({ candidates, recruiters, onClose, getCandidateId }) {
  const todayStr = getSafeDate(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [recruiterFilter, setRecruiterFilter] = useState('all');

  const filtered = useMemo(() => {
    return candidates.filter(c => {
      const d = c.dateAdded || c.createdAt;
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

  const getRecruiterDisplayName = (rec) => {
    if (!rec) return '-';
    if (typeof rec === 'object') return getRecruiterLabel(rec);
    const found = recruiters.find(r => r._id === rec || r.id === rec);
    if (found) return getRecruiterLabel(found);
    return '-';
  };

  const selectedRecruiterName = recruiterFilter === 'all'
    ? 'All Recruiters'
    : getRecruiterDisplayName(recruiterFilter);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-violet-500" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Day Submissions</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Viewing candidates submitted by {recruiterFilter === 'all' ? 'all recruiters' : selectedRecruiterName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Dynamic Recruiter filter dropdown */}
            <select
              value={recruiterFilter}
              onChange={e => setRecruiterFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-slate-700 min-w-[150px]"
            >
              <option value="all">All Recruiters</option>
              {recruiters.map(r => (
                <option key={r._id || r.id} value={r._id || r.id}>
                  {getRecruiterLabel(r)}
                </option>
              ))}
            </select>
            {/* Date picker */}
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

        {/* Table */}
        <div className="overflow-auto flex-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Calendar className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">No submissions for {displayDate}</p>
              {recruiterFilter !== 'all' && (
                <p className="text-xs mt-1 text-slate-400">Try selecting "All Recruiters"</p>
              )}
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
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{c.name}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {getRecruiterDisplayName(c.recruiterId)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.position || '-'}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{c.client || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {statusArr.map(s => (
                            <span
                              key={s}
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                s === 'Selected' || s === 'Joined'
                                  ? 'bg-green-100 text-green-800'
                                  : s === 'Rejected' || s === 'No Show' || s === 'Backout'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-blue-100 text-blue-800'
                              }`}
                            >
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

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{filtered.length}</span> submission{filtered.length !== 1 ? 's' : ''} for {displayDate}
            {recruiterFilter !== 'all' && <span className="ml-1">· <span className="font-medium text-violet-600">{selectedRecruiterName}</span></span>}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-white transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}