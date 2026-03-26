import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import {
  Building2, User, X, Eye, Pencil, Plus, CheckCircle, Ban, MapPin, DollarSign, Clock
} from "lucide-react";

const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, '');
const API_URL = `${BASE_URL}/api`;

// Sleek Grey Input Styling
const inputCls = "w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-zinc-500 bg-white dark:bg-zinc-900 dark:text-zinc-100 transition-shadow placeholder-zinc-400";

/* ---------------- DETAIL MODAL ---------------- */
const ClientDetailCard = ({ client, onClose }) => {
  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
          {/* Grey Gradient Header */}
          <div className="bg-gradient-to-r from-zinc-800 to-zinc-950 text-white p-6 rounded-t-2xl border-b border-zinc-700">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">{client.companyName}</h2>
                <div className="flex items-center gap-3 mt-2 text-zinc-300 text-sm">
                  <span className="bg-zinc-800 px-2 py-1 rounded-md border border-zinc-700 text-xs font-mono">
                    {client.clientId}
                  </span>
                  {client.industry && <span>• {client.industry}</span>}
                  {client.clientLocation && <span>• {client.clientLocation}</span>}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6 text-zinc-800 dark:text-zinc-300">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Contact Info Card */}
              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                  <User className="w-5 h-5 text-zinc-500" /> Contact Details
                </h3>
                <div className="space-y-3 text-sm">
                  <p className="flex justify-between"><span className="text-zinc-500">Contact Person:</span> <span className="font-medium">{client.contactPerson || "-"}</span></p>
                  <p className="flex justify-between"><span className="text-zinc-500">Email:</span> <span className="font-medium">{client.email || "-"}</span></p>
                  <p className="flex justify-between"><span className="text-zinc-500">Phone:</span> <span className="font-medium">{client.phone || "-"}</span></p>
                  <p className="flex justify-between"><span className="text-zinc-500">Website:</span> <span className="font-medium">{client.website || "-"}</span></p>
                  <p className="flex justify-between"><span className="text-zinc-500">Location:</span> <span className="font-medium">{client.clientLocation || "-"}</span></p>
                  <div className="pt-2"><span className="text-zinc-500 block mb-1">Address:</span> <p className="font-medium text-xs leading-relaxed">{client.address || "-"}</p></div>
                </div>
              </div>

              {/* Business Terms Card */}
              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                  <Building2 className="w-5 h-5 text-zinc-500" /> Business Terms
                </h3>
                <div className="space-y-3 text-sm">
                  <p className="flex justify-between"><span className="text-zinc-500">Commission Rate:</span> <span className="font-medium">{client.percentage ? `${client.percentage}%` : "-"}</span></p>
                  <p className="flex justify-between"><span className="text-zinc-500">Candidate Period:</span> <span className="font-medium">{client.candidatePeriod ? `${client.candidatePeriod} months` : "-"}</span></p>
                  <p className="flex justify-between"><span className="text-zinc-500">Replacement:</span> <span className="font-medium">{client.replacementPeriod ? `${client.replacementPeriod} days` : "-"}</span></p>
                  <p className="flex justify-between"><span className="text-zinc-500">Locking Period:</span> <span className="font-medium">{client.lockingPeriod || "-"}</span></p>
                  <p className="flex justify-between"><span className="text-zinc-500">Payment Mode:</span> <span className="font-medium">{client.paymentMode || "-"}</span></p>
                  <p className="flex justify-between"><span className="text-zinc-500">GST Number:</span> <span className="font-medium font-mono text-xs">{client.gstNumber || "-"}</span></p>
                  <p className="flex justify-between"><span className="text-zinc-500">Status:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${client.active ? 'bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      {client.active ? "Active" : "Inactive"}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {client.terms && (
              <div className="bg-zinc-100 dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <h4 className="font-semibold mb-2 text-zinc-900 dark:text-zinc-100">Terms & Conditions</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">{client.terms}</p>
              </div>
            )}
          </div>
      </div>
    </div>
  );
};

/* ---------------- MAIN DASHBOARD ---------------- */
export default function AdminClientInfo() {
  const { toast } = useToast();
  const { authHeaders } = useAuth();

  const getAuthHeader = useCallback(async () => ({
    "Content-Type": "application/json",
    ...(await authHeaders()),
  }), [authHeaders]);

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedClient, setSelectedClient] = useState(null);
  const [errors, setErrors] = useState({});

  // ADDED NEW FIELDS TO INITIAL STATE
  const initialFormState = {
    companyName: "", contactPerson: "", email: "", phone: "", website: "",
    address: "", locationLink: "", industry: "", gstNumber: "", notes: "",
    clientId: "", percentage: "", candidatePeriod: "", replacementPeriod: "",
    lockingPeriod: "", paymentMode: "", clientLocation: "", // New Fields
    terms: "", active: true,
  };
  const [form, setForm] = useState(initialFormState);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${API_URL}/clients`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setClients(data.map((c) => ({ ...c, id: c._id })));
    } catch {
      toast({ title: "Error", description: "Failed to load clients", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => { fetchClients(); }, []);

  const validateForm = () => {
    const e = {};

    // ── Company Name: required, letters/spaces/punctuation only, 2–100 chars
    if (!form.companyName.trim()) {
      e.companyName = "Company name is required";
    } else if (!/^[a-zA-Z\s'.,&()\-]{2,100}$/.test(form.companyName.trim())) {
      e.companyName = "Company name must contain letters only (no numbers)";
    }

    // ── Contact Person: optional, letters/spaces only if filled ──────────────
    if (form.contactPerson.trim() && !/^[a-zA-Z\s'.'\-]{2,80}$/.test(form.contactPerson.trim())) {
      e.contactPerson = "Contact person must be letters only (2–80 chars)";
    }

    // ── Email: optional, valid format if filled ───────────────────────────────
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      e.email = "Enter a valid email address (e.g. name@company.com)";
    }

    // ── Phone: optional, exactly 10 digits starting with 6-9 if filled ───────
    if (form.phone.trim()) {
      const cleanPhone = form.phone.replace(/[\s\-+]/g, '');
      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        e.phone = "Enter a valid 10-digit Indian mobile number (starts with 6–9)";
      }
    }

    // ── Industry: optional, letters/spaces only if filled ────────────────────
    if (form.industry.trim() && !/^[a-zA-Z\s&\/\-,]{2,80}$/.test(form.industry.trim())) {
      e.industry = "Industry must be letters only (2–80 chars)";
    }

    // ── Website: optional, must look like a URL if filled ────────────────────
    if (form.website.trim() && !/^(https?:\/\/)?(www\.)?[\w\-]+\.[a-zA-Z]{2,}(\/\S*)?$/.test(form.website.trim())) {
      e.website = "Enter a valid website URL (e.g. https://company.com)";
    }

    // ── GST Number: optional, standard 15-char Indian GST format if filled ───
    if (form.gstNumber.trim() && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstNumber.trim().toUpperCase())) {
      e.gstNumber = "Enter a valid 15-character GST number (e.g. 22AAAAA0000A1Z5)";
    }

    // ── Commission %: optional, must be a number 0–100 if filled ─────────────
    if (form.percentage.toString().trim() !== "") {
      const pct = Number(form.percentage);
      if (isNaN(pct) || !/^\d+(\.\d+)?$/.test(form.percentage.toString().trim())) {
        e.percentage = "Commission must be a number (e.g. 15 or 15.5)";
      } else if (pct < 0 || pct > 100) {
        e.percentage = "Commission % must be between 0 and 100";
      }
    }

    // ── Candidate Period: optional, must be a positive integer (months) ───────
    if (form.candidatePeriod.toString().trim() !== "") {
      const cp = Number(form.candidatePeriod);
      if (!Number.isInteger(cp) || cp < 1 || cp > 120) {
        e.candidatePeriod = "Must be a whole number of months (1–120)";
      }
    }

    // ── Replacement Period: optional, must be a positive integer (days) ───────
    if (form.replacementPeriod.toString().trim() !== "") {
      const rp = Number(form.replacementPeriod);
      if (!Number.isInteger(rp) || rp < 1 || rp > 365) {
        e.replacementPeriod = "Must be a whole number of days (1–365)";
      }
    }

    // ── Locking Period: optional, must be a positive integer (days) ────────────
    if (form.lockingPeriod.toString().trim() !== "") {
      const lp = Number(form.lockingPeriod);
      if (!Number.isInteger(lp) || lp < 1 || lp > 365) {
        e.lockingPeriod = "Locking period must be a whole number of days (1–365)";
      }
    }

    // ── Payment Mode: optional, letters/numbers/hyphens if filled ────────────
    if (form.paymentMode.trim() && !/^[a-zA-Z0-9\s\-\/]{2,50}$/.test(form.paymentMode.trim())) {
      e.paymentMode = "Payment mode must be 2–50 alphanumeric characters (e.g. Net-30)";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === "phone" && /[^0-9]/.test(value)) return;
    if (name === "phone" && value.length > 10) return;
    if (name === "lockingPeriod" && value !== "" && /[^0-9]/.test(value)) return;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
    if (errors[name]) {
      const copy = { ...errors };
      delete copy[name];
      setErrors(copy);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      const url = editingClient ? `${API_URL}/clients/${editingClient.id}` : `${API_URL}/clients`;
      const headers = await getAuthHeader();
      const res = await fetch(url, {
        method: editingClient ? "PUT" : "POST",
        headers,
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      const normalized = { ...saved, id: saved._id };

      // Update local state directly — no full refetch needed
      if (editingClient) {
        setClients(prev => prev.map(c => c.id === editingClient.id ? normalized : c));
      } else {
        setClients(prev => [normalized, ...prev]);
      }

      toast({ title: "Success", description: "Client saved successfully" });
      setShowForm(false);
      setEditingClient(null);
      setForm(initialFormState);
    } catch {
      toast({ title: "Error", description: "Save failed", variant: "destructive" });
    }
  };

  const handleEditClient = (client) => {
    setEditingClient(client);
    setForm({
      ...initialFormState, ...client,
      percentage: client.percentage?.toString() || "",
      candidatePeriod: client.candidatePeriod?.toString() || "",
      replacementPeriod: client.replacementPeriod?.toString() || "",
      lockingPeriod: client.lockingPeriod || "", // Handle new field
      paymentMode: client.paymentMode || "", // Handle new field
      clientLocation: client.clientLocation || "", // Handle new field
      active: client.active !== false,
    });
    setShowForm(true);
  };

  const handleToggleActive = async (client) => {
    try {
      const headers = await getAuthHeader();
      await fetch(`${API_URL}/clients/${client.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ active: !client.active }),
      });
      // Update local state directly — no full refetch
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, active: !client.active } : c));
    } catch { }
  };

  const uniqueIndustries = useMemo(() => Array.from(new Set(clients.map((c) => c.industry).filter(Boolean))), [clients]);

  const filteredClients = useMemo(() => clients.filter((c) => {
    const s = searchTerm.toLowerCase();
    const matchSearch = c.companyName.toLowerCase().includes(s) || (c.email || "").toLowerCase().includes(s);
    const matchIndustry = industryFilter === "all" || c.industry === industryFilter;
    const matchStatus = statusFilter === "all" || (statusFilter === "active" ? c.active !== false : c.active === false);
    return matchSearch && matchIndustry && matchStatus;
  }), [clients, searchTerm, industryFilter, statusFilter]);

  return (
    <div className="flex-1 p-6 space-y-8 bg-zinc-50 dark:bg-zinc-950 min-h-screen text-zinc-900 dark:text-zinc-100">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Clients</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Manage client profiles and business terms</p>
        </div>
        <button
          onClick={() => {
            setEditingClient(null);
            setShowForm(!showForm);
            setForm(initialFormState);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "Add Client"}
        </button>
      </div>

      {/* Form Panel */}
      {showForm && (
        <div
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6"
        >
          <h3 className="font-semibold text-lg mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-3 text-zinc-900 dark:text-white">
            {editingClient ? "Edit Client Profile" : "Create New Client"}
          </h3>
          <div className="grid md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Company Name *</label>
              <input name="companyName" value={form.companyName} onChange={handleChange} className={`${inputCls} ${errors.companyName ? 'border-red-500' : ''}`} />
              {errors.companyName && <p className="text-xs text-red-500 mt-1">{errors.companyName}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Contact Person</label>
              <input name="contactPerson" value={form.contactPerson} onChange={handleChange} className={`${inputCls} ${errors.contactPerson ? 'border-red-500' : ''}`} />
              {errors.contactPerson && <p className="text-xs text-red-500 mt-1">{errors.contactPerson}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Email</label>
              <input name="email" value={form.email} onChange={handleChange} className={`${inputCls} ${errors.email ? 'border-red-500' : ''}`} />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Phone (10 digits)</label>
              <input name="phone" value={form.phone} onChange={handleChange} className={`${inputCls} ${errors.phone ? 'border-red-500' : ''}`} />
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Industry</label>
              <input name="industry" value={form.industry} onChange={handleChange} className={`${inputCls} ${errors.industry ? 'border-red-500' : ''}`} />
              {errors.industry && <p className="text-xs text-red-500 mt-1">{errors.industry}</p>}
            </div>
            
            {/* --- ADDED NEW FIELDS HERE --- */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Client Location</label>
              <input name="clientLocation" value={form.clientLocation} onChange={handleChange} placeholder="City, State" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">GST Number</label>
              <input name="gstNumber" value={form.gstNumber} onChange={handleChange} placeholder="e.g. 22AAAAA0000A1Z5" className={`${inputCls} ${errors.gstNumber ? 'border-red-500' : ''}`} />
              {errors.gstNumber && <p className="text-xs text-red-500 mt-1">{errors.gstNumber}</p>}
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-zinc-500 mb-1">Address</label>
              <textarea name="address" value={form.address} onChange={handleChange} placeholder="Full address..." rows={2} className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Locking Period</label>
              <input name="lockingPeriod" value={form.lockingPeriod} onChange={handleChange} placeholder="e.g. 30" className={`${inputCls} ${errors.lockingPeriod ? 'border-red-500' : ''}`} />
              {errors.lockingPeriod && <p className="text-xs text-red-500 mt-1">{errors.lockingPeriod}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Payment Mode</label>
              <input name="paymentMode" value={form.paymentMode} onChange={handleChange} placeholder="e.g. Net-30" className={`${inputCls} ${errors.paymentMode ? 'border-red-500' : ''}`} />
              {errors.paymentMode && <p className="text-xs text-red-500 mt-1">{errors.paymentMode}</p>}
            </div>
             {/* ----------------------------- */}

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Commission %</label>
              <input name="percentage" value={form.percentage} onChange={handleChange} placeholder="e.g. 15" className={`${inputCls} ${errors.percentage ? 'border-red-500' : ''}`} />
              {errors.percentage && <p className="text-xs text-red-500 mt-1">{errors.percentage}</p>}
            </div>
            <div className="md:col-span-3 flex justify-end pt-4">
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm"
              >
                {editingClient ? "Update Client" : "Save Client"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <input
          placeholder="Search by company or email..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className={`${inputCls} flex-1`}
        />
        <select value={industryFilter} onChange={e => setIndustryFilter(e.target.value)} className={`${inputCls} w-full sm:w-48`}>
          <option value="all">All Industries</option>
          {uniqueIndustries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${inputCls} w-full sm:w-40`}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table Area */}
      {loading ? (
        <div className="text-center p-12 text-zinc-500 flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-zinc-300 border-t-zinc-800 rounded-full animate-spin mb-4"></div>
          Loading clients...
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-xs uppercase text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                {/* --- MODIFIED TABLE HEADERS --- */}
                <tr>
                  <th className="px-6 py-4 font-medium tracking-wider">Client</th>
                  <th className="px-6 py-4 font-medium tracking-wider">Contact</th>
                  <th className="px-6 py-4 font-medium tracking-wider">Email</th> {/* Replaced Terms with Email */}
                  <th className="px-6 py-4 font-medium tracking-wider">Status</th>
                  <th className="px-6 py-4 font-medium tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {filteredClients.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-zinc-400">No clients found matching criteria.</td></tr>
                ) : filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">{client.companyName}</div>
                      <div className="text-xs text-zinc-500 font-mono mt-0.5">{client.clientId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-zinc-800 dark:text-zinc-300">{client.contactPerson || "-"}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{client.phone || "-"}</div>
                    </td>
                    
                    {/* --- REPLACED TERMS COLUMN WITH EMAIL --- */}
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                      {client.email || "-"}
                    </td>

                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${client.active !== false
                          ? "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                          : "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30"
                        }`}>
                        {client.active !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedClient(client)}
                          title="View Details"
                          className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditClient(client)}
                          title="Edit"
                          className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(client)}
                          title={client.active ? "Deactivate" : "Activate"}
                          className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                        >
                          {client.active !== false
                            ? <Ban className="w-4 h-4" />
                            : <CheckCircle className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Render Modal */}
      {selectedClient && <ClientDetailCard client={selectedClient} onClose={() => setSelectedClient(null)} />}
    </div>
  );
}