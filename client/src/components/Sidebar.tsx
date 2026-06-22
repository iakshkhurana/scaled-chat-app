import type { Room } from '../types';
import { Spinner } from './Spinner';

export function Sidebar({
  publicRooms,
  dmRooms,
  activeRoomId,
  loading,
  onSelect,
  onNewRoom,
  onNewDm,
}: {
  publicRooms: Room[];
  dmRooms: Room[];
  activeRoomId: number | null;
  loading: boolean;
  onSelect: (room: Room) => void;
  onNewRoom: () => void;
  onNewDm: () => void;
}) {
  if (loading) {
    return (
      <aside className="border-r border-line bg-soft flex">
        <Spinner size="sm" label="Loading rooms" />
      </aside>
    );
  }

  return (
    <aside className="border-r border-line bg-soft overflow-y-auto py-4.5 animate-fade-in">
      <Section title="Rooms" onAdd={onNewRoom}>
        {publicRooms.length === 0 && <Empty>No rooms yet.</Empty>}
        {publicRooms.map((room) => (
          <RoomItem
            key={room.id}
            symbol="#"
            label={room.name ?? 'untitled'}
            active={room.id === activeRoomId}
            onClick={() => onSelect(room)}
          />
        ))}
      </Section>

      <Section title="Direct Messages" onAdd={onNewDm}>
        {dmRooms.length === 0 && <Empty>No DMs yet.</Empty>}
        {dmRooms.map((room) => (
          <RoomItem
            key={room.id}
            symbol="@"
            label={room.name ?? 'direct message'}
            active={room.id === activeRoomId}
            onClick={() => onSelect(room)}
          />
        ))}
      </Section>
    </aside>
  );
}

function Section({
  title,
  onAdd,
  children,
}: {
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5.5">
      <div className="flex items-center justify-between px-4.5 pb-2.5">
        <span className="mono-label">{title}</span>
        <button className="btn-icon" title={`New ${title}`} onClick={onAdd}>
          +
        </button>
      </div>
      {children}
    </div>
  );
}

function RoomItem({
  symbol,
  label,
  active,
  onClick,
}: {
  symbol: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2.5 px-4.5 py-2.5 cursor-pointer border-l-2 ${
        active
          ? 'bg-white border-ink text-ink font-semibold'
          : 'border-transparent text-ink-soft hover:bg-[#ededea]'
      }`}
    >
      <span className={`font-mono ${active ? 'text-ink' : 'text-muted'}`}>{symbol}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4.5 py-1 text-sm text-muted">{children}</div>;
}
