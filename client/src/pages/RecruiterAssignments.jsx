import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  BriefcaseIcon, MapPinIcon, CurrencyDollarIcon,
  Squares2X2Icon, ListBulletIcon, EyeIcon, XMarkIcon, 
  BuildingOfficeIcon, PlusIcon, UserGroupIcon, MagnifyingGlassIcon,
  TrashIcon, UserCircleIcon
} from "@heroicons/react/24/outline";
import { useToast } from "@/hooks/use-toast";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ── Plain Tailwind UI Helpers ────────────────────────────────────────────────

const Badge = ({ children, className = '' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
    {children}
  </span>
);

const getTatBadge = (tatTime) => {
  if (!tatTime) return <Badge className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">N/A</Badge>;
  const diffDays = Math.ceil((new Date(tatTime).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
  if (diffDays < 0) return <Badge className="bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30">Expired</Badge>;
  if (diffDays <= 3) return <Badge className="bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30">Due: {diffDays}d</Badge>;
  return <Badge className="bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30">{diffDays} days left</Badge>;
};

// Modal component
const Modal = ({ open, onClose, children, maxWidth = 'max-w-2xl' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      <div className={`relative bg-white dark:bg-zinc-950 rounded-xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800`}>
        {children}
      </div>
    </div>
  );
};

const ModalHeader = ({ children }) => <div className="px-6 pt-6 pb-2 border-b border-zinc-100 dark:border-zinc-800 mb-4">{children}</div>;
const ModalTitle = ({ children }) => <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{children}</h2>;
const ModalDesc = ({ children }) => <p className="text-sm text-zinc-500 mt-1 pb-4">{children}</p>;
const ModalFooter = ({ children }) => <div className="px-6 pb-6 pt-4 flex justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800 mt-4">{children}</div>;
const ModalBody = ({ children }) => <div className="px-6 py-2">{children}</div>;

const Button = ({ children, onClick, disabled, className = '', variant = 'default', size = 'md' }) => {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none shadow-sm';
  const sizes = { sm: 'px-2 py-1 text-xs', md: 'px-4 py-2 text-sm', icon: 'p-2' };
  const variants = {
    default: 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200',
    outline: 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800',
    ghost: 'bg-transparent text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 shadow-none',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size] ?? sizes.md} ${variants[variant] ?? variants.default} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ className = '', ...props }) => (
  <input className={`w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 placeholder-zinc-400 ${className}`} {...props}/>
);

const Label = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">{children}</label>
);

const NativeSelect = ({ value, onChange, children, disabled, className = '' }) => (
  <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
    className={`w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${className}`}>
    {children}
  </select>
);

// ─────────────────────────────────────────────────────────────────────────────

export default function RecruiterAssignments() {
  const { authHeaders } = useAuth(); // ✅ FIX: Use dynamic auth headers
  const { toast } = useToast();
  
  const [jobs, setJobs] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  
  const [submitting, setSubmitting] = useState(false);

  const initialJobForm = {
    jobCode: '', clientName: '', position: '', skills: '', salaryBudget: '',
    location: '', experience: '', gender: 'Any', interviewMode: 'Virtual',
    tatTime: '', jdLink: '', comments: '', primaryRecruiter: '', secondaryRecruiter: ''
  };

  const [jobForm, setJobForm] = useState(initialJobForm);

  const [clientForm, setClientForm] = useState({
    companyName: '', industry: '', location: '', website: '', contactPerson: '', email: '', phone: ''
  });

  // ✅ FIX: Standardized header fetch function
  const getAuthHeader = async () => {
    const h = await authHeaders();
    return { 'Content-Type': 'application/json', ...h };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader(); // ✅ Inject headers
      const [resJobs, resRecs, resClients] = await Promise.all([
        fetch(`${API_URL}/jobs`, { headers }),
        fetch(`${API_URL}/users/active-list`, { headers }),
        fetch(`${API_URL}/clients`, { headers })
      ]);
      if (resJobs.ok) {
        const data = await resJobs.json();
        setJobs(data.map((j) => ({ ...j, id: j._id })));
      }
      if (resRecs.ok) setRecruiters(await resRecs.json());
      if (resClients.ok) setClients(await resClients.json());
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to fetch data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // STANDARD NAME FORMATTING LOGIC
  const formatRecruiterName = (r) => {
    if (r.firstName && r.lastName) return `${r.firstName} ${r.lastName}`;
    return r.name || r.username || r.fullName || r.firstName || r.email || 'Unknown';
  };

  const handleCreateClient = async () => {
    if (!clientForm.companyName.trim()) return toast({ title: "Validation", description: "Company Name is required", variant: "destructive" });
    if (!clientForm.contactPerson.trim()) return toast({ title: "Validation", description: "Contact Person is required", variant: "destructive" });
    if (!clientForm.email.trim()) return toast({ title: "Validation", description: "Email is required", variant: "destructive" });

    setSubmitting(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/clients`, {
        method: 'POST',
        headers,
        body: JSON.stringify(clientForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create client");
      toast({ title: "Success", description: "Client added successfully" });
      setIsClientModalOpen(false);
      fetchData();
      setClientForm({ companyName: '', industry: '', location: '', website: '', contactPerson: '', email: '', phone: '' });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const openViewModal = (job) => {
    setJobForm({
      jobCode: job.jobCode || '',
      clientName: job.clientName || '',
      position: job.position || '',
      skills: job.skills || '',
      salaryBudget: job.salaryBudget || '',
      location: job.location || '',
      experience: job.experience || '',
      gender: job.gender || 'Any',
      interviewMode: job.interviewMode || 'Virtual',
      tatTime: job.tatTime ? new Date(job.tatTime).toISOString().split('T')[0] : '',
      jdLink: job.jdLink || '',
      comments: job.comments || '',
      primaryRecruiter: job.primaryRecruiter || '',
      secondaryRecruiter: job.secondaryRecruiter || ''
    });
    setSelectedJob(job);
    setIsEditMode(true);
    setIsJobModalOpen(true);
  };

  const handleCreateJob = async () => {
    if (!jobForm.jobCode.trim()) return toast({ title: "Validation", description: "Job Code is required", variant: "destructive" });
    if (!jobForm.position.trim()) return toast({ title: "Validation", description: "Position is required", variant: "destructive" });
    if (!jobForm.clientName) return toast({ title: "Validation", description: "Client is required", variant: "destructive" });
    
    setSubmitting(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/jobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(jobForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create job");
      toast({ title: "Success", description: "New requirement posted successfully" });
      setIsJobModalOpen(false);
      fetchData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!jobToDelete) return;
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/jobs/${jobToDelete._id}`, {
        method: 'DELETE',
        headers
      });
      if (!res.ok) throw new Error("Failed to delete job");
      toast({ title: "Success", description: "Job deleted successfully" });
      setDeleteDialogOpen(false);
      setJobToDelete(null);
      setSelectedJob(null);
      fetchData();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const query = searchQuery.toLowerCase();
      return (
        job.position?.toLowerCase().includes(query) ||
        job.clientName?.toLowerCase().includes(query) ||
        job.jobCode?.toLowerCase().includes(query) ||
        job.location?.toLowerCase().includes(query)
      );
    });
  }, [jobs, searchQuery]);

  return (
    <>
      <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 min-h-screen text-zinc-900 dark:text-zinc-100">
        <div className="max-w-[1600px] mx-auto space-y-8">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">My Assignments</h1>
              <p className="text-zinc-500 mt-1 flex items-center gap-2">
                <UserCircleIcon className="w-4 h-4 text-blue-600" />
                Showing jobs assigned to you
              </p>
            </div>
          </div>

          {/* Search / View Toggle */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-zinc-900 p-3 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
            <div className="relative w-full md:w-96">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400"/>
              <input 
                type="text" 
                placeholder="Search by Job Code, Role or Client..." 
                className="w-full pl-9 p-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>
                <Squares2X2Icon className="w-5 h-5"/>
              </button>
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>
                <ListBulletIcon className="w-5 h-5"/>
              </button>
            </div>
          </div>

          {/* Jobs Grid / List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-10 w-10 border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-100 rounded-full animate-spin mb-4" />
              <p className="text-zinc-500 font-medium">Fetching assignments...</p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <BriefcaseIcon className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-4"/>
              <p className="text-zinc-500 text-lg">No assigned jobs found.</p>
              <p className="text-zinc-400 text-sm mt-1">You haven't been assigned to any active requirements yet.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredJobs.map(job => (
                <div key={job.id} className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 hover:shadow-md transition-all relative group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700">{job.jobCode}</span>
                      <h3 className="text-lg font-bold mt-2.5 text-zinc-900 dark:text-white truncate max-w-[200px]" title={job.position}>{job.position}</h3>
                      <p className="text-sm text-zinc-500 flex items-center gap-1.5 mt-1"><BuildingOfficeIcon className="w-4 h-4"/> {job.clientName}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm mb-4 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-lg border border-zinc-100 dark:border-zinc-800/50">
                    <div className="flex justify-between items-center"><span className="text-zinc-500">Location:</span> <span className="font-medium text-zinc-900 dark:text-zinc-100">{job.location || 'Remote'}</span></div>
                    <div className="flex justify-between items-center"><span className="text-zinc-500">Target Date:</span> {getTatBadge(job.tatTime)}</div>
                  </div>
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button className="h-8 w-8 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg transition-colors" onClick={() => openViewModal(job)}>
                      <EyeIcon className="w-4 h-4"/>
                    </button>
                    {/* Only show delete if user created it or has permission - simplistic check here */}
                    <button className="h-8 w-8 flex items-center justify-center text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" onClick={() => { setJobToDelete(job); setDeleteDialogOpen(true); }}>
                      <TrashIcon className="w-4 h-4"/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 uppercase text-xs">
                  <tr>
                    <th className="p-4 font-semibold">Job Code</th>
                    <th className="p-4 font-semibold">Position</th>
                    <th className="p-4 font-semibold">Client</th>
                    <th className="p-4 font-semibold">Location</th>
                    <th className="p-4 font-semibold">TAT</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredJobs.map(job => (
                    <tr key={job.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                      <td className="p-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">{job.jobCode}</td>
                      <td className="p-4 font-medium text-zinc-900 dark:text-white">{job.position}</td>
                      <td className="p-4 text-zinc-600 dark:text-zinc-400">{job.clientName}</td>
                      <td className="p-4 text-zinc-600 dark:text-zinc-400">{job.location}</td>
                      <td className="p-4">{getTatBadge(job.tatTime)}</td>
                      <td className="p-4 flex gap-2 justify-end">
                        <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors" onClick={() => openViewModal(job)}><EyeIcon className="w-4 h-4"/></button>
                        <button className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500 transition-colors" onClick={() => { setJobToDelete(job); setDeleteDialogOpen(true); }}><TrashIcon className="w-4 h-4"/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Post / View Requirement Modal */}
      <Modal open={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} maxWidth="max-w-4xl">
        <ModalHeader>
          <ModalTitle>{isEditMode ? 'View Job Requirement' : 'Post New Requirement'}</ModalTitle>
          <ModalDesc>{isEditMode ? 'Job details are read-only.' : 'Fill in the details below. Fields marked with * are required.'}</ModalDesc>
        </ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="jobCode">Job Code *</Label>
              <Input id="jobCode" placeholder="e.g. JB-1001" value={jobForm.jobCode} onChange={e => setJobForm({...jobForm, jobCode: e.target.value})} disabled={isEditMode}/>
            </div>
            <div>
              <Label htmlFor="clientName">Client *</Label>
              <NativeSelect value={jobForm.clientName} onChange={val => setJobForm({...jobForm, clientName: val})} disabled={isEditMode}>
                <option value="">Select Client</option>
                {clients.map(c => <option key={c._id} value={c.companyName}>{c.companyName}</option>)}
              </NativeSelect>
              {!isEditMode && clients.length === 0 && <div className="text-xs text-red-500 mt-1">No clients found. Please add a client first.</div>}
            </div>
            <div>
              <Label htmlFor="position">Position Title *</Label>
              <Input id="position" placeholder="e.g. React Developer" value={jobForm.position} onChange={e => setJobForm({...jobForm, position: e.target.value})} disabled={isEditMode}/>
            </div>
            <div>
              <Label htmlFor="salaryBudget">Salary Budget</Label>
              <Input id="salaryBudget" placeholder="e.g. 15 LPA" value={jobForm.salaryBudget} onChange={e => setJobForm({...jobForm, salaryBudget: e.target.value})} disabled={isEditMode}/>
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={jobForm.location} onChange={e => setJobForm({...jobForm, location: e.target.value})} disabled={isEditMode}/>
            </div>
            <div>
              <Label htmlFor="experience">Experience</Label>
              <Input id="experience" placeholder="e.g. 3-5 Years" value={jobForm.experience} onChange={e => setJobForm({...jobForm, experience: e.target.value})} disabled={isEditMode}/>
            </div>
            <div>
              <Label htmlFor="tatTime">Target Date (TAT)</Label>
              <Input id="tatTime" type="date" value={jobForm.tatTime} onChange={e => setJobForm({...jobForm, tatTime: e.target.value})} disabled={isEditMode}/>
            </div>
            <div>
              <Label>Interview Mode</Label>
              <NativeSelect value={jobForm.interviewMode} onChange={val => setJobForm({...jobForm, interviewMode: val})} disabled={isEditMode}>
                <option value="Virtual">Virtual</option>
                <option value="In-Person">In-Person</option>
                <option value="Hybrid">Hybrid</option>
              </NativeSelect>
            </div>

            <div className="col-span-1 md:col-span-2 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-zinc-900 dark:text-white"><UserGroupIcon className="w-4 h-4"/> Assign Recruiters</h4>
            </div>

            <div>
              <Label>Primary Recruiter</Label>
              <NativeSelect value={jobForm.primaryRecruiter} onChange={val => setJobForm({...jobForm, primaryRecruiter: val})} disabled={isEditMode}>
                <option value="">Select Recruiter</option>
                <option value="Unassigned">None</option>
                {/* Updated to show Full Name */}
                {recruiters.map(r => {
                  const name = formatRecruiterName(r);
                  return <option key={r._id} value={name}>{name}</option>;
                })}
              </NativeSelect>
            </div>
            <div>
              <Label>Secondary Recruiter</Label>
              <NativeSelect value={jobForm.secondaryRecruiter} onChange={val => setJobForm({...jobForm, secondaryRecruiter: val})} disabled={isEditMode}>
                <option value="">Select Recruiter</option>
                <option value="Unassigned">None</option>
                {recruiters.map(r => {
                  const name = formatRecruiterName(r);
                  return <option key={r._id} value={name}>{name}</option>;
                })}
              </NativeSelect>
            </div>

            <div className="col-span-1 md:col-span-2">
              <Label>Required Skills</Label>
              <textarea className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm min-h-[80px] bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 placeholder-zinc-400" value={jobForm.skills} onChange={e => setJobForm({...jobForm, skills: e.target.value})} disabled={isEditMode}/>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          {isEditMode ? (
            <Button onClick={() => setIsJobModalOpen(false)}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsJobModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateJob} disabled={submitting}>
                {submitting ? 'Saving...' : 'Post Requirement'}
              </Button>
            </>
          )}
        </ModalFooter>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <ModalHeader>
          <ModalTitle>Delete Requirement?</ModalTitle>
          <ModalDesc>This will permanently delete the job <strong>{jobToDelete?.jobCode}</strong>. This action cannot be undone.</ModalDesc>
        </ModalHeader>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDeleteJob}>Delete</Button>
        </ModalFooter>
      </Modal>
    </>
  );
}