import User from '../models/User.js';
import { admin } from '../middleware/authMiddleware.js';
import { v2 as cloudinary } from 'cloudinary';
import { sendBrevoEmail } from '../services/email.js';

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key:    process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get current logged-in user's full profile
// @route   GET /api/recruiters/profile
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      _id:            user._id,
      firstName:      user.firstName,
      lastName:       user.lastName,
      email:          user.email,
      username:       user.username,
      phone:          user.phone          || '',
      location:       user.location       || '',
      specialization: user.specialization || '',
      experience:     user.experience     || '',
      bio:            user.bio            || '',
      profilePicture: user.profilePicture || '',
      role:           user.role,
      active:         user.active,
      recruiterId:    user.recruiterId    || '',
      socials: {
        linkedin: user.socials?.linkedin || '',
        github:   user.socials?.github   || '',
        twitter:  user.socials?.twitter  || '',
        website:  user.socials?.website  || '',
      },
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update current logged-in user's profile
// @route   PUT /api/recruiters/profile
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // ── Basic fields ──────────────────────────────────────────────────────
    if (req.body.firstName !== undefined) user.firstName      = req.body.firstName.trim()  || user.firstName;
    if (req.body.lastName  !== undefined) user.lastName       = req.body.lastName.trim()   || user.lastName;
    if (req.body.email     !== undefined) user.email          = req.body.email.trim()      || user.email;
    if (req.body.phone     !== undefined) user.phone          = req.body.phone;
    if (req.body.location  !== undefined) user.location       = req.body.location;
    if (req.body.specialization !== undefined) user.specialization = req.body.specialization;
    if (req.body.experience     !== undefined) user.experience     = req.body.experience;
    if (req.body.bio            !== undefined) user.bio            = req.body.bio;

    // ── Socials ───────────────────────────────────────────────────────────
    if (req.body.socials && typeof req.body.socials === 'object') {
      user.socials = {
        linkedin: req.body.socials.linkedin ?? user.socials?.linkedin ?? '',
        github:   req.body.socials.github   ?? user.socials?.github   ?? '',
        twitter:  req.body.socials.twitter  ?? user.socials?.twitter  ?? '',
        website:  req.body.socials.website  ?? user.socials?.website  ?? '',
      };
    }

    // ── Profile picture (HANDLES DELETION, UPLOAD, AND KEEPING) ───────────
    if (req.body.profilePicture !== undefined) {
      if (req.body.profilePicture === '') {
        // Option 1: User deleted the image
        if (user.profilePicture?.includes('cloudinary')) {
          try { await cloudinary.uploader.destroy(`recruiters/recruiter_${user._id}`); } catch {}
        }
        user.profilePicture = '';
      } 
      else if (req.body.profilePicture.startsWith('data:image')) {
        // Option 2: User uploaded a new base64 image
        try {
          if (user.profilePicture?.includes('cloudinary')) {
            try { await cloudinary.uploader.destroy(`recruiters/recruiter_${user._id}`); } catch {}
          }
          const result = await cloudinary.uploader.upload(req.body.profilePicture, {
            folder:        'recruiters',
            public_id:     `recruiter_${user._id}`,
            overwrite:     true,
            resource_type: 'image',
            transformation: [
              { width: 500, height: 500, crop: 'limit' },
              { quality: 'auto' },
              { fetch_format: 'auto' },
            ],
          });
          user.profilePicture = result.secure_url;
        } catch (uploadError) {
          return res.status(500).json({ message: 'Image upload failed', error: uploadError.message });
        }
      } 
      else {
        // Option 3: Image URL remains unchanged
        user.profilePicture = req.body.profilePicture;
      }
    }

    // ── Sync displayName to Firebase Auth ─────────────────────────────────
    if (user.firebaseUid) {
      const fbUpdates = {};
      const newFirst = req.body.firstName?.trim();
      const newLast  = req.body.lastName?.trim();
      if (newFirst || newLast) {
        fbUpdates.displayName = `${newFirst || user.firstName} ${newLast || user.lastName}`.trim();
      }
      if (req.body.email && req.body.email.trim() !== user.email) {
        fbUpdates.email = req.body.email.trim();
      }
      if (Object.keys(fbUpdates).length > 0) {
        try {
          await admin.auth().updateUser(user.firebaseUid, fbUpdates);
        } catch (fbErr) {
          console.error('[Profile] Firebase sync error (non-fatal):', fbErr.message);
        }
      }
    }

    const updatedUser = await user.save();

    res.json({
      _id:            updatedUser._id,
      firstName:      updatedUser.firstName,
      lastName:       updatedUser.lastName,
      email:          updatedUser.email,
      username:       updatedUser.username,
      phone:          updatedUser.phone          || '',
      location:       updatedUser.location       || '',
      specialization: updatedUser.specialization || '',
      experience:     updatedUser.experience     || '',
      bio:            updatedUser.bio            || '',
      profilePicture: updatedUser.profilePicture || '',
      role:           updatedUser.role,
      active:         updatedUser.active,
      socials: {
        linkedin: updatedUser.socials?.linkedin || '',
        github:   updatedUser.socials?.github   || '',
        twitter:  updatedUser.socials?.twitter  || '',
        website:  updatedUser.socials?.website  || '',
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already in use by another account.' });
    }
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all recruiters (admin view)
// @route   GET /api/recruiters
// @access  Private/Admin
// ─────────────────────────────────────────────────────────────────────────────
export const getRecruiters = async (req, res) => {
  try {
    // ✅ FIX: Fetch only 'recruiter' and 'admin' roles — managers are intentionally excluded.
    // The Recruiters page shows admins + recruiters only.
    // Managers are managed separately and should not appear in this list.
    // ✅ FIX: Removed active:true filter — fetch ALL users (active + inactive)
    // The frontend AdminRecruiters.jsx handles active/inactive display and counts.
    // Filtering by active:true here meant deactivated users were never returned,
    // so the Inactive counter always showed 0 and deactivated cards disappeared.
    const recruiters = await User.find({
      role: { $in: ['recruiter', 'admin', 'manager'] }
    }).select('-password').sort({ role: 1, firstName: 1 }).lean();
    console.log(`[getRecruiters] Found ${recruiters.length} users with roles recruiter/admin/manager`);
    if (recruiters.length > 0) {
      console.log(`- Sample: ${recruiters[0].firstName} ${recruiters[0].lastName} role: ${recruiters[0].role}`);
    }
    res.json(recruiters);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a new recruiter (admin only)
// @route   POST /api/recruiters
// @access  Private/Admin
// ─────────────────────────────────────────────────────────────────────────────
export const createRecruiter = async (req, res) => {
  const { firstName, lastName, email, password, recruiterId, phone, role, username, profilePicture } = req.body;

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ message: 'First name, last name, email, and password are required.' });
  }

  let firebaseUid = null;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User with this email already exists.' });

    if (recruiterId) {
      const idExists = await User.findOne({ recruiterId });
      if (idExists) return res.status(400).json({ message: 'Recruiter ID already exists.' });
    }

    let firebaseUser;
    try {
      firebaseUser = await admin.auth().createUser({
        email,
        password,
        displayName: `${firstName} ${lastName}`,
      });
    } catch (fbError) {
      if (fbError.code === 'auth/email-already-exists') {
        firebaseUser = await admin.auth().getUserByEmail(email);
      } else {
        throw fbError;
      }
    }
    firebaseUid = firebaseUser.uid;

    const user = await User.create({
      firebaseUid,
      firstName,
      lastName,
      email,
      recruiterId,
      phone,
      role:           role || 'recruiter',
      username:       username || email.split('@')[0],
      profilePicture: profilePicture || '',
      active:         true,
    });

    res.status(201).json({
      _id:         user._id,
      firstName:   user.firstName,
      lastName:    user.lastName,
      email:       user.email,
      recruiterId: user.recruiterId,
      role:        user.role,
      firebaseUid: user.firebaseUid,
    });

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5174').replace(/\/$/, '');

    // Send Welcome Email to Recruiter - BACKGROUNDED
    sendBrevoEmail({
      toEmail: email,
      toName: `${firstName} ${lastName}`,
      subject: "Welcome to VTS Tracker - Recruiter Account",
      htmlContent: `
        <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #6366f1;">Welcome ${firstName}!</h2>
          <p>Your recruiter account has been created successfully in the <b>VTS Tracker</b> portal.</p>
          <p><b>Your Credentials:</b></p>
          <ul>
            <li><b>Email:</b> ${email}</li>
            <li><b>Password:</b> ${password}</li>
          </ul>
          <p>You can login here: <a href="${frontendUrl}/login">VTS Login</a></p>
          <p>Please change your password after your first login for security.</p>
          <p>Best Regards,<br/><b>Admin Team - Arah Info Tech</b></p>
        </body>
        </html>
      `
    }).then(sent => {
      if (sent) console.log(`[Email] Welcome email sent asynchronously to: ${email}`);
      else console.error(`[Email] Async welcome email delivery FAILED for: ${email}`);
    }).catch(err => {
      console.error(`[Email Error] Async welcome email for ${email}:`, err.message);
    });
  } catch (error) {
    console.error('Create Recruiter Error:', error);
    if (firebaseUid) {
      try { await admin.auth().deleteUser(firebaseUid); } catch {}
    }
    if (error.code === 'auth/weak-password') return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    if (error.code === 'auth/invalid-email')  return res.status(400).json({ message: 'Invalid email address.' });
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update a specific recruiter (admin only)
// @route   PUT /api/recruiters/:id
// @access  Private/Admin
// ─────────────────────────────────────────────────────────────────────────────
export const updateRecruiter = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Recruiter not found' });

    if (req.body.recruiterId && req.body.recruiterId !== user.recruiterId) {
      const idExists = await User.findOne({ recruiterId: req.body.recruiterId });
      if (idExists) return res.status(400).json({ message: 'Recruiter ID already exists' });
    }
    if (req.body.email && req.body.email !== user.email) {
      const emailExists = await User.findOne({ email: req.body.email });
      if (emailExists) return res.status(400).json({ message: 'Email already exists' });
    }

    if (user.firebaseUid) {
      const fbUpdates = {};
      if (req.body.password)                        fbUpdates.password    = req.body.password;
      if (req.body.email && req.body.email !== user.email) fbUpdates.email = req.body.email;
      if (req.body.firstName || req.body.lastName) {
        fbUpdates.displayName = `${req.body.firstName || user.firstName} ${req.body.lastName || user.lastName}`.trim();
      }
      if (Object.keys(fbUpdates).length > 0) {
        try { await admin.auth().updateUser(user.firebaseUid, fbUpdates); }
        catch (e) { console.error('Firebase admin update error (non-fatal):', e.message); }
      }
    }

    user.firstName      = req.body.firstName      || user.firstName;
    user.lastName       = req.body.lastName       || user.lastName;
    user.email          = req.body.email          || user.email;
    user.phone          = req.body.phone          || user.phone;
    user.role           = req.body.role           || user.role;
    user.username       = req.body.username       || user.username;
    user.recruiterId    = req.body.recruiterId    || user.recruiterId;
    
    // Explicitly allow picture deletion by admins too
    if (req.body.profilePicture !== undefined) {
      user.profilePicture = req.body.profilePicture;
    }

    const updatedUser = await user.save();
    res.json({
      _id:         updatedUser._id,
      firstName:   updatedUser.firstName,
      lastName:    updatedUser.lastName,
      email:       updatedUser.email,
      role:        updatedUser.role,
      recruiterId: updatedUser.recruiterId,
      profilePicture: updatedUser.profilePicture
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a recruiter (admin only)
// @route   DELETE /api/recruiters/:id
// @access  Private/Admin
// ─────────────────────────────────────────────────────────────────────────────
export const deleteRecruiter = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Recruiter not found' });

    if (user.firebaseUid) {
      try { await admin.auth().deleteUser(user.firebaseUid); }
      catch (e) { console.error('Firebase delete (non-fatal):', e.message); }
    }

    if (user.profilePicture?.includes('cloudinary')) {
      try { await cloudinary.uploader.destroy(`recruiters/recruiter_${user._id}`); } catch {}
    }

    await user.deleteOne();
    res.json({ message: 'Recruiter removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Toggle active/inactive status (admin only)
// @route   PATCH /api/recruiters/:id/status
// @access  Private/Admin
// ─────────────────────────────────────────────────────────────────────────────
export const toggleRecruiterStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Recruiter not found' });

    // ✅ FIX: Robust boolean toggle — handles undefined/null/string 'false' safely.
    // Old code: !user.active → when active=undefined, !undefined=true (always activates!)
    // New code: explicitly check current state then set clean boolean false/true.
    const currentlyActive = user.active !== false && user.active !== 'false';
    user.active = !currentlyActive;   // true → false (deactivate), false → true (activate)

    await user.save();

    // Also disable/enable in Firebase Auth so they can't log in when deactivated
    if (user.firebaseUid) {
      try {
        await admin.auth().updateUser(user.firebaseUid, { disabled: !user.active });
      } catch (fbErr) {
        console.error('[toggleStatus] Firebase sync error (non-fatal):', fbErr.message);
      }
    }

    res.json({
      message: `${user.firstName} has been ${user.active ? 'activated' : 'deactivated'}`,
      active:  user.active,
    });
  } catch (error) {
    console.error('[toggleRecruiterStatus]', error.message);
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get users by role — used by messaging pages to build recipient lists
// @route   GET /api/recruiters/by-role?role=manager   → Navya, Sanjay
// @route   GET /api/recruiters/by-role?role=recruiter → Varun, Lahitya, Akhila, Hema
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.query;
    const filter = role
      ? { role, active: true }
      : { role: { $in: ['manager', 'recruiter'] }, active: true };

    const users = await User.find(filter)
      .select('_id firstName lastName username email role')
      .sort({ firstName: 1 });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};