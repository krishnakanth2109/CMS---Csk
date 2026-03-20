import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Send, Search, Plus, X, Check, Reply, Trash2, Smile,
  Hash, Lock, Megaphone, Users, Settings, ChevronDown, ChevronRight,
  Edit2, MessageSquare, Shield, Crown, Loader2, AlertCircle, Pin,
  MessageCircle, AtSign
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import io from 'socket.io-client';

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const API_URL  = `${BASE_URL}/api`;

const getAuthHeader = () => {
  try {
    const s = sessionStorage.getItem('currentUser');
    const t = s ? JSON.parse(s)?.idToken : null;
    return { Authorization: `Bearer ${t || ''}`, 'Content-Type': 'application/json' };
  } catch { return { 'Content-Type': 'application/json' }; }
};

const getCurrentUser = () => {
  try { const s = sessionStorage.getItem('currentUser'); return s ? JSON.parse(s) : null; }
  catch { return null; }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const buildName = (u) => {
  if (!u) return null;
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || u.email || null;
};

const fmtFull = (d) => {
  try { return format(new Date(d), 'MMM d, h:mm a'); }
  catch { return ''; }
};

const fmtTime = (d) => {
  try {
    const dt = new Date(d);
    if (isToday(dt))     return format(dt, 'h:mm a');
    if (isYesterday(dt)) return 'Yesterday';
    return format(dt, 'MMM d');
  } catch { return ''; }
};

// Deterministic color from a string — ash-safe palette
const colorOf = (name) => {
  const p = ['#6366f1','#8b5cf6','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899','#14b8a6'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return p[Math.abs(h) % p.length];
};

const CHANNEL_COLORS = {
  blue:   'bg-blue-500',   purple: 'bg-purple-500', green:  'bg-emerald-500',
  orange: 'bg-orange-500', pink:   'bg-pink-500',   teal:   'bg-teal-500',
  red:    'bg-red-500',    indigo: 'bg-indigo-500',
};

const EMOJIS = ['😀','😂','😍','👍','❤️','🔥','🎉','✅','⚡','💯','🙏','😊','👋','💪','🎯','📌','📝','💡','⭐','🚀','😎','🤔','😅','🤝','📎'];

// ── Avatar ─────────────────────────────────────────────────────────────────────
const Avatar = ({ name, size = 'md', src, online = false }) => {
  const sz = { xs: 'w-6 h-6 text-[10px]', sm: 'w-8 h-8 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base' };
  const bg = colorOf(name || 'U');
  return (
    <div className="relative flex-shrink-0">
      <div className={`${sz[size]} rounded-full flex items-center justify-center text-white font-bold overflow-hidden select-none`}
        style={{ background: bg }}>
        {src ? <img src={src} className="w-full h-full object-cover" alt="" /> : (name || 'U')[0].toUpperCase()}
      </div>
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full" />
      )}
    </div>
  );
};

// ── Channel Icon ───────────────────────────────────────────────────────────────
const ChannelIcon = ({ type, size = 4 }) => {
  const cls = `w-${size} h-${size}`;
  if (type === 'private')      return <Lock className={cls} />;
  if (type === 'announcement') return <Megaphone className={cls} />;
  return <Hash className={cls} />;
};

// ── Emoji Picker ───────────────────────────────────────────────────────────────
const EmojiPicker = ({ onSelect, onClose }) => {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={ref} className="absolute bottom-14 left-0 z-50 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 w-72">
      <div className="grid grid-cols-10 gap-0.5">
        {EMOJIS.map(e => (
          <button key={e} onClick={() => onSelect(e)}
            className="text-lg hover:bg-slate-100 rounded p-1 transition-colors">{e}</button>
        ))}
      </div>
    </div>
  );
};

// ── DM Modal — start a direct conversation ────────────────────────────────────
const NewDMModal = ({ allUsers, myId, existingDMIds, onStart, onClose }) => {
  const [search, setSearch] = useState('');
  const available = allUsers.filter(u => {
    const id = (u._id || u.id).toString();
    if (id === myId) return false;
    const n = buildName(u)?.toLowerCase() || '';
    return n.includes(search.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">New Direct Message</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} autoFocus
              placeholder="Search by name..."
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none" />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {available.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-400">No users found</div>
          )}
          {available.map(u => {
            const id  = (u._id || u.id).toString();
            const n   = buildName(u) || 'User';
            const has = existingDMIds.includes(id);
            return (
              <button key={id} onClick={() => { onStart(u); onClose(); }}
                className="flex items-center gap-3 w-full px-5 py-3 hover:bg-slate-50 transition-colors text-left">
                <Avatar name={n} size="sm" online />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{n}</p>
                  <p className="text-[11px] text-slate-400 capitalize">{u.role}</p>
                </div>
                {has && <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Open</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Create / Edit Channel Modal ────────────────────────────────────────────────
const ChannelModal = ({ initial, allUsers, currentUserId, onSave, onClose }) => {
  const isEdit = !!initial?._id;
  const [name,      setName]      = useState(initial?.name || '');
  const [desc,      setDesc]      = useState(initial?.description || '');
  const [type,      setType]      = useState(initial?.type || 'public');
  const [color,     setColor]     = useState(initial?.color || 'blue');
  const [canPost,   setCanPost]   = useState(initial?.canPost || 'all');
  const [memberIds, setMemberIds] = useState(
    initial?.members?.map(m => (m._id || m).toString()) || []
  );
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const filteredUsers = allUsers.filter(u => {
    const n = buildName(u)?.toLowerCase() || '';
    return n.includes(search.toLowerCase()) && (u._id || u.id).toString() !== currentUserId;
  });

  const toggleMember = (id) =>
    setMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSave = async () => {
    if (!name.trim()) { setErr('Channel name is required'); return; }
    setSaving(true);
    try { await onSave({ name, description: desc, type, color, canPost, memberIds }); onClose(); }
    catch (e) { setErr(e.message || 'Failed to save'); }
    finally   { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">{isEdit ? 'Edit Channel' : 'Create Channel'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {err && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{err}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Channel Name *</label>
            <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-transparent bg-white">
              <ChannelIcon type={type} size={4} />
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. general, hiring-updates"
                className="flex-1 text-sm outline-none text-slate-800 placeholder-slate-400" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              placeholder="What's this channel for?"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none placeholder-slate-400 bg-white" />
          </div>

          {/* Type + Color */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Type</label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white text-slate-700">
                <option value="public">🌐 Public</option>
                <option value="private">🔒 Private</option>
                <option value="announcement">📢 Announcement</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Color</label>
              <div className="flex gap-1.5 flex-wrap mt-1.5">
                {Object.entries(CHANNEL_COLORS).map(([k, v]) => (
                  <button key={k} onClick={() => setColor(k)}
                    className={`w-6 h-6 rounded-full ${v} transition-transform ${color === k ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : 'hover:scale-110'}`} />
                ))}
              </div>
            </div>
          </div>

          {/* Post permission */}
          {type === 'announcement' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Who can post?</label>
              <select value={canPost} onChange={e => setCanPost(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white text-slate-700">
                <option value="all">Everyone</option>
                <option value="admin_manager">Admins & Managers only</option>
              </select>
            </div>
          )}

          {/* Members */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Members <span className="font-normal text-slate-400">({memberIds.length} selected)</span>
            </label>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50">
                <Search className="w-4 h-4 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search people..."
                  className="flex-1 text-sm outline-none bg-transparent placeholder-slate-400 text-slate-700" />
              </div>
              <div className="max-h-44 overflow-y-auto">
                {filteredUsers.map(u => {
                  const id  = (u._id || u.id).toString();
                  const n   = buildName(u) || 'User';
                  const sel = memberIds.includes(id);
                  return (
                    <button key={id} onClick={() => toggleMember(id)}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 transition-colors text-left ${sel ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                      <Avatar name={n} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{n}</div>
                        <div className="text-[11px] text-slate-400 capitalize">{u.role}</div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
                        ${sel ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                        {sel && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-slate-400">No users found</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Channel'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function TeamsChat({ role: roleProp }) {
  const currentUser = getCurrentUser();
  const myId   = currentUser?.id || currentUser?._id || '';
  const myName = buildName(currentUser) || 'You';
  const role   = roleProp || currentUser?.role || 'recruiter';
  const canManage = role === 'admin' || role === 'manager';

  // ── State ──────────────────────────────────────────────────────────────────
  const [channels,        setChannels]        = useState([]);
  const [dms,             setDms]             = useState([]);      // { id, name, role, messages[] }
  const [allUsers,        setAllUsers]        = useState([]);
  const [messages,        setMessages]        = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [activeDMId,      setActiveDMId]      = useState(null);   // userId of DM partner
  const [loading,         setLoading]         = useState(true);
  const [msgLoading,      setMsgLoading]      = useState(false);
  const [sending,         setSending]         = useState(false);

  const [text,       setText]       = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmoji,  setShowEmoji]  = useState(false);

  const [sidebarSearch,     setSidebarSearch]     = useState('');
  const [showCreateModal,   setShowCreateModal]   = useState(false);
  const [editingChannel,    setEditingChannel]    = useState(null);
  const [showNewDM,         setShowNewDM]         = useState(false);
  const [channelsPanelOpen, setChannelsPanelOpen] = useState(true);
  const [dmsPanelOpen,      setDmsPanelOpen]      = useState(true);

  const [contextMenu,  setContextMenu]  = useState(null);
  const [deleteConfirm,setDeleteConfirm]= useState(null);
  const [showMembers,  setShowMembers]  = useState(false);

  const socketRef  = useRef(null);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  // ── Derived active objects ─────────────────────────────────────────────────
  const activeChannel = useMemo(
    () => channels.find(c => c._id === activeChannelId) || null,
    [channels, activeChannelId]
  );
  const activeDM = useMemo(
    () => dms.find(d => d.id === activeDMId) || null,
    [dms, activeDMId]
  );

  // ── Header info for current view ──────────────────────────────────────────
  const headerInfo = useMemo(() => {
    if (activeChannel) return {
      name: activeChannel.name,
      desc: activeChannel.description,
      type: activeChannel.type,
      color: CHANNEL_COLORS[activeChannel.color] || 'bg-blue-500',
      memberCount: activeChannel.members?.length || 0,
      isDM: false,
    };
    if (activeDM) return {
      name: activeDM.name,
      desc: activeDM.role ? activeDM.role.charAt(0).toUpperCase() + activeDM.role.slice(1) : '',
      type: 'dm',
      color: '',
      memberCount: 2,
      isDM: true,
    };
    return null;
  }, [activeChannel, activeDM]);

  // ── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    socketRef.current = io(BASE_URL);
    socketRef.current.emit('join_room', myId);

    // Channel messages
    socketRef.current.on('channel_message', (msg) => {
      if (msg.channelId === activeChannelId) {
        setMessages(prev => prev.find(m => m._id === msg._id) ? prev : [...prev, msg]);
      }
      setChannels(prev => prev.map(ch =>
        ch._id === msg.channelId
          ? { ...ch, lastMessage: msg.content, lastMessageAt: msg.createdAt }
          : ch
      ));
    });

    // DM messages (via legacy receive_message)
    socketRef.current.on('receive_message', (msg) => {
      const partnerId = msg.from === myId ? msg.to : msg.from;
      // Add to DM thread if open
      if (activeDMId && (partnerId === activeDMId || msg.from === activeDMId)) {
        setMessages(prev => prev.find(m => m._id === msg._id) ? prev : [...prev, msg]);
      }
      // Update DM sidebar preview
      setDms(prev => {
        const exists = prev.find(d => d.id === partnerId);
        if (exists) {
          return prev.map(d => d.id === partnerId
            ? { ...d, lastMessage: msg.content, lastMessageAt: msg.createdAt, unread: d.id !== activeDMId ? (d.unread || 0) + 1 : 0 }
            : d
          );
        }
        return prev;
      });
    });

    socketRef.current.on('channel_created', (ch) => {
      setChannels(prev => prev.find(c => c._id === ch._id) ? prev : [ch, ...prev]);
    });
    socketRef.current.on('channel_updated', (ch) => {
      setChannels(prev => prev.map(c => c._id === ch._id ? ch : c));
    });
    socketRef.current.on('channel_deleted', ({ id }) => {
      setChannels(prev => prev.filter(c => c._id !== id));
      if (activeChannelId === id) setActiveChannelId(null);
    });

    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, [myId, activeChannelId, activeDMId]);

  // ── Fetch initial data ────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [chRes, usrRes, msgRes] = await Promise.all([
          fetch(`${API_URL}/channels`,            { headers: getAuthHeader() }),
          fetch(`${API_URL}/recruiters`,           { headers: getAuthHeader() }),
          fetch(`${API_URL}/messages`,             { headers: getAuthHeader() }),
        ]);
        if (chRes.ok)  setChannels(await chRes.json());
        if (usrRes.ok) {
          const users = await usrRes.json();
          setAllUsers(Array.isArray(users) ? users : []);
        }
        // Build DM list from legacy messages
        if (msgRes.ok) {
          const msgs = await msgRes.json();
          buildDMList(msgs);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  // Build DM sidebar entries from message history
  const buildDMList = (msgs) => {
    const map = new Map();
    msgs.forEach(m => {
      if (m.channelId) return; // skip channel messages
      const otherId   = m.from === myId ? m.to : m.from;
      const otherName = m.from === myId ? (m.toName || otherId) : (m.fromName || otherId);
      if (!otherId || otherId === myId || otherId === 'all') return;
      if (!map.has(otherId)) {
        map.set(otherId, { id: otherId, name: otherName, lastMessage: m.content, lastMessageAt: m.createdAt, unread: 0, messages: [] });
      } else {
        const cur = map.get(otherId);
        if (new Date(m.createdAt) > new Date(cur.lastMessageAt)) {
          cur.lastMessage = m.content;
          cur.lastMessageAt = m.createdAt;
        }
      }
      if (m.to === myId && !m.read) map.get(otherId).unread++;
    });
    setDms(Array.from(map.values()).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)));
  };

  // ── Load channel messages ─────────────────────────────────────────────────
  useEffect(() => {
    if (!activeChannelId) return;
    setActiveDMId(null);
    const load = async () => {
      setMsgLoading(true);
      try {
        const res = await fetch(`${API_URL}/channels/${activeChannelId}/messages`, { headers: getAuthHeader() });
        if (res.ok) setMessages(await res.json());
        if (socketRef.current) socketRef.current.emit('join_room', `channel_${activeChannelId}`);
      } catch (e) { console.error(e); }
      finally { setMsgLoading(false); }
    };
    load();
  }, [activeChannelId]);

  // ── Load DM messages ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeDMId) return;
    setActiveChannelId(null);
    const load = async () => {
      setMsgLoading(true);
      try {
        const res = await fetch(`${API_URL}/messages`, { headers: getAuthHeader() });
        if (res.ok) {
          const all = await res.json();
          const thread = all.filter(m =>
            !m.channelId && (
              (m.from === myId && m.to === activeDMId) ||
              (m.from === activeDMId && m.to === myId)
            )
          ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          setMessages(thread);
          // Clear unread
          setDms(prev => prev.map(d => d.id === activeDMId ? { ...d, unread: 0 } : d));
        }
      } catch (e) { console.error(e); }
      finally { setMsgLoading(false); }
    };
    load();
  }, [activeDMId, myId]);

  // ── Auto scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChannelId, activeDMId]);

  // ── Close context menu ────────────────────────────────────────────────────
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('click', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('click', close); };
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!text.trim()) return;
    if (!activeChannelId && !activeDMId) return;
    setSending(true);

    const optimisticId = `opt_${Date.now()}`;
    const isChannel = !!activeChannelId;

    // Optimistic message
    const optimistic = isChannel
      ? { _id: optimisticId, channelId: activeChannelId, senderId: myId, senderName: myName,
          content: text.trim(), type: 'text', replyTo: replyingTo?._id || null,
          replyPreview: replyingTo?.content?.slice(0, 60) || '',
          createdAt: new Date().toISOString(), _optimistic: true }
      : { _id: optimisticId, from: myId, to: activeDMId, content: text.trim(),
          fromName: myName, createdAt: new Date().toISOString(), _optimistic: true };

    setMessages(prev => [...prev, optimistic]);
    const sentText = text.trim();
    setText('');
    setReplyingTo(null);

    try {
      let saved;
      if (isChannel) {
        const res = await fetch(`${API_URL}/channels/${activeChannelId}/messages`, {
          method: 'POST', headers: getAuthHeader(),
          body: JSON.stringify({ content: sentText, replyTo: replyingTo?._id || null, replyPreview: replyingTo?.content?.slice(0, 60) || '' }),
        });
        if (!res.ok) throw new Error('Send failed');
        saved = await res.json();
        if (socketRef.current) socketRef.current.emit('channel_message', { ...saved, to: `channel_${activeChannelId}` });
        setChannels(prev => prev.map(ch =>
          ch._id === activeChannelId ? { ...ch, lastMessage: saved.content, lastMessageAt: saved.createdAt } : ch
        ));
      } else {
        // DM via legacy messages endpoint
        const res = await fetch(`${API_URL}/messages`, {
          method: 'POST', headers: getAuthHeader(),
          body: JSON.stringify({ to: activeDMId, subject: 'Direct Message', content: sentText }),
        });
        if (!res.ok) throw new Error('Send failed');
        saved = await res.json();
        if (socketRef.current) socketRef.current.emit('send_message', { ...saved, to: activeDMId });
        setDms(prev => prev.map(d =>
          d.id === activeDMId ? { ...d, lastMessage: sentText, lastMessageAt: saved.createdAt } : d
        ));
      }
      setMessages(prev => prev.map(m => m._id === optimisticId ? saved : m));
    } catch {
      setMessages(prev => prev.filter(m => m._id !== optimisticId));
      setText(sentText);
    } finally {
      setSending(false);
    }
  }, [text, activeChannelId, activeDMId, myId, myName, replyingTo]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Start a new DM ────────────────────────────────────────────────────────
  const handleStartDM = (user) => {
    const id = (user._id || user.id).toString();
    const n  = buildName(user) || 'User';
    setDms(prev => {
      const exists = prev.find(d => d.id === id);
      if (!exists) {
        return [{ id, name: n, role: user.role, lastMessage: '', lastMessageAt: new Date().toISOString(), unread: 0 }, ...prev];
      }
      return prev;
    });
    setActiveDMId(id);
  };

  // ── Delete message ────────────────────────────────────────────────────────
  const handleDeleteMsg = async (id) => {
    try {
      if (activeChannelId) {
        await fetch(`${API_URL}/channels/${activeChannelId}/messages/${id}`, {
          method: 'DELETE', headers: getAuthHeader(),
        });
        setMessages(prev => prev.map(m =>
          m._id === id ? { ...m, deletedAt: new Date().toISOString(), content: 'This message was deleted' } : m
        ));
      } else {
        await fetch(`${API_URL}/messages/${id}`, { method: 'DELETE', headers: getAuthHeader() });
        setMessages(prev => prev.filter(m => m._id !== id));
      }
    } catch (e) { console.error(e); }
    setDeleteConfirm(null);
  };

  const handleCreateChannel = async (data) => {
    const res = await fetch(`${API_URL}/channels`, {
      method: 'POST', headers: getAuthHeader(), body: JSON.stringify(data),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    const ch = await res.json();
    setChannels(prev => [ch, ...prev]);
    setActiveChannelId(ch._id);
    if (socketRef.current) socketRef.current.emit('channel_created', ch);
  };

  const handleEditChannel = async (data) => {
    const res = await fetch(`${API_URL}/channels/${editingChannel._id}`, {
      method: 'PUT', headers: getAuthHeader(), body: JSON.stringify(data),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    const updated = await res.json();
    setChannels(prev => prev.map(c => c._id === updated._id ? updated : c));
    if (socketRef.current) socketRef.current.emit('channel_updated', updated);
  };

  const handleDeleteChannel = async (id) => {
    if (!confirm('Delete this channel and all its messages? This cannot be undone.')) return;
    const res = await fetch(`${API_URL}/channels/${id}`, { method: 'DELETE', headers: getAuthHeader() });
    if (res.ok) {
      setChannels(prev => prev.filter(c => c._id !== id));
      if (activeChannelId === id) { setActiveChannelId(null); setMessages([]); }
      if (socketRef.current) socketRef.current.emit('channel_deleted', { id });
    }
  };

  const handleContextMenu = (e, msg) => {
    e.preventDefault(); e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 180);
    setContextMenu({ x, y, msg });
  };

  // ── Derived helpers ────────────────────────────────────────────────────────
  const filteredChannels = channels.filter(ch =>
    ch.name.toLowerCase().includes(sidebarSearch.toLowerCase())
  );
  const filteredDMs = dms.filter(d =>
    d.name.toLowerCase().includes(sidebarSearch.toLowerCase())
  );

  const isOwner   = (msg) => (msg.senderId?.toString() === myId) || (msg.from === myId);
  const canDelete = (msg) => canManage || isOwner(msg);
  const canPost   = (ch)  => !ch || ch.canPost !== 'admin_manager' || canManage;

  const totalUnread = dms.reduce((s, d) => s + (d.unread || 0), 0);

  const channelMembers = useMemo(() => {
    if (!activeChannel) return [];
    return (activeChannel.members || []).map(m => {
      const user = allUsers.find(u => (u._id || u.id).toString() === (m._id || m).toString());
      return user || m;
    });
  }, [activeChannel, allUsers]);

  const groupedMessages = useMemo(() => {
    const groups = [];
    let currentDate = null;
    messages.forEach(msg => {
      const d = format(new Date(msg.createdAt), 'yyyy-MM-dd');
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ type: 'date', date: msg.createdAt, id: `date_${d}` });
      }
      groups.push({ type: 'msg', msg });
    });
    return groups;
  }, [messages]);

  const existingDMIds = dms.map(d => d.id);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center animate-pulse">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <p className="text-sm text-slate-400 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <ChannelModal allUsers={allUsers} currentUserId={myId}
          onSave={handleCreateChannel} onClose={() => setShowCreateModal(false)} />
      )}
      {editingChannel && (
        <ChannelModal initial={editingChannel} allUsers={allUsers} currentUserId={myId}
          onSave={handleEditChannel} onClose={() => setEditingChannel(null)} />
      )}
      {showNewDM && (
        <NewDMModal allUsers={allUsers} myId={myId} existingDMIds={existingDMIds}
          onStart={handleStartDM} onClose={() => setShowNewDM(false)} />
      )}

      {/* Delete confirm dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Delete message?</p>
                <p className="text-sm text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDeleteMsg(deleteConfirm)}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 1000 }}
          className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden min-w-[160px] py-1"
          onClick={e => e.stopPropagation()}>
          <button onClick={() => { setReplyingTo(contextMenu.msg); inputRef.current?.focus(); setContextMenu(null); }}
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
            <Reply className="w-4 h-4 text-slate-400" /> Reply
          </button>
          {canDelete(contextMenu.msg) && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button onClick={() => { setDeleteConfirm(contextMenu.msg._id); setContextMenu(null); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          LEFT SIDEBAR — ash theme
      ════════════════════════════════════════════════════════════════════ */}
      <div className="w-64 flex-shrink-0 flex flex-col bg-slate-100 border-r border-slate-200">

        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 leading-none">Team Chat</p>
                <p className="text-[11px] text-slate-400 mt-0.5 capitalize">{role}</p>
              </div>
            </div>
            {canManage && (
              <button onClick={() => setShowCreateModal(true)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors text-slate-500 hover:text-slate-700"
                title="Create channel">
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Me chip */}
        <div className="px-3 py-2.5 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
            <Avatar name={myName} size="sm" online />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-700 truncate leading-none">{myName}</p>
              <p className="text-[11px] text-slate-400 capitalize mt-0.5">{role}</p>
            </div>
            {canManage && <Shield className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" title="Admin / Manager" />}
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 border border-slate-200">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input value={sidebarSearch} onChange={e => setSidebarSearch(e.target.value)}
              placeholder="Search..."
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none" />
            {sidebarSearch && (
              <button onClick={() => setSidebarSearch('')} className="text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-2">

          {/* ── Channels Section ── */}
          <div className="px-3 mb-1">
            <button onClick={() => setChannelsPanelOpen(v => !v)}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors w-full">
              {channelsPanelOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Channels
              <span className="ml-1 text-[10px] font-normal normal-case text-slate-400">{filteredChannels.length}</span>
            </button>
          </div>

          {channelsPanelOpen && (
            <div className="space-y-0.5 px-2 mb-3">
              {filteredChannels.length === 0 ? (
                <div className="px-3 py-3 text-center">
                  <Hash className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                  <p className="text-xs text-slate-400">{canManage ? 'Create your first channel' : 'No channels yet'}</p>
                </div>
              ) : filteredChannels.map(ch => {
                const isActive = ch._id === activeChannelId;
                const colorCls = CHANNEL_COLORS[ch.color] || 'bg-blue-500';
                return (
                  <div key={ch._id}
                    className={`group relative flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-all
                      ${isActive ? 'bg-white shadow-sm border border-slate-200' : 'hover:bg-white/60'}`}
                    onClick={() => { setActiveChannelId(ch._id); setActiveDMId(null); }}>
                    <div className={`w-7 h-7 ${colorCls} rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <ChannelIcon type={ch.type} size={3} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className={`text-sm truncate ${isActive ? 'text-slate-800 font-semibold' : 'text-slate-600 font-medium'}`}>
                          {ch.name}
                        </span>
                        {ch.pinned && <Pin className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />}
                      </div>
                      {ch.lastMessage && (
                        <p className="text-[11px] text-slate-400 truncate">{ch.lastMessage}</p>
                      )}
                    </div>
                    {canManage && (
                      <div className="hidden group-hover:flex items-center gap-0.5 absolute right-2 bg-white rounded-lg border border-slate-200 shadow-sm px-0.5">
                        <button onClick={e => { e.stopPropagation(); setEditingChannel(ch); }}
                          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleDeleteChannel(ch._id); }}
                          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {canManage && (
                <button onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 w-full px-2.5 py-1.5 text-slate-400 hover:text-slate-600 hover:bg-white/60 rounded-xl transition-colors text-xs">
                  <div className="w-4 h-4 border border-dashed border-slate-300 rounded flex items-center justify-center">
                    <Plus className="w-2.5 h-2.5" />
                  </div>
                  Add a channel
                </button>
              )}
            </div>
          )}

          {/* ── Direct Messages Section ── */}
          <div className="px-3 mb-1">
            <div className="flex items-center justify-between">
              <button onClick={() => setDmsPanelOpen(v => !v)}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors">
                {dmsPanelOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Direct Messages
                {totalUnread > 0 && (
                  <span className="ml-1 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {totalUnread}
                  </span>
                )}
              </button>
              <button onClick={() => setShowNewDM(true)}
                className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-slate-200 transition-colors"
                title="New direct message">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {dmsPanelOpen && (
            <div className="space-y-0.5 px-2">
              {filteredDMs.length === 0 ? (
                <div className="px-3 py-3 text-center">
                  <MessageCircle className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                  <p className="text-xs text-slate-400">No direct messages yet</p>
                  <button onClick={() => setShowNewDM(true)}
                    className="text-xs text-blue-500 hover:text-blue-600 font-medium mt-1 transition-colors">
                    Start a conversation
                  </button>
                </div>
              ) : filteredDMs.map(dm => {
                const isActive = dm.id === activeDMId;
                return (
                  <div key={dm.id}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-all
                      ${isActive ? 'bg-white shadow-sm border border-slate-200' : 'hover:bg-white/60'}`}
                    onClick={() => { setActiveDMId(dm.id); setActiveChannelId(null); }}>
                    <Avatar name={dm.name} size="sm" online />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-sm truncate ${isActive ? 'text-slate-800 font-semibold' : 'text-slate-600 font-medium'}`}>
                          {dm.name}
                        </span>
                        {dm.unread > 0 && (
                          <span className="flex-shrink-0 bg-blue-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                            {dm.unread > 9 ? '9+' : dm.unread}
                          </span>
                        )}
                      </div>
                      {dm.lastMessage && (
                        <p className={`text-[11px] truncate ${dm.unread > 0 ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                          {dm.lastMessage}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              <button onClick={() => setShowNewDM(true)}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 text-slate-400 hover:text-slate-600 hover:bg-white/60 rounded-xl transition-colors text-xs">
                <div className="w-4 h-4 border border-dashed border-slate-300 rounded flex items-center justify-center">
                  <Plus className="w-2.5 h-2.5" />
                </div>
                New message
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MAIN CHAT AREA
      ════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">

        {headerInfo ? (
          <>
            {/* Chat Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200">
              <div className="flex items-center gap-3">
                {headerInfo.isDM ? (
                  <Avatar name={headerInfo.name} size="md" online />
                ) : (
                  <div className={`w-9 h-9 ${headerInfo.color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <ChannelIcon type={headerInfo.type} size={4} />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-800">{headerInfo.name}</h2>
                    {headerInfo.type === 'private' && (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium border border-slate-200">Private</span>
                    )}
                    {headerInfo.type === 'announcement' && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium border border-amber-200">Announcements</span>
                    )}
                    {headerInfo.isDM && (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium border border-slate-200">Direct Message</span>
                    )}
                  </div>
                  {headerInfo.desc && (
                    <p className="text-xs text-slate-400 mt-0.5 leading-none">{headerInfo.desc}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {!headerInfo.isDM && (
                  <button onClick={() => setShowMembers(v => !v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border
                      ${showMembers ? 'bg-blue-50 text-blue-700 border-blue-200' : 'text-slate-500 hover:bg-slate-100 border-transparent'}`}>
                    <Users className="w-4 h-4" />
                    <span>{headerInfo.memberCount}</span>
                  </button>
                )}
                {canManage && activeChannel && (
                  <button onClick={() => setEditingChannel(activeChannel)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors border border-transparent hover:border-slate-200"
                    title="Channel settings">
                    <Settings className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Messages */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar" style={{ background: '#f8f9fb' }}>
                  {msgLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
                      {headerInfo.isDM ? (
                        <>
                          <Avatar name={headerInfo.name} size="lg" />
                          <div className="text-center">
                            <p className="font-bold text-slate-800 text-lg">{headerInfo.name}</p>
                            <p className="text-slate-400 text-sm mt-1">This is the beginning of your conversation.</p>
                            <p className="text-slate-400 text-sm">Say hi! 👋</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={`w-14 h-14 ${headerInfo.color} rounded-2xl flex items-center justify-center`}>
                            <ChannelIcon type={headerInfo.type} size={7} />
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-slate-800 text-lg">#{headerInfo.name}</p>
                            {activeChannel?.description && (
                              <p className="text-slate-400 text-sm mt-1">{activeChannel.description}</p>
                            )}
                            <p className="text-slate-400 text-sm mt-1">
                              {canPost(activeChannel)
                                ? 'Be the first to send a message!'
                                : 'Only admins & managers can post here.'}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {groupedMessages.map((item) => {
                        if (item.type === 'date') {
                          const lbl = isToday(new Date(item.date)) ? 'Today'
                            : isYesterday(new Date(item.date)) ? 'Yesterday'
                            : format(new Date(item.date), 'MMMM d, yyyy');
                          return (
                            <div key={item.id} className="flex items-center gap-3 py-3">
                              <div className="flex-1 h-px bg-slate-200" />
                              <span className="text-xs text-slate-400 font-medium px-3 py-1 bg-white rounded-full border border-slate-200 whitespace-nowrap shadow-sm">{lbl}</span>
                              <div className="flex-1 h-px bg-slate-200" />
                            </div>
                          );
                        }

                        const { msg } = item;
                        const isMine   = isOwner(msg);
                        const isDeleted = !!msg.deletedAt;
                        const isSystem  = msg.type === 'system';
                        const senderN   = msg.senderName || (isMine ? myName : (msg.fromName || 'Unknown'));
                        const senderCol = colorOf(senderN);

                        if (isSystem) {
                          return (
                            <div key={msg._id} className="flex items-center justify-center py-2">
                              <span className="text-[11px] text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">{msg.content}</span>
                            </div>
                          );
                        }

                        return (
                          <div key={msg._id}
                            className={`group flex items-start gap-3 px-2 py-1.5 rounded-xl transition-colors
                              ${isDeleted ? 'opacity-50' : 'hover:bg-white hover:shadow-sm'}
                              ${msg._optimistic ? 'opacity-60' : ''}`}
                            onContextMenu={isDeleted ? undefined : (e) => handleContextMenu(e, msg)}>
                            <Avatar name={senderN} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 mb-0.5">
                                <span className="text-sm font-semibold" style={{ color: isMine ? '#2563eb' : senderCol }}>
                                  {isMine ? 'You' : senderN}
                                </span>
                                <span className="text-[11px] text-slate-400">{fmtFull(msg.createdAt)}</span>
                                {msg._optimistic && <span className="text-[10px] text-slate-400 italic">sending…</span>}
                              </div>

                              {/* Reply preview */}
                              {msg.replyPreview && (
                                <div className="mb-1.5 pl-3 border-l-2 border-blue-400 bg-blue-50 rounded-r-lg py-1 pr-2">
                                  <p className="text-[11px] text-blue-600 font-semibold mb-0.5">Replied to a message</p>
                                  <p className="text-xs text-slate-500 line-clamp-1">{msg.replyPreview}…</p>
                                </div>
                              )}

                              <p className={`text-sm leading-relaxed break-words whitespace-pre-wrap
                                ${isDeleted ? 'text-slate-400 italic' : 'text-slate-700'}`}>
                                {msg.content}
                              </p>
                            </div>

                            {/* Hover actions */}
                            {!isDeleted && (
                              <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0 bg-white border border-slate-200 rounded-xl shadow-sm px-1 py-0.5">
                                <button onClick={() => { setReplyingTo(msg); inputRef.current?.focus(); }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                  <Reply className="w-3.5 h-3.5" />
                                </button>
                                {canDelete(msg) && (
                                  <button onClick={() => setDeleteConfirm(msg._id)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </div>

                {/* Input area */}
                <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-slate-100">
                  {(headerInfo.isDM || canPost(activeChannel)) ? (
                    <>
                      {replyingTo && (
                        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl">
                          <div className="flex-1 border-l-2 border-blue-400 pl-2">
                            <p className="text-[11px] text-blue-700 font-semibold">
                              Replying to {replyingTo.senderName || (replyingTo.from === myId ? 'You' : 'User')}
                            </p>
                            <p className="text-xs text-slate-500 line-clamp-1">{replyingTo.content}</p>
                          </div>
                          <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-end gap-2 relative">
                        {showEmoji && (
                          <EmojiPicker
                            onSelect={e => { setText(p => p + e); setShowEmoji(false); inputRef.current?.focus(); }}
                            onClose={() => setShowEmoji(false)}
                          />
                        )}
                        <button onClick={() => setShowEmoji(v => !v)}
                          className={`flex-shrink-0 p-2 rounded-xl transition-colors ${showEmoji ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
                          <Smile className="w-5 h-5" />
                        </button>

                        <div className="flex-1 bg-slate-100 border border-slate-200 rounded-2xl px-4 py-2.5 flex items-end gap-2 focus-within:border-blue-300 focus-within:bg-white transition-colors">
                          <textarea
                            ref={inputRef}
                            value={text}
                            onChange={e => setText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={headerInfo.isDM
                              ? `Message ${headerInfo.name}`
                              : `Message #${headerInfo.name}`}
                            rows={1}
                            className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none resize-none leading-relaxed"
                            style={{ maxHeight: 120 }}
                          />
                        </div>

                        <button onClick={handleSend} disabled={!text.trim() || sending}
                          className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm
                            ${text.trim() ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <Megaphone className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <p className="text-sm text-amber-700">Only admins & managers can post in this announcement channel.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Members panel */}
              {showMembers && !headerInfo.isDM && (
                <div className="w-60 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col">
                  <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-700">Members ({channelMembers.length})</h3>
                    <button onClick={() => setShowMembers(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-0.5">
                    {channelMembers.map((m, i) => {
                      const n = buildName(m) || 'User';
                      const isCreator = (m._id || m.id || '').toString() === (activeChannel?.createdBy?._id || activeChannel?.createdBy || '').toString();
                      return (
                        <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                          <Avatar name={n} size="sm" online />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-slate-700 truncate">{n}</span>
                              {isCreator && <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                            </div>
                            <span className="text-[11px] text-slate-400 capitalize">{m.role}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty / welcome state */
          <div className="flex-1 flex flex-col items-center justify-center gap-5 select-none" style={{ background: '#f8f9fb' }}>
            <div className="w-20 h-20 bg-white border-2 border-slate-200 rounded-3xl flex items-center justify-center shadow-sm">
              <MessageSquare className="w-9 h-9 text-slate-400" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-700 mb-1">Team Chat</h2>
              <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                {canManage
                  ? 'Create a channel to start collaborating, or send a direct message.'
                  : 'Select a channel from the sidebar or send a direct message.'}
              </p>
            </div>
            <div className="flex gap-3">
              {canManage && (
                <button onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                  <Hash className="w-4 h-4" /> New Channel
                </button>
              )}
              <button onClick={() => setShowNewDM(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors border border-slate-200 shadow-sm">
                <MessageCircle className="w-4 h-4" /> Direct Message
              </button>
            </div>
            {channels.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center max-w-xs">
                {channels.slice(0, 4).map(ch => (
                  <button key={ch._id} onClick={() => setActiveChannelId(ch._id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all text-xs font-medium text-slate-600 shadow-sm">
                    <div className={`w-4 h-4 ${CHANNEL_COLORS[ch.color] || 'bg-blue-500'} rounded flex items-center justify-center`}>
                      <ChannelIcon type={ch.type} size={2} />
                    </div>
                    {ch.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.4); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.7); }
      `}</style>
    </div>
  );
}