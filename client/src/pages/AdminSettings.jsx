import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Lock, User, Mail, Loader2, Eye, EyeOff, Camera, Trash2, Upload,
  ShieldCheck, CheckCircle2, RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = `${BASE_URL}/api`;

const STEPS = { REQUEST: 'request', VERIFY: 'verify', RESET: 'reset', DONE: 'done' };

const PASSWORD_REQS = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter',  test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter',  test: (p) => /[a-z]/.test(p) },
  { label: 'One number',            test: (p) => /\d/.test(p) },
];

export default function AdminSettings() {
  const { toast } = useToast();
  const { authHeaders, setCurrentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', username: '', profilePicture: '' });

  const fileInputRef = useRef(null);
  const [step, setStep] = useState(STEPS.REQUEST);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const boxRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState({ new: false, confirm: false });

  const allReqsMet = PASSWORD_REQS.every(r => r.test(passwords.newPassword));
  const passwordsMatch = passwords.newPassword === passwords.confirmPassword && passwords.newPassword.length > 0;

  const buildHeaders = useCallback(async () => {
    const ah = await authHeaders();
    return { 'Content-Type': 'application/json', ...ah };
  }, [authHeaders]);

  const getUserEmail = useCallback(() => {
    try {
      const session = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
      return session.email || formData.email || '';
    } catch { return formData.email || ''; }
  }, [formData.email]);

  useEffect(() => {
    (async () => {
      try {
        const headers = await buildHeaders();
        const res = await fetch(`${API_URL}/auth/profile`, { headers });
        const data = await res.json();
        setFormData({ 
            name: data.name || '', 
            email: data.email || '', 
            username: data.username || '',
            profilePicture: data.profilePicture || '' 
        });
      } catch (err) {
        toast({ title: 'Error loading profile', variant: 'destructive' });
      } finally { setLoading(false); }
    })();
  }, [buildHeaders, toast]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        toast({ title: "File too large", description: "Image must be under 1.5MB", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setFormData(p => ({ ...p, profilePicture: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  // UPDATE this function inside AdminSettings.jsx:
const handleSaveProfile = async () => {
  setSaving(true);
  try {
    const headers = await buildHeaders();
    const res = await fetch(`${API_URL}/auth/profile`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ 
        name: formData.name, 
        email: formData.email, 
        profilePicture: formData.profilePicture 
      }),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.message || "Failed to save profile");
    }

    // 🟢 CRITICAL STEP: Update the local storage AND the Auth Context
    // This tells the rest of the app (Sidebar/Header) that the user has changed.
    const session = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    const updatedUser = { ...session, ...data };
    
    sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
    
    if (setCurrentUser) {
      setCurrentUser(updatedUser); // This triggers the UI refresh globally
    }

    toast({ title: 'Success', description: 'Profile saved successfully!' });
  } catch (err) {
    console.error("Save Error:", err);
    toast({ title: 'Save Failed', description: err.message, variant: 'destructive' });
  } finally {
    setSaving(false);
  }
};

  const handleSendOtp = async () => {
    setSending(true);
    try {
      const headers = await buildHeaders();
      const res = await fetch(`${API_URL}/auth/send-otp`, {
        method: 'POST', headers, body: JSON.stringify({ email: getUserEmail() }),
      });
      const data = await res.json();
      if (data.devOtp) setOtpDigits(String(data.devOtp).split(''));
      setStep(STEPS.VERIFY);
      setCountdown(60);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setCountdown(p => p > 0 ? p - 1 : 0), 1000);
      toast({ title: 'OTP Sent!' });
    } catch (err) { toast({ title: 'Failed', variant: 'destructive' }); } finally { setSending(false); }
  };

  const handleVerifyOtp = async () => {
    setVerifying(true);
    try {
      const headers = await buildHeaders();
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: 'POST', headers, body: JSON.stringify({ email: getUserEmail(), otp: otpDigits.join('') }),
      });
      if (!res.ok) throw new Error();
      setStep(STEPS.RESET);
    } catch (err) { toast({ title: 'Invalid OTP', variant: 'destructive' }); } finally { setVerifying(false); }
  };

  const handleChangePassword = async () => {
    setPwSaving(true);
    try {
      const headers = await buildHeaders();
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: 'PUT', headers,
        body: JSON.stringify({ email: getUserEmail(), newPassword: passwords.newPassword }),
      });
      if (!res.ok) throw new Error();
      setStep(STEPS.DONE);
    } catch (err) { toast({ title: 'Error', variant: 'destructive' }); } finally { setPwSaving(false); }
  };

  const stepIdx  = [STEPS.REQUEST, STEPS.VERIFY, STEPS.RESET, STEPS.DONE].indexOf(step);
  const stepMeta = ['Send OTP', 'Verify', 'New Password'];

  if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your account and preferences</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><User className="text-primary" /><CardTitle>Profile Information</CardTitle></div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="relative group w-24 h-24">
                <div className="w-full h-full rounded-full border-2 border-dashed border-zinc-300 overflow-hidden bg-zinc-50 flex items-center justify-center">
                  {formData.profilePicture ? <img src={formData.profilePicture} className="w-full h-full object-cover" /> : <User className="h-10 text-zinc-400" />}
                </div>
                <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><Camera className="text-white" /></div>
              </div>
              <div className="flex flex-col gap-2">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Change</Button>
                  {formData.profilePicture && <Button variant="destructive" size="sm" onClick={() => setFormData(p => ({ ...p, profilePicture: '' }))}><Trash2 className="h-4 w-4 mr-2" />Remove</Button>}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Full Name</Label><Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Username</Label><Input value={formData.username} disabled className="bg-muted" /></div>
            </div>
            <div className="space-y-2"><Label>Email</Label><Input value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} /></div>
            <div className="flex justify-end"><Button onClick={handleSaveProfile} disabled={saving}>{saving ? <Loader2 className="animate-spin mr-2" /> : 'Save Profile'}</Button></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div className="flex items-center gap-2"><Lock className="text-primary" /><CardTitle>Change Password</CardTitle></div></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-6">
              {stepMeta.map((label, i) => (
                <React.Fragment key={label}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i <= stepIdx ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>{i < stepIdx || step === STEPS.DONE ? <CheckCircle2 className="w-4" /> : i + 1}</div>
                  <span className="text-xs">{label}</span>
                  {i < 2 && <div className="flex-1 h-px bg-border" />}
                </React.Fragment>
              ))}
            </div>

            {step === STEPS.REQUEST && <div className="flex justify-end"><Button onClick={handleSendOtp} disabled={sending}>{sending ? <Loader2 className="animate-spin mr-2" /> : 'Send OTP Code'}</Button></div>}
            
            {step === STEPS.VERIFY && (
              <div className="space-y-6">
                <div className="flex gap-2 justify-center">
                  {otpDigits.map((d, i) => <input key={i} ref={boxRefs[i]} className="w-11 h-14 text-center text-2xl font-bold border rounded-lg" value={d} onChange={e => {
                    const val = e.target.value; const dd = [...otpDigits]; dd[i] = val.slice(-1); setOtpDigits(dd);
                    if (val && i < 5) boxRefs[i + 1].current.focus();
                  }} />)}
                </div>
                <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setStep(STEPS.REQUEST)}>Back</Button><Button onClick={handleVerifyOtp} disabled={verifying}>Verify OTP</Button></div>
              </div>
            )}

            {step === STEPS.RESET && (
              <div className="space-y-4">
                <div className="space-y-2"><Label>New Password</Label><Input type="password" value={passwords.newPassword} onChange={e => setPasswords(p => ({ ...p, newPassword: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Confirm Password</Label><Input type="password" value={passwords.confirmPassword} onChange={e => setPasswords(p => ({ ...p, confirmPassword: e.target.value }))} /></div>
                <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setStep(STEPS.REQUEST)}>Cancel</Button><Button onClick={handleChangePassword} disabled={!passwordsMatch}>Update Password</Button></div>
              </div>
            )}

            {step === STEPS.DONE && <div className="text-center py-6"><CheckCircle2 className="mx-auto h-12 w-12 text-green-500" /><h3 className="mt-4 font-bold">Password Updated!</h3><Button className="mt-4" variant="outline" onClick={() => setStep(STEPS.REQUEST)}>Change Again</Button></div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}