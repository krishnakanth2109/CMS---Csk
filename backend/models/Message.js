import mongoose from 'mongoose';

const messageSchema = mongoose.Schema({
  from: { type: String, required: true }, // 'admin' or recruiter username/id
  to: { type: String, required: true },   // 'admin', 'all', or recruiter username/id
  subject: { type: String, required: true },
  content: { type: String, required: true },
  read: { type: Boolean, default: false },
  // Optional: Add sender/receiver names to avoid extra lookups if you prefer
  fromName: { type: String },
  toName: { type: String }
}, {
  timestamps: true // automatically adds createdAt
});

// ── Indexes for fast queries ──────────────────────────────────────────────────
messageSchema.index({ to: 1, createdAt: -1 });   // inbox queries (most common)
messageSchema.index({ from: 1, createdAt: -1 }); // sent queries
messageSchema.index({ createdAt: -1 });           // default sort

const Message = mongoose.model('Message', messageSchema);
export default Message;