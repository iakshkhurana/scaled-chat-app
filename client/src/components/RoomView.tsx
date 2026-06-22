import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Room, Message } from '../types';
import { Logo } from './Logo';
import { Spinner } from './Spinner';

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function RoomView({
  room,
  messages,
  myUserId,
  loading,
  onSend,
}: {
  room: Room | null;
  messages: Message[];
  myUserId: number;
  loading: boolean;
  onSend: (body: string) => void;
}) {
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest message whenever the list grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!room) {
    return (
      <main className="flex flex-col min-w-0">
        <div className="flex-1 flex flex-col items-center justify-center gap-3.5 text-muted">
          <Logo size={40} color="#cfcfcf" />
          <span className="mono-label">Select a room to start chatting</span>
        </div>
      </main>
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    onSend(body);
    setText('');
  }

  return (
    <main className="flex flex-col min-w-0">
      <div className="shrink-0 border-b border-line px-6 py-4">
        <h2 className="text-[22px]">
          {room.type === 'public' ? '# ' : '@ '}
          {room.name ?? 'untitled'}
        </h2>
        <span className="mono-label mt-1 block">
          {room.type === 'public' ? 'PUBLIC ROOM' : 'DIRECT MESSAGE'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5.5 flex flex-col gap-4">
        {loading && <Spinner size="sm" label="Loading messages" />}
        {!loading && messages.length === 0 && (
          <div className="text-sm text-muted">No messages yet. Say something →</div>
        )}
        {!loading &&
          messages.map((m) => {
            const mine = m.sender_id === myUserId;
            return (
              <div key={m.id} className={`max-w-[70%] ${mine ? 'self-end' : ''}`}>
                <div className={`flex items-baseline gap-2.5 mb-1 ${mine ? 'justify-end' : ''}`}>
                  {/* Own messages don't need a name — the dark right bubble says it's you. */}
                  {!mine && (
                    <span className="font-mono text-[11px] uppercase tracking-wider text-ink">
                      {m.username}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-muted">{timeOf(m.created_at)}</span>
                </div>
                <div
                  className={`rounded-md px-3.5 py-2.5 whitespace-pre-wrap break-words border ${
                    mine ? 'bg-ink text-white border-ink' : 'bg-soft border-line'
                  }`}
                >
                  {m.body}
                </div>
              </div>
            );
          })}
        <div ref={bottomRef} />
      </div>

      <form className="shrink-0 border-t border-line px-6 py-3.5 flex gap-2.5" onSubmit={submit}>
        <input
          className="input flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${room.name ?? ''}`}
        />
        <button className="btn btn-primary" disabled={!text.trim()}>
          Send →
        </button>
      </form>
    </main>
  );
}
