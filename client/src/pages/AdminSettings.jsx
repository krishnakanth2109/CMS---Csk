import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Lock, User, Mail, Loader2, Eye, EyeOff,
  ShieldCheck, CheckCircle2, RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

// ── ENV ───────────────────────────────────────────────────────────────────────
// VITE_API_URL="http://localhost:5000"  (no trailing /api in .env)
// We always append /api here so every fetch hits the correct endpoint.
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
  const { toast }      = useToast();
  const { authHeaders } = useAuth();   // ← async token getter from AuthContext

  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  // Profile form
  const [formData, setFormData] = useState({ name: '', email: '', username: '' });

  // Password OTP flow
  const [step,      setStep]      = useState(STEPS.REQUEST);
  const [sending,   setSending]   = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [pwSaving,  setPwSaving]  = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);

  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const b0 = useRef(null); const b1 = useRef(null); const b2 = useRef(null);
  const b3 = useRef(null); const b4 = useRef(null); const b5 = useRef(null);
  const boxRefs = [b0, b1, b2, b3, b4, b5];

  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });
  const [showPass,  setShowPass]  = useState({ new: false, confirm: false });

  const allReqsMet     = PASSWORD_REQS.every(r => r.test(passwords.newPassword));
  const passwordsMatch = passwords.newPassword === passwords.confirmPassword && passwords.newPassword.length > 0;

  // ── Auth header builder ───────────────────────────────────────────────────
  // Uses AuthContext.authHeaders() which auto-refreshes the Firebase token
  // if it's within 5 minutes of expiry, and respects the 9-hour session cap.
  // MUST be awaited: const headers = await buildHeaders();
  const buildHeaders = useCallback(async () => {
    const ah = await authHeaders();    // { Authorization: 'Bearer <fresh-token>' }
    return { 'Content-Type': 'application/json', ...ah };
  }, [authHeaders]);

  // ── Read email from session (needed for OTP payload) ──────────────────────
  const getUserEmail = useCallback(() => {
    try {
      const session = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
      return session.email || formData.email || '';
    } catch { return formData.email || ''; }
  }, [formData.email]);

  // ── Fetch profile on mount ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const headers = await buildHeaders();
        const res     = await fetch(`${API_URL}/auth/profile`, { headers });
        if (!res.ok) throw new Error('Failed to load profile');
        const data = await res.json();
        setFormData({ name: data.name || '', email: data.email || '', username: data.username || '' });
      } catch (err) {
        toast({ title: 'Error', description: 'Could not load user profile.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);    // eslint-disable-line react-hooks/exhaustive-deps

  // ── Profile save ──────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const headers = await buildHeaders();
      const res     = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT', headers,
        body: JSON.stringify({ name: formData.name, email: formData.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update profile');

      // Sync sessionStorage so getUserEmail() stays accurate
      try {
        const session = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        sessionStorage.setItem('currentUser', JSON.stringify({ ...session, name: data.name, email: data.email }));
      } catch {}

      toast({ title: 'Profile saved', description: 'Your profile has been updated.' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Countdown timer ───────────────────────────────────────────────────────
  const startCountdown = (secs = 60) => {
    setCountdown(secs);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    const email = getUserEmail();
    if (!email) {
      toast({ title: 'Error', description: 'Session not found. Please log in again.', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const headers = await buildHeaders();
      const res     = await fetch(`${API_URL}/auth/send-otp`, {
        method: 'POST', headers, body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send OTP.');

      if (data.devOtp) {
        setOtpDigits(String(data.devOtp).split(''));
        toast({ title: 'Dev Mode — OTP auto-filled', description: 'Set FIREBASE_WEB_API_KEY in .env for real email delivery.' });
      } else {
        toast({ title: 'OTP Sent!', description: `Check inbox at ${email}.` });
      }
      setStep(STEPS.VERIFY);
      startCountdown(60);
      setTimeout(() => b0.current?.focus(), 120);
    } catch (err) {
      toast({ title: 'Send Failed', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  // ── OTP box handlers ──────────────────────────────────────────────────────
  const handleDigit = (i, val) => {
    if (!/^\d*$/.test(val)) return;
    const d = [...otpDigits]; d[i] = val.slice(-1); setOtpDigits(d);
    if (val && i < 5) boxRefs[i + 1]?.current?.focus();
  };
  const handleKeyDn = (i, e) => {
    if (e.key === 'Backspace' && !otpDigits[i] && i > 0) boxRefs[i - 1]?.current?.focus();
  };
  const handlePaste = (e) => {
    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (t.length === 6) { setOtpDigits(t.split('')); b5.current?.focus(); }
    e.preventDefault();
  };

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    const code  = otpDigits.join('');
    const email = getUserEmail();
    if (code.length < 6) {
      toast({ title: 'Incomplete', description: 'Enter all 6 digits.', variant: 'destructive' });
      return;
    }
    setVerifying(true);
    try {
      const headers = await buildHeaders();
      const res     = await fetch(`${API_URL}/auth/verify-otp`, {
        method: 'POST', headers, body: JSON.stringify({ email, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpDigits(['', '', '', '', '', '']);
        setTimeout(() => b0.current?.focus(), 50);
        throw new Error(data.message || 'Verification failed.');
      }
      toast({ title: 'Verified!', description: 'Set your new password.' });
      setStep(STEPS.RESET);
    } catch (err) {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  };

  // ── Step 3: Change password ───────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!allReqsMet)     { toast({ title: 'Weak Password',  description: 'Meet all requirements.', variant: 'destructive' }); return; }
    if (!passwordsMatch) { toast({ title: 'Mismatch',       description: 'Passwords do not match.', variant: 'destructive' }); return; }
    setPwSaving(true);
    try {
      const headers = await buildHeaders();
      const res     = await fetch(`${API_URL}/auth/change-password`, {
        method: 'PUT', headers,
        body: JSON.stringify({ email: getUserEmail(), newPassword: passwords.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update password.');
      setStep(STEPS.DONE);
    } catch (err) {
      toast({ title: 'Update Failed', description: err.message, variant: 'destructive' });
    } finally {
      setPwSaving(false);
    }
  };

  const resetOtpFlow = () => {
    setStep(STEPS.REQUEST);
    setOtpDigits(['', '', '', '', '', '']);
    setPasswords({ newPassword: '', confirmPassword: '' });
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(0);
  };

  const stepIdx  = [STEPS.REQUEST, STEPS.VERIFY, STEPS.RESET, STEPS.DONE].indexOf(step);
  const stepMeta = ['Send OTP', 'Verify', 'New Password'];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">

        <div>
          <h1 className="text-4xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your account and preferences</p>
        </div>

        {/* ── Profile Card ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Profile Information</CardTitle>
            </div>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={formData.username} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Username cannot be changed.</p>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                  : 'Save Profile'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Password / OTP Card ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <CardTitle>Change Password</CardTitle>
            </div>
            <CardDescription>Verify your identity with a one-time code, then set your new password.</CardDescription>
          </CardHeader>
          <CardContent>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              {stepMeta.map((label, i) => {
                const done   = i < Math.min(stepIdx, 3) || step === STEPS.DONE;
                const active = i === Math.min(stepIdx, 2);
                return (
                  <React.Fragment key={label}>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        done   ? 'bg-green-500 text-white'
                               : active ? 'bg-primary text-primary-foreground'
                               : 'bg-muted text-muted-foreground'
                      }`}>
                        {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      <span className={`text-xs font-medium hidden sm:block ${active || done ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {label}
                      </span>
                    </div>
                    {i < 2 && <div className={`flex-1 h-px ${done ? 'bg-green-400' : 'bg-border'}`} />}
                  </React.Fragment>
                );
              })}
            </div>

            {/* STEP 1 — Request OTP */}
            {step === STEPS.REQUEST && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                  <Mail className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Identity Verification Required</p>
                    <p className="text-sm text-blue-700 dark:text-blue-400 mt-0.5">
                      A 6-digit OTP will be sent to <strong>{getUserEmail()}</strong>.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleSendOtp} disabled={sending} className="min-w-[160px]">
                    {sending
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                      : <><Mail className="mr-2 h-4 w-4" />Send OTP Code</>}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2 — Verify OTP */}
            {step === STEPS.VERIFY && (
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code sent to <strong className="text-foreground">{getUserEmail()}</strong>. Expires in <strong>10 minutes</strong>.
                </p>

                <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                  {otpDigits.map((digit, i) => (
                    <input key={i} ref={boxRefs[i]} type="text" inputMode="numeric" maxLength={1} value={digit}
                      onChange={e => handleDigit(i, e.target.value)}
                      onKeyDown={e => handleKeyDn(i, e)}
                      className={`w-11 h-14 text-center text-2xl font-bold rounded-lg border-2 transition-all
                        focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background text-foreground
                        ${digit ? 'border-primary' : 'border-border'}`}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <button type="button" onClick={handleSendOtp} disabled={countdown > 0 || sending}
                    className="text-sm text-primary hover:text-primary/80 disabled:text-muted-foreground disabled:cursor-not-allowed flex items-center gap-1 transition-colors">
                    <RefreshCw className={`h-3.5 w-3.5 ${sending ? 'animate-spin' : ''}`} />
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
                  </button>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={resetOtpFlow}>Back</Button>
                    <Button onClick={handleVerifyOtp} disabled={verifying || otpDigits.join('').length < 6} className="min-w-[130px]">
                      {verifying
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
                        : <><ShieldCheck className="mr-2 h-4 w-4" />Verify OTP</>}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 — Set new password */}
            {step === STEPS.RESET && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" /> Identity verified — set your new password below.
                </div>

                <div className="space-y-2">
                  <Label htmlFor="np">New Password</Label>
                  <div className="relative">
                    <Input id="np" type={showPass.new ? 'text' : 'password'} value={passwords.newPassword}
                      onChange={e => setPasswords(p => ({ ...p, newPassword: e.target.value }))}
                      placeholder="Enter new password" className="pr-10" />
                    <button type="button" tabIndex={-1} onClick={() => setShowPass(p => ({ ...p, new: !p.new }))}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                      {showPass.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {passwords.newPassword.length > 0 && (
                  <div className="p-3 bg-muted/50 rounded-lg border border-border space-y-1.5">
                    {PASSWORD_REQS.map(req => (
                      <div key={req.label} className="flex items-center gap-2 text-xs">
                        {req.test(passwords.newPassword)
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          : <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground shrink-0" />}
                        <span className={req.test(passwords.newPassword) ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="cp">Confirm New Password</Label>
                  <div className="relative">
                    <Input id="cp" type={showPass.confirm ? 'text' : 'password'} value={passwords.confirmPassword}
                      onChange={e => setPasswords(p => ({ ...p, confirmPassword: e.target.value }))}
                      placeholder="Confirm new password" className="pr-10" />
                    <button type="button" tabIndex={-1} onClick={() => setShowPass(p => ({ ...p, confirm: !p.confirm }))}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                      {showPass.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwords.confirmPassword && !passwordsMatch && (
                    <p className="text-xs text-destructive mt-1">Passwords do not match.</p>
                  )}
                  {passwords.confirmPassword && passwordsMatch && (
                    <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                      <CheckCircle2 className="h-3 w-3" /> Passwords match
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={resetOtpFlow} disabled={pwSaving}>Cancel</Button>
                  <Button onClick={handleChangePassword} disabled={pwSaving || !allReqsMet || !passwordsMatch} className="min-w-[160px]">
                    {pwSaving
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>
                      : <><Lock className="mr-2 h-4 w-4" />Update Password</>}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4 — Done */}
            {step === STEPS.DONE && (
              <div className="py-8 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Password Updated!</h3>
                  <p className="text-sm text-muted-foreground mt-1">Your password has been changed successfully.</p>
                </div>
                <Button variant="outline" onClick={resetOtpFlow}>Change Again</Button>
              </div>
            )}

          </CardContent>
        </Card>

      </div>
    </div>
  );
}