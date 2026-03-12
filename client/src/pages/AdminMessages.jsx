import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, MessageSquare, Search, Trash2, Plus, X, Check, CheckCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import io from 'socket.io-client';
import { format, isToday, isYesterday } from 'date-fns';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_URL  = `${BASE_URL}/api`;

const getAuthHeader = () => {
  try {
    const stored = sessionStorage.getItem('currentUser');
    const token  = stored ? JSON.parse(stored)?.idToken : null;
    return { Authorization: `Bearer ${token || ''}`, 'Content-Type': 'application/json' };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
};

const buildName = (user) => {
  if (!user) return null;
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return full || user.username || user.email || null;
};

const formatMsgTime = (date) => {
  try {
    const d = new Date(date);
    if (isToday(d)) return format(d, 'h:mm a');
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMM d');
  } catch { return ''; }
};

const Avatar = ({ name, size = 'md', color = 'blue' }) => {
  const letter = (name || 'U')[0].toUpperCase();
  const colors = {
    blue: 'bg-blue-500', green: 'bg-emerald-500', purple: 'bg-purple-500',
    orange: 'bg-orange-500', pink: 'bg-pink-500', teal: 'bg-teal-500',
  };
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
  const colorClass = colors[color] || colors.blue;
  return (
    <div className={`${sizes[size]} ${colorClass} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {letter}
    </div>
  );
};

// Assign a stable color per name
const nameColor = (name) => {
  const palette = ['blue', 'green', 'purple', 'orange', 'pink', 'teal'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
};

export default function AdminMessages() {
  const { toast } = useToast();

  const [messages,        setMessages]        = useState([]);
  const [recruiters,      setRecruiters]      = useState([]);
  const [managers,        setManagers]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [selectedContact, setSelectedContact] = useState(null); // id or 'all'
  const [showCompose,     setShowCompose]     = useState(false);

  // Compose
  const [subject,   setSubject]   = useState('');
  const [content,   setContent]   = useState('');
  const [recipient, setRecipient] = useState('');
  const [sending,   setSending]   = useState(false);

  // Reply input
  const [replyText,    setReplyText]    = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [replySending, setReplySending] = useState(false);

  const socketRef  = useRef(null);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => {
    socketRef.current = io(BASE_URL);
    socketRef.current.emit('join_room', 'admin');
    socketRef.current.on('receive_message', (newMessage) => {
      setMessages(prev => [newMessage, ...prev]);
      toast({ title: 'New Message', description: `From: ${newMessage.fromName || newMessage.from}` });
    });

    const fetchAll = async () => {
      setLoading(true);
      try {
        const [msgRes, recRes, mgrRes] = await Promise.all([
          fetch(`${API_URL}/messages`,                              { headers: getAuthHeader() }),
          fetch(`${API_URL}/recruiters/by-role?role=recruiter`,    { headers: getAuthHeader() }),
          fetch(`${API_URL}/recruiters/by-role?role=manager`,      { headers: getAuthHeader() }),
        ]);
        if (msgRes.ok) setMessages(await msgRes.json());
        if (recRes.ok) { const d = await recRes.json(); setRecruiters(Array.isArray(d) ? d : []); }
        if (mgrRes.ok) { const d = await mgrRes.json(); setManagers(Array.isArray(d) ? d : []); }
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to load messages', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, [toast]);

  // Scroll to bottom when chat changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedContact, messages]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const resolveName = (idOrKey, fallback) => {
    if (!idOrKey) return fallback || 'Unknown';
    if (idOrKey === 'admin') return 'Admin';
    if (idOrKey === 'all')   return 'Everyone';
    const rec = recruiters.find(r => r._id === idOrKey || r.id === idOrKey);
    if (rec) return buildName(rec) || 'Recruiter';
    const mgr = managers.find(m => m._id === idOrKey || m.id === idOrKey);
    if (mgr) return buildName(mgr) || 'Manager';
    return fallback || idOrKey;
  };

  const isInboxMsg = (m) => m.to === 'admin' && m.from !== 'admin';

  // Build contact list: unique people who messaged admin or admin messaged
  const contacts = useMemo(() => {
    const map = new Map();
    messages.forEach(m => {
      const otherId   = m.from === 'admin' ? m.to : m.from;
      const otherName = m.from === 'admin'
        ? resolveName(m.to, m.toName)
        : resolveName(m.from, m.fromName);
      if (!otherId || otherId === 'admin') return;
      if (!map.has(otherId)) {
        map.set(otherId, { id: otherId, name: otherName, lastMsg: m, unread: 0 });
      } else {
        const cur = map.get(otherId);
        const curDate = new Date(cur.lastMsg.createdAt);
        const newDate = new Date(m.createdAt);
        if (newDate > curDate) map.get(otherId).lastMsg = m;
      }
      if (isInboxMsg(m) && m.from === otherId) {
        map.get(otherId).unread = (map.get(otherId).unread || 0) + 1;
      }
    });
    return Array.from(map.values())
      .sort((a, b) => new Date(b.lastMsg.createdAt) - new Date(a.lastMsg.createdAt));
  }, [messages, recruiters, managers]);

  // Messages in the selected conversation thread
  const chatMessages = useMemo(() => {
    if (!selectedContact) return [];
    return messages
      .filter(m =>
        (m.from === selectedContact && m.to === 'admin') ||
        (m.from === 'admin' && m.to === selectedContact)
      )
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [messages, selectedContact]);

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedContactInfo = contacts.find(c => c.id === selectedContact);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!content.trim() || !subject.trim() || !recipient) {
      toast({ title: 'Validation Error', description: 'All fields are required', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ to: recipient, subject, content }),
      });
      if (!res.ok) throw new Error('Failed to send');
      const saved = await res.json();
      if (socketRef.current) socketRef.current.emit('send_message', saved);
      setMessages(prev => [saved, ...prev]);
      setSubject(''); setContent(''); setRecipient(''); setShowCompose(false);
      // Switch to that conversation
      setSelectedContact(recipient);
      toast({ title: 'Sent!', description: 'Message sent successfully' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleQuickReply = async () => {
    if (!replyText.trim() || !selectedContact) return;
    setReplySending(true);
    try {
      const subject = replySubject || `Re: conversation`;
      const res = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ to: selectedContact, subject, content: replyText }),
      });
      if (!res.ok) throw new Error('Failed');
      const saved = await res.json();
      if (socketRef.current) socketRef.current.emit('send_message', saved);
      setMessages(prev => [saved, ...prev]);
      setReplyText('');
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setReplySending(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this message?')) return;
    try {
      const res = await fetch(`${API_URL}/messages/${id}`, { method: 'DELETE', headers: getAuthHeader() });
      if (!res.ok) throw new Error('Failed');
      setMessages(prev => prev.filter(m => m._id !== id));
      toast({ title: 'Deleted' });
    } catch {
      toast({ title: 'Error', description: 'Could not delete', variant: 'destructive' });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuickReply();
    }
  };

  const totalUnread = contacts.reduce((s, c) => s + (c.unread || 0), 0);

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#111b21] overflow-hidden" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ── Left Sidebar ── */}
      <div className="w-[360px] flex-shrink-0 flex flex-col border-r border-[#2a3942]" style={{ background: '#111b21' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ background: '#202c33' }}>
          <div className="flex items-center gap-3">
            <Avatar name="Admin" size="md" color="blue" />
            <span className="text-white font-semibold text-base">Admin</span>
            {totalUnread > 0 && (
              <span className="bg-[#00a884] text-black text-xs font-bold px-2 py-0.5 rounded-full">{totalUnread}</span>
            )}
          </div>
          <button
            onClick={() => { setShowCompose(true); setSubject(''); setContent(''); setRecipient(''); }}
            className="p-2 rounded-full hover:bg-[#2a3942] text-[#aebac1] transition-colors"
            title="New Message"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2" style={{ background: '#111b21' }}>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: '#202c33' }}>
            <Search className="w-4 h-4 text-[#aebac1] flex-shrink-0" />
            <input
              placeholder="Search or start new chat"
              className="flex-1 bg-transparent text-sm text-white placeholder-[#8696a0] outline-none"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <p className="text-center text-sm text-[#8696a0] mt-10">No conversations yet</p>
          ) : (
            filteredContacts.map(contact => (
              <div
                key={contact.id}
                onClick={() => { setSelectedContact(contact.id); setShowCompose(false); }}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-[#2a3942]
                  ${selectedContact === contact.id ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'}`}
              >
                <Avatar name={contact.name} size="md" color={nameColor(contact.name)} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="text-white font-medium text-sm truncate">{contact.name}</span>
                    <span className="text-xs text-[#8696a0] ml-2 flex-shrink-0">
                      {formatMsgTime(contact.lastMsg?.createdAt)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-[#8696a0] truncate flex-1">
                      {contact.lastMsg?.from === 'admin' && (
                        <CheckCheck className="w-3 h-3 inline mr-1 text-[#53bdeb]" />
                      )}
                      {contact.lastMsg?.content}
                    </p>
                    {contact.unread > 0 && (
                      <span className="ml-2 bg-[#00a884] text-black text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                        {contact.unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col" style={{
        background: '#0b141a',
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23182229' fill-opacity='0.5'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}>

        {showCompose ? (
          /* ── Compose New Message ── */
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-4 px-6 py-4" style={{ background: '#202c33' }}>
              <button onClick={() => setShowCompose(false)} className="text-[#aebac1] hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
              <span className="text-white font-semibold text-base">New Message</span>
            </div>

            <div className="flex-1 flex items-center justify-center p-8">
              <div className="w-full max-w-lg space-y-4">
                {/* Recipient */}
                <div>
                  <label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider block mb-1.5">To</label>
                  <Select value={recipient} onValueChange={setRecipient}>
                    <SelectTrigger className="w-full bg-[#202c33] border-[#2a3942] text-white h-11">
                      <SelectValue placeholder="Select recipient..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#233138] border-[#2a3942]">
                      <SelectItem value="all" className="text-white focus:bg-[#2a3942]">
                        Broadcast to All
                      </SelectItem>
                      {managers.length > 0 && <>
                        <div className="px-2 py-1 text-[10px] text-[#8696a0] font-bold uppercase">Managers</div>
                        {managers.map(m => (
                          <SelectItem key={m._id || m.id} value={m._id || m.id} className="text-white focus:bg-[#2a3942]">
                            {buildName(m) || 'Manager'}
                          </SelectItem>
                        ))}
                      </>}
                      {recruiters.length > 0 && <>
                        <div className="px-2 py-1 text-[10px] text-[#8696a0] font-bold uppercase">Recruiters</div>
                        {recruiters.map(r => (
                          <SelectItem key={r._id || r.id} value={r._id || r.id} className="text-white focus:bg-[#2a3942]">
                            {buildName(r) || 'Recruiter'}
                          </SelectItem>
                        ))}
                      </>}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subject */}
                <div>
                  <label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider block mb-1.5">Subject</label>
                  <input
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Message subject..."
                    className="w-full h-11 px-4 rounded-lg text-sm text-white placeholder-[#8696a0] outline-none focus:ring-2 focus:ring-[#00a884]"
                    style={{ background: '#202c33', border: '1px solid #2a3942' }}
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider block mb-1.5">Message</label>
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Type a message..."
                    rows={6}
                    className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-[#8696a0] outline-none resize-none focus:ring-2 focus:ring-[#00a884]"
                    style={{ background: '#202c33', border: '1px solid #2a3942' }}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowCompose(false)}
                    className="px-5 py-2 text-sm text-[#aebac1] hover:text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending || !content.trim() || !subject.trim() || !recipient}
                    className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-50 transition-all"
                    style={{ background: '#00a884' }}
                  >
                    <Send className="w-4 h-4" />
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>

        ) : selectedContact && selectedContactInfo ? (
          /* ── Chat Thread ── */
          <div className="flex flex-col h-full">
            {/* Chat Header */}
            <div className="flex items-center gap-4 px-6 py-3 flex-shrink-0" style={{ background: '#202c33' }}>
              <Avatar name={selectedContactInfo.name} size="md" color={nameColor(selectedContactInfo.name)} />
              <div>
                <p className="text-white font-semibold text-sm">{selectedContactInfo.name}</p>
                <p className="text-xs text-[#8696a0]">
                  {chatMessages.length} message{chatMessages.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => { setShowCompose(true); setRecipient(selectedContact); setSubject(''); setContent(''); }}
                  className="p-2 rounded-full hover:bg-[#2a3942] text-[#aebac1] transition-colors"
                  title="New message to this contact"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {chatMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-[#8696a0] text-sm">No messages yet</p>
                </div>
              ) : (
                chatMessages.map((msg, i) => {
                  const isMe = msg.from === 'admin';
                  const showDate = i === 0 || (
                    format(new Date(msg.createdAt), 'yyyy-MM-dd') !==
                    format(new Date(chatMessages[i-1].createdAt), 'yyyy-MM-dd')
                  );
                  return (
                    <React.Fragment key={msg._id}>
                      {showDate && (
                        <div className="flex justify-center my-3">
                          <span className="px-3 py-1 rounded-full text-xs text-[#8696a0]" style={{ background: '#182229' }}>
                            {isToday(new Date(msg.createdAt)) ? 'Today'
                              : isYesterday(new Date(msg.createdAt)) ? 'Yesterday'
                              : format(new Date(msg.createdAt), 'MMMM d, yyyy')}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                        <div
                          className="relative max-w-[65%] px-3 py-2 rounded-lg shadow-sm"
                          style={{
                            background: isMe ? '#005c4b' : '#202c33',
                            borderRadius: isMe ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
                          }}
                        >
                          {/* Subject badge */}
                          {msg.subject && (
                            <p className="text-[10px] font-semibold mb-1" style={{ color: '#53bdeb' }}>
                              {msg.subject}
                            </p>
                          )}
                          <p className="text-sm text-white leading-relaxed whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[10px] text-[#8696a0]">
                              {format(new Date(msg.createdAt), 'h:mm a')}
                            </span>
                            {isMe && <CheckCheck className="w-3 h-3 text-[#53bdeb]" />}
                          </div>
                          {/* Delete on hover */}
                          <button
                            onClick={e => handleDelete(e, msg._id)}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full items-center justify-center hidden group-hover:flex"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Reply Input */}
            <div className="flex-shrink-0 px-4 py-3 flex items-end gap-3" style={{ background: '#202c33' }}>
              <div className="flex-1 rounded-lg px-4 py-2 flex flex-col gap-1" style={{ background: '#2a3942' }}>
                <input
                  value={replySubject}
                  onChange={e => setReplySubject(e.target.value)}
                  placeholder="Subject (optional)..."
                  className="bg-transparent text-xs text-[#8696a0] placeholder-[#8696a0] outline-none border-b border-[#3b4a54] pb-1"
                />
                <textarea
                  ref={inputRef}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message"
                  rows={1}
                  className="bg-transparent text-sm text-white placeholder-[#8696a0] outline-none resize-none"
                  style={{ maxHeight: 120 }}
                />
              </div>
              <button
                onClick={handleQuickReply}
                disabled={replySending || !replyText.trim()}
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-50"
                style={{ background: replyText.trim() ? '#00a884' : '#2a3942' }}
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

        ) : (
          /* ── Empty State ── */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 select-none">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#202c33' }}>
              <MessageSquare className="w-10 h-10 text-[#00a884]" />
            </div>
            <div className="text-center">
              <p className="text-white text-xl font-light mb-1">Admin Messages</p>
              <p className="text-[#8696a0] text-sm">Select a conversation or start a new one</p>
            </div>
            <button
              onClick={() => { setShowCompose(true); setSubject(''); setContent(''); setRecipient(''); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-black transition-all"
              style={{ background: '#00a884' }}
            >
              <Plus className="w-4 h-4" /> New Message
            </button>
          </div>
        )}
      </div>
    </div>
  );
}