import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, MessageSquare, Search, Trash2, Plus, X, CheckCheck } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import io from 'socket.io-client';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
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

const getCurrentUser = () => {
  try {
    const stored = sessionStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
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
  return (
    <div className={`${sizes[size]} ${colors[color] || colors.blue} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {letter}
    </div>
  );
};

const nameColor = (name) => {
  const palette = ['blue', 'green', 'purple', 'orange', 'pink', 'teal'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
};

export default function MessagesRecruiters() {
  const currentUser = getCurrentUser();
  const myId        = currentUser?.id || currentUser?._id || '';
  const myName      = buildName(currentUser) || 'Recruiter';

  const [messages,        setMessages]        = useState([]);
  const [managers,        setManagers]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [showCompose,     setShowCompose]     = useState(false);

  // Compose
  const [composeRecipient, setComposeRecipient] = useState('admin');
  const [composeSubject,   setComposeSubject]   = useState('');
  const [composeContent,   setComposeContent]   = useState('');
  const [sending,          setSending]          = useState(false);

  // Reply
  const [replyText,    setReplyText]    = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [replySending, setReplySending] = useState(false);

  const [toastMsg, setToastMsg] = useState(null);
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToastMsg({ message, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    socketRef.current = io(BASE_URL);
    socketRef.current.emit('join_room', myId);
    socketRef.current.on('receive_message', (msg) => {
      setMessages(prev => [msg, ...prev]);
      showToast(`New message: ${msg.subject}`);
    });

    const fetchAll = async () => {
      setLoading(true);
      try {
        const [msgRes, mgrRes] = await Promise.all([
          fetch(`${API_URL}/messages`,                          { headers: getAuthHeader() }),
          fetch(`${API_URL}/recruiters/by-role?role=manager`,  { headers: getAuthHeader() }),
        ]);
        if (msgRes.ok) setMessages(await msgRes.json());
        if (mgrRes.ok) { const d = await mgrRes.json(); setManagers(Array.isArray(d) ? d : []); }
      } catch {
        showToast('Failed to load messages', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, [myId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedContact, messages]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const resolveName = (idOrKey, fallback) => {
    if (!idOrKey) return fallback || 'Unknown';
    if (idOrKey === 'admin') return 'Admin';
    if (idOrKey === 'all')   return 'Everyone';
    if (idOrKey === myId)    return myName;
    const mgr = managers.find(m => m._id === idOrKey || m.id === idOrKey);
    if (mgr) return buildName(mgr) || 'Manager';
    return fallback || idOrKey;
  };

  const isMyInbox = (m) => (m.to === myId || m.to === 'all') && m.from !== myId;
  const isMySent  = (m) => m.from === myId;

  const contacts = useMemo(() => {
    const map = new Map();
    messages.forEach(m => {
      const iMine = isMySent(m) || isMyInbox(m);
      if (!iMine) return;
      const otherId   = m.from === myId ? m.to : m.from;
      const otherName = m.from === myId
        ? resolveName(m.to, m.toName)
        : resolveName(m.from, m.fromName);
      if (!otherId) return;
      if (!map.has(otherId)) {
        map.set(otherId, { id: otherId, name: otherName, lastMsg: m, unread: 0 });
      } else {
        const cur = map.get(otherId);
        if (new Date(m.createdAt) > new Date(cur.lastMsg.createdAt)) cur.lastMsg = m;
      }
      if (isMyInbox(m) && m.from === otherId) {
        map.get(otherId).unread = (map.get(otherId).unread || 0) + 1;
      }
    });
    return Array.from(map.values())
      .sort((a, b) => new Date(b.lastMsg.createdAt) - new Date(a.lastMsg.createdAt));
  }, [messages, myId, managers]);

  const chatMessages = useMemo(() => {
    if (!selectedContact) return [];
    return messages
      .filter(m =>
        (m.from === myId && m.to === selectedContact) ||
        (m.from === selectedContact && (m.to === myId || m.to === 'all'))
      )
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [messages, selectedContact, myId]);

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedContactInfo = contacts.find(c => c.id === selectedContact);
  const totalUnread = contacts.reduce((s, c) => s + (c.unread || 0), 0);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!composeSubject.trim() || !composeContent.trim()) {
      showToast('Subject and message are required', 'error'); return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/messages`, {
        method: 'POST', headers: getAuthHeader(),
        body: JSON.stringify({ to: composeRecipient, subject: composeSubject, content: composeContent }),
      });
      if (!res.ok) throw new Error('Failed to send');
      const saved = await res.json();
      if (socketRef.current) socketRef.current.emit('send_message', saved);
      setMessages(prev => [saved, ...prev]);
      setComposeSubject(''); setComposeContent(''); setShowCompose(false);
      setSelectedContact(composeRecipient);
      showToast('Message sent successfully');
    } catch (err) {
      showToast(err.message, 'error');
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
        method: 'POST', headers: getAuthHeader(),
        body: JSON.stringify({ to: selectedContact, subject, content: replyText }),
      });
      if (!res.ok) throw new Error('Failed');
      const saved = await res.json();
      if (socketRef.current) socketRef.current.emit('send_message', saved);
      setMessages(prev => [saved, ...prev]);
      setReplyText('');
    } catch (err) {
      showToast(err.message, 'error');
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
      showToast('Message deleted');
    } catch { showToast('Could not delete', 'error'); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickReply(); }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#111b21] overflow-hidden" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white
          ${toastMsg.type === 'error' ? 'bg-red-500' : 'bg-[#00a884]'}`}>
          {toastMsg.message}
        </div>
      )}

      {/* ── Left Sidebar ── */}
      <div className="w-[360px] flex-shrink-0 flex flex-col border-r border-[#2a3942]" style={{ background: '#111b21' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ background: '#202c33' }}>
          <div className="flex items-center gap-3">
            <Avatar name={myName} size="md" color="teal" />
            <span className="text-white font-semibold text-base">{myName}</span>
            {totalUnread > 0 && (
              <span className="bg-[#00a884] text-black text-xs font-bold px-2 py-0.5 rounded-full">{totalUnread}</span>
            )}
          </div>
          <button
            onClick={() => { setShowCompose(true); setComposeRecipient('admin'); setComposeSubject(''); setComposeContent(''); }}
            className="p-2 rounded-full hover:bg-[#2a3942] text-[#aebac1] transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2" style={{ background: '#111b21' }}>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: '#202c33' }}>
            <Search className="w-4 h-4 text-[#aebac1] flex-shrink-0" />
            <input
              placeholder="Search conversations"
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
                      {contact.lastMsg?.from === myId && (
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
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-4 px-6 py-4" style={{ background: '#202c33' }}>
              <button onClick={() => setShowCompose(false)} className="text-[#aebac1] hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
              <span className="text-white font-semibold text-base">New Message</span>
            </div>

            <div className="flex-1 flex items-center justify-center p-8">
              <div className="w-full max-w-lg space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider block mb-1.5">To</label>
                  <div className="relative">
                    <select
                      value={composeRecipient}
                      onChange={e => setComposeRecipient(e.target.value)}
                      className="w-full appearance-none h-11 px-4 rounded-lg text-sm text-white outline-none focus:ring-2 focus:ring-[#00a884]"
                      style={{ background: '#202c33', border: '1px solid #2a3942' }}
                    >
                      <option value="admin">Admin</option>
                      {managers.map(m => (
                        <option key={m._id || m.id} value={m._id || m.id}>
                          {buildName(m) || 'Manager'} (Manager)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider block mb-1.5">Subject</label>
                  <input
                    value={composeSubject}
                    onChange={e => setComposeSubject(e.target.value)}
                    placeholder="Message subject..."
                    className="w-full h-11 px-4 rounded-lg text-sm text-white placeholder-[#8696a0] outline-none focus:ring-2 focus:ring-[#00a884]"
                    style={{ background: '#202c33', border: '1px solid #2a3942' }}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider block mb-1.5">Message</label>
                  <textarea
                    value={composeContent}
                    onChange={e => setComposeContent(e.target.value)}
                    placeholder="Type a message..."
                    rows={6}
                    className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-[#8696a0] outline-none resize-none focus:ring-2 focus:ring-[#00a884]"
                    style={{ background: '#202c33', border: '1px solid #2a3942' }}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setShowCompose(false)} className="px-5 py-2 text-sm text-[#aebac1] hover:text-white rounded-lg">Cancel</button>
                  <button
                    onClick={handleSend}
                    disabled={sending || !composeContent.trim() || !composeSubject.trim()}
                    className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-50"
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
          <div className="flex flex-col h-full">
            {/* Chat Header */}
            <div className="flex items-center gap-4 px-6 py-3 flex-shrink-0" style={{ background: '#202c33' }}>
              <Avatar name={selectedContactInfo.name} size="md" color={nameColor(selectedContactInfo.name)} />
              <div>
                <p className="text-white font-semibold text-sm">{selectedContactInfo.name}</p>
                <p className="text-xs text-[#8696a0]">{chatMessages.length} message{chatMessages.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="ml-auto">
                <button
                  onClick={() => { setShowCompose(true); setComposeRecipient(selectedContact); setComposeSubject(''); setComposeContent(''); }}
                  className="p-2 rounded-full hover:bg-[#2a3942] text-[#aebac1] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {chatMessages.map((msg, i) => {
                const isMe = msg.from === myId;
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
                        {msg.subject && (
                          <p className="text-[10px] font-semibold mb-1" style={{ color: '#53bdeb' }}>{msg.subject}</p>
                        )}
                        <p className="text-sm text-white leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[10px] text-[#8696a0]">{format(new Date(msg.createdAt), 'h:mm a')}</span>
                          {isMe && <CheckCheck className="w-3 h-3 text-[#53bdeb]" />}
                        </div>
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
              })}
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
          <div className="flex-1 flex flex-col items-center justify-center gap-4 select-none">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#202c33' }}>
              <MessageSquare className="w-10 h-10 text-[#00a884]" />
            </div>
            <div className="text-center">
              <p className="text-white text-xl font-light mb-1">My Messages</p>
              <p className="text-[#8696a0] text-sm">Select a conversation or start a new one</p>
            </div>
            <button
              onClick={() => { setShowCompose(true); setComposeRecipient('admin'); setComposeSubject(''); setComposeContent(''); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-black"
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