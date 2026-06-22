import { Logo } from './Logo';

type Item = { n: string; label: string; onClick?: () => void; href?: string };

function Col({ items }: { items: Item[] }) {
  return (
    <div className="flex flex-col gap-3.5">
      {items.map((it) => (
        <div key={it.n} className="grid grid-cols-[34px_1fr] items-center">
          <span className="font-mono text-xs text-neutral-600">{it.n}</span>
          {it.href ? (
            <a
              href={it.href}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[13px] tracking-wider text-white hover:opacity-70"
            >
              {it.label}
            </a>
          ) : (
            <button
              onClick={it.onClick}
              className="font-mono text-[13px] tracking-wider text-white text-left hover:opacity-70"
            >
              {it.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// Dark footer with numbered columns + a giant cut-off wordmark (agnost style).
export function Footer({
  onHome,
  onEnter,
  onDocs,
}: {
  onHome: () => void;
  onEnter: () => void;
  onDocs: () => void;
}) {
  return (
    <footer className="bg-ink text-white pt-16 px-10 overflow-hidden">
      <div className="max-w-[1100px] mx-auto flex justify-between flex-wrap gap-10">
        <div>
          <div className="flex items-center gap-2.5 font-display font-bold tracking-wide text-lg">
            <Logo color="#fff" /> RELAY
          </div>
          <p className="text-neutral-500 mt-3 mb-0 max-w-[220px]">Realtime chat for teams.</p>
          <p className="mono-label !text-neutral-600 mt-8">RELAY</p>
        </div>

        <div className="flex gap-12 flex-wrap">
          <Col
            items={[
              { n: '1.1', label: 'HOME', onClick: onHome },
              { n: '1.2', label: 'DOCS', onClick: onDocs },
              { n: '1.3', label: 'CONTACT', onClick: onHome },
            ]}
          />
          <Col
            items={[
              { n: '2.1', label: 'APP', onClick: onEnter },
              { n: '2.2', label: 'FAQ', onClick: onHome },
            ]}
          />
          <Col
            items={[
              { n: '3.1', label: 'X [TWITTER]', href: 'https://x.com' },
              { n: '3.2', label: 'LINKEDIN', href: 'https://linkedin.com' },
            ]}
          />
        </div>
      </div>

      <div className="wordmark text-center font-display font-bold leading-[0.8] tracking-tighter mt-6 text-[clamp(80px,22vw,320px)] select-none">
        relay
      </div>
    </footer>
  );
}
