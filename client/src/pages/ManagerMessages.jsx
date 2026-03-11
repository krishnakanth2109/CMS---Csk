import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Search, Trash2, Reply, ChevronDown, Plus } from 'lucide-react';
import { format } from 'date-fns';
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

export default function ManagerMessages() {
  const currentUser = getCurrentUser();
  const myId        = currentUser?.id || currentUser?._id || '';

  const [messages,        setMessages]        = useState([]);
  const [recruiters,      setRecruiters]      = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [activeTab,       setActiveTab]       = useState('inbox');
  const [searchQuery,     setSearchQuery]     = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);

  // Compose
  const [isComposing, setIsComposing] = useState(false);
  const [recipient,   setRecipient]   = useState('admin');
  const [subject,     setSubject]     = useState('');
  const [content,     setContent]     = useState('');
  const [sending,     setSending]     = useState(false);

  // Reply
  const [replying,     setReplying]     = useState(false);
  const [replySubject, setReplySubject] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [replySending, setReplySending] = useState(false);

  const [toast, setToast] = useState(null);
  const socketRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Effects ───────────────────────────────────────────────────────────────────
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
        const [msgRes, recRes] = await Promise.all([
          fetch(`${API_URL}/messages`,                             { headers: getAuthHeader() }),
          fetch(`${API_URL}/recruiters/by-role?role=recruiter`,   { headers: getAuthHeader() }),
        ]);
        if (msgRes.ok) setMessages(await msgRes.json());
        if (recRes.ok) {
          const d = await recRes.json();
          setRecruiters(Array.isArray(d) ? d : []);
        }
      } catch (err) {
        console.error(err);
        showToast('Failed to load messages', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, [myId]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const resolveName = (idOrKey, fallback) => {
    if (!idOrKey) return fallback || 'Unknown';
    if (idOrKey === 'admin') return 'Admin';
    if (idOrKey === 'all')   return 'Everyone';
    if (idOrKey === myId)    return 'You';
    const rec = recruiters.find(r => r._id === idOrKey || r.id === idOrKey);
    if (rec) return buildName(rec) || 'Recruiter';
    return fallback || idOrKey;
  };

  const getSender    = (msg) => resolveName(msg.from, msg.fromName);
  const getRecipient = (msg) => resolveName(msg.to,   msg.toName);

  const isMyInbox = (m) => (m.to === myId || m.to === 'all') && m.from !== myId;
  const isMySent  = (m) => m.from === myId;

  const displayList = messages.filter(m => {
    const matchesTab = activeTab === 'inbox' ? isMyInbox(m) : isMySent(m);
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (m.subject || '').toLowerCase().includes(q) ||
      (m.content  || '').toLowerCase().includes(q) ||
      getSender(m).toLowerCase().includes(q) ||
      getRecipient(m).toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  const inboxCount = messages.filter(isMyInbox).length;

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!subject.trim() || !content.trim()) { showToast('Subject and message are required', 'error'); return; }
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
      setSubject(''); setContent(''); setIsComposing(false);
      showToast('Message sent successfully');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const handleReplyStart = (msg) => {
    setReplySubject(`Re: ${msg.subject}`);
    setReplyContent('');
    setReplying(true);
  };

  const handleReplySend = async () => {
    if (!replyContent.trim()) { showToast('Reply cannot be empty', 'error'); return; }
    setReplySending(true);
    try {
      const res = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({ to: selectedMessage.from, subject: replySubject, content: replyContent }),
      });
      if (!res.ok) throw new Error('Failed');
      const saved = await res.json();
      if (socketRef.current) socketRef.current.emit('send_message', saved);
      setMessages(prev => [saved, ...prev]);
      setReplying(false);
      showToast('Reply sent');
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
      if (selectedMessage?._id === id) { setSelectedMessage(null); setReplying(false); }
      showToast('Message deleted');
    } catch { showToast('Could not delete', 'error'); }
  };

  const initials = (name) => (name || 'U')[0].toUpperCase();

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden relative">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium
          ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-blue-600" />
          Communications
          {inboxCount > 0 && (
            <span className="text-sm font-normal text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
              {inboxCount} New
            </span>
          )}
        </h1>
        <button
          onClick={() => { setIsComposing(true); setRecipient('admin'); setSubject(''); setContent(''); setSelectedMessage(null); setReplying(false); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition-colors"
        >
          <Plus className="w-4 h-4" /> Compose
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Message List ── */}
        <div className="w-72 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">

          {/* Search */}
          <div className="p-3 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search messages..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg border-none outline-none text-gray-800 dark:text-gray-200"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 dark:border-gray-700">
            {['inbox', 'sent'].map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSelectedMessage(null); setReplying(false); setIsComposing(false); }}
                className={`flex-1 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors
                  ${activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
              >
                {tab}
                {tab === 'inbox' && inboxCount > 0 && (
                  <span className="ml-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{inboxCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-6 text-center text-sm text-gray-400">Loading…</p>
            ) : displayList.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">No messages found.</p>
            ) : (
              displayList.map(msg => (
                <div
                  key={msg._id}
                  onClick={() => { setSelectedMessage(msg); setIsComposing(false); setReplying(false); }}
                  className={`group relative p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer transition-colors
                    ${selectedMessage?._id === msg._id
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}
                >
                  <div className="flex justify-between items-start mb-0.5">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate pr-2">
                      {activeTab === 'inbox' ? getSender(msg) : `To: ${getRecipient(msg)}`}
                    </span>
                    <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">
                      {format(new Date(msg.createdAt), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{msg.subject}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{msg.content}</p>
                  <button
                    onClick={e => handleDelete(e, msg._id)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded-full text-red-400 hover:bg-red-50 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Right: Compose OR Detail ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {isComposing ? (
            /* Compose view */
            <div className="flex-1 flex flex-col p-8 max-w-2xl mx-auto w-full">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex-1 flex flex-col">
                <h2 className="text-xl font-bold mb-5 flex items-center gap-2 text-gray-800 dark:text-white">
                  <Send className="w-5 h-5 text-blue-600" /> New Message
                </h2>
                <div className="space-y-4 flex-1 flex flex-col">

                  {/* Recipient */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Recipient</label>
                    <div className="relative">
                      <select
                        value={recipient}
                        onChange={e => setRecipient(e.target.value)}
                        className="w-full appearance-none text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 pr-8 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="admin">Admin</option>
                        {recruiters.length > 0 && (
                          <optgroup label="── Recruiters ──">
                            {recruiters.map(r => (
                              <option key={r._id || r.id} value={r._id || r.id}>
                                {buildName(r) || 'Recruiter'}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Subject</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder="Enter subject..."
                      className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Message */}
                  <div className="flex-1 flex flex-col">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Message</label>
                    <textarea
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      placeholder="Type your message here..."
                      className="flex-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 resize-none outline-none focus:ring-2 focus:ring-blue-500 min-h-[160px]"
                    />
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-3">
                  <button onClick={() => setIsComposing(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Discard</button>
                  <button
                    onClick={handleSend}
                    disabled={sending || !subject.trim() || !content.trim()}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {sending ? 'Sending…' : 'Send Message'}
                  </button>
                </div>
              </div>
            </div>

          ) : selectedMessage ? (
            /* Detail view */
            <>
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-5 flex-shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
                      {initials(getSender(selectedMessage))}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">{selectedMessage.subject}</h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium text-gray-800 dark:text-gray-200">{getSender(selectedMessage)}</span>
                        <span className="mx-1 text-gray-400">→</span>
                        <span>{getRecipient(selectedMessage)}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(new Date(selectedMessage.createdAt), 'MMMM d, yyyy · h:mm a')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isMyInbox(selectedMessage) && (
                      <button
                        onClick={() => handleReplyStart(selectedMessage)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                      >
                        <Reply className="w-4 h-4" /> Reply
                      </button>
                    )}
                    <button
                      onClick={e => handleDelete(e, selectedMessage._id)}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed text-sm">
                  {selectedMessage.content}
                </div>
              </div>

              {replying && (
                <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex-shrink-0">
                  <input
                    type="text"
                    value={replySubject}
                    onChange={e => setReplySubject(e.target.value)}
                    className="w-full text-sm font-medium border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                  />
                  <textarea
                    rows={3}
                    value={replyContent}
                    onChange={e => setReplyContent(e.target.value)}
                    placeholder="Write your reply..."
                    className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 resize-none outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setReplying(false)} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
                    <button
                      onClick={handleReplySend}
                      disabled={replySending || !replyContent.trim()}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {replySending ? 'Sending…' : 'Send Reply'}
                    </button>
                  </div>
                </div>
              )}

              {!replying && isMyInbox(selectedMessage) && (
                <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3">
                  <button
                    onClick={() => handleReplyStart(selectedMessage)}
                    className="w-full text-left text-sm text-gray-400 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                  >
                    <Reply className="w-4 h-4 inline mr-2 -mt-0.5" /> Click to reply…
                  </button>
                </div>
              )}
            </>

          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 dark:text-gray-600">
              <MessageSquare className="w-16 h-16 mb-3 opacity-30" />
              <p className="text-sm">Select a message to view</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
