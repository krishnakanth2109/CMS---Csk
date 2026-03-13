import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import {
  loginUser,
  registerUser,
  getUserProfile,
  updateUserProfile,
  forgotPassword,
} from '../controllers/authController.js';

const router = express.Router();

// ─── OTP Store ────────────────────────────────────────────────────────────────
const otpStore = new Map();
const OTP_TTL  = 10 * 60 * 1000; // 10 minutes
const makeOTP  = () => String(Math.floor(100000 + Math.random() * 900000));

// ─── Validate + normalise FRONTEND_URL at startup ────────────────────────────
// Firebase requires continueUrl to be a fully-qualified URL: https://... or http://...
// If FRONTEND_URL is missing or lacks a scheme, we fix it and warn loudly.
const getRawFrontendUrl = () => {
  let url = (process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');

  if (!url) {
    // Fallback to localhost for local development
    console.warn('[send-otp] ⚠  FRONTEND_URL is not set in .env — defaulting to http://localhost:5173');
    return 'http://localhost:5173';
  }

  // Add scheme if missing  (e.g. "localhost:5173" → "http://localhost:5173")
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    const fixed = `http://${url}`;
    console.warn(`[send-otp] ⚠  FRONTEND_URL missing scheme — auto-corrected to: ${fixed}`);
    return fixed;
  }

  return url;
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/send-otp
//
// FLOW:
//   1. Generate 6-digit OTP, store server-side with 10-min TTL
//   2. Build continueUrl = FRONTEND_URL/settings?otp=CODE&email=EMAIL
//   3. Call Firebase REST API (sendOobCode) → Firebase sends its password-reset
//      email containing a "Reset Password" button
//   4. User clicks button → Firebase verifies oobCode → redirects to continueUrl
//   5. Frontend (Settings page) reads ?otp from URL → auto-fills boxes
//   6. User clicks "Verify OTP" → /verify-otp → /change-password
//
// REQUIRED .env keys:
//   FIREBASE_WEB_API_KEY = AIzaSy...   (Firebase Console → Project Settings → General → Web API Key)
//   FRONTEND_URL         = https://vagarious-cms.netlify.app   (NO trailing slash)
//
// Also add FRONTEND_URL to Firebase Console → Authentication → Settings → Authorized Domains
// ─────────────────────────────────────────────────────────────────────────────
router.post('/send-otp', protect, async (req, res) => {
  const { email } = req.body;

  if (req.user.email !== email)
    return res.status(403).json({ message: 'Unauthorized: email mismatch.' });

  const webApiKey   = process.env.FIREBASE_WEB_API_KEY;
  const frontendUrl = getRawFrontendUrl();

  try {
    const code = makeOTP();
    otpStore.set(email, { code, expiresAt: Date.now() + OTP_TTL, verified: false });

    // ── Dev / no-key mode: return OTP directly so dev can test without email ─
    if (!webApiKey) {
      console.log(`[DEV] OTP for ${email}: ${code}`);
      return res.status(200).json({
        devOtp: code,
        message: 'Dev Mode — FIREBASE_WEB_API_KEY not set. Add it to .env for real email delivery.',
      });
    }

    // ── Build a valid, fully-qualified continueUrl ────────────────────────────
    const continueUrl = `${frontendUrl}/settings?otp=${code}&email=${encodeURIComponent(email)}`;
    console.log(`[send-otp] continueUrl → ${continueUrl}`);

    // ── Call Firebase REST API to send the password-reset email ──────────────
    const firebaseRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${webApiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email,
          continueUrl,
        }),
      }
    );

    const firebaseData = await firebaseRes.json();

    if (!firebaseRes.ok) {
      const fbMsg = firebaseData?.error?.message || 'Firebase rejected the request.';
      console.error('[send-otp] Firebase error:', fbMsg);

      if (fbMsg === 'EMAIL_NOT_FOUND')
        return res.status(404).json({ message: 'No account found with this email.' });
      if (fbMsg === 'INVALID_EMAIL')
        return res.status(400).json({ message: 'Invalid email address.' });
      if (fbMsg.includes('TOO_MANY_ATTEMPTS'))
        return res.status(429).json({ message: 'Too many attempts. Try again later.' });
      if (fbMsg.includes('INVALID_CONTINUE_URI') || fbMsg.includes('MISSING_CONTINUE_URI'))
        return res.status(500).json({
          message: 'Server config error: FRONTEND_URL in .env is invalid. '
                 + `Current value resolves to: "${frontendUrl}". `
                 + 'It must be a full URL like https://vagarious-cms.netlify.app',
        });

      return res.status(500).json({ message: `Email delivery failed: ${fbMsg}` });
    }

    console.log(`[send-otp] Reset email sent to: ${email}`);
    res.status(200).json({
      message: 'Verification email sent! Check your inbox and click the link in the email.',
    });

  } catch (err) {
    console.error('[send-otp] Unexpected error:', err.message);
    res.status(500).json({ message: 'Failed to send verification email.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify-otp
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify-otp', protect, async (req, res) => {
  const { email, otp } = req.body;
  const stored = otpStore.get(email);

  if (!stored)
    return res.status(400).json({ message: 'No OTP found. Request a new one.' });

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ message: 'OTP expired. Request a new one.' });
  }

  if (String(otp).trim() !== stored.code)
    return res.status(400).json({ message: 'Invalid OTP.' });

  otpStore.set(email, { ...stored, verified: true, expiresAt: Date.now() + OTP_TTL });
  res.status(200).json({ message: 'OTP verified.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/change-password
// ─────────────────────────────────────────────────────────────────────────────
router.put('/change-password', protect, async (req, res) => {
  const { email, newPassword } = req.body;
  const stored = otpStore.get(email);

  if (!stored || !stored.verified)
    return res.status(403).json({ message: 'OTP not verified. Verify first.' });

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ message: 'OTP session expired. Start over.' });
  }

  try {
    await admin.auth().updateUser(req.user.firebaseUid, { password: newPassword });
    otpStore.delete(email);
    res.status(200).json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('[change-password] Error:', err.code, err.message);
    if (err.code === 'auth/weak-password')
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    res.status(500).json({ message: 'Failed to update password.' });
  }
});

// ─── Other auth routes (unchanged) ───────────────────────────────────────────
router.post('/login',           loginUser);
router.post('/register',        registerUser);
router.post('/forgot-password', forgotPassword);
router.get('/profile',  protect, getUserProfile);
router.put('/profile',  protect, updateUserProfile);

export default router;