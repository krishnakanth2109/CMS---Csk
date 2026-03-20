import mongoose from 'mongoose';

const messageSchema = mongoose.Schema({
  // DM fields (kept for backward compat)
  from: { type: String },
  to:   { type: String },

  // Channel / group message fields
  channelId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', default: null },
  senderId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  senderName:  { type: String, default: '' },

  subject:  { type: String, default: '' },
  content:  { type: String, required: true },
  type:     { type: String, enum: ['text', 'system', 'announcement'], default: 'text' },

  // Reply threading
  replyTo:      { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  replyPreview: { type: String, default: '' },

  // Read tracking — array of userIds who have read this
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Legacy DM support
  read:     { type: Boolean, default: false },
  fromName: { type: String },
  toName:   { type: String },

  edited:    { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
}, {
  timestamps: true,
});

messageSchema.index({ channelId: 1, createdAt: -1 });
messageSchema.index({ to: 1, createdAt: -1 });
messageSchema.index({ from: 1, createdAt: -1 });
messageSchema.index({ createdAt: -1 });

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
export default Message;
