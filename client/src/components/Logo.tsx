// Concentric-circle target mark (the ◎ look from the reference design).
export function Logo({ size = 22, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.4" />
      <circle cx="12" cy="12" r="6" stroke={color} strokeWidth="1.4" />
      <circle cx="12" cy="12" r="2" fill={color} />
    </svg>
  );
}
