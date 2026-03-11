import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Send, MessageSquare, Search, Trash2, Plus, MoreVertical, Reply } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import io from 'socket.io-client';
import { format } from 'date-fns';

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

// Build "First Last" from a user object
const buildName = (user) => {
  if (!user) return null;
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return full || user.username || user.email || null;
};

export default function AdminMessages() {
  const { toast } = useToast();

  const [messages,        setMessages]        = useState([]);
  const [recruiters,      setRecruiters]      = useState([]);  // role=recruiter
  const [managers,        setManagers]        = useState([]);  // role=manager
  const [loading,         setLoading]         = useState(true);
  const [activeTab,       setActiveTab]       = useState('inbox');
  const [searchQuery,     setSearchQuery]     = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);

  const [isComposing, setIsComposing] = useState(false);
  const [subject,     setSubject]     = useState('');
  const [content,     setContent]     = useState('');
  const [recipient,   setRecipient]   = useState('');

  // ── Inline reply state ────────────────────────────────────────────────────────
  const [replying,     setReplying]     = useState(false);
  const [replySubject, setReplySubject] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [replySending, setReplySending] = useState(false);

  const socketRef = useRef(null);

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    socketRef.current = io(BASE_URL);
    socketRef.current.emit('join_room', 'admin');

    socketRef.current.on('receive_message', (newMessage) => {
      setMessages((prev) => [newMessage, ...prev]);
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

        if (msgRes.ok) {
          const data = await msgRes.json();
          setMessages(data);
          const inbox = data.filter(isInboxMsg);
          if (inbox.length > 0) setSelectedMessage(inbox[0]);
        }
        if (recRes.ok) {
          const d = await recRes.json();
          setRecruiters(Array.isArray(d) ? d : []);
        }
        if (mgrRes.ok) {
          const d = await mgrRes.json();
          setManagers(Array.isArray(d) ? d : []);
        }
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to load messages', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, [toast]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  // Inbox for admin: someone sent a message TO admin (not from admin)
  const isInboxMsg = (m) => m.to === 'admin' && m.from !== 'admin';

  // Resolve id → "First Last" using loaded lists, fall back to backend-resolved name
  const resolveName = (idOrKey, fallback) => {
    if (!idOrKey) return fallback || 'Unknown';
    if (idOrKey === 'admin') return 'Admin';
    if (idOrKey === 'all')   return 'Everyone';
    const rec = recruiters.find(r => r._id === idOrKey || r.id === idOrKey);
    if (rec) return buildName(rec) || 'Recruiter';
    const mgr = managers.find(m => m._id === idOrKey || m.id === idOrKey);
    if (mgr) return buildName(mgr) || 'Manager';
    return fallback || idOrKey; // backend already resolved name
  };

  const getSenderLabel    = (msg) => resolveName(msg.from, msg.fromName);
  const getRecipientLabel = (msg) => resolveName(msg.to,   msg.toName);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!content.trim() || !subject.trim() || !recipient) {
      toast({ title: 'Validation Error', description: 'All fields are required', variant: 'destructive' });
      return;
    }
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
      setSubject(''); setContent(''); setRecipient(''); setIsComposing(false);
      toast({ title: 'Success', description: 'Message sent successfully' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this message?')) return;
    try {
      const res = await fetch(`${API_URL}/messages/${id}`, { method: 'DELETE', headers: getAuthHeader() });
      if (!res.ok) throw new Error('Failed');
      setMessages(prev => prev.filter(m => m._id !== id));
      if (selectedMessage?._id === id) setSelectedMessage(null);
      toast({ title: 'Deleted', description: 'Message removed' });
    } catch {
      toast({ title: 'Error', description: 'Could not delete', variant: 'destructive' });
    }
  };

  const handleReplyStart = (msg) => {
    setReplySubject(`Re: ${msg.subject}`);
    setReplyContent('');
    setReplying(true);
    setIsComposing(false);
  };

  const handleReplySend = async () => {
    if (!replyContent.trim()) {
      toast({ title: 'Error', description: 'Reply cannot be empty', variant: 'destructive' });
      return;
    }
    setReplySending(true);
    try {
      const res = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({
          to: selectedMessage.from,
          subject: replySubject,
          content: replyContent,
        }),
      });
      if (!res.ok) throw new Error('Failed to send reply');
      const saved = await res.json();
      if (socketRef.current) socketRef.current.emit('send_message', saved);
      setMessages(prev => [saved, ...prev]);
      setReplying(false);
      setReplyContent('');
      toast({ title: 'Reply Sent', description: 'Your reply was sent successfully' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setReplySending(false);
    }
  };

  // ── Filtering ──────────────────────────────────────────────────────────────────
  const filteredMessages = messages.filter(m => {
    const matchesTab = activeTab === 'inbox' ? isInboxMsg(m) : m.from === 'admin';
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (m.subject || '').toLowerCase().includes(q) ||
      (m.content  || '').toLowerCase().includes(q) ||
      getSenderLabel(m).toLowerCase().includes(q) ||
      getRecipientLabel(m).toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  const inboxCount = messages.filter(isInboxMsg).length;

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">

      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          Communications
          {inboxCount > 0 && (
            <span className="text-sm font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{inboxCount} New</span>
          )}
        </h1>
        <Button
          onClick={() => { setIsComposing(true); setRecipient(''); setSubject(''); setContent(''); setSelectedMessage(null); }}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
        >
          <Plus className="w-4 h-4 mr-2" /> Compose
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Sidebar ── */}
        <div className="w-1/3 min-w-[300px] max-w-[400px] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">

          {/* Search & Tabs */}
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search messages..."
                className="pl-9 bg-gray-100 dark:bg-gray-700 border-none"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
              {['inbox', 'sent'].map(tab => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setIsComposing(false); setReplying(false); }}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all capitalize flex items-center justify-center gap-1.5
                    ${activeTab === tab ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
                >
                  {tab}
                  {tab === 'inbox' && inboxCount > 0 && (
                    <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{inboxCount}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-6 text-center text-sm text-gray-400">Loading messages...</p>
            ) : filteredMessages.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">No messages found.</p>
            ) : (
              filteredMessages.map(msg => (
                <div
                  key={msg._id}
                  onClick={() => { setSelectedMessage(msg); setIsComposing(false); setReplying(false); }}
                  className={`group p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors
                    ${selectedMessage?._id === msg._id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : ''}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-gray-900 dark:text-white text-sm truncate pr-2">
                      {activeTab === 'inbox' ? getSenderLabel(msg) : `To: ${getRecipientLabel(msg)}`}
                    </span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {format(new Date(msg.createdAt), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{msg.subject}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{msg.content}</p>
                    </div>
                    <button
                      onClick={e => handleDelete(e, msg._id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full text-red-500 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Right Content ── */}
        <div className="flex-1 bg-gray-50 dark:bg-gray-900 flex flex-col">

          {isComposing ? (
            <div className="h-full flex flex-col p-8 max-w-3xl mx-auto w-full">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex-1 flex flex-col">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-800 dark:text-white">
                  <Send className="w-5 h-5 text-blue-600" /> New Message
                </h2>

                <div className="space-y-4 flex-1 flex flex-col">
                  {/* Recipient */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Recipient</label>
                    <Select value={recipient} onValueChange={setRecipient}>
                      <SelectTrigger className="w-full bg-gray-50 dark:bg-gray-700 dark:border-gray-600 border-none h-10">
                        <SelectValue placeholder="Select Recipient..." />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Broadcast */}
                        <SelectItem value="all">
                          <span className="font-bold">Broadcast to All</span>
                          <span className="text-gray-400 ml-2 text-xs">(Managers &amp; Recruiters)</span>
                        </SelectItem>

                        {/* Managers */}
                        {managers.length > 0 && (
                          <>
                            <div className="px-2 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                              Managers
                            </div>
                            {managers.map(m => (
                              <SelectItem key={m._id || m.id} value={m._id || m.id}>
                                <span className="font-medium">{buildName(m) || 'Manager'}</span>
                                <span className="text-gray-400 ml-2 text-xs">Manager</span>
                              </SelectItem>
                            ))}
                          </>
                        )}

                        {/* Recruiters */}
                        {recruiters.length > 0 && (
                          <>
                            <div className="px-2 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                              Recruiters
                            </div>
                            {recruiters.map(r => (
                              <SelectItem key={r._id || r.id} value={r._id || r.id}>
                                <span className="font-medium">{buildName(r) || 'Recruiter'}</span>
                                <span className="text-gray-400 ml-2 text-xs">Recruiter</span>
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Subject */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Subject</label>
                    <Input
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      className="bg-gray-50 dark:bg-gray-700 border-none h-10"
                      placeholder="Enter subject..."
                    />
                  </div>

                  {/* Message */}
                  <div className="space-y-1 flex-1 flex flex-col">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Message</label>
                    <Textarea
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      className="bg-gray-50 dark:bg-gray-700 border-none resize-none flex-1 p-4 text-base"
                      placeholder="Type your message here..."
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setIsComposing(false)}>Discard</Button>
                  <Button
                    onClick={handleSend}
                    disabled={!content || !recipient}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                  >
                    Send Message <Send className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>

          ) : selectedMessage ? (
            <div className="h-full flex flex-col">
              {/* Message Header */}
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{selectedMessage.subject}</h2>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
                        {(getSenderLabel(selectedMessage)[0] || 'U').toUpperCase()}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white block">
                          {activeTab === 'inbox' ? getSenderLabel(selectedMessage) : 'You (Admin)'}
                        </span>
                        <span className="text-gray-500 text-xs">
                          To: {getRecipientLabel(selectedMessage)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 mr-2">
                      {format(new Date(selectedMessage.createdAt), 'PPp')}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4 text-gray-500" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {activeTab === 'inbox' && (
                          <DropdownMenuItem onClick={() => handleReplyStart(selectedMessage)}>
                            <Reply className="w-4 h-4 mr-2" /> Reply
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={e => handleDelete(e, selectedMessage._id)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 p-8 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 min-h-[50%] whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">
                  {selectedMessage.content}
                </div>
              </div>

              {activeTab === 'inbox' && (
                <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                  {replying ? (
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                          <Reply className="w-4 h-4 text-blue-600" />
                          Replying to {getSenderLabel(selectedMessage)}
                        </span>
                        <button onClick={() => setReplying(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                      </div>
                      <Input
                        value={replySubject}
                        onChange={e => setReplySubject(e.target.value)}
                        className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm font-medium"
                        placeholder="Subject..."
                      />
                      <Textarea
                        value={replyContent}
                        onChange={e => setReplyContent(e.target.value)}
                        placeholder="Write your reply..."
                        className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 resize-none text-sm"
                        rows={4}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setReplying(false)}>Cancel</Button>
                        <Button
                          onClick={handleReplySend}
                          disabled={replySending || !replyContent.trim()}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          {replySending ? 'Sending...' : 'Send Reply'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4">
                      <Button
                        onClick={() => handleReplyStart(selectedMessage)}
                        variant="outline"
                        className="w-full justify-start text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        <Reply className="w-4 h-4 mr-2" /> Click to reply to {getSenderLabel(selectedMessage)}...
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
              <p>Select a message to view</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
