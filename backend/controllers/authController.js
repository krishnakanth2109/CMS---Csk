import User from '../models/User.js';
import { admin } from '../middleware/authMiddleware.js';

// Helper: derive a display "name" from User document.
const fullName = (user) =>
  [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || user.email;

// @desc    Login user
// @route   POST /api/auth/login
export const loginUser = async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ message: 'Firebase ID token is required.' });

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email } = decodedToken;

    let user = await User.findOne({ $or: [{ firebaseUid: uid }, { email }] });
    if (!user) return res.status(401).json({ message: 'User not registered. Contact admin.' });
    if (user.active === false) return res.status(401).json({ message: 'Account deactivated.' });

    if (!user.firebaseUid) {
      user.firebaseUid = uid;
      await user.save();
    }

    res.json({
      _id: user._id,
      name: fullName(user),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      username: user.username,
      role: user.role,
      profilePicture: user.profilePicture || "", // Return image
      firebaseUid: user.firebaseUid,
      recruiterId: user.recruiterId,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login.' });
  }
};

// @desc    Register user
// @route   POST /api/auth/register
export const registerUser = async (req, res) => {
  const { email, password, firstName, lastName, name, username, role, profilePicture } = req.body;
  let fName = firstName;
  let lName = lastName;
  if (!fName && name) {
    const parts = name.trim().split(/\s+/);
    fName = parts[0];
    lName = parts.slice(1).join(' ') || parts[0];
  }

  try {
    const firebaseUser = await admin.auth().createUser({
      email, password, displayName: [fName, lName].filter(Boolean).join(' ')
    });

    const user = await User.create({
      firebaseUid: firebaseUser.uid,
      email, firstName: fName, lastName: lName || '',
      username: username || email.split('@')[0],
      role: role || 'recruiter',
      profilePicture: profilePicture || "", // Save image
      active: true,
    });

    res.status(201).json({ _id: user._id, name: fullName(user), email: user.email, profilePicture: user.profilePicture });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
export const getUserProfile = async (req, res) => {
  try {
    if (req.user) {
      res.json({
        _id: req.user._id,
        username: req.user.username,
        name: fullName(req.user),
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
        profilePicture: req.user.profilePicture || "", // Return image
        firebaseUid: req.user.firebaseUid,
      });
    } else {
      res.status(404).json({ message: 'User not found.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching profile.' });
  }
};

// @desc    Update user profile (Handles Image Edit & Remove)
// @route   PUT /api/auth/profile
// REPLACE your updateUserProfile function with this:
export const updateUserProfile = async (req, res) => {
  try {
    // 1. Find user by ID (from protect middleware)
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // 2. Handle Name Splitting (Full Name -> First & Last)
    if (req.body.name) {
      const nameParts = req.body.name.trim().split(/\s+/);
      user.firstName = nameParts[0];
      user.lastName = nameParts.slice(1).join(' ') || ""; // Handles single names or multiple middle names
    }

    // 3. Handle Email (Optional: Syncing email to Firebase is complex, 
    // usually we keep the original login email and just update profile email)
    if (req.body.email) {
      user.email = req.body.email;
    }

    // 4. Handle Profile Picture
    if (req.body.profilePicture !== undefined) {
      user.profilePicture = req.body.profilePicture;
    }

    // 5. Save to MongoDB
    const updatedUser = await user.save();

    // 6. Return the EXACT object the frontend needs
    res.json({
      _id: updatedUser._id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      name: [updatedUser.firstName, updatedUser.lastName].filter(Boolean).join(' '),
      email: updatedUser.email,
      username: updatedUser.username,
      profilePicture: updatedUser.profilePicture || "",
      role: updatedUser.role,
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ message: error.message || 'Server Error updating profile.' });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.json({ message: 'Reset link sent if registered.' });
    const resetLink = await admin.auth().generatePasswordResetLink(email);
    console.log(`Reset link: ${resetLink}`);
    res.json({ message: 'Reset link sent if registered.' });
  } catch (error) { res.status(500).json({ message: 'Error' }); }
};