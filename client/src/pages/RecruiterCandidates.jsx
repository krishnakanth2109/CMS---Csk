import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  Plus, Search, Edit, Download, Phone, Mail,
  Building, Briefcase, Loader2, Ban, List, LayoutGrid,
  Calendar, GraduationCap, Award, UserCircle, Target,
  MessageCircle, Eye, IndianRupee, Upload, FileUp, X,
  Trash2, AlertTriangle, FileSpreadsheet, Linkedin
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL = `${BASE_URL}/api`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const getRecruiterName = (r) => {
  if (!r) return '-';
  if (r.name) return r.name;
  const first = r.firstName || '';
  const last = r.lastName || '';
  if (first || last) return `${first} ${last}`.trim();
  if (r.username) return r.username;
  return r.email || '-';
};

// ── UI Components ─────────────────────────────────────────────────────────────

const Button = ({ children, onClick, disabled, className = '', variant = 'default', size = 'md', type = 'button' }) => {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none';
  const sizes = { sm: 'px-2 py-1 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base', icon: 'p-2' };
  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    link: 'text-blue-600 underline bg-transparent hover:text-blue-700 p-0',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sizes[size] ?? sizes.md} ${variants[variant] ?? variants.default} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ className = '', ...props }) => (
  <input className={`w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${className}`} {...props} />
);

const Label = ({ children, className = '', htmlFor }) => (
  <label htmlFor={htmlFor} className={`block text-sm font-medium text-slate-700 dark:text-slate-300 ${className}`}>{children}</label>
);

const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: 'bg-blue-100 text-blue-800',
    secondary: 'bg-slate-100 text-slate-700',
    destructive: 'bg-red-100 text-red-700',
    outline: 'border border-slate-300 text-slate-700 bg-white',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant] ?? variants.default} ${className}`}>
      {children}
    </span>
  );
};

// ── Modal ─────────────────────────────────────────────────────────────────────
const Modal = ({ open, onClose, children, maxWidth = 'max-w-2xl' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}>
        {children}
      </div>
    </div>
  );
};
const ModalHeader = ({ children }) => <div className="px-6 pt-6 pb-2">{children}</div>;
const ModalTitle = ({ children, className = '' }) => <h2 className={`text-xl font-bold text-slate-900 dark:text-white ${className}`}>{children}</h2>;
const ModalDesc = ({ children }) => <p className="text-sm text-slate-500 mt-1">{children}</p>;
const ModalFooter = ({ children }) => <div className="px-6 pb-6 pt-4 flex justify-end gap-3">{children}</div>;
const ModalBody = ({ children }) => <div className="px-6 py-4">{children}</div>;

const NativeSelect = ({ value, onChange, children, className = '', disabled }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    disabled={disabled}
    className={`w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${className}`}
  >
    {children}
  </select>
);

// ── Main Component ────────────────────────────────────────────────────────────

export default function RecruiterCandidates() {
  const { currentUser, userRole, authHeaders } = useAuth(); 
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingCandidate, setViewingCandidate] = useState(null);
  const [isParsingResume, setIsParsingResume] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('table');
  const [activeStatFilter, setActiveStatFilter] = useState(null);
  const [selectedCandidates, setSelectedCandidates] = useState([]);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

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

  const standardSources = ['Portal', 'LinkedIn', 'Referral', 'Direct', 'Agency', 'Naukri', 'Indeed'];

  const allStatuses = [
    'Shared Profiles', 'Yet to attend', 'Turnups', 'No Show', 'Selected',
    'Joined', 'Rejected', 'Pipeline', 'Hold', 'Backout'
  ];

  const [isCustomSource, setIsCustomSource] = useState(false);

  const initialFormState = {
    name: '', email: '', contact: '', dateOfBirth: '', gender: '', linkedin: '',
    currentLocation: '', preferredLocation: '',
    position: '', client: '', industry: '', currentCompany: '', skills: '',
    totalExperience: '', relevantExperience: '',
    education: '',
    ctc: '', ectc: '',
    currentTakeHome: '',
    expectedTakeHome: '',
    noticePeriod: '',
    servingNoticePeriod: 'false',
    noticePeriodDays: '',
    lwd: '', 
    reasonForChange: '',
    offersInHand: 'false',
    offerPackage: '',
    source: 'Portal',
    status: ['Submitted'],
    rating: '0', assignedJobId: '',
    dateAdded: new Date().toISOString().split('T')[0],
    notes: '', remarks: '',
    active: true
  };

  const [formData, setFormData] = useState(initialFormState);

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0];
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

      const authH = await authHeaders();
      const response = await fetch(`${API_URL}/candidates/parse-resume`, {
        method: 'POST',
        headers: { ...authH },
        body: uploadFormData
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to parse resume');
      }

      if (result.success && result.data) {
        const cleanContact = result.data.contact ? result.data.contact.replace(/\D/g, '').slice(0, 10) : '';
        const cleanTotalExp = result.data.totalExperience ? String(result.data.totalExperience).replace(/[^0-9.]/g, '') : '';

        setFormData(prev => ({
          ...prev,
          name: prev.name || result.data.name || '',
          email: prev.email || result.data.email || '',
          contact: prev.contact || cleanContact || '',
          linkedin: prev.linkedin || result.data.linkedin || '',
          gender: prev.gender || result.data.gender || 'Not Specified',
          skills: prev.skills || result.data.skills || '',
          totalExperience: prev.totalExperience || cleanTotalExp || '',
          education: prev.education || result.data.education || '',
          currentLocation: prev.currentLocation || result.data.currentLocation || '',
          currentCompany: prev.currentCompany || result.data.currentCompany || '',
        }));
        toast({ title: 'Success', description: 'Resume parsed successfully. Fields auto-filled.' });
      }
    } catch (error) {
      console.error('Parsing error:', error);
      toast({ title: 'Warning', description: 'Could not parse some details. Please fill manually.', variant: 'default' });
    } finally {
      setIsParsingResume(false);
      event.target.value = '';
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const authH = await authHeaders();
      const headers = { ...authH };

      const [candRes, jobRes, clientRes] = await Promise.all([
        fetch(`${API_URL}/candidates`, { headers }),
        fetch(`${API_URL}/jobs`, { headers }),
        fetch(`${API_URL}/clients`, { headers })
      ]);

      if (candRes.ok && jobRes.ok && clientRes.ok) {
        const allCandidates = await candRes.json();
        const allJobs = await jobRes.json();
        const allClients = await clientRes.json();

        let finalCandidates = allCandidates;

        if (currentUser?._id) {
          finalCandidates = allCandidates.filter(c => {
            const cRecruiterId = typeof c.recruiterId === 'object'
              ? String(c.recruiterId?._id)
              : String(c.recruiterId || '');
            return cRecruiterId === String(currentUser._id);
          });
        }

        finalCandidates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        const fixedCandidates = finalCandidates.map((c) => ({
          ...c,
          status: Array.isArray(c.status) ? c.status : [c.status || 'Submitted']
        }));
        
        setCandidates(fixedCandidates);
        setJobs(allJobs);
        setClients(allClients);
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to load data" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status) { setActiveStatFilter(status); setStatusFilter('all'); }
  }, [searchParams]);

  // ✅ REAL-TIME INPUT RESTRICTION
  const handleInputChange = (key, value) => {
    let newValue = value;
    
    // Strict typing rules
    if (key === 'contact') {
      newValue = value.replace(/\D/g, '').slice(0, 10);
    } else if (key === 'name') {
      newValue = value.replace(/[^a-zA-Z\s]/g, '');
    } else if (key === 'totalExperience' || key === 'relevantExperience') {
      // Allow only digits and a single decimal point
      newValue = value.replace(/[^0-9.]/g, '');
      const parts = newValue.split('.');
      if (parts.length > 2) newValue = parts[0] + '.' + parts.slice(1).join('');
    }

    setFormData(prev => ({ ...prev, [key]: newValue }));
    
    // Clear error for the field being typed in
    if (errors[key]) {
      setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  const addStatus = (newStatus) => {
    if (newStatus === 'SELECT_ALL') {
      setFormData(prev => ({ ...prev, status: [...allStatuses] }));
    } else if (!formData.status.includes(newStatus)) {
      setFormData(prev => ({ ...prev, status: [...prev.status, newStatus] }));
    }
    if (errors.status) setErrors(prev => { const n = { ...prev }; delete n.status; return n; });
  };

  const removeStatus = (statusToRemove) => {
    setFormData(prev => ({ ...prev, status: prev.status.filter(s => s !== statusToRemove) }));
  };

  // ✅ STRICT SUBMIT VALIDATION
  const validateForm = () => {
    const newErrors = {};
    const trimStr = (val) => (typeof val === 'string' ? val.trim() : val);
    const data = formData;

    // 1. Personal Info
    const name = trimStr(data.name);
    if (!name) newErrors.name = "Name is required";
    else if (name.length < 2 || name.length > 100) newErrors.name = "Must be between 2 and 100 characters";

    const email = trimStr(data.email);
    if (!email) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Invalid email format";

    const contact = trimStr(data.contact);
    if (!contact) newErrors.contact = "Phone is required";
    else if (contact.length !== 10) newErrors.contact = "Must be exactly 10 digits";

    if (data.linkedin && !/^(https?:\/\/)?([\w\d\-]+\.)+\w{2,}(\/.*)?$/i.test(trimStr(data.linkedin))) {
      newErrors.linkedin = "Invalid LinkedIn URL format";
    }

    if (data.currentLocation && trimStr(data.currentLocation).length > 100) newErrors.currentLocation = "Max 100 characters";
    if (data.preferredLocation && trimStr(data.preferredLocation).length > 100) newErrors.preferredLocation = "Max 100 characters";

    // 2. Professional Info
    const pos = trimStr(data.position);
    if (!pos) newErrors.position = "Position is required";
    else if (pos.length > 100) newErrors.position = "Max 100 characters allowed";

    if (!data.client) newErrors.client = "Client is required";

    if (data.currentCompany && trimStr(data.currentCompany).length > 100) newErrors.currentCompany = "Max 100 characters";
    if (data.industry && trimStr(data.industry).length > 100) newErrors.industry = "Max 100 characters";

    const skills = trimStr(data.skills);
    if (!skills) newErrors.skills = "At least one skill is required";
    else if (skills.length > 500) newErrors.skills = "Max 500 characters allowed";

    if (data.education && trimStr(data.education).length > 200) newErrors.education = "Max 200 characters";

    // 3. Financials & Experience
    const totExp = trimStr(data.totalExperience);
    if (totExp && isNaN(Number(totExp))) newErrors.totalExperience = "Must be a valid number";
    
    const relExp = trimStr(data.relevantExperience);
    if (relExp && isNaN(Number(relExp))) newErrors.relevantExperience = "Must be a valid number";

    if (data.ctc && trimStr(data.ctc).length > 50) newErrors.ctc = "Max 50 characters";
    if (data.ectc && trimStr(data.ectc).length > 50) newErrors.ectc = "Max 50 characters";
    if (data.currentTakeHome && trimStr(data.currentTakeHome).length > 50) newErrors.currentTakeHome = "Max 50 characters";
    if (data.expectedTakeHome && trimStr(data.expectedTakeHome).length > 50) newErrors.expectedTakeHome = "Max 50 characters";
    if (data.noticePeriod && trimStr(data.noticePeriod).length > 50) newErrors.noticePeriod = "Max 50 characters";

    if (data.servingNoticePeriod === 'true') {
      if (!data.lwd) newErrors.lwd = "LWD is required if currently serving notice";
    }

    if (data.reasonForChange && trimStr(data.reasonForChange).length > 500) newErrors.reasonForChange = "Max 500 characters allowed";

    if (data.offersInHand === 'true') {
      if (!trimStr(data.offerPackage)) newErrors.offerPackage = "Package amount is required";
      else if (trimStr(data.offerPackage).length > 50) newErrors.offerPackage = "Max 50 characters";
    }

    // 4. Recruitment Info
    if (isCustomSource && !trimStr(data.source)) newErrors.source = "Source is required";
    if (!data.status || data.status.length === 0) newErrors.status = "At least one status is required";
    if (!data.dateAdded) newErrors.dateAdded = "Date Added is required";
    if (data.remarks && trimStr(data.remarks).length > 1000) newErrors.remarks = "Max 1000 characters allowed";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const stats = useMemo(() => {
    const countStatus = (s) => candidates.filter(c =>
      Array.isArray(c.status) ? c.status.includes(s) : c.status === s
    ).length;
    return {
      total: candidates.length,
      turnups: countStatus('Turnups'),
      noShow: countStatus('No Show'),
      yetToAttend: countStatus('Yet to attend'),
      selected: countStatus('Selected'),
      rejected: countStatus('Rejected'),
      hold: countStatus('Hold'),
      joined: countStatus('Joined'),
      pipeline: countStatus('Pipeline'),
      backout: countStatus('Backout'),
      sharedProfiles: countStatus('Shared Profiles'),
    };
  }, [candidates]);

  const getFilteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      const searchMatch =
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.candidateId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (Array.isArray(c.skills) && c.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase())));
      const currentStatusArr = Array.isArray(c.status) ? c.status : [c.status || ''];
      let statCardMatch = true;
      if (activeStatFilter) statCardMatch = currentStatusArr.includes(activeStatFilter);
      const statusDropdownMatch = statusFilter === 'all' || currentStatusArr.includes(statusFilter);
      return searchMatch && statusDropdownMatch && statCardMatch;
    });
  }, [candidates, searchTerm, statusFilter, activeStatFilter]);

  const handleExport = () => {
    if (getFilteredCandidates.length === 0) { toast({ title: "No data to export", variant: "destructive" }); return; }
    const headers = ["Candidate ID", "Name", "Email", "Phone", "Client", "Position", "Status", "Total Exp", "Current CTC", "Expected CTC", "Skills", "Date Added"];
    const escapeCsv = (str) => str ? `"${String(str).replace(/"/g, '""')}"` : '""';
    const rows = getFilteredCandidates.map(c => [
      escapeCsv(c.candidateId), escapeCsv(c.name), escapeCsv(c.email), escapeCsv(c.contact),
      escapeCsv(c.client), escapeCsv(c.position), escapeCsv(Array.isArray(c.status) ? c.status.join(' | ') : c.status),
      escapeCsv(c.totalExperience), escapeCsv(c.ctc), escapeCsv(c.ectc),
      escapeCsv(Array.isArray(c.skills) ? c.skills.join(', ') : c.skills),
      escapeCsv(new Date(c.dateAdded || c.createdAt || new Date()).toLocaleDateString())
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `candidates_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getStatusBadgeVariant = (status) => {
    if (status === 'Joined' || status === 'Selected') return 'default';
    if (status === 'Rejected' || status === 'Backout' || status === 'No Show') return 'destructive';
    return 'secondary';
  };

  const getCandidateId = (c) => c.candidateId || c._id.substring(c._id.length - 6).toUpperCase();
  const formatSkills = (skills) => !skills ? 'N/A' : Array.isArray(skills) ? skills.slice(0, 3).join(', ') + (skills.length > 3 ? '...' : '') : skills.length > 50 ? skills.substring(0, 50) + '...' : skills;
  const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

  const toggleSelectCandidate = (id) => setSelectedCandidates(prev => prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]);
  const selectAllCandidates = () => setSelectedCandidates(selectedCandidates.length === getFilteredCandidates.length ? [] : getFilteredCandidates.map(c => c._id));

  const openViewDialog = (c) => { setViewingCandidate(c); setIsViewDialogOpen(true); };

  const openEditDialog = (c) => {
    setErrors({});
    setSelectedCandidateId(c._id);
    const isStandard = standardSources.includes(c.source || 'Portal');
    setIsCustomSource(!isStandard);
    setFormData({
      name: c.name || '', email: c.email || '', contact: c.contact || '',
      dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth).toISOString().split('T')[0] : '',
      gender: c.gender || '', linkedin: c.linkedin || '',
      currentLocation: c.currentLocation || '', preferredLocation: c.preferredLocation || '',
      position: c.position || '', client: c.client || '', industry: c.industry || '',
      currentCompany: c.currentCompany || '', skills: Array.isArray(c.skills) ? c.skills.join(', ') : c.skills || '',
      totalExperience: c.totalExperience ? String(c.totalExperience) : '',
      relevantExperience: c.relevantExperience ? String(c.relevantExperience) : '',
      education: c.education || '',
      ctc: c.ctc ? String(c.ctc) : '', ectc: c.ectc ? String(c.ectc) : '',
      currentTakeHome: c.currentTakeHome || '', expectedTakeHome: c.expectedTakeHome || '',
      noticePeriod: c.noticePeriod ? String(c.noticePeriod) : '',
      servingNoticePeriod: c.servingNoticePeriod ? 'true' : 'false',
      lwd: c.lwd ? new Date(c.lwd).toISOString().split('T')[0] : '',
      reasonForChange: c.reasonForChange || '',
      offersInHand: c.offersInHand ? 'true' : 'false',
      offerPackage: c.offerPackage || '',
      source: c.source || 'Portal',
      status: Array.isArray(c.status) ? c.status : [c.status || 'Submitted'],
      rating: c.rating?.toString() || '0',
      assignedJobId: typeof c.assignedJobId === 'object' ? c.assignedJobId._id : c.assignedJobId || '',
      dateAdded: c.dateAdded ? new Date(c.dateAdded).toISOString().split('T')[0] : '',
      notes: c.notes || '', remarks: c.remarks || '', active: c.active !== false
    });
    setIsEditDialogOpen(true);
  };

  const handleSave = async (isEdit) => {
    if (!validateForm()) { toast({ title: "Validation Error", description: "Please fix the highlighted errors", variant: "destructive" }); return; }
    setIsSubmitting(true);
    try {
      const authH = await authHeaders();
      const headers = { ...authH, 'Content-Type': 'application/json' };

      // Clean Payload
      const nameParts = (formData.name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || formData.name || '';
      const lastName = nameParts.slice(1).join(' ') || nameParts[0] || '';

      const payload = {
        ...formData,
        firstName,
        lastName,
        name: formData.name.trim(),
        email: formData.email.trim(),
        contact: formData.contact.trim(),
        linkedin: formData.linkedin.trim(),
        currentLocation: formData.currentLocation.trim(),
        preferredLocation: formData.preferredLocation.trim(),
        position: formData.position.trim(),
        industry: formData.industry.trim(),
        currentCompany: formData.currentCompany.trim(),
        education: formData.education.trim(),
        ctc: formData.ctc.trim(),
        ectc: formData.ectc.trim(),
        currentTakeHome: formData.currentTakeHome.trim(),
        expectedTakeHome: formData.expectedTakeHome.trim(),
        noticePeriod: formData.noticePeriod.trim(),
        reasonForChange: formData.reasonForChange.trim(),
        offerPackage: formData.offerPackage.trim(),
        source: formData.source.trim(),
        remarks: formData.remarks.trim(),
        assignedJobId: typeof formData.assignedJobId === 'object' ? formData.assignedJobId._id : formData.assignedJobId,
        skills: typeof formData.skills === 'string' ? formData.skills.split(',').map((s) => s.trim()).filter(Boolean) : formData.skills,
        rating: parseInt(formData.rating) || 0,
        servingNoticePeriod: formData.servingNoticePeriod === 'true',
        offersInHand: formData.offersInHand === 'true'
      };
      const url = isEdit ? `${API_URL}/candidates/${selectedCandidateId}` : `${API_URL}/candidates`;
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Success", description: `Candidate ${isEdit ? 'updated' : 'added'} successfully` });
        setIsAddDialogOpen(false); setIsEditDialogOpen(false);
        fetchData(); setFormData(initialFormState);
      } else {
        throw new Error(data.message || 'Operation failed');
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Operation failed" });
    } finally { setIsSubmitting(false); }
  };

  const toggleActiveStatus = async (id, currentStatus) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'}?`)) return;
    try {
      const authH = await authHeaders();
      const headers = { ...authH, 'Content-Type': 'application/json' };
      await fetch(`${API_URL}/candidates/${id}`, { method: 'PUT', headers, body: JSON.stringify({ active: !currentStatus }) });
      toast({ title: "Status Updated" }); fetchData();
    } catch (error) { toast({ variant: "destructive", title: "Error" }); }
  };

  const handleBulkDelete = async () => {
    if (selectedCandidates.length === 0) return;
    setIsDeleting(true);
    try {
      const authH = await authHeaders();
      const headers = { ...authH };
      const deletePromises = selectedCandidates.map(id => fetch(`${API_URL}/candidates/${id}`, { method: 'DELETE', headers }));
      await Promise.all(deletePromises);
      toast({ title: "Deleted", description: `${selectedCandidates.length} candidate(s) deleted successfully` });
      setSelectedCandidates([]); fetchData(); setIsDeleteConfirmOpen(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete one or more candidates" });
    } finally { setIsDeleting(false); }
  };

  const handleImportExcel = async () => {
    if (!importFile) { toast({ title: 'No file selected', description: 'Please select an Excel file to import', variant: 'destructive' }); return; }
    setIsImporting(true); setImportResult(null);
    try {
      const fd = new FormData(); fd.append('file', importFile);
      const authH = await authHeaders();
      const response = await fetch(`${API_URL}/candidates/bulk-import`, {
        method: 'POST',
        headers: { ...authH },
        body: fd,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Import failed');
      const successCount = result.imported ?? 0;
      const createdCount = result.created ?? successCount;
      const updatedCount = result.updated ?? 0;
      const failCount = Math.max(0, (result.total ?? 0) - successCount);
      const errorMessages = (result.errors || []).map((e) => typeof e === 'string' ? e : `Row ${e.row} (${e.candidate}): ${e.error}`);
      setImportResult({ success: successCount, failed: failCount, errors: errorMessages });
      if (successCount > 0) {
        toast({ title: 'Import Successful', description: `${createdCount} added, ${updatedCount} updated.` });
        fetchData();
      } else {
        toast({ title: 'Nothing Imported', description: result.message || 'No candidates were added.', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Import Failed', description: error.message, variant: 'destructive' });
    } finally { setIsImporting(false); }
  };

  const handleWhatsApp = (c) => {
    if (!c.contact) return;
    let phone = c.contact.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;
    const firstName = c.name.split(' ')[0];
    const message = `Hi ${firstName}, this is regarding your job application for the ${c.position} position at ${c.client}. Are you available?`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  // ── Render Form function instead of Component to avoid cursor jump ──
  const renderCandidateForm = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
      {/* ── Section 1: Personal ── */}
      <div className="md:col-span-3 font-semibold border-b pb-1 text-slate-500 flex items-center gap-2"><UserCircle className="h-4 w-4" /> Personal Information</div>

      <div className="space-y-1">
        <Label className={errors.name ? "text-red-500" : ""}>Full Name *</Label>
        <Input value={formData.name} onChange={e => handleInputChange('name', e.target.value)} className={errors.name ? "border-red-500" : ""} placeholder="Letters only" />
        {errors.name && <span className="text-xs text-red-500">{errors.name}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.email ? "text-red-500" : ""}>Email *</Label>
        <Input value={formData.email} onChange={e => handleInputChange('email', e.target.value)} className={errors.email ? "border-red-500" : ""} placeholder="user@domain.com" />
        {errors.email && <span className="text-xs text-red-500">{errors.email}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.contact ? "text-red-500" : ""}>Phone *</Label>
        <Input value={formData.contact} onChange={e => handleInputChange('contact', e.target.value)} className={errors.contact ? "border-red-500" : ""} placeholder="10 Digits Only" />
        {errors.contact && <span className="text-xs text-red-500">{errors.contact}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.dateOfBirth ? "text-red-500" : ""}>Date of Birth</Label>
        <Input type="date" value={formData.dateOfBirth} onChange={e => handleInputChange('dateOfBirth', e.target.value)} className={errors.dateOfBirth ? "border-red-500" : ""} />
        {errors.dateOfBirth && <span className="text-xs text-red-500">{errors.dateOfBirth}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.gender ? "text-red-500" : ""}>Gender</Label>
        <NativeSelect value={formData.gender} onChange={val => handleInputChange('gender', val)} className={errors.gender ? "border-red-500" : ""}>
          <option value="">Select</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
          <option value="Not Specified">Not Specified</option>
        </NativeSelect>
        {errors.gender && <span className="text-xs text-red-500">{errors.gender}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.linkedin ? "text-red-500" : ""}>LinkedIn URL</Label>
        <div className="relative">
          <Linkedin className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <Input className={`pl-8 ${errors.linkedin ? "border-red-500" : ""}`} value={formData.linkedin} onChange={e => handleInputChange('linkedin', e.target.value)} placeholder="https://linkedin.com/in/..." />
        </div>
        {errors.linkedin && <span className="text-xs text-red-500">{errors.linkedin}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.currentLocation ? "text-red-500" : ""}>Current Location</Label>
        <Input value={formData.currentLocation} onChange={e => handleInputChange('currentLocation', e.target.value)} className={errors.currentLocation ? "border-red-500" : ""} />
        {errors.currentLocation && <span className="text-xs text-red-500">{errors.currentLocation}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.preferredLocation ? "text-red-500" : ""}>Preferred Location</Label>
        <Input value={formData.preferredLocation} onChange={e => handleInputChange('preferredLocation', e.target.value)} className={errors.preferredLocation ? "border-red-500" : ""} />
        {errors.preferredLocation && <span className="text-xs text-red-500">{errors.preferredLocation}</span>}
      </div>

      {/* ── Section 2: Professional ── */}
      <div className="md:col-span-3 font-semibold border-b pb-1 text-slate-500 mt-4 flex items-center gap-2"><Briefcase className="h-4 w-4" /> Professional Information</div>

      <div className="space-y-1">
        <Label className={errors.position ? "text-red-500" : ""}>Role (Position) *</Label>
        <Input value={formData.position} onChange={e => handleInputChange('position', e.target.value)} className={errors.position ? "border-red-500" : ""} placeholder="e.g. Frontend Developer" />
        {errors.position && <span className="text-xs text-red-500">{errors.position}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.client ? "text-red-500" : ""}>Client *</Label>
        <NativeSelect value={formData.client} onChange={val => handleInputChange('client', val)} className={errors.client ? "border-red-500" : ""}>
          <option value="">Select Client</option>
          {clients.map(client => <option key={client._id} value={client.companyName}>{client.companyName}</option>)}
        </NativeSelect>
        {errors.client && <span className="text-xs text-red-500">{errors.client}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.currentCompany ? "text-red-500" : ""}>Current Company</Label>
        <Input value={formData.currentCompany} onChange={e => handleInputChange('currentCompany', e.target.value)} className={errors.currentCompany ? "border-red-500" : ""} />
        {errors.currentCompany && <span className="text-xs text-red-500">{errors.currentCompany}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.industry ? "text-red-500" : ""}>Industry</Label>
        <Input value={formData.industry} onChange={e => handleInputChange('industry', e.target.value)} className={errors.industry ? "border-red-500" : ""} />
        {errors.industry && <span className="text-xs text-red-500">{errors.industry}</span>}
      </div>
      <div className="md:col-span-2 space-y-1">
        <Label className={errors.skills ? "text-red-500" : ""}>Skills (comma separated) *</Label>
        <Input value={formData.skills} onChange={e => handleInputChange('skills', e.target.value)} className={errors.skills ? "border-red-500" : ""} placeholder="e.g. React, Node.js" />
        {errors.skills && <span className="text-xs text-red-500">{errors.skills}</span>}
      </div>

      <div className="md:col-span-3 font-semibold text-slate-500 border-b pb-1 mt-4 flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Education</div>
      <div className="md:col-span-3 space-y-1">
        <Label className={errors.education ? "text-red-500" : ""}>Qualification</Label>
        <Input value={formData.education} onChange={e => handleInputChange('education', e.target.value)} className={errors.education ? "border-red-500" : ""} placeholder="e.g. B.Tech from IIT Delhi" />
        {errors.education && <span className="text-xs text-red-500">{errors.education}</span>}
      </div>

      {/* ── Section 3: Financial & Availability ── */}
      <div className="md:col-span-3 font-semibold text-slate-500 border-b pb-1 mt-4 flex items-center gap-2"><IndianRupee className="h-4 w-4" /> Experience & Availability</div>

      <div className="space-y-1">
        <Label className={errors.totalExperience ? "text-red-500" : ""}>Total Exp (Yrs)</Label>
        <Input value={formData.totalExperience} onChange={e => handleInputChange('totalExperience', e.target.value)} className={errors.totalExperience ? "border-red-500" : ""} placeholder="Numbers only (e.g. 3.5)" />
        {errors.totalExperience && <span className="text-xs text-red-500">{errors.totalExperience}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.relevantExperience ? "text-red-500" : ""}>Relevant Exp (Yrs)</Label>
        <Input value={formData.relevantExperience} onChange={e => handleInputChange('relevantExperience', e.target.value)} className={errors.relevantExperience ? "border-red-500" : ""} placeholder="Numbers only (e.g. 2)" />
        {errors.relevantExperience && <span className="text-xs text-red-500">{errors.relevantExperience}</span>}
      </div>

      <div className="space-y-1">
        <Label className={errors.ctc ? "text-red-500" : ""}>Current CTC (LPA)</Label>
        <Input value={formData.ctc} onChange={e => handleInputChange('ctc', e.target.value)} className={errors.ctc ? "border-red-500" : ""} />
        {errors.ctc && <span className="text-xs text-red-500">{errors.ctc}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.ectc ? "text-red-500" : ""}>Expected CTC (LPA)</Label>
        <Input value={formData.ectc} onChange={e => handleInputChange('ectc', e.target.value)} className={errors.ectc ? "border-red-500" : ""} />
        {errors.ectc && <span className="text-xs text-red-500">{errors.ectc}</span>}
      </div>

      <div className="space-y-1">
        <Label className={errors.currentTakeHome ? "text-red-500" : ""}>Current Take Home</Label>
        <Input value={formData.currentTakeHome} onChange={e => handleInputChange('currentTakeHome', e.target.value)} className={errors.currentTakeHome ? "border-red-500" : ""} />
        {errors.currentTakeHome && <span className="text-xs text-red-500">{errors.currentTakeHome}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.expectedTakeHome ? "text-red-500" : ""}>Expected Take Home</Label>
        <Input value={formData.expectedTakeHome} onChange={e => handleInputChange('expectedTakeHome', e.target.value)} className={errors.expectedTakeHome ? "border-red-500" : ""} />
        {errors.expectedTakeHome && <span className="text-xs text-red-500">{errors.expectedTakeHome}</span>}
      </div>

      <div className="space-y-1">
        <Label className={errors.noticePeriod ? "text-red-500" : ""}>Notice Period</Label>
        <Input value={formData.noticePeriod} onChange={e => handleInputChange('noticePeriod', e.target.value)} className={errors.noticePeriod ? "border-red-500" : ""} placeholder="e.g. 30 Days" />
        {errors.noticePeriod && <span className="text-xs text-red-500">{errors.noticePeriod}</span>}
      </div>

      <div className="space-y-1">
        <Label className={errors.servingNoticePeriod ? "text-red-500" : ""}>Serving Notice?</Label>
        <NativeSelect value={formData.servingNoticePeriod} onChange={val => handleInputChange('servingNoticePeriod', val)} className={errors.servingNoticePeriod ? "border-red-500" : ""}>
          <option value="false">No</option>
          <option value="true">Yes</option>
        </NativeSelect>
        {errors.servingNoticePeriod && <span className="text-xs text-red-500">{errors.servingNoticePeriod}</span>}
      </div>

      {formData.servingNoticePeriod === 'true' && (
        <div className="space-y-1">
          <Label className={errors.lwd ? "text-red-500" : ""}>LWD (Last Working Day) *</Label>
          <Input type="date" value={formData.lwd} onChange={e => handleInputChange('lwd', e.target.value)} className={errors.lwd ? "border-red-500" : ""} />
          {errors.lwd && <span className="text-xs text-red-500">{errors.lwd}</span>}
        </div>
      )}

      <div className="space-y-1 md:col-span-2">
        <Label className={errors.reasonForChange ? "text-red-500" : ""}>Reason For Change</Label>
        <textarea value={formData.reasonForChange} onChange={e => handleInputChange('reasonForChange', e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-sm h-10 ${errors.reasonForChange ? "border-red-500" : "border-slate-300"}`} />
        {errors.reasonForChange && <span className="text-xs text-red-500">{errors.reasonForChange}</span>}
      </div>

      <div className="space-y-1">
        <Label className={errors.offersInHand ? "text-red-500" : ""}>Offers in Hand?</Label>
        <NativeSelect value={formData.offersInHand} onChange={val => handleInputChange('offersInHand', val)} className={errors.offersInHand ? "border-red-500" : ""}>
          <option value="false">No</option>
          <option value="true">Yes</option>
        </NativeSelect>
        {errors.offersInHand && <span className="text-xs text-red-500">{errors.offersInHand}</span>}
      </div>
      
      {formData.offersInHand === 'true' && (
        <div className="space-y-1">
          <Label className={errors.offerPackage ? "text-red-500" : ""}>Package Amount *</Label>
          <Input value={formData.offerPackage} onChange={e => handleInputChange('offerPackage', e.target.value)} className={errors.offerPackage ? "border-red-500" : ""} placeholder="e.g. 15 LPA" />
          {errors.offerPackage && <span className="text-xs text-red-500">{errors.offerPackage}</span>}
        </div>
      )}

      {/* ── Section 4: Recruitment Status ── */}
      <div className="md:col-span-3 font-semibold text-slate-500 border-b pb-1 mt-4 flex items-center gap-2"><Target className="h-4 w-4" /> Recruitment Details</div>

      <div className="space-y-1">
        <Label className={errors.source ? "text-red-500" : ""}>Source *</Label>
        <NativeSelect value={isCustomSource ? 'Other' : formData.source} onChange={v => { if (v === 'Other') { setIsCustomSource(true); handleInputChange('source', '') } else { setIsCustomSource(false); handleInputChange('source', v) } }} className={errors.source ? "border-red-500" : ""}>
          {standardSources.map(s => <option key={s} value={s}>{s}</option>)}
          <option value="Other">Other</option>
        </NativeSelect>
        {isCustomSource && <Input className={`mt-1 ${errors.source ? "border-red-500" : ""}`} value={formData.source} onChange={e => handleInputChange('source', e.target.value)} placeholder="Enter Source" />}
        {errors.source && <span className="text-xs text-red-500">{errors.source}</span>}
      </div>

      <div className="space-y-1">
        <Label className={errors.status ? "text-red-500" : ""}>Status (Multi-select) *</Label>
        <div className={`border rounded-lg p-2 min-h-[42px] flex flex-wrap gap-2 bg-white ${errors.status ? 'border-red-500' : 'border-slate-300'}`}>
          {formData.status.length > 0 ? formData.status.map(status => (
            <Badge key={status} variant="secondary" className="flex items-center gap-1">
              {status}
              <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => removeStatus(status)} />
            </Badge>
          )) : <span className="text-sm text-slate-400 p-1">No status selected</span>}
        </div>
        <NativeSelect value="" onChange={addStatus}>
          <option value="">Add a status...</option>
          <option value="SELECT_ALL">✓ Select All</option>
          {allStatuses.map(status => <option key={status} value={status} disabled={formData.status.includes(status)}>{status}</option>)}
        </NativeSelect>
        {errors.status && <span className="text-xs text-red-500">{errors.status}</span>}
      </div>

      <div className="space-y-1">
        <Label className={errors.rating ? "text-red-500" : ""}>Rating</Label>
        <NativeSelect value={formData.rating} onChange={v => handleInputChange('rating', v)} className={errors.rating ? "border-red-500" : ""}>
          {[1, 2, 3, 4, 5].map(r => <option key={r} value={r.toString()}>{r} Stars</option>)}
        </NativeSelect>
        {errors.rating && <span className="text-xs text-red-500">{errors.rating}</span>}
      </div>
      <div className="space-y-1">
        <Label className={errors.dateAdded ? "text-red-500" : ""}>Date Added *</Label>
        <Input type="date" value={formData.dateAdded} onChange={e => handleInputChange('dateAdded', e.target.value)} className={errors.dateAdded ? "border-red-500" : ""} />
        {errors.dateAdded && <span className="text-xs text-red-500">{errors.dateAdded}</span>}
      </div>
      <div className="md:col-span-3 space-y-1 mt-2">
        <Label className={errors.remarks ? "text-red-500" : ""}>Remarks</Label>
        <textarea value={formData.remarks} onChange={e => handleInputChange('remarks', e.target.value)} className={`w-full border rounded-lg px-3 py-2 text-sm min-h-[80px] ${errors.remarks ? "border-red-500" : "border-slate-300"}`} />
        {errors.remarks && <span className="text-xs text-red-500">{errors.remarks}</span>}
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        /* Custom sleek horizontal scrollbar */
        .sleek-scrollbar::-webkit-scrollbar {
          height: 10px;
        }
        .sleek-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9; 
          border-radius: 6px;
        }
        .sleek-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1; 
          border-radius: 6px;
        }
        .sleek-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8; 
        }
      `}</style>

      {/* ✨ CRITICAL FIX 1: Added grid-cols-1, min-w-0, and overflow-x-hidden here to lock width */}
      <main className="flex-1 grid grid-cols-1 min-w-0 w-full p-6 overflow-y-auto overflow-x-hidden pb-48">
        
        {/* ✨ CRITICAL FIX 2: Set width bounds strictly */}
        <div className="w-full max-w-full mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">
                {/* Dynamically Show correct title */}
                {(userRole === 'admin' || userRole === 'manager') ? 'My Candidates' : 'My Candidates'}
              </h1>
              <p className="text-slate-500">Manage pipeline</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              {selectedCandidates.length > 0 && (
                <Button variant="destructive" onClick={() => setIsDeleteConfirmOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedCandidates.length})
                </Button>
              )}
              <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Export</Button>
              <Button variant="outline" className="border-green-500 text-green-700 hover:bg-green-50" onClick={() => { setIsImportDialogOpen(true); setImportFile(null); setImportResult(null); }}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Excel
              </Button>
              <Button onClick={() => { setFormData(initialFormState); setErrors({}); setIsAddDialogOpen(true); setIsCustomSource(false); }}>
                <Plus className="mr-2 h-4 w-4" /> Add Candidate
              </Button>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard title="Overall Submissions" value={stats.total} color="blue" active={activeStatFilter === null} onClick={() => { setActiveStatFilter(null); setStatusFilter('all'); }} />
            <StatCard title="Turnups" value={stats.turnups} color="cyan" active={activeStatFilter === 'Turnups'} onClick={() => { setActiveStatFilter('Turnups'); setStatusFilter('all'); }} />
            <StatCard title="No Show" value={stats.noShow} color="indigo" active={activeStatFilter === 'No Show'} onClick={() => { setActiveStatFilter('No Show'); setStatusFilter('all'); }} />
            <StatCard title="Yet to attend" value={stats.yetToAttend} color="purple" active={activeStatFilter === 'Yet to attend'} onClick={() => { setActiveStatFilter('Yet to attend'); setStatusFilter('all'); }} />
            <StatCard title="Selected" value={stats.selected} color="green" active={activeStatFilter === 'Selected'} onClick={() => { setActiveStatFilter('Selected'); setStatusFilter('all'); }} />
            <StatCard title="Rejected" value={stats.rejected} color="red" active={activeStatFilter === 'Rejected'} onClick={() => { setActiveStatFilter('Rejected'); setStatusFilter('all'); }} />
            <StatCard title="Hold" value={stats.hold} color="amber" active={activeStatFilter === 'Hold'} onClick={() => { setActiveStatFilter('Hold'); setStatusFilter('all'); }} />
            <StatCard title="Pipeline" value={stats.pipeline} color="orange" active={activeStatFilter === 'Pipeline'} onClick={() => setActiveStatFilter('Pipeline')} />
            <StatCard title="Joined" value={stats.joined} color="emerald" active={activeStatFilter === 'Joined'} onClick={() => setActiveStatFilter('Joined')} />
            <StatCard title="Backout" value={stats.backout} color="red" active={activeStatFilter === 'Backout'} onClick={() => { setActiveStatFilter('Backout'); setStatusFilter('all'); }} />
            <StatCard title="Shared Profiles" value={stats.sharedProfiles} color="cyan" active={activeStatFilter === 'Shared Profiles'} onClick={() => { setActiveStatFilter('Shared Profiles'); setStatusFilter('all'); }} />
          </div>

          {/* Filters */}
          <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input placeholder="Search name, ID or skills..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <NativeSelect value={statusFilter} onChange={setStatusFilter} className="w-44">
                  <option value="all">All Status</option>
                  {allStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                </NativeSelect>
                <div className="flex bg-slate-100 rounded-lg p-1">
                  <button className={`p-2 rounded text-sm ${viewMode === 'table' ? 'bg-white shadow' : ''}`} onClick={() => setViewMode('table')}><List className="h-4 w-4" /></button>
                  <button className={`p-2 rounded text-sm ${viewMode === 'grid' ? 'bg-white shadow' : ''}`} onClick={() => setViewMode('grid')}><LayoutGrid className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          </div>

          {/* Table View With Double Custom Scrollbar */}
          {viewMode === 'table' ? (
            
            // ✨ CRITICAL FIX 3: Boxed in the wrapper so it doesn't leak size
            <div className="w-full overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white flex flex-col">
              
              {/* TOP SCROLLBAR (Sleek) */}
              <div 
                ref={topScrollRef} 
                onScroll={handleTopScroll} 
                className="w-full overflow-x-auto overflow-y-hidden sleek-scrollbar rounded-t-xl bg-slate-50 border-b border-slate-100"
                style={{ height: '10px' }}
              >
                <div style={{ width: '1600px', height: '1px' }}></div>
              </div>

              {/* TABLE CONTAINER */}
              <div ref={bottomScrollRef} onScroll={handleBottomScroll} className="w-full overflow-x-auto sleek-scrollbar rounded-b-xl">
                <table className="w-full text-sm text-left border-collapse min-w-[1600px]">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                    <tr>
                      <th className="p-4 w-12 whitespace-nowrap"><input type="checkbox" checked={getFilteredCandidates.length > 0 && selectedCandidates.length === getFilteredCandidates.length} onChange={selectAllCandidates} className="h-4 w-4 rounded border-slate-300" /></th>
                      <th className="p-3 whitespace-nowrap">ID</th>
                      <th className="p-3 whitespace-nowrap">Name</th>
                      <th className="p-3 whitespace-nowrap">Phone</th>
                      <th className="p-3 whitespace-nowrap">Email</th>
                      <th className="p-3 whitespace-nowrap">Client</th>
                      <th className="p-3 whitespace-nowrap">Skills</th>
                      <th className="p-3 whitespace-nowrap">Date Added</th>
                      <th className="p-3 whitespace-nowrap">Experience</th>
                      <th className="p-3 whitespace-nowrap">CTC / ECTC</th>
                      <th className="p-3 whitespace-nowrap">Status</th>
                      <th className="p-3 whitespace-nowrap">Remarks</th>
                      <th className="p-3 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {getFilteredCandidates.map((c, index) => {
                      return (
                      <tr key={c._id} className="hover:bg-slate-50">
                        <td className="p-3 pl-4 whitespace-nowrap"><input type="checkbox" checked={selectedCandidates.includes(c._id)} onChange={() => toggleSelectCandidate(c._id)} className="h-4 w-4 rounded" /></td>
                        <td className="p-3 font-mono text-xs text-blue-600 font-bold cursor-pointer whitespace-nowrap" onClick={() => { navigator.clipboard.writeText(getCandidateId(c)); toast({ title: "Copied ID" }); }}>{getCandidateId(c)}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-900">{c.name}</span>
                        </td>
                        <td className="p-3 text-sm text-slate-600 whitespace-nowrap">
                          <div className="flex items-center gap-2">{c.contact}
                            <button className="text-green-600 hover:text-green-700" onClick={() => handleWhatsApp(c)}><MessageCircle className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                        <td className="p-3 text-sm text-slate-600 whitespace-nowrap"><span className="truncate max-w-[150px] block" title={c.email}>{c.email}</span></td>
                        <td className="p-3 text-slate-600 whitespace-nowrap">{c.client}</td>
                        <td className="p-3 text-xs text-slate-600 max-w-[150px] truncate whitespace-nowrap" title={Array.isArray(c.skills) ? c.skills.join(', ') : c.skills}>{formatSkills(c.skills)}</td>
                        <td className="p-3 text-sm text-slate-600 whitespace-nowrap">{formatDate(c.dateAdded || c.createdAt)}</td>
                        <td className="p-3 text-sm whitespace-nowrap">{c.totalExperience ? `${c.totalExperience} Yrs` : '-'}</td>
                        <td className="p-3 text-xs whitespace-nowrap"><div>{c.ctc || '-'}</div><div className="text-green-600">{c.ectc || '-'}</div></td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(c.status) ? c.status.map(s => (
                              <Badge key={s} variant={getStatusBadgeVariant(s)} className="text-[10px] px-1 py-0 whitespace-nowrap">{s}</Badge>
                            )) : <Badge variant={getStatusBadgeVariant(c.status)} className="whitespace-nowrap">{c.status}</Badge>}
                          </div>
                        </td>
                        <td className="p-3 text-xs text-slate-500 truncate max-w-[150px] whitespace-nowrap">{c.remarks || '-'}</td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1">
                            <button className="p-1 hover:bg-slate-100 rounded" onClick={() => openViewDialog(c)}><Eye className="h-3.5 w-3.5 text-blue-600" /></button>
                            <button className="p-1 hover:bg-slate-100 rounded" onClick={() => openEditDialog(c)}><Edit className="h-3.5 w-3.5 text-slate-600" /></button>
                            <button className="p-1 hover:bg-slate-100 rounded" onClick={() => toggleActiveStatus(c._id, c.active !== false)}><Ban className="h-3.5 w-3.5 text-red-600" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getFilteredCandidates.map(c => (
                <div key={c._id} className="bg-white border border-slate-200 rounded-xl hover:shadow-lg transition-all p-6">
                  <div className="flex justify-between mb-4">
                    <div className="flex gap-3">
                      <div>
                        <h3 className="font-bold text-slate-900">{c.name}</h3>
                        <p className="text-sm text-blue-600 font-mono">{getCandidateId(c)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end max-w-[50%]">
                      {Array.isArray(c.status) ? c.status.slice(0, 2).map(s => (
                        <Badge key={s} variant={getStatusBadgeVariant(s)} className="text-[10px]">{s}</Badge>
                      )) : <Badge variant={getStatusBadgeVariant(c.status)}>{c.status}</Badge>}
                      {Array.isArray(c.status) && c.status.length > 2 && <span className="text-xs text-slate-500">+{c.status.length - 2}</span>}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2"><Building className="h-4 w-4" /> {c.client}</div>
                    <div className="flex items-center gap-2"><Award className="h-4 w-4" /> {formatSkills(c.skills)}</div>
                    <div className="flex items-center gap-2"><Mail className="h-4 w-4" /> {c.email}</div>
                    <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> {c.contact}</div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => openViewDialog(c)}>View</Button>
                    <Button variant="outline" className="flex-1" onClick={() => openEditDialog(c)}>Edit</Button>
                    <Button variant="outline" className="text-green-600 hover:bg-green-50" onClick={() => handleWhatsApp(c)}><MessageCircle className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirm Modal */}
      <Modal open={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)}>
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-5 w-5" /> Confirm Deletion</ModalTitle>
          <ModalDesc>Are you sure you want to delete <strong>{selectedCandidates.length}</strong> selected candidate(s)? This action cannot be undone.</ModalDesc>
        </ModalHeader>
        <ModalFooter>
          <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)} disabled={isDeleting}>Cancel</Button>
          <Button variant="destructive" onClick={handleBulkDelete} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete
          </Button>
        </ModalFooter>
      </Modal>

      {/* Add / Edit Modal */}
      <Modal open={isAddDialogOpen || isEditDialogOpen} onClose={() => { setIsAddDialogOpen(false); setIsEditDialogOpen(false); }} maxWidth="max-w-6xl">
        <ModalHeader>
          <ModalTitle>{isEditDialogOpen ? 'Edit Candidate' : 'Add New Candidate'}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {!isEditDialogOpen && (
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 bg-slate-50 mb-4">
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-full"><FileUp className="h-6 w-6 text-blue-600" /></div>
                <div className="text-center">
                  <h3 className="font-semibold text-slate-900 mb-1">Upload Resume to Auto-Fill</h3>
                  <p className="text-sm text-slate-500 mb-3">Upload PDF or DOC/DOCX file (max 5MB)</p>
                </div>
                <label htmlFor="resume-upload-recruiter">
                  <input id="resume-upload-recruiter" type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} className="hidden" disabled={isParsingResume} />
                  <Button type="button" variant="outline" disabled={isParsingResume} onClick={() => document.getElementById('resume-upload-recruiter')?.click()}>
                    {isParsingResume ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Parsing...</> : <><Upload className="mr-2 h-4 w-4" />Choose File</>}
                  </Button>
                </label>
              </div>
            </div>
          )}
          {renderCandidateForm()}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setIsEditDialogOpen(false); }}>Cancel</Button>
          <Button onClick={() => handleSave(isEditDialogOpen)} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} {isEditDialogOpen ? "Update" : "Save"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Import Modal */}
      <Modal open={isImportDialogOpen} onClose={() => { setIsImportDialogOpen(false); setImportFile(null); setImportResult(null); }}>
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-green-600" /> Import Candidates from Excel</ModalTitle>
          <ModalDesc>Upload an Excel file (.xlsx / .xls) to bulk-import candidates.</ModalDesc>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-semibold mb-1">Required Excel Columns:</p>
              <p className="text-xs text-blue-700 leading-relaxed">name, email, contact, position, client, skills, totalExperience, ctc, ectc, noticePeriod, currentCompany, currentLocation, source, status</p>
              <button className="text-blue-600 text-xs underline mt-1" onClick={() => {
                const headers = ['name', 'email', 'contact', 'position', 'client', 'skills', 'totalExperience', 'ctc', 'ectc', 'noticePeriod', 'currentCompany', 'currentLocation', 'source', 'status'];
                const exampleRow = ['John Doe', 'john@example.com', '9876543210', 'Software Engineer', 'Acme Corp', 'React,Node.js', '3', '6 LPA', '8 LPA', '30 days', 'TCS', 'Bangalore', 'Portal', 'Submitted'];
                const csv = [headers.join(','), exampleRow.join(',')].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'candidate_import_template.csv'; a.click();
              }}>↓ Download Template (CSV)</button>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors" onClick={() => document.getElementById('excel-import-input')?.click()}>
              <FileSpreadsheet className="h-10 w-10 text-slate-400 mx-auto mb-2" />
              {importFile ? (
                <div><p className="font-semibold text-green-700">{importFile.name}</p><p className="text-xs text-slate-500">{(importFile.size / 1024).toFixed(1)} KB</p></div>
              ) : (
                <div><p className="text-slate-600 font-medium">Click to choose Excel file</p><p className="text-xs text-slate-400 mt-1">.xlsx or .xls, max 10MB</p></div>
              )}
              <input id="excel-import-input" type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }} />
            </div>

            {importResult && (
              <div className={`rounded-lg p-4 text-sm ${importResult.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                <p className="font-semibold text-green-700">✅ {importResult.success} candidate(s) processed successfully</p>
                {importResult.failed > 0 && (
                  <div className="mt-2">
                    <p className="font-semibold text-red-600">❌ {importResult.failed} rows failed</p>
                    <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-red-600 space-y-1">
                      {importResult.errors.map((err, i) => <li key={i}>• {err}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>Cancel</Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={!importFile || isImporting} onClick={handleImportExcel}>
            {isImporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing...</> : <><FileSpreadsheet className="mr-2 h-4 w-4" />Import Now</>}
          </Button>
        </ModalFooter>
      </Modal>

      {/* View Modal */}
      {viewingCandidate && (
        <Modal open={isViewDialogOpen} onClose={() => setIsViewDialogOpen(false)} maxWidth="max-w-4xl">
          <ModalHeader>
            <div className="flex items-center gap-3">
              <div>
                <ModalTitle className="text-xl">{viewingCandidate.name}</ModalTitle>
                <p className="text-sm font-mono text-blue-600">ID: {getCandidateId(viewingCandidate)}</p>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                {Array.isArray(viewingCandidate.status) ? viewingCandidate.status.map(s => <Badge key={s} variant={getStatusBadgeVariant(s)}>{s}</Badge>) : <Badge variant={getStatusBadgeVariant(viewingCandidate.status)}>{viewingCandidate.status}</Badge>}
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                <h3 className="font-semibold text-slate-800 border-b pb-2 flex items-center gap-2"><UserCircle className="h-4 w-4" /> Personal Information</h3>
                <div className="grid grid-cols-2 gap-y-3 text-sm">
                  <div><Label className="text-xs text-slate-500">Email</Label><div>{viewingCandidate.email}</div></div>
                  <div><Label className="text-xs text-slate-500">Phone</Label>
                    <div className="flex items-center gap-2">
                      <div>{viewingCandidate.contact}</div>
                      <button className="text-green-600" onClick={() => handleWhatsApp(viewingCandidate)}><MessageCircle className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div><Label className="text-xs text-slate-500">Date of Birth</Label><div>{formatDate(viewingCandidate.dateOfBirth)}</div></div>
                  <div><Label className="text-xs text-slate-500">Gender</Label><div>{viewingCandidate.gender || '-'}</div></div>
                  <div className="col-span-2"><Label className="text-xs text-slate-500">LinkedIn</Label><div>{viewingCandidate.linkedin ? <a href={viewingCandidate.linkedin} target="_blank" className="text-blue-600 hover:underline">{viewingCandidate.linkedin}</a> : '-'}</div></div>
                  <div><Label className="text-xs text-slate-500">Current Location</Label><div>{viewingCandidate.currentLocation || '-'}</div></div>
                  <div><Label className="text-xs text-slate-500">Preferred Location</Label><div>{viewingCandidate.preferredLocation || '-'}</div></div>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                <h3 className="font-semibold text-slate-800 border-b pb-2 flex items-center gap-2"><Briefcase className="h-4 w-4" /> Professional Details</h3>
                <div className="grid grid-cols-2 gap-y-3 text-sm">
                  <div><Label className="text-xs text-slate-500">Position</Label><div>{viewingCandidate.position}</div></div>
                  <div><Label className="text-xs text-slate-500">Client</Label><div>{viewingCandidate.client}</div></div>
                  <div><Label className="text-xs text-slate-500">Industry</Label><div>{viewingCandidate.industry || '-'}</div></div>
                  <div><Label className="text-xs text-slate-500">Current Company</Label><div>{viewingCandidate.currentCompany || '-'}</div></div>
                  <div className="col-span-2"><Label className="text-xs text-slate-500">Skills</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Array.isArray(viewingCandidate.skills) ? viewingCandidate.skills.map(s => <Badge key={s} variant="outline" className="bg-white">{s}</Badge>) : viewingCandidate.skills}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>Close</Button>
            <Button onClick={() => { setIsViewDialogOpen(false); openEditDialog(viewingCandidate); }}>Edit Candidate</Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}

const StatCard = ({ title, value, color, active, onClick }) => {
  const styles = {
    blue: "border-l-blue-500 text-blue-600 bg-blue-50/50",
    cyan: "border-l-cyan-500 text-cyan-600 bg-cyan-50/50",
    purple: "border-l-purple-500 text-purple-600 bg-purple-50/50",
    indigo: "border-l-indigo-500 text-indigo-600 bg-indigo-50/50",
    rose: "border-l-rose-500 text-rose-600 bg-rose-50/50",
    green: "border-l-green-500 text-green-600 bg-green-50/50",
    emerald: "border-l-emerald-500 text-emerald-600 bg-emerald-50/50",
    red: "border-l-red-500 text-red-600 bg-red-50/50",
    orange: "border-l-orange-500 text-orange-600 bg-orange-50/50",
    amber: "border-l-amber-500 text-amber-600 bg-amber-50/50",
  };
  const currentStyle = styles[color] || styles.blue;
  return (
    <div onClick={onClick} className={`p-4 rounded-lg shadow-sm border border-slate-200 border-l-4 cursor-pointer hover:shadow-md transition-all relative overflow-hidden bg-white ${currentStyle} ${active ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}>
      <div className="flex justify-between items-center relative z-10">
        <div>
          <h3 className="text-2xl font-bold">{value}</h3>
          <p className="text-sm font-medium opacity-80">{title}</p>
        </div>
      </div>
      {active && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600 animate-pulse" />}
    </div>
  );
};