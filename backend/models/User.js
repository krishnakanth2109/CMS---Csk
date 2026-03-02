import mongoose from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// User Model
// Firebase owns authentication (passwords/tokens).
// MongoDB stores profile data + firebaseUid for lookup.
// ─────────────────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema(
  {
    // 🔹 Firebase UID (Link between Firebase and MongoDB)
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true, // Allows null/missing values while maintaining uniqueness
    },

    // 🔹 Custom ID for Recruiters (Optional)
    recruiterId: {
      type: String,
      unique: true,
      sparse: true,
    },

    // 🔹 Basic Information
    firstName: { 
      type: String,
      trim: true 
    },
    lastName: { 
      type: String, 
      trim: true 
    },
    username: { 
      type: String,
      unique: true,
      sparse: true,
      trim: true 
    },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // 🔹 Profile Image (Stores Base64 string or URL)
    profilePicture: { 
      type: String,
      default: "" 
    },

    phone: { 
      type: String 
    },

    // 🔹 Role Management
    role: {
      type: String,
      enum: ['admin', 'recruiter', 'manager'],
      default: 'recruiter',
    },

    // 🔹 Account Status
    active: {
      type: Boolean,
      default: true,
    },

    // 🔹 Extended Profile Details
    location: { type: String },
    specialization: { type: String },
    experience: { type: String },
    bio: { type: String },

    // 🔹 Social Links
    socials: {
      linkedin: String,
      github: String,
      twitter: String,
      website: String,
    },

    // 🔹 Legacy/Internal Password (Optional, Firebase is primary)
    password: { 
      type: String 
    },
  },
  {
    // Automatically creates 'createdAt' and 'updatedAt' fields
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);

export default User;