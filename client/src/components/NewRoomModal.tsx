import { useState, type FormEvent } from 'react';
import { createRoom } from '../lib/api';
import type { Room } from '../types';

export function NewRoomModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (room: Room) => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const room = await createRoom(name.trim());
      onCreated(room);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center"
      onClick={onClose}
    >
      <form
        className="w-full max-w-[380px] bg-white border border-ink rounded-md p-6"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3 className="text-[22px] mb-1">New room</h3>
        <span className="mono-label block mb-4.5">CREATE A PUBLIC ROOM</span>

        <div className="flex flex-col gap-1.5 mb-3.5">
          <label className="mono-label !text-ink-soft">Room name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="general"
            autoFocus
            required
          />
        </div>

        {error && <div className="text-danger text-sm mb-3">{error}</div>}

        <div className="flex gap-2.5 mt-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? '...' : 'Create →'}
          </button>
        </div>
      </form>
    </div>
  );
}
