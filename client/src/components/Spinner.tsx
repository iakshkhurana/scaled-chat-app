// Reusable loading spinner. Pass a label to show text under it.
export function Spinner({
  label,
  size = 'md',
  dark = false,
}: {
  label?: string;
  size?: 'sm' | 'md';
  dark?: boolean;
}) {
  const dim = size === 'sm' ? 'w-4 h-4 border-2' : 'w-6 h-6 border-[2.5px]';
  const colors = dark
    ? 'border-white/25 border-t-white'
    : 'border-line border-t-ink';
  return (
    <div className="flex-1 min-h-[160px] flex flex-col items-center justify-center gap-3 text-muted">
      <div className={`${dim} ${colors} rounded-full animate-spin`} />
      {label && <span className="mono-label">{label}</span>}
    </div>
  );
}
