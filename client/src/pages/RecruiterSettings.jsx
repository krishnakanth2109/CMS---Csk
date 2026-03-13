import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Lock, Loader2, Eye, EyeOff,
  Mail, ShieldCheck, CheckCircle2, RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = `${BASE_URL}/api`;

const TInput = ({ className = '', ...props }) => (
  <input
    className={`w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm
      bg-white dark:bg-gray-900 text-gray-900 dark:text-white
      focus:outline-none focus:ring-2 focus:ring-blue-500
      disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    {...props}
  />
);

const TLabel = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
    {children}
  </label>
);

const TBtn = ({ children, onClick, disabled, className = '', variant = 'primary', type = 'button' }) => {
  const styles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center font-medium rounded-lg px-4 py-2 text-sm
        transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none
        ${styles[variant] || styles.primary} ${className}`}>
      {children}
    </button>
  );
};

const STEPS = { REQUEST: 'request', VERIFY: 'verify', RESET: 'reset', DONE: 'done' };

const PASSWORD_REQS = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter',  test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter',  test: (p) => /[a-z]/.test(p) },
  { label: 'One number',            test: (p) => /\d/.test(p) },
];

export default function RecruiterSettings() {
  const { toast }       = useToast();
  const { authHeaders } = useAuth();

  const buildHeaders = useCallback(async () => {
    const ah = await authHeaders();
    return { 'Content-Type': 'application/json', ...ah };
  }, [authHeaders]);

  const getUserEmail = () => {
    try {
      const session = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
      return session.email || '';
    } catch { return ''; }
  };

  const [step,      setStep]      = useState(STEPS.REQUEST);
  const [sending,   setSending]   = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);

  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const box0 = useRef(null); const box1 = useRef(null); const box2 = useRef(null);
  const box3 = useRef(null); const box4 = useRef(null); const box5 = useRef(null);
  const boxRefs = [box0, box1, box2, box3, box4, box5];

  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });
  const [showPass,  setShowPass]  = useState({ new: false, confirm: false });

  const allReqsMet     = PASSWORD_REQS.every(r => r.test(passwords.newPassword));
  const passwordsMatch = passwords.newPassword === passwords.confirmPassword && passwords.newPassword.length > 0;

  // ── KEY FIX: Read ?otp= and ?email= from URL after Firebase redirect ────────
  // When the user clicks the Firebase email link, Firebase verifies the token
  // and redirects to continueUrl = /settings?otp=CODE&email=EMAIL
  // We read these params here, auto-fill the OTP boxes, and jump to step 2.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const otpParam   = params.get('otp');
    const emailParam = params.get('email');

    if (otpParam && otpParam.length === 6 && /^\d{6}$/.test(otpParam)) {
      setOtpDigits(otpParam.split(''));
      setStep(STEPS.VERIFY);
      startCountdown(600); // 10 min shown as seconds for the verify step
      toast({
        title: 'Email Verified!',
        description: emailParam
          ? `OTP auto-filled for ${emailParam}. Click Verify OTP to continue.`
          : 'OTP auto-filled. Click Verify OTP to continue.',
      });

      // Clean the URL so the OTP isn't visible or reusable on refresh
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

      // Dev mode: backend returns the OTP directly (no FIREBASE_WEB_API_KEY set)
      if (data.devOtp) {
        const devCode = String(data.devOtp);
        setOtpDigits(devCode.split(''));
        toast({ title: 'Dev Mode — OTP auto-filled', description: 'Add FIREBASE_WEB_API_KEY to .env for real email delivery.' });
        setStep(STEPS.VERIFY);
        startCountdown(60);
        setTimeout(() => box0.current?.focus(), 120);
      } else {
        // Production: Firebase sends the email. User must click the link.
        // Page will reload via continueUrl with ?otp= in the URL.
        toast({
          title: 'Email Sent!',
          description: `Check your inbox at ${email}. Click the link in the email to continue.`,
        });
        setStep(STEPS.VERIFY);
        startCountdown(60);
      }
    } catch (err) {
      toast({ title: 'Send Failed', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  // ── OTP box handlers ──────────────────────────────────────────────────────
  const handleDigitChange = (i, val) => {
    if (!/^\d*$/.test(val)) return;
    const d = [...otpDigits]; d[i] = val.slice(-1); setOtpDigits(d);
    if (val && i < 5) boxRefs[i + 1]?.current?.focus();
  };
  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otpDigits[i] && i > 0) boxRefs[i - 1]?.current?.focus();
  };
  const handlePaste = (e) => {
    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (t.length === 6) { setOtpDigits(t.split('')); box5.current?.focus(); }
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
        setTimeout(() => box0.current?.focus(), 50);
        throw new Error(data.message || 'Verification failed.');
      }
      toast({ title: 'Verified!', description: 'Set your new password.' });
      setStep(STEPS.RESET);
    } catch (err) {
      toast({ title: 'Verification Failed', description: err.message, variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  };

  // ── Step 3: Change password ───────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!allReqsMet)     { toast({ title: 'Weak Password', description: 'Meet all requirements.', variant: 'destructive' }); return; }
    if (!passwordsMatch) { toast({ title: 'Mismatch',      description: 'Passwords do not match.', variant: 'destructive' }); return; }
    setSaving(true);
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
      setSaving(false);
    }
  };

  const resetFlow = () => {
    setStep(STEPS.REQUEST);
    setOtpDigits(['', '', '', '', '', '']);
    setPasswords({ newPassword: '', confirmPassword: '' });
    if (timerRef.current) clearInterval(timerRef.current);
    setCountdown(0);
  };

  const stepIdx  = [STEPS.REQUEST, STEPS.VERIFY, STEPS.RESET, STEPS.DONE].indexOf(step);
  const stepMeta = ['Send OTP', 'Verify', 'New Password'];

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto space-y-6">

        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Manage your security preferences</p>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-md overflow-hidden">

          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Change Password</h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Verify your identity with a one-time code, then set your new password.
            </p>
          </div>

          {/* Step indicator */}
          <div className="px-6 pt-5 flex items-center gap-2">
            {stepMeta.map((label, i) => {
              const done   = i < Math.min(stepIdx, 3) || step === STEPS.DONE;
              const active = i === Math.min(stepIdx, 2);
              return (
                <React.Fragment key={label}>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      done   ? 'bg-green-500 text-white'
                             : active ? 'bg-blue-600 text-white'
                             : 'bg-gray-200 dark:bg-gray-600 text-gray-500'
                    }`}>
                      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium hidden sm:block ${active || done ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400'}`}>
                      {label}
                    </span>
                  </div>
                  {i < 2 && <div className={`flex-1 h-px ${done ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-600'}`} />}
                </React.Fragment>
              );
            })}
          </div>

          <div className="px-6 py-6">

            {/* STEP 1 — Request OTP */}
            {step === STEPS.REQUEST && (
              <div className="space-y-5">
                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                  <Mail className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Verification Required</p>
                    <p className="text-sm text-blue-700 dark:text-blue-400 mt-0.5">
                      A verification email will be sent to <strong>{getUserEmail() || 'your email'}</strong>.
                      Click the link in the email to continue.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <TBtn onClick={handleSendOtp} disabled={sending} className="min-w-[160px]">
                    {sending
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                      : <><Mail className="mr-2 h-4 w-4" />Send OTP Code</>}
                  </TBtn>
                </div>
              </div>
            )}

            {/* STEP 2 — Verify OTP */}
            {step === STEPS.VERIFY && (
              <div className="space-y-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enter the 6-digit code from the verification email sent to{' '}
                  <strong className="text-gray-800 dark:text-gray-200">{getUserEmail()}</strong>.
                  Expires in <strong>10 minutes</strong>.
                </p>

                <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                  {otpDigits.map((digit, i) => (
                    <input key={i} ref={boxRefs[i]} type="text" inputMode="numeric" maxLength={1} value={digit}
                      onChange={e => handleDigitChange(i, e.target.value)}
                      onKeyDown={e => handleKeyDown(i, e)}
                      className={`w-11 h-14 text-center text-2xl font-bold rounded-lg border-2 transition-all
                        focus:outline-none focus:ring-2 focus:ring-blue-500/30
                        ${digit
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white'}`}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <button type="button" onClick={handleSendOtp} disabled={countdown > 0 || sending}
                    className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center gap-1 transition-colors">
                    <RefreshCw className={`h-3.5 w-3.5 ${sending ? 'animate-spin' : ''}`} />
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
                  </button>
                  <div className="flex gap-3">
                    <TBtn variant="outline" onClick={resetFlow}>Back</TBtn>
                    <TBtn onClick={handleVerifyOtp} disabled={verifying || otpDigits.join('').length < 6} className="min-w-[130px]">
                      {verifying
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
                        : <><ShieldCheck className="mr-2 h-4 w-4" />Verify OTP</>}
                    </TBtn>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 — Set new password */}
            {step === STEPS.RESET && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" /> Identity verified — set your new password below.
                </div>

                <div className="space-y-1">
                  <TLabel htmlFor="np">New Password</TLabel>
                  <div className="relative">
                    <TInput id="np" type={showPass.new ? 'text' : 'password'} value={passwords.newPassword}
                      onChange={e => setPasswords(p => ({ ...p, newPassword: e.target.value }))}
                      placeholder="Enter new password" className="pr-10" />
                    <button type="button" tabIndex={-1} onClick={() => setShowPass(p => ({ ...p, new: !p.new }))}
                      className="absolute right-0 top-0 h-full px-3 text-gray-400 hover:text-gray-600 focus:outline-none">
                      {showPass.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {passwords.newPassword.length > 0 && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 space-y-1.5">
                    {PASSWORD_REQS.map(req => (
                      <div key={req.label} className="flex items-center gap-2 text-xs">
                        {req.test(passwords.newPassword)
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          : <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 dark:border-gray-500 shrink-0" />}
                        <span className={req.test(passwords.newPassword) ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}>
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-1">
                  <TLabel htmlFor="cp">Confirm New Password</TLabel>
                  <div className="relative">
                    <TInput id="cp" type={showPass.confirm ? 'text' : 'password'} value={passwords.confirmPassword}
                      onChange={e => setPasswords(p => ({ ...p, confirmPassword: e.target.value }))}
                      placeholder="Confirm new password"
                      className={`pr-10 ${passwords.confirmPassword && !passwordsMatch ? 'border-red-400 focus:ring-red-400' : ''}`} />
                    <button type="button" tabIndex={-1} onClick={() => setShowPass(p => ({ ...p, confirm: !p.confirm }))}
                      className="absolute right-0 top-0 h-full px-3 text-gray-400 hover:text-gray-600 focus:outline-none">
                      {showPass.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwords.confirmPassword && !passwordsMatch && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
                  )}
                  {passwords.confirmPassword && passwordsMatch && (
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mt-1">
                      <CheckCircle2 className="h-3 w-3" /> Passwords match
                    </p>
                  )}
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <TBtn variant="outline" onClick={resetFlow} disabled={saving}>Cancel</TBtn>
                  <TBtn onClick={handleChangePassword} disabled={saving || !allReqsMet || !passwordsMatch} className="min-w-[160px]">
                    {saving
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>
                      : <><Lock className="mr-2 h-4 w-4" />Update Password</>}
                  </TBtn>
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
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Password Updated!</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your password has been changed successfully.</p>
                </div>
                <TBtn variant="outline" onClick={resetFlow}>Change Again</TBtn>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}