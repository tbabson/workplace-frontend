import { Fragment, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Plus, MessageSquare, Trash2, ArrowLeft, Reply, Smile, X, MessageCircle, FolderKanban } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { chatApi } from '../../api/chat';
import { usersApi } from '../../api/users';
import { WS_URL } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import type { ChatMessage, ChatRoom, MessageReaction, User } from '../../types';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Modal } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Input';
import { PageSpinner } from '../../components/ui/Spinner';
import { apiError } from '../../utils/helpers';
import '../../utils/sound'; // registers global workplace:notification listener
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👎', '🔥', '✅'];

const ROOM_COLORS: Record<string, string> = {
  general:      'bg-blue-500',
  departmental: 'bg-purple-500',
  project:      'bg-indigo-500',
  direct:       'bg-green-500',
};

// The backend returns error text in `error`.
const apiMsg = apiError;

// WhatsApp-style day label for the divider above each day's messages.
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const withinWeek = today.getTime() - d.getTime() < 6 * 24 * 3600 * 1000;
  return withinWeek
    ? d.toLocaleDateString(undefined, { weekday: 'long' })
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

// Message time as shown on WhatsApp bubbles, e.g. "10:42".
function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// Project rooms are named "<project title> — Project Chat".
function projectTitleOf(room: ChatRoom): string {
  return room.name.replace(/ — Project Chat$/, '');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve a human-readable display name for a room.
 *  DM rooms are stored as "dm:<userA>:<userB>" — show the OTHER user's name. */
function roomDisplayName(room: ChatRoom, currentUserId: string, userMap: Map<string, string>): string {
  if (room.type === 'direct') {
    const parts = room.name.split(':'); // ['dm', idA, idB]
    if (parts.length === 3 && parts[0] === 'dm') {
      const otherId = parts[1] === currentUserId ? parts[2] : parts[1];
      return userMap.get(otherId) ?? 'Direct Message';
    }
  }
  return room.name;
}

// ── RoomItem ──────────────────────────────────────────────────────────────────

function RoomItem({ room, displayName, isSelected, unread, currentUserId, currentUserRole, onSelect, onDelete }: {
  room: ChatRoom;
  displayName: string;
  isSelected: boolean;
  unread: number;
  currentUserId: string;
  currentUserRole: string;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const canDelete = currentUserRole === 'super_admin' || room.created_by === currentUserId;
  return (
    <div className={`flex items-center border-b border-gray-50 group ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
      <button onClick={onSelect} className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0">
        <div className={`relative h-8 w-8 rounded-lg ${ROOM_COLORS[room.type] ?? 'bg-gray-500'} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
          {displayName.charAt(0).toUpperCase()}
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
          <p className="text-xs text-gray-400 capitalize">{room.type === 'direct' ? 'Direct Message' : room.type === 'project' ? 'Project chat' : room.type}</p>
        </div>
      </button>
      {canDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 p-1.5 mr-2 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all shrink-0"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Chat() {
  const { user, token } = useAuthStore();
  const qc = useQueryClient();

  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [message, setMessage]           = useState('');
  const [wsMessages, setWsMessages]     = useState<ChatMessage[]>([]);
  const [createModal, setCreateModal]   = useState(false);
  const [dmModal, setDmModal]           = useState(false);
  const [replyTo, setReplyTo]           = useState<ChatMessage | null>(null);
  const [reactions, setReactions]       = useState<Record<string, MessageReaction[]>>({});
  const [typing, setTyping]             = useState<Record<string, string>>({});
  const [unread, setUnread]             = useState<Record<string, number>>({});
  const [emojiFor, setEmojiFor]         = useState<string | null>(null);

  const wsRef        = useRef<WebSocket | null>(null);
  const bottomRef    = useRef<HTMLDivElement | null>(null);
  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const typingSentAt = useRef<number>(0);
  // Ref so WS callback can read latest users without stale closure
  const usersRef     = useRef<User[]>([]);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn: () => chatApi.listRooms().then((r) => r.data.data),
  });

  const { data: messages } = useQuery({
    queryKey: ['chat-messages', selectedRoom?.id],
    queryFn: () => chatApi.getMessages(selectedRoom!.id).then((r) => r.data.data),
    enabled: !!selectedRoom,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data.data),
  });

  // Keep ref in sync for WS callbacks (must not be read during render)
  useEffect(() => { usersRef.current = users ?? []; }, [users]);

  // getUserName reads from state (safe during render)
  const userMap     = useMemo(() => new Map((users ?? []).map((u) => [u.id, u.name])), [users]);
  const getUserName = useCallback((id: string) => userMap.get(id) ?? 'Unknown', [userMap]);

  // ── Fetch reactions for visible messages ───────────────────────────────────

  useEffect(() => {
    if (!messages?.length) return;
    Promise.all(
      messages.map((m) =>
        chatApi.getReactions(m.id).then((r) => ({ id: m.id, list: r.data.data ?? [] }))
      )
    ).then((results) => {
      setReactions((prev) => {
        const next = { ...prev };
        results.forEach(({ id, list }) => { next[id] = list; });
        return next;
      });
    });
  }, [messages]);

  // ── Select room (resets per-room state) ────────────────────────────────────

  const selectRoom = useCallback((room: ChatRoom | null) => {
    setSelectedRoom(room);
    setWsMessages([]);
    setReplyTo(null);
    setTyping({});
    if (room) {
      setUnread((prev) => { const n = { ...prev }; delete n[room.id]; return n; });
    }
  }, []);

  // Open the room named in ?room= (set when a chat notification is clicked), then
  // clear it so it doesn't override rooms the user picks afterwards.
  const [searchParams, setSearchParams] = useSearchParams();
  const roomParam = searchParams.get('room');
  const [handledRoomParam, setHandledRoomParam] = useState<string | null>(null);
  // Adjusting state while rendering (React's pattern for reacting to a changed
  // value) rather than in an effect, which would render twice.
  if (roomParam && rooms && roomParam !== handledRoomParam) {
    setHandledRoomParam(roomParam);
    const target = rooms.find((r) => r.id === roomParam);
    if (target) selectRoom(target);
  }
  if (!roomParam && handledRoomParam) setHandledRoomParam(null);
  useEffect(() => {
    if (!roomParam || !rooms || roomParam !== handledRoomParam) return;
    if (!rooms.some((r) => r.id === roomParam)) toast.error('That chat room is no longer available to you');
    setSearchParams({}, { replace: true });
  }, [roomParam, rooms, handledRoomParam, setSearchParams]);

  // ── WebSocket ──────────────────────────────────────────────────────────────

  const connectWs = useCallback((roomId: string) => {
    if (wsRef.current) wsRef.current.close();
    const url = `${WS_URL}/chat/ws/${roomId}${token ? `?token=${token}` : ''}`;
    const ws  = new WebSocket(url);

    ws.onmessage = (e) => {
      // WritePump may batch multiple JSON objects separated by newlines
      (e.data as string).split('\n').filter(Boolean).forEach((line) => {
        try {
          const ev = JSON.parse(line) as {
            type?: string; content?: string; sender_id?: string;
            room_id?: string; message_id?: string; reply_to_id?: string | null;
          };

          if (ev.type === 'typing') {
            if (!ev.sender_id || ev.sender_id === user?.id) return;
            const name = usersRef.current.find((u) => u.id === ev.sender_id)?.name ?? 'Someone';
            setTyping((prev) => ({ ...prev, [ev.sender_id!]: name }));
            clearTimeout(typingTimers.current[ev.sender_id]);
            typingTimers.current[ev.sender_id] = setTimeout(() => {
              setTyping((prev) => { const n = { ...prev }; delete n[ev.sender_id!]; return n; });
            }, 3000);
            return;
          }

          if (ev.type === 'message' || ev.content) {
            const chatMsg: ChatMessage = {
              id:          ev.message_id ?? String(Date.now()),
              room_id:     ev.room_id ?? roomId,
              sender_id:   ev.sender_id ?? '',
              content:     ev.content ?? '',
              reply_to_id: ev.reply_to_id ?? null,
              is_deleted:  false,
              created_at:  new Date().toISOString(),
            };
            if (!ev.room_id || ev.room_id === roomId) {
              setWsMessages((prev) => [...prev, chatMsg]);
              if (ev.sender_id && ev.sender_id !== user?.id) {
                window.dispatchEvent(new Event('workplace:notification'));
              }
            } else {
              setUnread((prev) => ({ ...prev, [ev.room_id!]: (prev[ev.room_id!] ?? 0) + 1 }));
              window.dispatchEvent(new Event('workplace:notification'));
            }
            // Re-sort the room list so the chat with the newest message is on top.
            qc.invalidateQueries({ queryKey: ['chat-rooms'] });
          }
        } catch { /* ignore malformed frame */ }
      });
    };

    wsRef.current = ws;
  }, [token, user, qc]);

  useEffect(() => {
    if (!selectedRoom) return;
    connectWs(selectedRoom.id);
    chatApi.markRead(selectedRoom.id).catch(() => {});
    return () => { wsRef.current?.close(); };
  }, [selectedRoom, connectWs]);

  // Like WhatsApp: open a chat at the newest message instantly, then glide down
  // smoothly as new messages arrive.
  const lastScrolledRoom = useRef<string | null>(null);
  useEffect(() => {
    const opening = lastScrolledRoom.current !== (selectedRoom?.id ?? null);
    lastScrolledRoom.current = selectedRoom?.id ?? null;
    bottomRef.current?.scrollIntoView({ behavior: opening ? 'auto' : 'smooth' });
  }, [messages, wsMessages, selectedRoom?.id]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const reactionGroups = (msgId: string) => {
    const map = new Map<string, { emoji: string; count: number; mine: boolean }>();
    for (const r of reactions[msgId] ?? []) {
      const e = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
      e.count++;
      if (r.user_id === user?.id) e.mine = true;
      map.set(r.emoji, e);
    }
    return Array.from(map.values());
  };

  // Deduplicate REST + WS messages by id
  const allMsgs = useMemo(() => {
    const seen = new Set<string>();
    return [...(messages ?? []), ...wsMessages].filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [messages, wsMessages]);

  const typingNames  = Object.values(typing);
  const regularRooms = (rooms ?? []).filter((r) => r.type !== 'direct');
  const dmRooms      = (rooms ?? []).filter((r) => r.type === 'direct');

  const getRoomName  = (room: ChatRoom) => roomDisplayName(room, user?.id ?? '', userMap);
  const dmableUsers  = (users ?? []).filter((u) => u.id !== user?.id);

  // ── Typing throttle ────────────────────────────────────────────────────────

  const sendTyping = () => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const now = Date.now();
    if (now - typingSentAt.current < 2000) return;
    typingSentAt.current = now;
    wsRef.current.send(JSON.stringify({ type: 'typing' }));
  };

  // ── Send message ───────────────────────────────────────────────────────────

  const sendMsg = () => {
    if (!selectedRoom || !message.trim()) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) { toast.error('Not connected'); return; }
    wsRef.current.send(JSON.stringify({
      type:        'message',
      content:     message.trim(),
      reply_to_id: replyTo?.id ?? undefined,
    }));
    setMessage('');
    setReplyTo(null);
  };

  // ── Mutations ──────────────────────────────────────────────────────────────

  const deleteMsgMut = useMutation({
    mutationFn: (id: string) => chatApi.deleteMessage(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['chat-messages', selectedRoom?.id] });
      setWsMessages((prev) => prev.map((m) => m.id === id ? { ...m, is_deleted: true, content: '' } : m));
      toast.success('Message deleted');
    },
    onError: (e: unknown) => toast.error(apiMsg(e, 'Failed to delete')),
  });

  const deleteRoomMut = useMutation({
    mutationFn: (id: string) => chatApi.deleteRoom(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
      if (selectedRoom?.id === id) selectRoom(null);
      toast.success('Room deleted');
    },
    onError: (e: unknown) => toast.error(apiMsg(e, 'Failed')),
  });

  const reactMut = useMutation({
    mutationFn: ({ msgId, emoji, remove }: { msgId: string; emoji: string; remove: boolean }) =>
      remove ? chatApi.removeReaction(msgId, emoji) : chatApi.addReaction(msgId, emoji),
    onSuccess: (_, { msgId, emoji, remove }) => {
      setReactions((prev) => {
        const cur = prev[msgId] ?? [];
        if (remove) return { ...prev, [msgId]: cur.filter((r) => !(r.emoji === emoji && r.user_id === user?.id)) };
        const next: MessageReaction = { message_id: msgId, user_id: user!.id, emoji, created_at: new Date().toISOString() };
        return { ...prev, [msgId]: [...cur, next] };
      });
      setEmojiFor(null);
    },
    onError: (e: unknown) => toast.error(apiMsg(e, 'Failed to react')),
  });

  const dmMut = useMutation({
    mutationFn: (userId: string) => chatApi.createDM(userId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
      setDmModal(false);
      selectRoom(res.data.data);
    },
    onError: (e: unknown) => toast.error(apiMsg(e, 'Failed')),
  });

  const { register, handleSubmit, reset } = useForm<{ name: string; type: string }>();
  const createRoomMut = useMutation({
    mutationFn: (d: { name: string; type: string }) => chatApi.createRoom(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
      setCreateModal(false);
      reset();
      toast.success('Room created');
    },
    onError: (e: unknown) => toast.error(apiMsg(e, 'Failed to create room')),
  });

  if (isLoading) return <PageSpinner />;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex h-[calc(100vh-8rem)] bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
      onClick={() => setEmojiFor(null)}
    >
      {/* ── Sidebar ── */}
      <div className={`${selectedRoom ? 'hidden md:flex' : 'flex'} w-full md:w-72 border-r border-gray-100 flex-col shrink-0`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Chat</h3>
          <div className="flex items-center gap-1">
            <button onClick={() => setDmModal(true)} title="New DM"
              className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
              <MessageCircle size={15} />
            </button>
            <button onClick={() => setCreateModal(true)} title="New Room"
              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {regularRooms.length === 0 && dmRooms.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No rooms yet</div>
          ) : (
            <>
              {regularRooms.map((room) => (
                <RoomItem
                  key={room.id}
                  room={room}
                  displayName={getRoomName(room)}
                  isSelected={selectedRoom?.id === room.id}
                  unread={unread[room.id] ?? 0}
                  currentUserId={user?.id ?? ''}
                  currentUserRole={user?.role ?? ''}
                  onSelect={() => selectRoom(room)}
                  onDelete={() => { if (confirm(`Delete "${getRoomName(room)}"?`)) deleteRoomMut.mutate(room.id); }}
                />
              ))}

              {dmRooms.length > 0 && (
                <>
                  <div className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Direct Messages
                  </div>
                  {dmRooms.map((room) => (
                    <RoomItem
                      key={room.id}
                      room={room}
                      displayName={getRoomName(room)}
                      isSelected={selectedRoom?.id === room.id}
                      unread={unread[room.id] ?? 0}
                      currentUserId={user?.id ?? ''}
                      currentUserRole={user?.role ?? ''}
                      onSelect={() => selectRoom(room)}
                      onDelete={() => { if (confirm(`Delete "${getRoomName(room)}"?`)) deleteRoomMut.mutate(room.id); }}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Message Pane ── */}
      <div className={`${selectedRoom ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
        {!selectedRoom ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <MessageSquare size={40} className="text-gray-300 mb-3" />
            <p className="font-medium text-gray-500">Select a room to start chatting</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0">
              <button onClick={() => selectRoom(null)}
                className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                <ArrowLeft size={18} />
              </button>
              <div className={`h-8 w-8 rounded-lg ${ROOM_COLORS[selectedRoom.type] ?? 'bg-gray-500'} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                {getRoomName(selectedRoom).charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{getRoomName(selectedRoom)}</p>
                {selectedRoom.type === 'project' && selectedRoom.project_id ? (
                  <Link
                    to={`/projects/${selectedRoom.project_id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    title="Open the project"
                  >
                    <FolderKanban size={12} /> Project: {projectTitleOf(selectedRoom)}
                  </Link>
                ) : (
                  <p className="text-xs text-gray-400 capitalize">{selectedRoom.type === 'direct' ? 'Direct Message' : `${selectedRoom.type} room`}</p>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {allMsgs.map((msg, i) => {
                const isMe        = msg.sender_id === user?.id;
                const name        = getUserName(msg.sender_id);
                const groups      = reactionGroups(msg.id);
                const replyParent = msg.reply_to_id ? allMsgs.find((m) => m.id === msg.reply_to_id) : null;
                // A WhatsApp-style divider ("Today", "Yesterday", …) starts each new day.
                const newDay      = i === 0 || new Date(allMsgs[i - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString();
                const showHeader  = newDay || allMsgs[i - 1].sender_id !== msg.sender_id;

                return (
                  <Fragment key={msg.id}>
                  {newDay && (
                    <div className="flex justify-center my-3">
                      <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        {dayLabel(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                    <div className={`flex items-end gap-2 max-w-[75%] ${isMe ? 'flex-row-reverse' : ''}`}>
                      {!isMe && (showHeader
                        ? <Avatar name={name} size="sm" />
                        : <div className="w-8 shrink-0" />
                      )}

                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {showHeader && (
                          <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                            <span className="text-xs font-medium text-gray-600">{isMe ? 'You' : name}</span>
                            <span className="text-xs text-gray-400" title={new Date(msg.created_at).toLocaleString()}>{clockTime(msg.created_at)}</span>
                          </div>
                        )}

                        {/* Reply quote */}
                        {replyParent && !replyParent.is_deleted && (
                          <div className="text-xs px-3 py-1.5 rounded-xl mb-1 border-l-2 border-indigo-400 bg-indigo-50 text-gray-600 max-w-[16rem] truncate">
                            <span className="font-medium text-indigo-600">{getUserName(replyParent.sender_id)}: </span>
                            {replyParent.content}
                          </div>
                        )}

                        {/* Bubble + hover actions */}
                        <div className={`flex items-center gap-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                          <div className={`px-3 py-2 rounded-2xl text-sm break-words max-w-xs lg:max-w-md ${
                            isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-900 rounded-tl-sm'
                          }`}>
                            {msg.is_deleted
                              ? <span className="italic opacity-60">Message deleted</span>
                              : msg.content
                            }
                          </div>

                          {!msg.is_deleted && (
                            <div className={`opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity ${isMe ? 'mr-1' : 'ml-1'}`}>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEmojiFor(emojiFor === msg.id ? null : msg.id); }}
                                className="p-1 rounded-full text-gray-400 hover:text-yellow-500 hover:bg-yellow-50"
                                title="React"
                              >
                                <Smile size={13} />
                              </button>
                              <button
                                onClick={() => { setReplyTo(msg); setEmojiFor(null); }}
                                className="p-1 rounded-full text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                                title="Reply"
                              >
                                <Reply size={13} />
                              </button>
                              {isMe && (
                                <button
                                  onClick={() => { if (confirm('Delete this message?')) deleteMsgMut.mutate(msg.id); }}
                                  className="p-1 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50"
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Emoji picker */}
                        {emojiFor === msg.id && (
                          <div
                            className={`mt-1 flex gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1.5 shadow-md ${isMe ? 'self-end' : 'self-start'}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {QUICK_EMOJIS.map((emoji) => {
                              const mine = (reactions[msg.id] ?? []).some((r) => r.emoji === emoji && r.user_id === user?.id);
                              return (
                                <button
                                  key={emoji}
                                  onClick={() => reactMut.mutate({ msgId: msg.id, emoji, remove: mine })}
                                  className={`text-base hover:scale-125 transition-transform rounded p-0.5 ${mine ? 'bg-indigo-50' : ''}`}
                                >
                                  {emoji}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Reaction pills */}
                        {groups.length > 0 && (
                          <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {groups.map(({ emoji, count, mine }) => (
                              <button
                                key={emoji}
                                onClick={() => reactMut.mutate({ msgId: msg.id, emoji, remove: mine })}
                                className={`flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                                  mine
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'
                                }`}
                              >
                                {emoji} {count}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  </Fragment>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Typing indicator */}
            {typingNames.length > 0 && (
              <div className="px-4 pb-1 text-xs text-gray-400 italic shrink-0">
                {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing…
              </div>
            )}

            {/* Reply preview */}
            {replyTo && (
              <div className="mx-4 mb-1 px-3 py-2 bg-indigo-50 border-l-2 border-indigo-400 rounded-lg flex items-start justify-between gap-2 shrink-0">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-indigo-600">{getUserName(replyTo.sender_id)}</p>
                  <p className="text-xs text-gray-600 truncate">{replyTo.content}</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="shrink-0 text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              </div>
            )}

            {/* Input bar */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2 shrink-0">
              <input
                value={message}
                onChange={(e) => { setMessage(e.target.value); sendTyping(); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && message.trim()) { e.preventDefault(); sendMsg(); } }}
                placeholder="Type a message…"
                className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={sendMsg}
                disabled={!message.trim()}
                className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Create Room Modal ── */}
      <Modal open={createModal} onClose={() => { setCreateModal(false); reset(); }} title="Create Room">
        <form onSubmit={handleSubmit((d) => createRoomMut.mutate(d))} className="space-y-4">
          <Input label="Room Name" {...register('name', { required: true })} />
          <Select
            label="Type"
            options={[
              { value: 'general',      label: 'General' },
              { value: 'departmental', label: 'Departmental' },
              // Project rooms are created with their project; only super_admin may make one by hand.
              ...(user?.role === 'super_admin' ? [{ value: 'project', label: 'Project' }] : []),
            ]}
            {...register('type', { required: true })}
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => { setCreateModal(false); reset(); }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={createRoomMut.isPending} className="flex-1">
              Create
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── DM Modal ── */}
      <Modal open={dmModal} onClose={() => setDmModal(false)} title="New Direct Message">
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {dmableUsers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No other users</p>
          ) : (
            dmableUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => dmMut.mutate(u.id)}
                disabled={dmMut.isPending}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-left transition-colors disabled:opacity-50"
              >
                <Avatar name={u.name} size="sm" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{u.role.replace('_', ' ')}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
