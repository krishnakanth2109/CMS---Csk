import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  loginUser,
  registerUser,
  getUserProfile,
  updateUserProfile,
  forgotPassword,
} from '../controllers/authController.js';

const router = express.Router();

const otpStore  = new Map();
const OTP_TTL   = 10 * 60 * 1000; 
const makeOTP = () => String(Math.floor(100000 + Math.random() * 900000));

// OTP Logic (Same as your provided code)
router.post('/send-otp', protect, async (req, res) => {
  const { email } = req.body;
  if (req.user.email !== email) return res.status(403).json({ message: 'Unauthorized' });

  try {
    const code = makeOTP();
    otpStore.set(email, { code, expiresAt: Date.now() + OTP_TTL, verified: false });
    
    const webApiKey = process.env.FIREBASE_WEB_API_KEY;
    if (!webApiKey) return res.status(200).json({ devOtp: code, message: 'Dev Mode' });

    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${webApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: 'PASSWORD_RESET', email, continueUrl: `${process.env.FRONTEND_URL}/settings?otp=${code}` }),
    });
    res.status(200).json({ message: 'OTP sent.' });
  } catch (err) { res.status(500).json({ message: 'Error' }); }
});

router.post('/verify-otp', protect, async (req, res) => {
  const { email, otp } = req.body;
  const stored = otpStore.get(email);
  if (!stored || String(otp).trim() !== stored.code) return res.status(400).json({ message: 'Invalid OTP' });
  otpStore.set(email, { ...stored, verified: true, expiresAt: Date.now() + OTP_TTL });
  res.status(200).json({ message: 'Verified' });
});

router.put('/change-password', protect, async (req, res) => {
  const { email, newPassword } = req.body;
  const stored = otpStore.get(email);
  if (!stored || !stored.verified) return res.status(403).json({ message: 'Verify OTP first' });

  try {
    const { admin } = await import('../middleware/authMiddleware.js');
    await admin.auth().updateUser(req.user.firebaseUid, { password: newPassword });
    otpStore.delete(email);
    res.status(200).json({ message: 'Password updated' });
  } catch (err) { res.status(500).json({ message: 'Update failed' }); }
});

router.post('/login', loginUser);
router.post('/register', registerUser);
router.post('/forgot-password', forgotPassword);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile); // <--- Matches "Save Profile" button

export default router;