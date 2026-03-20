import Channel from '../models/Channel.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

// ── GET /api/channels  — list channels the user belongs to (or all public if admin)
export const getChannels = async (req, res) => {
  try {
    const { role, _id: userId } = req.user;
    let query;
    if (role === 'admin') {
      query = {};  // admin sees all
    } else if (role === 'manager') {
      query = { $or: [{ members: userId }, { createdBy: userId }, { type: 'public' }] };
    } else {
      // recruiters: only channels they're members of
      query = { $or: [{ members: userId }, { type: 'public' }] };
    }
    const channels = await Channel.find(query)
      .sort({ pinned: -1, lastMessageAt: -1, createdAt: -1 })
      .populate('createdBy', 'firstName lastName username')
      .populate('members', 'firstName lastName username role')
      .lean();
    res.json(channels);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── POST /api/channels  — create a channel (admin/manager only)
export const createChannel = async (req, res) => {
  try {
    const { role, _id: userId } = req.user;
    if (role !== 'admin' && role !== 'manager') {
      return res.status(403).json({ message: 'Only admins and managers can create channels' });
    }
    const { name, description, type, color, icon, memberIds, canPost } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Channel name is required' });

    // Validate members exist
    let members = [];
    if (memberIds?.length) {
      const users = await User.find({ _id: { $in: memberIds } }).select('_id').lean();
      members = users.map(u => u._id);
    }
    // Always include creator
    if (!members.some(m => m.toString() === userId.toString())) {
      members.push(userId);
    }

    const channel = await Channel.create({
      name: name.trim(),
      description: description || '',
      type: type || 'public',
      color: color || 'blue',
      icon: icon || '',
      canPost: canPost || 'all',
      createdBy: userId,
      members,
    });

    // Post a system message
    await Message.create({
      channelId: channel._id,
      senderId: userId,
      senderName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
      content: `Channel "${channel.name}" was created.`,
      type: 'system',
    });

    const populated = await Channel.findById(channel._id)
      .populate('createdBy', 'firstName lastName username')
      .populate('members', 'firstName lastName username role')
      .lean();

    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ── PUT /api/channels/:id  — update channel (admin/manager/creator only)
export const updateChannel = async (req, res) => {
  try {
    const { role, _id: userId } = req.user;
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });

    const isCreator = channel.createdBy.toString() === userId.toString();
    if (role !== 'admin' && role !== 'manager' && !isCreator) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { name, description, type, color, memberIds, canPost } = req.body;
    if (name !== undefined) channel.name = name.trim();
    if (description !== undefined) channel.description = description;
    if (type !== undefined) channel.type = type;
    if (color !== undefined) channel.color = color;
    if (canPost !== undefined) channel.canPost = canPost;
    if (memberIds !== undefined) {
      const users = await User.find({ _id: { $in: memberIds } }).select('_id').lean();
      channel.members = users.map(u => u._id);
      // Always keep creator
      if (!channel.members.some(m => m.toString() === channel.createdBy.toString())) {
        channel.members.push(channel.createdBy);
      }
    }

    await channel.save();
    const populated = await Channel.findById(channel._id)
      .populate('createdBy', 'firstName lastName username')
      .populate('members', 'firstName lastName username role')
      .lean();
    res.json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ── DELETE /api/channels/:id  — delete channel (admin/creator only)
export const deleteChannel = async (req, res) => {
  try {
    const { role, _id: userId } = req.user;
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });

    const isCreator = channel.createdBy.toString() === userId.toString();
    if (role !== 'admin' && !isCreator) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Delete all messages in this channel
    await Message.deleteMany({ channelId: channel._id });
    await channel.deleteOne();
    res.json({ message: 'Channel deleted', id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── GET /api/channels/:id/messages  — get messages in a channel
export const getChannelMessages = async (req, res) => {
  try {
    const { role, _id: userId } = req.user;
    const channel = await Channel.findById(req.params.id).lean();
    if (!channel) return res.status(404).json({ message: 'Channel not found' });

    // Access check
    const isMember = channel.members.some(m => m.toString() === userId.toString());
    if (role !== 'admin' && !isMember && channel.type !== 'public') {
      return res.status(403).json({ message: 'Not a member of this channel' });
    }

    const limit = parseInt(req.query.limit) || 100;
    const before = req.query.before ? new Date(req.query.before) : new Date();

    const msgs = await Message.find({
      channelId: channel._id,
      deletedAt: null,
      createdAt: { $lte: before },
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    res.json(msgs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── POST /api/channels/:id/messages  — send message to channel
export const sendChannelMessage = async (req, res) => {
  try {
    const { role, _id: userId, firstName, lastName, username } = req.user;
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });

    // Permission: announcement channels only allow admin/manager
    if (channel.canPost === 'admin_manager' && role !== 'admin' && role !== 'manager') {
      return res.status(403).json({ message: 'Only admins and managers can post in this channel' });
    }

    const isMember = channel.members.some(m => m.toString() === userId.toString());
    if (!isMember && role !== 'admin' && channel.type !== 'public') {
      return res.status(403).json({ message: 'Not a member of this channel' });
    }

    const { content, replyTo, replyPreview } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'Content is required' });

    const senderName = [firstName, lastName].filter(Boolean).join(' ') || username || 'User';

    const message = await Message.create({
      channelId: channel._id,
      senderId: userId,
      senderName,
      content: content.trim(),
      type: 'text',
      replyTo: replyTo || null,
      replyPreview: replyPreview || '',
      readBy: [userId],
    });

    // Update channel last message
    channel.lastMessageAt = new Date();
    channel.lastMessage = content.trim().slice(0, 80);
    await channel.save();

    res.status(201).json(message);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ── PUT /api/channels/:id/members  — add/remove members (admin/manager/creator)
export const updateChannelMembers = async (req, res) => {
  try {
    const { role, _id: userId } = req.user;
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });

    const isCreator = channel.createdBy.toString() === userId.toString();
    if (role !== 'admin' && role !== 'manager' && !isCreator) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { add = [], remove = [] } = req.body;
    const memberStrs = channel.members.map(m => m.toString());

    add.forEach(id => { if (!memberStrs.includes(id)) { channel.members.push(id); memberStrs.push(id); } });
    channel.members = channel.members.filter(m => !remove.includes(m.toString()));
    // Always keep creator
    if (!channel.members.some(m => m.toString() === channel.createdBy.toString())) {
      channel.members.push(channel.createdBy);
    }

    await channel.save();
    const populated = await Channel.findById(channel._id)
      .populate('members', 'firstName lastName username role').lean();
    res.json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ── DELETE /api/channels/:channelId/messages/:msgId
export const deleteChannelMessage = async (req, res) => {
  try {
    const { role, _id: userId } = req.user;
    const msg = await Message.findById(req.params.msgId);
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    const isOwner = msg.senderId?.toString() === userId.toString();
    if (role !== 'admin' && !isOwner) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    msg.deletedAt = new Date();
    msg.content = 'This message was deleted';
    await msg.save();
    res.json({ id: msg._id, deletedAt: msg.deletedAt });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
