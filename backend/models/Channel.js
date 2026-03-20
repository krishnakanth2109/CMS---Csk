import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  type:        { type: String, enum: ['public', 'private', 'announcement'], default: 'public' },
  // '#' prefix for channels, '@' prefix stored separately for DMs
  icon:        { type: String, default: '' },
  color:       { type: String, default: 'blue' },

  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Only admins/managers can post in announcement channels
  canPost:     { type: String, enum: ['all', 'admin_manager'], default: 'all' },

  lastMessageAt: { type: Date, default: null },
  lastMessage:   { type: String, default: '' },

  pinned: { type: Boolean, default: false },
}, { timestamps: true });

channelSchema.index({ members: 1 });
channelSchema.index({ createdBy: 1 });
channelSchema.index({ lastMessageAt: -1 });

const Channel = mongoose.models.Channel || mongoose.model('Channel', channelSchema);
export default Channel;
