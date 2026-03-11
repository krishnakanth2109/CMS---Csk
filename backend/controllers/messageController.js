import Message from '../models/Message.js';
import User from '../models/User.js';

// Helper: resolve a display name (firstName + lastName) from id or keyword
const resolveName = async (value) => {
  if (!value) return 'Unknown';
  if (value === 'admin') return 'Admin';
  if (value === 'all')   return 'Everyone';

  // Valid MongoDB ObjectId (24 hex chars)
  if (/^[a-f\d]{24}$/i.test(value)) {
    const user = await User.findById(value).select('firstName lastName username role');
    if (user) {
      const full = [user.firstName, user.lastName].filter(Boolean).join(' ');
      return full || user.username || 'User';
    }
  }
  return value; // fallback
};

// @desc    Get messages for a user (Admin, Manager, or Recruiter)
// @route   GET /api/messages
export const getMessages = async (req, res) => {
  try {
    const { role, username, id } = req.user;
    let query;

    if (role === 'admin') {
      // Admin sees all messages to/from admin + broadcasts
      query = {
        $or: [
          { to: 'admin' },
          { from: 'admin' },
          { to: 'all' }
        ]
      };
    } else {
      // Manager OR Recruiter: match by their MongoDB id, username, or broadcasts
      query = {
        $or: [
          { to: id },
          { to: username },
          { to: 'all' },
          { from: id },
          { from: username }
        ]
      };
    }

    const messages = await Message.find(query).sort({ createdAt: -1 });

    const enhancedMessages = await Promise.all(
      messages.map(async (msg) => {
        const fromName = await resolveName(msg.from);
        const toName   = await resolveName(msg.to);
        return { ...msg.toObject(), fromName, toName };
      })
    );

    res.json(enhancedMessages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Send a message
// @route   POST /api/messages
export const sendMessage = async (req, res) => {
  try {
    const { to, subject, content } = req.body;
    const { role, id } = req.user;

    // Admin sends as 'admin', everyone else sends as their MongoDB id
    const from = role === 'admin' ? 'admin' : id;

    const message = await Message.create({ from, to, subject, content });

    const fromName = await resolveName(from);
    const toName   = await resolveName(to);

    res.status(201).json({ ...message.toObject(), fromName, toName });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a message
// @route   PUT /api/messages/:id
export const updateMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (req.user.role !== 'admin' && message.from !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    message.subject = req.body.subject || message.subject;
    message.content = req.body.content || message.content;

    const updatedMessage = await message.save();
    res.json(updatedMessage);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a message
// @route   DELETE /api/messages/:id
export const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (req.user.role !== 'admin' && message.from !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await message.deleteOne();
    res.json({ message: 'Message removed', id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
