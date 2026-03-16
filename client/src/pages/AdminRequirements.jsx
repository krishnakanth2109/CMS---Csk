import React, { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  XMarkIcon, EyeIcon, PencilIcon, PlusIcon, CheckCircleIcon, NoSymbolIcon,
  BriefcaseIcon, AcademicCapIcon, BuildingOfficeIcon, CalendarIcon, MapPinIcon,
  TrashIcon 
} from "@heroicons/react/24/outline";

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = `${BASE_URL}/api`;

const inputCls = "w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-zinc-500 bg-white dark:bg-zinc-900 dark:text-zinc-100 transition-shadow placeholder-zinc-400";

/* ---------------- JOB DETAIL MODAL ---------------- */
const JobDetailCard = ({ job, onClose }) => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800"
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-gradient-to-r from-zinc-800 to-zinc-950 text-white p-6 rounded-t-2xl border-b border-zinc-700">
             <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{job.position}</h2>
                  <div className="flex items-center gap-3 mt-2 text-zinc-300 text-sm">
                    <span className="bg-zinc-800 px-2 py-1 rounded-md border border-zinc-700 text-xs font-mono">
                      {job.jobCode}
                    </span>
                    <span>• {job.clientName}</span>
                  </div>
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-400 hover:text-white">
                  <XMarkIcon className="w-6 h-6" />
                </button>
             </div>
          </div>

          <div className="p-6 space-y-6 text-zinc-800 dark:text-zinc-300">
             <div className="grid md:grid-cols-2 gap-8">
                {/* Requirements Card */}
                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                    <AcademicCapIcon className="w-5 h-5 text-zinc-500" /> Candidate Profile
                  </h3>
                  <div className="space-y-3 text-sm">
                    <p className="flex justify-between"><span className="text-zinc-500">Skills:</span> <span className="font-medium text-right ml-4">{job.skills || "-"}</span></p>
                    <p className="flex justify-between"><span className="text-zinc-500">Total Exp:</span> <span className="font-medium">{job.experience ? `${job.experience} Years` : "-"}</span></p>
                    <p className="flex justify-between"><span className="text-zinc-500">Relevant Exp:</span> <span className="font-medium">{job.relevantExperience ? `${job.relevantExperience} Years` : "-"}</span></p>
                    <p className="flex justify-between"><span className="text-zinc-500">Qualification:</span> <span className="font-medium">{job.qualification || "-"}</span></p>
                    <p className="flex justify-between"><span className="text-zinc-500">Gender:</span> <span className="font-medium">{job.gender || "Any"}</span></p>
                  </div>
                </div>

                {/* Logistics Card */}
                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                    <BriefcaseIcon className="w-5 h-5 text-zinc-500" /> Job Details
                  </h3>
                  <div className="space-y-3 text-sm">
                    <p className="flex justify-between"><span className="text-zinc-500">Location:</span> <span className="font-medium">{job.location || "-"}</span></p>
                    <p className="flex justify-between"><span className="text-zinc-500">Max Salary Range:</span> <span className="font-medium">{job.salaryBudget || "-"}</span></p>
                    <p className="flex justify-between"><span className="text-zinc-500">Notice Period:</span> <span className="font-medium">{job.noticePeriod || "-"}</span></p>
                    <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 mt-2">
                      <p className="flex justify-between mt-2"><span className="text-zinc-500">Primary Recruiter:</span> <span className="font-medium">{job.primaryRecruiter || 'Unassigned'}</span></p>
                      <p className="flex justify-between mt-1"><span className="text-zinc-500">Secondary Recruiter:</span> <span className="font-medium">{job.secondaryRecruiter || 'Unassigned'}</span></p>
                    </div>
                  </div>
                </div>
             </div>

             {job.jdLink && (
               <div className="bg-zinc-100 dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                 <h4 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-100 text-sm">Job Description Link</h4>
                 <a href={job.jdLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all text-sm">
                   {job.jdLink}
                 </a>
               </div>
             )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/* ---------------- MAIN COMPONENT ---------------- */
export default function AdminRequirements() {
  const { toast } = useToast();
  const { authHeaders } = useAuth();

  const getAuthHeader = async () => ({
    'Content-Type': 'application/json',
    ...(await authHeaders()),
  });

  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientFilter, setSelectedClientFilter] = useState("");

  const initialFormState = {
    jobCode: "", clientName: "", position: "", location: "",
    experience: "", relevantExperience: "", qualification: "",
    salaryBudget: "", gender: "Any", noticePeriod: "",
    primaryRecruiter: "", secondaryRecruiter: "", skills: "", jdLink: "",
    active: true,
  };

  const [form, setForm] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [selectedJob, setSelectedJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // ─── SCROLLBAR SYNC REFS & LOGIC ───────────────────────────────────────
  const topScrollRef = useRef(null);
  const bottomScrollRef = useRef(null);
  const tableRef = useRef(null);
  const [scrollWidth, setScrollWidth] = useState('100%');
  
  const isSyncingTop = useRef(false);
  const isSyncingBottom = useRef(false);

  useEffect(() => {
    const tableEl = tableRef.current;
    if (!tableEl) return;

    const updateWidth = () => {
      setScrollWidth(`${tableEl.scrollWidth}px`);
    };

    const observer = new ResizeObserver(updateWidth);
    observer.observe(tableEl);
    
    updateWidth();

    window.addEventListener('resize', updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [jobs, searchTerm, selectedClientFilter, showForm]);

  const handleTopScroll = (e) => {
    if (isSyncingTop.current) {
      isSyncingTop.current = false;
      return;
    }
    if (bottomScrollRef.current) {
      isSyncingBottom.current = true;
      bottomScrollRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  const handleBottomScroll = (e) => {
    if (isSyncingBottom.current) {
      isSyncingBottom.current = false;
      return;
    }
    if (topScrollRef.current) {
      isSyncingTop.current = true;
      topScrollRef.current.scrollLeft = e.target.scrollLeft;
    }
  };
  // ───────────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const [jobsRes, clientsRes, recRes] = await Promise.all([
        fetch(`${API_URL}/jobs`,       { headers }),
        fetch(`${API_URL}/clients`,    { headers }),
        fetch(`${API_URL}/recruiters`, { headers })
      ]);

      if(jobsRes.ok) {
        const data = await jobsRes.json();
        const jobsArray = Array.isArray(data) ? data : data.data || [];
        setJobs(jobsArray.map((j) => ({ ...j, id: j._id })));
      }
      if(clientsRes.ok) {
        const data = await clientsRes.json();
        const clientsArray = Array.isArray(data) ? data : data.data || [];
        setClients(clientsArray.map((c) => ({ id: c._id, companyName: c.companyName })));
      }
      if(recRes.ok) {
        const data = await recRes.json();
        const recruitersArray = Array.isArray(data) ? data : data.data || data.recruiters || [];
        
        // STANDARD NAME FORMATTING LOGIC
        setRecruiters(recruitersArray.map((r) => {
          let recName = r.name || r.username || r.fullName || r.email || 'Unnamed Recruiter';
          if (r.firstName && r.lastName) recName = `${r.firstName} ${r.lastName}`;
          
          return { id: r._id || r.id, name: recName, email: r.email };
        }));
      }
    } catch (error) {
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ✅ REAL-TIME INPUT RESTRICTION
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newValue = type === 'checkbox' ? checked : value;

    // Strict input filtering based on field type
    if (type !== 'checkbox') {
      if (name === 'position' || name === 'qualification') {
        // Strip everything except letters and spaces
        newValue = newValue.replace(/[^a-zA-Z\s]/g, '');
      } else if (name === 'experience' || name === 'relevantExperience') {
        // ✅ Allow numbers and a single decimal point
        newValue = newValue.replace(/[^0-9.]/g, '');
        const parts = newValue.split('.');
        if (parts.length > 2) {
          newValue = parts[0] + '.' + parts.slice(1).join('');
        }
      } else if (name === 'jobCode') {
        // Strip invalid characters for Job Code (only allow alphanumeric, hyphens, underscores)
        newValue = newValue.replace(/[^a-zA-Z0-9\-_]/g, '');
      }
    }

    setForm({ ...form, [name]: newValue });

    // Clear error for the field being typed in
    if (errors[name]) {
        setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  // ✅ SUBMIT VALIDATION (Checks lengths and requirements)
  const validateForm = () => {
    const newErrors = {};
    const trimStr = (val) => (typeof val === "string" ? val.trim() : val);

    const code = trimStr(form.jobCode);
    if (!code) newErrors.jobCode = "Job Code is required";
    else if (code.length < 2) newErrors.jobCode = "Must be at least 2 characters";

    if (!form.clientName) newErrors.clientName = "Please select a client";
    
    const position = trimStr(form.position);
    if (!position) newErrors.position = "Role is required";
    else if (position.length < 2) newErrors.position = "Must be at least 2 characters";

    const loc = trimStr(form.location);
    if (!loc) newErrors.location = "Location is required";

    const exp = trimStr(form.experience);
    if (!exp) newErrors.experience = "Experience is required";

    const salary = trimStr(form.salaryBudget);
    if (!salary) newErrors.salaryBudget = "Salary Range is required";

    // Cross-validation: Primary and Secondary recruiters cannot be the same
    if (form.primaryRecruiter && form.secondaryRecruiter && form.primaryRecruiter === form.secondaryRecruiter) {
      newErrors.secondaryRecruiter = "Secondary Recruiter cannot be the same as Primary";
      newErrors.primaryRecruiter = "Must be different from Secondary";
    }

    const skills = trimStr(form.skills);
    if (!skills) newErrors.skills = "At least one skill is required";

    const link = trimStr(form.jdLink);
    if (link) {
      const urlPattern = /^(https?:\/\/)?([\w\d\-]+\.)+\w{2,}(\/.*)?$/i;
      if (!urlPattern.test(link)) {
        newErrors.jdLink = "Please enter a valid URL (e.g., https://example.com)";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({ title: "Validation Error", description: "Please fix the highlighted fields", variant: "destructive" });
      return;
    }

    // Clean payload before sending
    const sanitizedPayload = {
      ...form,
      jobCode: form.jobCode.trim(),
      position: form.position.trim(),
      location: form.location.trim(),
      experience: form.experience.trim(),
      relevantExperience: form.relevantExperience?.trim() || "",
      qualification: form.qualification?.trim() || "",
      salaryBudget: form.salaryBudget.trim(),
      noticePeriod: form.noticePeriod?.trim() || "",
      skills: form.skills.trim(),
      jdLink: form.jdLink?.trim() || ""
    };

    try {
      const url = editingJob ? `${API_URL}/jobs/${editingJob.id}` : `${API_URL}/jobs`;
      const response = await fetch(url, {
        method: editingJob ? 'PUT' : 'POST',
        headers: await getAuthHeader(),
        body: JSON.stringify(sanitizedPayload)
      });

      if (!response.ok) throw new Error('Failed to save job');

      toast({ title: "Success", description: "Job requirement saved successfully" });
      setShowForm(false);
      setEditingJob(null);
      setErrors({});
      setForm(initialFormState);
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save data. Please try again.", variant: "destructive" });
    }
  };

  const handleEditJob = (job) => {
    setEditingJob(job);
    setErrors({});
    setForm({
      ...initialFormState,
      ...job
    });
    setShowForm(true);
  };

  const handleToggleActive = async (job) => {
    try {
      await fetch(`${API_URL}/jobs/${job.id}`, {
        method: 'PUT',
        headers: await getAuthHeader(),
        body: JSON.stringify({ active: !job.active })
      });
      fetchData();
      toast({ title: "Status Updated" });
    } catch (e) { 
      toast({ title: "Error", variant: "destructive" }); 
    }
  };

  // ✅ DELETE REQUIREMENT HANDLER
  const handleDeleteJob = async (jobId) => {
    if (!window.confirm("Are you sure you want to delete this requirement? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/jobs/${jobId}`, {
        method: 'DELETE',
        headers: await getAuthHeader()
      });

      if (!response.ok) throw new Error('Failed to delete job');

      toast({ title: "Deleted", description: "Requirement deleted successfully." });
      fetchData(); // Refresh the list
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete requirement.", variant: "destructive" });
    }
  };

  const filteredJobs = jobs.filter(j => {
    const matchesSearch = j.position?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          j.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          j.jobCode?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesClient = selectedClientFilter === "" || j.clientName === selectedClientFilter;
    
    return matchesSearch && matchesClient;
  });

  return (
    <div className="flex-1 grid grid-cols-1 min-w-0 w-full p-6 space-y-8 overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-zinc-950 min-h-screen text-zinc-900 dark:text-zinc-100">
      
      {/* Header */}
      <div className="w-full max-w-full mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Job Requirements</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">Manage active openings and allocations</p>
          </div>
          <button
            onClick={() => {
              setEditingJob(null);
              setShowForm(!showForm);
              setForm(initialFormState);
              setErrors({});
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all shadow-sm"
          >
            {showForm ? <XMarkIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
            {showForm ? "Cancel" : "Add Requirement"}
          </button>
        </div>

        {/* Form Section */}
        <AnimatePresence>
          {showForm && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6 overflow-hidden"
            >
              <h3 className="font-semibold text-lg mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-3 text-zinc-900 dark:text-white">
                {editingJob ? "Edit Job Requirement" : "Create New Requirement"}
              </h3>
              
              <div className="grid md:grid-cols-4 gap-5">
                {/* 1. Job Code */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">1. Job Code *</label>
                  <input name="jobCode" placeholder="E.g. JB1001" value={form.jobCode} onChange={handleChange} className={`${inputCls} ${errors.jobCode ? "border-red-500 focus:ring-red-500" : ""}`} />
                  {errors.jobCode && <p className="text-xs text-red-500 mt-1">{errors.jobCode}</p>}
                </div>

                {/* 2. Client */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">2. Client *</label>
                  <select name="clientName" value={form.clientName} onChange={handleChange} className={`${inputCls} ${errors.clientName ? "border-red-500 focus:ring-red-500" : ""}`}>
                    <option value="">Select Client</option>
                    {clients.map(c => <option key={c.id} value={c.companyName}>{c.companyName}</option>)}
                  </select>
                  {errors.clientName && <p className="text-xs text-red-500 mt-1">{errors.clientName}</p>}
                </div>

                {/* 3. Role / Position (Name) */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">3. Role / Position *</label>
                  <input name="position" placeholder="E.g. Software Engineer" value={form.position} onChange={handleChange} className={`${inputCls} ${errors.position ? "border-red-500 focus:ring-red-500" : ""}`} />
                  {errors.position && <p className="text-xs text-red-500 mt-1">{errors.position}</p>}
                </div>

                {/* 4. Location */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">4. Location *</label>
                  <input name="location" placeholder="City / Remote" value={form.location} onChange={handleChange} className={`${inputCls} ${errors.location ? "border-red-500 focus:ring-red-500" : ""}`} />
                  {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location}</p>}
                </div>

                {/* 5. Experience */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">5. Experience (Years) *</label>
                  <input name="experience" placeholder="E.g. 5.5" value={form.experience} onChange={handleChange} className={`${inputCls} ${errors.experience ? "border-red-500 focus:ring-red-500" : ""}`} />
                  {errors.experience && <p className="text-xs text-red-500 mt-1">{errors.experience}</p>}
                </div>

                {/* 6. Relevant Experience */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">6. Relevant Experience (Years)</label>
                  <input name="relevantExperience" placeholder="E.g. 2.5" value={form.relevantExperience} onChange={handleChange} className={`${inputCls} ${errors.relevantExperience ? "border-red-500 focus:ring-red-500" : ""}`} />
                  {errors.relevantExperience && <p className="text-xs text-red-500 mt-1">{errors.relevantExperience}</p>}
                </div>

                {/* 7. Educational Qualification */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">7. Educational Qualification</label>
                  <input name="qualification" placeholder="E.g. BTech" value={form.qualification} onChange={handleChange} className={`${inputCls} ${errors.qualification ? "border-red-500 focus:ring-red-500" : ""}`} />
                  {errors.qualification && <p className="text-xs text-red-500 mt-1">{errors.qualification}</p>}
                </div>

                {/* 8. Maximum Salary Range */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">8. Maximum Salary Range *</label>
                  <input name="salaryBudget" placeholder="E.g. 10-12 LPA" value={form.salaryBudget} onChange={handleChange} className={`${inputCls} ${errors.salaryBudget ? "border-red-500 focus:ring-red-500" : ""}`} />
                  {errors.salaryBudget && <p className="text-xs text-red-500 mt-1">{errors.salaryBudget}</p>}
                </div>

                {/* 9. Gender */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">9. Gender Preference</label>
                  <select name="gender" value={form.gender} onChange={handleChange} className={inputCls}>
                    <option value="Any">Any</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                {/* 10. N/P (Notice Period) */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">10. N/P (Notice Period)</label>
                  <input name="noticePeriod" placeholder="E.g. 15 Days, Immediate" value={form.noticePeriod} onChange={handleChange} className={`${inputCls} ${errors.noticePeriod ? "border-red-500 focus:ring-red-500" : ""}`} />
                  {errors.noticePeriod && <p className="text-xs text-red-500 mt-1">{errors.noticePeriod}</p>}
                </div>

                {/* 11. Primary Recruiter */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">11. Primary Recruiter</label>
                  <select name="primaryRecruiter" value={form.primaryRecruiter} onChange={handleChange} className={`${inputCls} ${errors.primaryRecruiter ? "border-red-500 focus:ring-red-500" : ""}`}>
                    <option value="">Select Recruiter</option>
                    {recruiters.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                  {errors.primaryRecruiter && <p className="text-xs text-red-500 mt-1">{errors.primaryRecruiter}</p>}
                </div>

                {/* 12. Secondary Recruiter */}
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">12. Secondary Recruiter</label>
                  <select name="secondaryRecruiter" value={form.secondaryRecruiter} onChange={handleChange} className={`${inputCls} ${errors.secondaryRecruiter ? "border-red-500 focus:ring-red-500" : ""}`}>
                    <option value="">Select Recruiter</option>
                    {recruiters.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                  {errors.secondaryRecruiter && <p className="text-xs text-red-500 mt-1">{errors.secondaryRecruiter}</p>}
                </div>

                {/* 13. Skills */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">13. Skills *</label>
                  <input name="skills" placeholder="React, Node.js, etc." value={form.skills} onChange={handleChange} className={`${inputCls} ${errors.skills ? "border-red-500 focus:ring-red-500" : ""}`} />
                  {errors.skills && <p className="text-xs text-red-500 mt-1">{errors.skills}</p>}
                </div>

                {/* 14. JD Link (Optional) */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">14. JD Link (Optional)</label>
                  <input name="jdLink" placeholder="https://..." value={form.jdLink} onChange={handleChange} className={`${inputCls} ${errors.jdLink ? "border-red-500 focus:ring-red-500" : ""}`} />
                  {errors.jdLink && <p className="text-xs text-red-500 mt-1">{errors.jdLink}</p>}
                </div>
              </div>

              <div className="flex justify-end pt-5 mt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button onClick={handleSubmit} className="px-6 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all shadow-sm">
                  {editingJob ? "Update Requirement" : "Save Requirement"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters & Search Bar */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
          <div className="w-full sm:flex-1">
            <input
              placeholder="Search by Role, Job Code, or Company..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="w-full sm:w-64">
            <select 
              value={selectedClientFilter} 
              onChange={(e) => setSelectedClientFilter(e.target.value)}
              className={inputCls}
            >
              <option value="">All Clients</option>
              {clients.map(c => (
                <option key={c.id} value={c.companyName}>{c.companyName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom Styles for the Dual Scrollbar matching Candidate format */}
        <style>{`
          .tbl-scroll::-webkit-scrollbar { height: 10px; }
          .tbl-scroll::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 10px; }
          .tbl-scroll::-webkit-scrollbar-thumb { background: #475569; border-radius: 10px; border: 2px solid #e2e8f0; }
          .tbl-scroll::-webkit-scrollbar-thumb:hover { background: #1e293b; }
          .tbl-scroll { scrollbar-width: thin; scrollbar-color: #475569 #e2e8f0; }
          
          .dark .tbl-scroll::-webkit-scrollbar-track { background: #27272a; }
          .dark .tbl-scroll::-webkit-scrollbar-thumb { background: #52525b; border-color: #27272a; }
          .dark .tbl-scroll::-webkit-scrollbar-thumb:hover { background: #71717a; }

          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        `}</style>

        {/* ✅ DUAL SCROLLBAR TABLE CONTAINER */}
        <div className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm bg-white dark:bg-zinc-900 flex flex-col relative overflow-hidden">
          {loading ? (
            <div className="text-center p-12 text-zinc-500 flex flex-col items-center">
              <div className="w-8 h-8 border-4 border-zinc-300 border-t-zinc-800 rounded-full animate-spin mb-4"></div>
              Loading jobs...
            </div>
          ) : (
            <>
              {/* TOP SCROLLBAR */}
              <div 
                ref={topScrollRef} 
                onScroll={handleTopScroll} 
                className="tbl-scroll overflow-x-auto overflow-y-hidden border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 z-20 sticky top-0 rounded-t-xl"
                style={{ height: '18px' }}
              >
                <div style={{ width: scrollWidth, height: '1px' }}></div>
              </div>

              {/* BOTTOM TABLE CONTAINER WITH STICKY HEADER */}
              <div 
                ref={bottomScrollRef} 
                onScroll={handleBottomScroll} 
                className="no-scrollbar max-h-[calc(100vh-16rem)] min-h-[400px] overflow-auto rounded-b-xl w-full"
              >
                <table ref={tableRef} className="min-w-[1400px] w-full text-left text-sm whitespace-nowrap border-collapse">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/80 text-xs uppercase text-zinc-500 font-semibold tracking-wider sticky top-0 z-10 shadow-[0_1px_0_0_#e4e4e7] dark:shadow-[0_1px_0_0_#27272a]">
                    <tr>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Job Code</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Role</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Company</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Location</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Primary Recruiter</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Secondary Recruiter</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900">Date Added</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 text-center">Status</th>
                      <th className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 text-right">Actions</th>
                    </tr>
                  </thead>
                  
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50 bg-white dark:bg-zinc-900">
                    {filteredJobs.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-zinc-400">No requirements found.</td></tr>
                    ) : filteredJobs.map(job => (
                      <tr key={job.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                        
                        {/* Job Code */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded text-xs border border-zinc-200 dark:border-zinc-700 font-mono font-medium">
                            {job.jobCode}
                          </span>
                        </td>

                        {/* Role */}
                        <td className="px-6 py-4">
                          <div className="font-bold text-zinc-900 dark:text-zinc-100 text-base">{job.position}</div>
                        </td>

                        {/* Company */}
                        <td className="px-6 py-4">
                          <div className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                            <BuildingOfficeIcon className="w-4 h-4 text-zinc-400" />
                            {job.clientName}
                          </div>
                        </td>

                        {/* Location */}
                        <td className="px-6 py-4">
                          <div className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                            <MapPinIcon className="w-4 h-4 text-zinc-400" />
                            {job.location || 'N/A'}
                          </div>
                        </td>

                        {/* Primary Recruiter */}
                        <td className="px-6 py-4">
                          {job.primaryRecruiter ? (
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center text-xs font-bold border border-blue-200 dark:border-blue-800">
                                {job.primaryRecruiter.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-zinc-700 dark:text-zinc-300">{job.primaryRecruiter}</span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 text-xs border border-dashed border-zinc-200 dark:border-zinc-700">
                              Unassigned
                            </span>
                          )}
                        </td>

                        {/* Secondary Recruiter */}
                        <td className="px-6 py-4">
                          {job.secondaryRecruiter ? (
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center justify-center text-xs font-bold border border-purple-200 dark:border-purple-800">
                                {job.secondaryRecruiter.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-zinc-700 dark:text-zinc-300">{job.secondaryRecruiter}</span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 text-xs border border-dashed border-zinc-200 dark:border-zinc-700">
                              Unassigned
                            </span>
                          )}
                        </td>

                        {/* Date Added */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">
                          <div className="flex items-center gap-1.5">
                            <CalendarIcon className="w-4 h-4" />
                            {job.createdAt || job.dateAdded 
                              ? new Date(job.createdAt || job.dateAdded).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
                              : 'N/A'
                            }
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            job.active !== false 
                              ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50" 
                              : "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50"
                          }`}>
                            {job.active !== false ? "Active" : "Inactive"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Button */}
                            <button onClick={() => setSelectedJob(job)} title="View Details" className="p-1.5 rounded-lg text-zinc-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-zinc-800 dark:hover:text-blue-400 transition-colors">
                              <EyeIcon className="w-5 h-5" />
                            </button>
                            {/* Edit Button */}
                            <button onClick={() => handleEditJob(job)} title="Edit Requirement" className="p-1.5 rounded-lg text-zinc-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-zinc-800 dark:hover:text-amber-400 transition-colors">
                              <PencilIcon className="w-5 h-5" />
                            </button>
                            {/* Toggle Active Button */}
                            <button onClick={() => handleToggleActive(job)} title={job.active !== false ? "Mark as Inactive" : "Mark as Active"} className={`p-1.5 rounded-lg transition-colors ${job.active !== false ? 'text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400' : 'text-zinc-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-zinc-800 dark:hover:text-green-400'}`}>
                              {job.active !== false ? <NoSymbolIcon className="w-5 h-5" /> : <CheckCircleIcon className="w-5 h-5" />}
                            </button>
                            {/* ✅ Delete Button added here */}
                            <button onClick={() => handleDeleteJob(job.id)} title="Delete Requirement" className="p-1.5 rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400 transition-colors">
                              <TrashIcon className="w-5 h-5" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedJob && <JobDetailCard job={selectedJob} onClose={() => setSelectedJob(null)} />}
    </div>
  );
}