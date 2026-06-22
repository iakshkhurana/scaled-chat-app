import { useEffect, useState } from 'react';
import { getUsers, createDm } from '../lib/api';
import type { User } from '../types';

export function NewDmModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (roomId: number) => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Load everyone (except me) so you can pick who to DM.
  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function pick(userId: number) {
    try {
      const roomId = await createDm(userId);
      onCreated(roomId);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[380px] max-h-[80vh] overflow-y-auto bg-white border border-ink rounded-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[22px] mb-1">New message</h3>
        <span className="mono-label block mb-4.5">START A DIRECT MESSAGE</span>

        {loading && <div className="text-sm text-muted">Loading…</div>}
        {error && <div className="text-danger text-sm mb-3">{error}</div>}
        {!loading && users.length === 0 && (
          <div className="text-sm text-muted">No other users yet. Register another account to DM.</div>
        )}

        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-2.5 px-3 py-2.5 border border-line rounded-md cursor-pointer mb-2 hover:bg-soft"
            onClick={() => pick(u.id)}
          >
            <span className="w-[26px] h-[26px] rounded-full bg-ink text-white inline-flex items-center justify-center font-mono text-[11px] shrink-0">
              {u.username.slice(0, 2).toUpperCase()}
            </span>
            <span>{u.username}</span>
          </div>
        ))}

        <button type="button" className="btn w-full mt-2" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
