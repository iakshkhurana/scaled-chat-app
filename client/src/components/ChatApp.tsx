import { useCallback, useEffect, useState } from 'react';
import type { Room, Message, CurrentUser } from '../types';
import { getPublicRooms, getMyRooms, getMessages } from '../lib/api';
import { useSocket } from '../lib/useSocket';
import { notify, requestNotifyPermission } from '../lib/notify';
import { Sidebar } from './Sidebar';
import { RoomView } from './RoomView';
import { NewRoomModal } from './NewRoomModal';
import { NewDmModal } from './NewDmModal';
import { Logo } from './Logo';

export function ChatApp({
  token,
  me,
  onLogout,
}: {
  token: string;
  me: CurrentUser;
  onLogout: () => void;
}) {
  const [publicRooms, setPublicRooms] = useState<Room[]>([]);
  const [dmRooms, setDmRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messagesByRoom, setMessagesByRoom] = useState<Record<number, Message[]>>({});
  const [modal, setModal] = useState<'room' | 'dm' | null>(null);
  const [toast, setToast] = useState<{ username: string; body: string; roomId: number } | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Live events from the ws-service. A new message just gets appended to the
  // right room's list (skip if we already have that id, e.g. our own echo).
  const { ready, join, sendMessage } = useSocket(token, (event) => {
    if (event.type === 'message') {
      const msg = event.message;
      setMessagesByRoom((prev) => {
        const list = prev[msg.room_id] ?? [];
        if (list.some((m) => m.id === msg.id)) return prev;
        return { ...prev, [msg.room_id]: [...list, msg] };
      });

      // Pop up for messages from OTHER people, but only when you're not already
      // looking at that room (or the tab is in the background).
      const fromSomeoneElse = msg.sender_id !== me.userId;
      const notLooking = document.hidden || msg.room_id !== activeRoom?.id;
      if (fromSomeoneElse && notLooking) {
        setToast({ username: msg.username, body: msg.body, roomId: msg.room_id });
        notify(`New message from ${msg.username}`, msg.body);
      }
    }
  });

  // Initial load: public rooms + my DMs + ask for notification permission.
  useEffect(() => {
    Promise.all([
      getPublicRooms().then(setPublicRooms).catch(console.error),
      refreshDms(),
    ]).finally(() => setLoadingRooms(false));
    requestNotifyPermission();
  }, []);

  // Auto-dismiss the in-app toast after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  function refreshDms() {
    return getMyRooms()
      .then((rooms) => setDmRooms(rooms.filter((r) => r.type === 'dm')))
      .catch(console.error);
  }

  // Open a room: load its history (newest-first from the API, so reverse it
  // into chronological order) and join it on the socket for live updates.
  const selectRoom = useCallback(
    async (room: Room) => {
      setActiveRoom(room);
      join(room.id);
      const haveCache = messagesByRoom[room.id] !== undefined;
      if (!haveCache) setLoadingMessages(true);
      try {
        const { messages } = await getMessages(room.id);
        setMessagesByRoom((prev) => ({ ...prev, [room.id]: [...messages].reverse() }));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMessages(false);
      }
    },
    [join, messagesByRoom]
  );

  // If the socket connects AFTER a room is already selected, (re)join it.
  useEffect(() => {
    if (ready && activeRoom) join(activeRoom.id);
  }, [ready, activeRoom, join]);

  function handleSend(body: string) {
    if (activeRoom) sendMessage(activeRoom.id, body);
  }

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <header className="h-[60px] shrink-0 border-b border-line flex items-center justify-between px-5">
        <div
          className="flex items-center gap-2.5 font-display font-bold tracking-wide text-lg cursor-pointer"
          onClick={() => { window.location.hash = ''; }}
          title="Home"
        >
          <Logo /> RELAY
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
            <span className={`w-2 h-2 rounded-full ${ready ? 'bg-online' : 'bg-muted'}`} />
            {me.username}
          </span>
          <button className="btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-[280px_1fr] min-h-0">
        <Sidebar
          publicRooms={publicRooms}
          dmRooms={dmRooms}
          activeRoomId={activeRoom?.id ?? null}
          loading={loadingRooms}
          onSelect={selectRoom}
          onNewRoom={() => setModal('room')}
          onNewDm={() => setModal('dm')}
        />

        <RoomView
          room={activeRoom}
          messages={activeRoom ? messagesByRoom[activeRoom.id] ?? [] : []}
          myUserId={me.userId}
          loading={loadingMessages}
          onSend={handleSend}
        />
      </div>

      {modal === 'room' && (
        <NewRoomModal
          onClose={() => setModal(null)}
          onCreated={(room) => {
            setPublicRooms((prev) => [room, ...prev]);
            setModal(null);
            selectRoom(room);
          }}
        />
      )}

      {modal === 'dm' && (
        <NewDmModal
          onClose={() => setModal(null)}
          onCreated={async (roomId) => {
            setModal(null);
            await refreshDms();
            const rooms = await getMyRooms();
            const room = rooms.find((r) => r.id === roomId);
            if (room) selectRoom(room);
          }}
        />
      )}

      {toast && (
        <div
          className="fixed right-[22px] bottom-[22px] z-[60] max-w-[320px] bg-ink text-white rounded-md px-4 py-3 cursor-pointer flex flex-col gap-1 shadow-[0_8px_30px_rgba(0,0,0,0.25)] animate-toast-in"
          onClick={() => {
            const room =
              publicRooms.find((r) => r.id === toast.roomId) ??
              dmRooms.find((r) => r.id === toast.roomId);
            if (room) selectRoom(room);
            setToast(null);
          }}
        >
          <span className="mono-label !text-accent">{toast.username}</span>
          <span className="truncate">{toast.body}</span>
        </div>
      )}
    </div>
  );
}
