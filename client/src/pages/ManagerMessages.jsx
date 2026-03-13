import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Send, MessageSquare, Search, Plus, X, Check, CheckCheck, Reply, Forward, Info, Trash2, Smile, AtSign, CheckSquare } from 'lucide-react';
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

const EMOJIS = ['😀','😂','😍','🥰','😎','🤔','👍','👎','❤️','🔥','🎉','✅','⚡','💯','🙏','😭','😅','🤣','😊','😁','👋','🤝','💪','🎯','📌','📎','✏️','📝','💡','⭐'];

const ContextMenu = ({ x, y, msg, isMe, onClose, onReply, onForward, onInfo, onDeleteForMe, onDeleteForEveryone, onSelect }) => {
  const menuRef = useRef(null);
  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <div ref={menuRef} style={{ position: 'fixed', zIndex: 1000, top: y, left: x, background: '#233138', border: '1px solid #2a3942' }}
      className="rounded-xl shadow-2xl overflow-hidden min-w-[200px]">
      {[
        { icon: <Reply className="w-4 h-4" />, label: 'Reply', action: onReply },
        { icon: <Forward className="w-4 h-4" />, label: 'Forward', action: onForward },
        { icon: <Info className="w-4 h-4" />, label: 'Info', action: onInfo },
        { icon: <CheckSquare className="w-4 h-4" />, label: 'Select', action: onSelect },
        { icon: <Trash2 className="w-4 h-4 text-red-400" />, label: 'Delete for me', action: onDeleteForMe, danger: true },
        ...(isMe ? [{ icon: <Trash2 className="w-4 h-4 text-red-400" />, label: 'Delete for everyone', action: onDeleteForEveryone, danger: true }] : []),
        { icon: <X className="w-4 h-4 text-[#8696a0]" />, label: 'Cancel', action: onClose },
      ].map(({ icon, label, action, danger }) => (
        <button key={label} onClick={() => { action(); onClose(); }}
          className={`flex items-center gap-3 w-full px-4 py-3 text-sm transition-colors hover:bg-[#2a3942] text-left ${danger ? 'text-red-400' : 'text-white'}`}>
          {icon}{label}
        </button>
      ))}
    </div>
  );
};

const EmojiPicker = ({ onSelect, onClose }) => {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={ref} className="absolute bottom-14 left-0 rounded-2xl shadow-2xl p-3 z-50 w-72"
      style={{ background: '#233138', border: '1px solid #2a3942' }}>
      <div className="grid grid-cols-10 gap-1">
        {EMOJIS.map(e => (
          <button key={e} onClick={() => onSelect(e)} className="text-xl hover:bg-[#2a3942] rounded p-1 transition-colors">{e}</button>
        ))}
      </div>
    </div>
  );
};

const InfoModal = ({ msg, onClose, resolveName }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
    <div className="rounded-2xl shadow-2xl p-6 min-w-[320px] max-w-md" style={{ background: '#233138' }} onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-white font-semibold text-base">Message Info</span>
        <button onClick={onClose} className="text-[#aebac1] hover:text-white"><X className="w-5 h-5" /></button>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between"><span className="text-[#8696a0]">From</span><span className="text-white">{resolveName(msg.from, msg.fromName)}</span></div>
        <div className="flex justify-between"><span className="text-[#8696a0]">To</span><span className="text-white">{resolveName(msg.to, msg.toName)}</span></div>
        <div className="flex justify-between"><span className="text-[#8696a0]">Subject</span><span className="text-white">{msg.subject || '—'}</span></div>
        <div className="flex justify-between"><span className="text-[#8696a0]">Sent</span><span className="text-white">{format(new Date(msg.createdAt), 'MMM d, yyyy h:mm a')}</span></div>
        <div className="flex justify-between"><span className="text-[#8696a0]">Status</span>
          <span className="text-white flex items-center gap-1">{msg.read ? <><CheckCheck className="w-4 h-4 text-[#53bdeb]" /> Read</> : <><Check className="w-4 h-4 text-[#8696a0]" /> Sent</>}</span>
        </div>
      </div>
      <div className="mt-5 p-3 rounded-xl" style={{ background: '#2a3942' }}>
        <p className="text-white text-sm">{msg.content}</p>
      </div>
    </div>
  </div>
);

const ForwardModal = ({ msg, contacts, onForward, onClose }) => {
  const [selected, setSelected] = useState([]);
  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="rounded-2xl shadow-2xl p-6 min-w-[320px] max-w-md w-full" style={{ background: '#233138' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-white font-semibold text-base">Forward Message</span>
          <button onClick={onClose} className="text-[#aebac1] hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1 mb-4">
          {contacts.map(c => (
            <button key={c.id} onClick={() => toggle(c.id)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-colors ${selected.includes(c.id) ? 'bg-[#00a884]/20' : 'hover:bg-[#2a3942]'}`}>
              <Avatar name={c.name} size="sm" color={nameColor(c.name)} />
              <span className="text-white text-sm flex-1 text-left">{c.name}</span>
              {selected.includes(c.id) && <Check className="w-4 h-4 text-[#00a884]" />}
            </button>
          ))}
        </div>
        <button onClick={() => { if (selected.length) { onForward(msg, selected); onClose(); } }}
          disabled={!selected.length}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-black disabled:opacity-50 transition-all"
          style={{ background: '#00a884' }}>
          Forward to {selected.length || ''} {selected.length === 1 ? 'contact' : 'contacts'}
        </button>
      </div>
    </div>
  );
};

export default function ManagerMessages() {
  const currentUser = getCurrentUser();
  const myId        = currentUser?.id || currentUser?._id || '';
  const myName      = buildName(currentUser) || 'Manager';

  const [messages,        setMessages]        = useState([]);
  const [recruiters,      setRecruiters]      = useState([]);
  const [managers,        setManagers]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [showCompose,     setShowCompose]     = useState(false);
  const [readSet,         setReadSet]         = useState(new Set());

  const [composeRecipients, setComposeRecipients] = useState([]);
  const [recipientSearch,   setRecipientSearch]   = useState('');
  const [composeSubject,    setComposeSubject]     = useState('');
  const [composeContent,    setComposeContent]     = useState('');
  const [sending,           setSending]            = useState(false);

  const [replyText,    setReplyText]    = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyingTo,   setReplyingTo]  = useState(null);

  const [contextMenu, setContextMenu] = useState(null);
  const [infoMsg,     setInfoMsg]     = useState(null);
  const [forwardMsg,  setForwardMsg]  = useState(null);
  const [selectMode,  setSelectMode]  = useState(false);
  const [selectedMsgs,setSelectedMsgs]= useState(new Set());
  const [showEmoji,   setShowEmoji]   = useState(false);
  const [toastMsg,    setToastMsg]    = useState(null);

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

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
        const [msgRes, recRes, mgrRes] = await Promise.all([
          fetch(`${API_URL}/messages`,                           { headers: getAuthHeader() }),
          fetch(`${API_URL}/recruiters/by-role?role=recruiter`, { headers: getAuthHeader() }),
          fetch(`${API_URL}/recruiters/by-role?role=manager`,   { headers: getAuthHeader() }),
        ]);
        if (msgRes.ok) setMessages(await msgRes.json());
        if (recRes.ok) { const d = await recRes.json(); setRecruiters(Array.isArray(d) ? d : []); }
        if (mgrRes.ok) { const d = await mgrRes.json(); setManagers(Array.isArray(d) ? d : []); }
      } catch { showToast('Failed to load messages', 'error'); }
      finally { setLoading(false); }
    };
    fetchAll();
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, [myId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [selectedContact, messages]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, []);

  const resolveName = useCallback((idOrKey, fallback) => {
    if (!idOrKey) return fallback || 'Unknown';
    if (idOrKey === 'admin') return 'Admin';
    if (idOrKey === 'all')   return 'Everyone';
    if (idOrKey === myId)    return myName;
    const rec = recruiters.find(r => r._id === idOrKey || r.id === idOrKey);
    if (rec) return buildName(rec) || 'Recruiter';
    const mgr = managers.find(m => m._id === idOrKey || m.id === idOrKey);
    if (mgr) return buildName(mgr) || 'Manager';
    return fallback || idOrKey;
  }, [recruiters, managers, myId, myName]);

  const isMyInbox = (m) => (m.to === myId || m.to === 'all') && m.from !== myId;
  const isMySent  = (m) => m.from === myId;

  const contacts = useMemo(() => {
    const map = new Map();
    messages.forEach(m => {
      const iMine = isMySent(m) || isMyInbox(m);
      if (!iMine) return;
      const otherId   = m.from === myId ? m.to : m.from;
      const otherName = m.from === myId ? resolveName(m.to, m.toName) : resolveName(m.from, m.fromName);
      if (!otherId) return;
      if (!map.has(otherId)) {
        map.set(otherId, { id: otherId, name: otherName, lastMsg: m, unread: 0 });
      } else {
        const cur = map.get(otherId);
        if (new Date(m.createdAt) > new Date(cur.lastMsg.createdAt)) cur.lastMsg = m;
      }
      if (isMyInbox(m) && m.from === otherId && !readSet.has(m._id)) {
        map.get(otherId).unread = (map.get(otherId).unread || 0) + 1;
      }
    });
    return Array.from(map.values()).sort((a, b) => new Date(b.lastMsg.createdAt) - new Date(a.lastMsg.createdAt));
  }, [messages, myId, recruiters, managers, readSet]);

  const chatMessages = useMemo(() => {
    if (!selectedContact) return [];
    return messages
      .filter(m =>
        (m.from === myId && m.to === selectedContact) ||
        (m.from === selectedContact && (m.to === myId || m.to === 'all'))
      )
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [messages, selectedContact, myId]);

  const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const selectedContactInfo = contacts.find(c => c.id === selectedContact);
  const totalUnread = contacts.reduce((s, c) => s + (c.unread || 0), 0);

  const handleSelectContact = (contactId) => {
    setSelectedContact(contactId);
    setShowCompose(false);
    setSelectMode(false);
    setSelectedMsgs(new Set());
    setMessages(prev => prev.map(m => {
      if ((m.to === myId || m.to === 'all') && m.from === contactId && !m.read) {
        setReadSet(rs => new Set([...rs, m._id]));
        return { ...m, read: true };
      }
      return m;
    }));
  };

  const handleSend = async () => {
    if (!composeSubject.trim() || !composeContent.trim() || composeRecipients.length === 0) {
      showToast('Select at least one recipient', 'error'); return;
    }
    setSending(true);
    try {
      const toSend = composeRecipients.includes('all') ? ['all'] : composeRecipients;
      const results = await Promise.all(toSend.map(to =>
        fetch(`${API_URL}/messages`, {
          method: 'POST', headers: getAuthHeader(),
          body: JSON.stringify({ to, subject: composeSubject, content: composeContent }),
        }).then(r => r.ok ? r.json() : null)
      ));
      results.forEach(saved => {
        if (saved) {
          if (socketRef.current) socketRef.current.emit('send_message', saved);
          setMessages(prev => [saved, ...prev]);
        }
      });
      setComposeSubject(''); setComposeContent(''); setComposeRecipients([]); setRecipientSearch(''); setShowCompose(false);
      if (toSend.length === 1) setSelectedContact(toSend[0]);
      showToast(`Message sent to ${composeRecipients.includes('all') ? 'everyone' : `${toSend.length} recipient${toSend.length > 1 ? 's' : ''}`}`);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSending(false); }
  };

  const handleQuickReply = async () => {
    if (!replyText.trim() || !selectedContact) return;
    setReplySending(true);
    try {
      const subj = replySubject || (replyingTo ? `Re: ${replyingTo.subject || 'conversation'}` : 'Re: conversation');
      const msgContent = replyingTo
        ? `> ${replyingTo.content.slice(0, 60)}${replyingTo.content.length > 60 ? '...' : ''}\n\n${replyText}`
        : replyText;
      const res = await fetch(`${API_URL}/messages`, {
        method: 'POST', headers: getAuthHeader(),
        body: JSON.stringify({ to: selectedContact, subject: subj, content: msgContent }),
      });
      if (!res.ok) throw new Error('Failed');
      const saved = await res.json();
      if (socketRef.current) socketRef.current.emit('send_message', saved);
      setMessages(prev => [saved, ...prev]);
      setReplyText(''); setReplyingTo(null); setReplySubject('');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setReplySending(false); }
  };

  const handleDeleteMsg = async (id) => {
    if (!confirm('Delete this message?')) return;
    try {
      const res = await fetch(`${API_URL}/messages/${id}`, { method: 'DELETE', headers: getAuthHeader() });
      if (!res.ok) throw new Error('Failed');
      setMessages(prev => prev.filter(m => m._id !== id));
      showToast('Message deleted');
    } catch { showToast('Could not delete', 'error'); }
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`Delete ${selectedMsgs.size} message(s)?`)) return;
    for (const id of selectedMsgs) {
      try { await fetch(`${API_URL}/messages/${id}`, { method: 'DELETE', headers: getAuthHeader() }); } catch {}
    }
    setMessages(prev => prev.filter(m => !selectedMsgs.has(m._id)));
    setSelectedMsgs(new Set()); setSelectMode(false);
    showToast('Deleted');
  };

  const handleForward = async (msg, recipientIds) => {
    for (const to of recipientIds) {
      try {
        const res = await fetch(`${API_URL}/messages`, {
          method: 'POST', headers: getAuthHeader(),
          body: JSON.stringify({ to, subject: `Fwd: ${msg.subject || 'message'}`, content: msg.content }),
        });
        if (res.ok) {
          const saved = await res.json();
          if (socketRef.current) socketRef.current.emit('send_message', saved);
          setMessages(prev => [saved, ...prev]);
        }
      } catch {}
    }
    showToast('Forwarded!');
  };

  const handleContextMenu = (e, msg) => {
    e.preventDefault(); e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 320);
    setContextMenu({ x, y, msg });
  };

  const toggleMsgSelect = (id) => {
    setSelectedMsgs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickReply(); }
  };

  const insertMention = () => {
    const name = selectedContactInfo?.name || '';
    setReplyText(prev => prev + `@${name} `);
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-screen bg-[#111b21] overflow-hidden" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white
          ${toastMsg.type === 'error' ? 'bg-red-500' : 'bg-[#00a884]'}`}>{toastMsg.message}</div>
      )}

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} msg={contextMenu.msg}
          isMe={contextMenu.msg.from === myId}
          onClose={() => setContextMenu(null)}
          onReply={() => { setReplyingTo(contextMenu.msg); inputRef.current?.focus(); }}
          onForward={() => setForwardMsg(contextMenu.msg)}
          onInfo={() => setInfoMsg(contextMenu.msg)}
          onSelect={() => { setSelectMode(true); toggleMsgSelect(contextMenu.msg._id); }}
          onDeleteForMe={() => handleDeleteMsg(contextMenu.msg._id)}
          onDeleteForEveryone={() => handleDeleteMsg(contextMenu.msg._id)}
        />
      )}

      {infoMsg && <InfoModal msg={infoMsg} onClose={() => setInfoMsg(null)} resolveName={resolveName} />}
      {forwardMsg && (
        <ForwardModal msg={forwardMsg} contacts={contacts.filter(c => c.id !== selectedContact)}
          onForward={handleForward} onClose={() => setForwardMsg(null)} />
      )}

      {/* Sidebar */}
      <div className="w-[360px] flex-shrink-0 flex flex-col border-r border-[#2a3942]" style={{ background: '#111b21' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ background: '#202c33' }}>
          <div className="flex items-center gap-3">
            <Avatar name={myName} size="md" color="green" />
            <span className="text-white font-semibold text-base">{myName}</span>
            {totalUnread > 0 && <span className="bg-[#00a884] text-black text-xs font-bold px-2 py-0.5 rounded-full">{totalUnread}</span>}
          </div>
          <button onClick={() => { setShowCompose(true); setComposeRecipients([]); setRecipientSearch(''); setComposeSubject(''); setComposeContent(''); }}
            className="p-2 rounded-full hover:bg-[#2a3942] text-[#aebac1] transition-colors"><Plus className="w-5 h-5" /></button>
        </div>

        <div className="px-3 py-2" style={{ background: '#111b21' }}>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: '#202c33' }}>
            <Search className="w-4 h-4 text-[#aebac1] flex-shrink-0" />
            <input placeholder="Search conversations" className="flex-1 bg-transparent text-sm text-white placeholder-[#8696a0] outline-none"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" /></div>
          ) : filteredContacts.length === 0 ? (
            <p className="text-center text-sm text-[#8696a0] mt-10">No conversations yet</p>
          ) : (
            filteredContacts.map(contact => (
              <div key={contact.id} onClick={() => handleSelectContact(contact.id)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-[#2a3942]
                  ${selectedContact === contact.id ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'}`}>
                <Avatar name={contact.name} size="md" color={nameColor(contact.name)} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="text-white font-medium text-sm truncate">{contact.name}</span>
                    <span className={`text-xs ml-2 flex-shrink-0 ${contact.unread > 0 ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
                      {formatMsgTime(contact.lastMsg?.createdAt)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-[#8696a0] truncate flex-1">
                      {contact.lastMsg?.from === myId && <CheckCheck className="w-3 h-3 inline mr-1 text-[#53bdeb]" />}
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

      {/* Main Chat */}
      <div className="flex-1 flex flex-col" style={{
        background: '#0b141a',
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23182229' fill-opacity='0.5'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}>
        {showCompose ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-4 px-6 py-4" style={{ background: '#202c33' }}>
              <button onClick={() => setShowCompose(false)} className="text-[#aebac1] hover:text-white p-1"><X className="w-5 h-5" /></button>
              <span className="text-white font-semibold text-base">New Message</span>
            </div>
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="w-full max-w-lg space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider block mb-1.5">
                    To {composeRecipients.length > 0 && <span className="text-[#00a884] normal-case font-normal">({composeRecipients.includes('all') ? 'Everyone' : `${composeRecipients.length} selected`})</span>}
                  </label>
                  {composeRecipients.length > 0 && !composeRecipients.includes('all') && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {composeRecipients.map(id => (
                        <span key={id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white" style={{ background: '#00a884' }}>
                          {resolveName(id, id)}
                          <button onClick={() => setComposeRecipients(prev => prev.filter(r => r !== id))}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #2a3942' }}>
                    <div className="flex items-center gap-2 px-3 py-2" style={{ background: '#202c33' }}>
                      <Search className="w-3.5 h-3.5 text-[#8696a0] flex-shrink-0" />
                      <input value={recipientSearch} onChange={e => setRecipientSearch(e.target.value)}
                        placeholder="Search people..." className="flex-1 bg-transparent text-sm text-white placeholder-[#8696a0] outline-none" />
                    </div>
                    <div className="max-h-52 overflow-y-auto" style={{ background: '#1a2930' }}>
                      {/* Broadcast to All */}
                      {'broadcast to all'.includes(recipientSearch.toLowerCase()) && (
                        <button onClick={() => setComposeRecipients(composeRecipients.includes('all') ? [] : ['all'])}
                          className={`flex items-center gap-3 w-full px-4 py-2.5 transition-colors text-left ${composeRecipients.includes('all') ? 'bg-[#00a884]/20' : 'hover:bg-[#2a3942]'}`}>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${composeRecipients.includes('all') ? 'border-[#00a884] bg-[#00a884]' : 'border-[#8696a0]'}`}>
                            {composeRecipients.includes('all') && <Check className="w-3 h-3 text-black" />}
                          </div>
                          <span className="text-sm font-medium" style={{ color: '#00a884' }}>📢 Broadcast to All</span>
                        </button>
                      )}
                      {/* Admin */}
                      {'admin'.includes(recipientSearch.toLowerCase()) && (
                        <button onClick={() => { if (composeRecipients.includes('all')) return; setComposeRecipients(prev => prev.includes('admin') ? prev.filter(r => r !== 'admin') : [...prev, 'admin']); }}
                          className={`flex items-center gap-3 w-full px-4 py-2.5 transition-colors text-left ${composeRecipients.includes('admin') ? 'bg-[#00a884]/20' : 'hover:bg-[#2a3942]'} ${composeRecipients.includes('all') ? 'opacity-40 cursor-not-allowed' : ''}`}>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${composeRecipients.includes('admin') ? 'border-[#00a884] bg-[#00a884]' : 'border-[#8696a0]'}`}>
                            {composeRecipients.includes('admin') && <Check className="w-3 h-3 text-black" />}
                          </div>
                          <Avatar name="Admin" size="sm" color="blue" />
                          <span className="text-sm text-white">Admin</span>
                        </button>
                      )}
                      {/* Managers (excluding self) */}
                      {managers.filter(m => (buildName(m)||'').toLowerCase().includes(recipientSearch.toLowerCase()) && (m._id||m.id) !== myId).length > 0 && (
                        <>
                          <div className="px-4 py-1.5 text-[10px] text-[#8696a0] font-bold uppercase tracking-wider" style={{ background: '#111b21' }}>Managers</div>
                          {managers.filter(m => (buildName(m)||'').toLowerCase().includes(recipientSearch.toLowerCase()) && (m._id||m.id) !== myId).map(m => {
                            const id = m._id || m.id; const name = buildName(m) || 'Manager';
                            const checked = composeRecipients.includes(id);
                            return (
                              <button key={id} onClick={() => { if (composeRecipients.includes('all')) return; setComposeRecipients(prev => checked ? prev.filter(r => r !== id) : [...prev, id]); }}
                                className={`flex items-center gap-3 w-full px-4 py-2.5 transition-colors text-left ${checked ? 'bg-[#00a884]/20' : 'hover:bg-[#2a3942]'}`}>
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${checked ? 'border-[#00a884] bg-[#00a884]' : 'border-[#8696a0]'}`}>
                                  {checked && <Check className="w-3 h-3 text-black" />}
                                </div>
                                <Avatar name={name} size="sm" color={nameColor(name)} />
                                <span className="text-sm text-white">{name}</span>
                              </button>
                            );
                          })}
                        </>
                      )}
                      {/* Recruiters */}
                      {recruiters.filter(r => (buildName(r)||'').toLowerCase().includes(recipientSearch.toLowerCase())).length > 0 && (
                        <>
                          <div className="px-4 py-1.5 text-[10px] text-[#8696a0] font-bold uppercase tracking-wider" style={{ background: '#111b21' }}>Recruiters</div>
                          {recruiters.filter(r => (buildName(r)||'').toLowerCase().includes(recipientSearch.toLowerCase())).map(r => {
                            const id = r._id || r.id; const name = buildName(r) || 'Recruiter';
                            const checked = composeRecipients.includes(id);
                            return (
                              <button key={id} onClick={() => { if (composeRecipients.includes('all')) return; setComposeRecipients(prev => checked ? prev.filter(x => x !== id) : [...prev, id]); }}
                                className={`flex items-center gap-3 w-full px-4 py-2.5 transition-colors text-left ${checked ? 'bg-[#00a884]/20' : 'hover:bg-[#2a3942]'}`}>
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${checked ? 'border-[#00a884] bg-[#00a884]' : 'border-[#8696a0]'}`}>
                                  {checked && <Check className="w-3 h-3 text-black" />}
                                </div>
                                <Avatar name={name} size="sm" color={nameColor(name)} />
                                <span className="text-sm text-white">{name}</span>
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider block mb-1.5">Subject</label>
                  <input value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Message subject..."
                    className="w-full h-11 px-4 rounded-lg text-sm text-white placeholder-[#8696a0] outline-none focus:ring-2 focus:ring-[#00a884]"
                    style={{ background: '#202c33', border: '1px solid #2a3942' }} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider block mb-1.5">Message</label>
                  <textarea value={composeContent} onChange={e => setComposeContent(e.target.value)} placeholder="Type a message..." rows={6}
                    className="w-full px-4 py-3 rounded-lg text-sm text-white placeholder-[#8696a0] outline-none resize-none focus:ring-2 focus:ring-[#00a884]"
                    style={{ background: '#202c33', border: '1px solid #2a3942' }} />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setShowCompose(false)} className="px-5 py-2 text-sm text-[#aebac1] hover:text-white rounded-lg">Cancel</button>
                  <button onClick={handleSend} disabled={sending || !composeContent.trim() || !composeSubject.trim() || composeRecipients.length === 0}
                    className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-50"
                    style={{ background: '#00a884' }}>
                    <Send className="w-4 h-4" />{sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>

        ) : selectedContact && selectedContactInfo ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-4 px-6 py-3 flex-shrink-0" style={{ background: '#202c33' }}>
              <Avatar name={selectedContactInfo.name} size="md" color={nameColor(selectedContactInfo.name)} />
              <div>
                <p className="text-white font-semibold text-sm">{selectedContactInfo.name}</p>
                <p className="text-xs text-[#8696a0]">{chatMessages.length} message{chatMessages.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {selectMode ? (
                  <>
                    <span className="text-[#8696a0] text-sm">{selectedMsgs.size} selected</span>
                    <button onClick={() => setSelectedMsgs(new Set(chatMessages.map(m => m._id)))}
                      className="text-xs text-[#00a884] px-2 py-1 rounded hover:bg-[#2a3942]">Select All</button>
                    {selectedMsgs.size > 0 && <button onClick={handleDeleteSelected} className="text-xs text-red-400 px-2 py-1 rounded hover:bg-[#2a3942]">Delete</button>}
                    <button onClick={() => { setSelectMode(false); setSelectedMsgs(new Set()); }}
                      className="p-2 rounded-full hover:bg-[#2a3942] text-[#aebac1]"><X className="w-4 h-4" /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setSelectMode(true)} className="p-2 rounded-full hover:bg-[#2a3942] text-[#aebac1]" title="Select">
                      <CheckSquare className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setShowCompose(true); setComposeRecipients([selectedContact]); setRecipientSearch(''); setComposeSubject(''); setComposeContent(''); }}
                      className="p-2 rounded-full hover:bg-[#2a3942] text-[#aebac1]"><Plus className="w-4 h-4" /></button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
              {chatMessages.map((msg, i) => {
                const isMe = msg.from === myId;
                const isSelected = selectedMsgs.has(msg._id);
                const showDate = i === 0 || (format(new Date(msg.createdAt), 'yyyy-MM-dd') !== format(new Date(chatMessages[i-1].createdAt), 'yyyy-MM-dd'));
                const isQuoted = msg.content?.startsWith('>');
                const lines = msg.content?.split('\n') || [];
                const quotedLines = isQuoted ? lines.filter(l => l.startsWith('>')).map(l => l.slice(2)) : [];
                const mainContent = isQuoted ? lines.filter(l => !l.startsWith('>')).join('\n').trim() : msg.content;

                return (
                  <React.Fragment key={msg._id}>
                    {showDate && (
                      <div className="flex justify-center my-3">
                        <span className="px-3 py-1 rounded-full text-xs text-[#8696a0]" style={{ background: '#182229' }}>
                          {isToday(new Date(msg.createdAt)) ? 'Today' : isYesterday(new Date(msg.createdAt)) ? 'Yesterday' : format(new Date(msg.createdAt), 'MMMM d, yyyy')}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2 ${selectMode ? 'cursor-pointer' : ''}`}
                      onClick={selectMode ? () => toggleMsgSelect(msg._id) : undefined}
                      onContextMenu={!selectMode ? (e) => handleContextMenu(e, msg) : undefined}>
                      {selectMode && (
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                          ${isSelected ? 'border-[#00a884] bg-[#00a884]' : 'border-[#8696a0]'}`}>
                          {isSelected && <Check className="w-3 h-3 text-black" />}
                        </div>
                      )}
                      <div className={`relative max-w-[65%] px-3 py-2 rounded-lg shadow-sm ${isSelected ? 'ring-2 ring-[#00a884]' : ''}`}
                        style={{ background: isMe ? '#005c4b' : '#202c33', borderRadius: isMe ? '8px 8px 2px 8px' : '8px 8px 8px 2px' }}>
                        {isQuoted && quotedLines.length > 0 && (
                          <div className="mb-2 pl-2 border-l-2 border-[#00a884]">
                            <p className="text-[10px] text-[#00a884] font-semibold mb-0.5">Quoted message</p>
                            <p className="text-[11px] text-[#8696a0] leading-relaxed line-clamp-2">{quotedLines.join(' ')}</p>
                          </div>
                        )}
                        {msg.subject && <p className="text-[10px] font-semibold mb-1" style={{ color: '#53bdeb' }}>{msg.subject}</p>}
                        <p className="text-sm text-white leading-relaxed whitespace-pre-wrap break-words">{mainContent || msg.content}</p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[10px] text-[#8696a0]">{format(new Date(msg.createdAt), 'h:mm a')}</span>
                          {isMe && (msg.read ? <CheckCheck className="w-3 h-3 text-[#53bdeb]" /> : <CheckCheck className="w-3 h-3 text-[#8696a0]" />)}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="flex-shrink-0 px-4 py-3 flex flex-col gap-2" style={{ background: '#202c33' }}>
              {replyingTo && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: '#2a3942' }}>
                  <div className="flex-1 border-l-2 border-[#00a884] pl-2">
                    <p className="text-[10px] text-[#00a884] font-semibold">Replying to</p>
                    <p className="text-xs text-[#8696a0] line-clamp-1">{replyingTo.content}</p>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="text-[#8696a0] hover:text-white"><X className="w-4 h-4" /></button>
                </div>
              )}
              <div className="flex items-end gap-3 relative">
                {showEmoji && (
                  <EmojiPicker onSelect={e => { setReplyText(prev => prev + e); setShowEmoji(false); inputRef.current?.focus(); }} onClose={() => setShowEmoji(false)} />
                )}
                <button onClick={() => setShowEmoji(v => !v)} className="text-[#aebac1] hover:text-[#00a884] transition-colors flex-shrink-0"><Smile className="w-5 h-5" /></button>
                <div className="flex-1 rounded-lg px-4 py-2 flex flex-col gap-1" style={{ background: '#2a3942' }}>
                  <input value={replySubject} onChange={e => setReplySubject(e.target.value)} placeholder="Subject (optional)..."
                    className="bg-transparent text-xs text-[#8696a0] placeholder-[#8696a0] outline-none border-b border-[#3b4a54] pb-1" />
                  <textarea ref={inputRef} value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder="Type a message" rows={1} className="bg-transparent text-sm text-white placeholder-[#8696a0] outline-none resize-none" style={{ maxHeight: 120 }} />
                </div>
                <button onClick={insertMention} className="text-[#aebac1] hover:text-[#00a884] transition-colors flex-shrink-0" title="Mention"><AtSign className="w-5 h-5" /></button>
                <button onClick={handleQuickReply} disabled={replySending || !replyText.trim()}
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-50"
                  style={{ background: replyText.trim() ? '#00a884' : '#2a3942' }}>
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>

        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 select-none">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#202c33' }}>
              <MessageSquare className="w-10 h-10 text-[#00a884]" />
            </div>
            <div className="text-center">
              <p className="text-white text-xl font-light mb-1">Manager Messages</p>
              <p className="text-[#8696a0] text-sm">Select a conversation or start a new one</p>
            </div>
            <button onClick={() => { setShowCompose(true); setComposeRecipients([]); setRecipientSearch(''); setComposeSubject(''); setComposeContent(''); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-black"
              style={{ background: '#00a884' }}>
              <Plus className="w-4 h-4" /> New Message
            </button>
          </div>
        )}
      </div>
    </div>
  );
}