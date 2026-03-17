import React, { useEffect, useState, useMemo } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { 
  Bell, Calendar, Clock, User, Trash2, Loader2, Plus, 
  Briefcase, AlertCircle, Filter 
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

// Helper to get Firebase Token for Auth Headers
function getFirebaseToken() {
  try {
    const raw = sessionStorage.getItem('currentUser');
    if (!raw) return null;
    return JSON.parse(raw)?.idToken ?? null;
  } catch {
    return null;
  }
}

function buildHeaders() {
  const token = getFirebaseToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export default function AdminSchedules() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  // Data State
  const [candidates, setCandidates] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filter State
  const [filterRecruiter, setFilterRecruiter] = useState("all");

  // Form State
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [interviewDate, setInterviewDate] = useState(new Date());
  
  // Adjusted to match backend enum default values
  const [roundType, setRoundType] = useState("L1 Interview");
  const [interviewMode, setInterviewMode] = useState("Virtual");
  const [interviewStatus, setInterviewStatus] = useState("Scheduled");

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [resCandidates, resInterviews] = await Promise.all([
        fetch(`${API_URL}/candidates`, { headers: buildHeaders() }),
        fetch(`${API_URL}/interviews`, { headers: buildHeaders() })
      ]);

      if (resCandidates.ok) {
        const data = await resCandidates.json();
        // Only show active candidates who haven't joined/rejected yet
        setCandidates(data.filter(c => !['Joined', 'Rejected'].includes(c.status?.at(-1) || c.status)));
      }

      if (resInterviews.ok) {
        const data = await resInterviews.json();
        setSchedules(data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error", description: "Failed to load data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchData(); 
  }, []);

  // Handle Schedule Creation
  const handleSchedule = async () => {
    if (!selectedCandidateId || !interviewDate) {
      toast({ title: "Validation Error", description: "Please select a candidate and time.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const dateStr = interviewDate.toISOString().split('T')[0];
      const timeStr = interviewDate.toTimeString().split(' ')[0].substring(0, 5);

      const payload = {
        candidateId: selectedCandidateId,
        interviewDate: dateStr,
        interviewTime: timeStr,
        type: interviewMode,
        round: roundType,
        status: interviewStatus, // Added Status payload mapping
        duration: 60
      };

      const response = await fetch(`${API_URL}/interviews`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to schedule");
      }

      toast({ title: "Success", description: "Interview Scheduled Successfully!" });
      fetchData(); // Refresh the list
      
      // Reset form
      setSelectedCandidateId("");
      setInterviewDate(new Date());
      setRoundType("L1 Interview");
      setInterviewMode("Virtual");
      setInterviewStatus("Scheduled");
    } catch (error) {
      toast({ title: "Error", description: error.message || "Could not schedule interview.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Schedule
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this scheduled interview?")) return;
    try {
      const response = await fetch(`${API_URL}/interviews/${id}`, { 
        method: 'DELETE', 
        headers: buildHeaders() 
      });
      
      if (!response.ok) throw new Error("Failed to delete");

      setSchedules(prev => prev.filter(s => s._id !== id));
      toast({ title: "Deleted", description: "Schedule removed successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete schedule", variant: "destructive" });
    }
  };

  // Extract unique recruiters for the filter dropdown dynamically
  const availableRecruiters = useMemo(() => {
    const rMap = new Map();
    schedules.forEach(s => {
      if (s.recruiterId?._id) {
        rMap.set(s.recruiterId._id, s.recruiterId);
      }
    });
    return Array.from(rMap.values());
  }, [schedules]);

  // Filter and sort the schedules
  const visibleSchedules = useMemo(() => {
    let filtered = schedules;
    if (filterRecruiter !== "all") {
      filtered = filtered.filter(s => s.recruiterId?._id === filterRecruiter);
    }
    return filtered.sort((a, b) => new Date(a.interviewDate).getTime() - new Date(b.interviewDate).getTime());
  }, [schedules, filterRecruiter]);

  return (
    <main className="flex-1 p-4 lg:p-8 overflow-y-auto bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Admin Interview Calendar</h1>
            <p className="text-slate-500 mt-1">Manage and track all organizational interview schedules.</p>
          </div>
          <div className="flex gap-2">
             <span className="px-3 py-1 text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-full shadow-sm text-slate-700 dark:text-slate-300">
                Total Scheduled: {schedules.length}
             </span>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* Left Column: Scheduling Form */}
          <div className="lg:col-span-4 space-y-6">
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-6 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-5">
                <h3 className="flex items-center gap-2 text-xl font-semibold">
                  <Plus className="w-5 h-5" /> Schedule New
                </h3>
              </div>
              <div className="p-6 space-y-5">
                
                {/* Candidate Select */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Candidate</label>
                  <div className="relative">
                     <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                     <select 
                       value={selectedCandidateId}
                       onChange={(e) => setSelectedCandidateId(e.target.value)}
                       className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                     >
                       <option value="">Select Candidate...</option>
                       {candidates.map(c => (
                         <option key={c._id} value={c._id}>
                           {c.name || `${c.firstName || ''} ${c.lastName || ''}`} - {c.position || 'N/A'}
                         </option>
                       ))}
                     </select>
                  </div>
                </div>

                {/* Date Picker */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Date & Time</label>
                  <div className="relative flex items-center">
                     <Clock className="absolute left-3 w-4 h-4 text-slate-400 z-10" />
                     <DatePicker
                        selected={interviewDate}
                        onChange={(date) => setInterviewDate(date)}
                        showTimeSelect
                        timeIntervals={30}
                        dateFormat="MMM d, yyyy h:mm aa"
                        minDate={new Date()}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none block dark:text-white"
                        wrapperClassName="w-full"
                     />
                  </div>
                </div>

                {/* Round & Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Round</label>
                     <select 
                        value={roundType} onChange={(e) => setRoundType(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none dark:text-white"
                     >
                       <option value="L1 Interview">L1 Interview</option>
                       <option value="L2 Interview">L2 Interview</option>
                       <option value="L3 Interview">L3 Interview</option>
                       <option value="L4 Interview">L4 Interview</option>
                       <option value="L5 Interview">L5 Interview</option>
                       <option value="Technical Round">Technical Round</option>
                       <option value="HR Round">HR Round</option>
                     </select>
                  </div>
                  <div className="space-y-2">
                     <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Mode</label>
                     <select 
                        value={interviewMode} onChange={(e) => setInterviewMode(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none dark:text-white"
                     >
                       <option value="Virtual">Virtual</option>
                       <option value="In-person">In-person</option>
                       <option value="Phone">Phone</option>
                     </select>
                  </div>
                </div>

                {/* Status Dropdown (Matching schema Enum perfectly) */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                  <select
                    value={interviewStatus}
                    onChange={(e) => setInterviewStatus(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none dark:text-white"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="No Show">No Show</option>
                    <option value="Shortlisted">Shortlisted</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Hold">Hold</option>
                  </select>
                </div>

                {/* Submit Button inside the main form container */}
                <div className="pt-2">
                  <button 
                    onClick={handleSchedule} 
                    disabled={submitting}
                    className="w-full flex justify-center items-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-3 rounded-xl shadow-md transition-all"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Schedule"}
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* Right Column: List of Interviews Table */}
          <div className="lg:col-span-8 space-y-6">
             <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[500px] flex flex-col">
                
                {/* Header & Filter */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                    <Calendar className="w-5 h-5 text-indigo-500" /> Upcoming Interviews
                  </h2>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select
                      value={filterRecruiter}
                      onChange={(e) => setFilterRecruiter(e.target.value)}
                      className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="all">All Recruiters</option>
                      {availableRecruiters.map(r => (
                        <option key={r._id} value={r._id}>
                          {r.name || r.firstName || "Unknown"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {loading ? (
                  <div className="flex-1 flex flex-col justify-center items-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2"/>
                    <span className="text-slate-500">Loading schedules...</span>
                  </div>
                ) : visibleSchedules.length === 0 ? (
                  <div className="flex-1 flex flex-col justify-center items-center py-16 px-4">
                     <Briefcase className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
                     <h3 className="text-slate-900 dark:text-white font-medium">No interviews found</h3>
                     <p className="text-slate-500 text-sm mt-1 text-center">There are no upcoming interviews matching your criteria.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400">
                        <tr>
                          <th className="px-5 py-3 font-medium whitespace-nowrap">Date & Time</th>
                          <th className="px-5 py-3 font-medium">Candidate</th>
                          <th className="px-5 py-3 font-medium">Position</th>
                          <th className="px-5 py-3 font-medium">Round & Mode</th>
                          <th className="px-5 py-3 font-medium">Status</th>
                          <th className="px-5 py-3 font-medium">Scheduled By</th>
                          <th className="px-5 py-3 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {visibleSchedules.map(schedule => (
                          <tr key={schedule._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {new Date(schedule.interviewDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                              <div className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">
                                {new Date(schedule.interviewDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {schedule.candidateId?.name || "Unknown"}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                              {schedule.candidateId?.position || "N/A"}
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex flex-col gap-1 items-start">
                                <span className="font-medium text-amber-600 dark:text-amber-500 whitespace-nowrap">
                                  {schedule.round}
                                </span>
                                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                  {schedule.type}
                                </span>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              {(() => {
                                const s = schedule.status;
                                const colors = {
                                  Scheduled:   "bg-blue-100 text-blue-800",
                                  Completed:   "bg-green-100 text-green-800",
                                  Shortlisted: "bg-emerald-100 text-emerald-800",
                                  Hold:        "bg-yellow-100 text-yellow-800",
                                  Submitted:   "bg-sky-100 text-sky-800",
                                  Cancelled:   "bg-red-100 text-red-800",
                                  "No Show":   "bg-red-100 text-red-800",
                                  Rejected:    "bg-rose-100 text-rose-800",
                                };
                                return (
                                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${colors[s] || "bg-gray-100 text-gray-700"}`}>
                                    {s || "Scheduled"}
                                  </span>
                                );
                              })()}
                            </td>

                            <td className="px-5 py-4 text-slate-600 dark:text-slate-400 font-medium">
                              {schedule.recruiterId?.name || schedule.recruiterId?.firstName || "Admin"}
                            </td>

                            <td className="px-5 py-4 text-right">
                               <button 
                                 onClick={() => handleDelete(schedule._id)} 
                                 className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors inline-flex"
                                 title="Delete Schedule"
                               >
                                  <Trash2 className="w-4 h-4" />
                               </button>
                            </td>

                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
             </div>
          </div>

        </div>
      </div>
    </main>
  );
}