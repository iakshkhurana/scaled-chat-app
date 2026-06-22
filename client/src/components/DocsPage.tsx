import type { MouseEvent, ReactNode } from 'react';
import { Logo } from './Logo';
import { Footer } from './Footer';

function Code({ children }: { children: ReactNode }) {
  return (
    <pre className="bg-ink text-neutral-200 rounded-lg px-4.5 py-4 overflow-x-auto font-mono text-[13px] leading-relaxed mb-4 whitespace-pre">
      {children}
    </pre>
  );
}
function C({ children }: { children: ReactNode }) {
  return <span className="text-neutral-500">{children}</span>;
}
function K({ children }: { children: ReactNode }) {
  return (
    <code className="font-mono text-[0.85em] bg-soft border border-line rounded px-1.5 py-px whitespace-nowrap">
      {children}
    </code>
  );
}
function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mb-13 scroll-mt-24">
      <h2 className="text-[30px] mb-2">{title}</h2>
      {children}
    </section>
  );
}
function Row({ cells }: { cells: ReactNode[] }) {
  return (
    <tr>
      {cells.map((c, i) => (
        <td key={i} className="text-left px-3 py-2.5 border-b border-line align-top">{c}</td>
      ))}
    </tr>
  );
}
function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <table className="w-full border-collapse mb-4 text-sm">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} className="text-left px-3 py-2.5 border-b border-line font-mono uppercase tracking-wider text-[11px] text-ink-soft">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function DocsPage({ onEnter, onHome }: { onEnter: () => void; onHome: () => void }) {
  function onAnchorClick(e: MouseEvent<HTMLElement>) {
    const link = (e.target as HTMLElement).closest('a');
    const href = link?.getAttribute('href');
    if (link && href?.startsWith('#')) {
      e.preventDefault();
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  const toc = [
    ['overview', '01 · Overview'],
    ['start', '02 · Quick start'],
    ['rest', '03 · REST API'],
    ['ws', '04 · WebSocket'],
    ['stack', '05 · Stack'],
  ];

  return (
    <div className="animate-fade-in overflow-x-hidden">
      {/* nav */}
      <nav className="sticky top-0 z-30 flex items-center justify-between px-10 py-4 bg-white/90 backdrop-blur border-b border-line">
        <div className="flex items-center gap-2.5 font-display font-bold tracking-wide text-lg cursor-pointer" onClick={onHome} title="Home">
          <Logo /> RELAY
        </div>
        <div className="hidden md:flex gap-7 mono-label" onClick={onAnchorClick}>
          <a href="#overview">OVERVIEW</a>
          <a href="#start">QUICK START</a>
          <a href="#rest">REST API</a>
          <a href="#ws">WEBSOCKET</a>
        </div>
        <div className="flex gap-2.5">
          <button className="btn" onClick={onHome}>Home</button>
          <button className="btn btn-primary" onClick={onEnter}>Open app →</button>
        </div>
      </nav>

      {/* hero */}
      <header className="max-w-[1100px] mx-auto px-10 pt-[70px] pb-8 flex flex-col gap-4">
        <span className="badge w-fit">DOCUMENTATION</span>
        <h1 className="text-[clamp(40px,6vw,72px)] tracking-tight">Docs</h1>
        <p className="text-ink-soft max-w-[640px] text-lg m-0">
          How RELAY is built and how to run it: a REST service, a realtime WebSocket service,
          Postgres for history and Redis for live fan-out.
        </p>
      </header>

      <div className="max-w-[1100px] mx-auto px-10 pb-20 grid md:grid-cols-[200px_1fr] gap-12 items-start">
        {/* toc */}
        <aside className="hidden md:flex sticky top-24 flex-col gap-2.5" onClick={onAnchorClick}>
          {toc.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="font-mono text-xs uppercase tracking-wider text-muted hover:text-ink">
              {label}
            </a>
          ))}
        </aside>

        {/* content */}
        <div className="min-w-0 [&_p]:text-ink-soft [&_p]:mb-3 [&_ul]:text-ink-soft [&_ul]:pl-5 [&_ul]:mb-3 [&_li]:mb-1.5 [&_ul]:list-disc [&_h3]:text-lg [&_h3]:mt-5 [&_h3]:mb-2">
          <Block id="overview" title="Overview">
            <p>RELAY is made of four parts that share one database and one JWT secret:</p>
            <ul>
              <li><b>client</b> — the React UI in the browser.</li>
              <li><b>api-service</b> — REST: login/register, rooms, message history.</li>
              <li><b>ws-service</b> — WebSocket: live messages, fanned out via Redis.</li>
              <li><b>shared</b> — the Postgres connection pool + schema, used by both services.</li>
            </ul>
            <Code>
              <C>{`// the life of a message\n`}</C>
              {`you type ──▶ WebSocket ──▶ ws-service\n`}
              {`                          1. save to Postgres\n`}
              {`                          2. publish to Redis "room:5"\n`}
              {`                                   │\n`}
              {`              every ws-service subscriber receives it\n`}
              {`                                   ▼\n`}
              {`         pushed to everyone connected to that room`}
            </Code>
            <div className="border border-ink border-l-[3px] rounded-md p-4 bg-soft text-ink-soft mb-4">
              Postgres = permanent &amp; queryable history. Redis = fast, ephemeral live delivery.
              WebSocket = the open pipe to the browser.
            </div>
          </Block>

          <Block id="start" title="Quick start">
            <p>You need Docker (for Postgres + Redis) and Node. Run each in its own terminal:</p>
            <Code>
              <C>{`# 1) infra\n`}</C>
              {`docker compose up -d\n\n`}
              <C>{`# 2) backend\n`}</C>
              {`cd api-service && npm run dev   `}<C>{`# :4000\n`}</C>
              {`cd ws-service  && npm run dev   `}<C>{`# :5050\n\n`}</C>
              <C>{`# 3) frontend\n`}</C>
              {`cd client && npm run dev        `}<C>{`# :5173`}</C>
            </Code>
            <div className="border border-ink border-l-[3px] rounded-md p-4 bg-soft text-ink-soft mb-4">
              <b>Important:</b> <K>JWT_SECRET</K> must be the same in api-service and ws-service —
              one signs the token, the other verifies it.
            </div>
          </Block>

          <Block id="rest" title="REST API">
            <p>Base URL <K>http://localhost:4000</K>. All except auth need a header{' '}
              <K>Authorization: Bearer &lt;token&gt;</K>.</p>
            <Table head={['Method', 'Path', 'Auth', 'Does']}>
              <Row cells={[<K>POST</K>, <K>/auth/register</K>, '—', 'create user, return JWT']} />
              <Row cells={[<K>POST</K>, <K>/auth/login</K>, '—', 'login, return JWT']} />
              <Row cells={[<K>GET</K>, <K>/rooms</K>, '✓', 'list public rooms']} />
              <Row cells={[<K>POST</K>, <K>/rooms</K>, '✓', 'create a public room']} />
              <Row cells={[<K>GET</K>, <K>/rooms/:id/messages</K>, '✓', <>paginated history (<K>?before=</K>)</>]} />
              <Row cells={[<K>POST</K>, <K>/dms/:userId</K>, '✓', 'find-or-create a DM room']} />
              <Row cells={[<K>GET</K>, <K>/me/rooms</K>, '✓', 'my rooms (public + DM)']} />
              <Row cells={[<K>GET</K>, <K>/users</K>, '✓', 'everyone except me (to start a DM)']} />
            </Table>
          </Block>

          <Block id="ws" title="WebSocket">
            <p>Connect with the JWT in the query string (browsers can’t set WS headers):</p>
            <Code>ws://localhost:5050?token=&lt;jwt&gt;</Code>
            <h3>You send</h3>
            <Table head={['type', 'fields', 'meaning']}>
              <Row cells={[<K>join</K>, <K>roomId</K>, "subscribe to a room's live messages"]} />
              <Row cells={[<K>message</K>, <K>roomId, body</K>, 'send a message']} />
              <Row cells={[<K>leave</K>, <K>roomId</K>, 'stop receiving that room']} />
            </Table>
            <h3>Server sends</h3>
            <Table head={['type', 'payload', 'meaning']}>
              <Row cells={[<K>ready</K>, <K>user</K>, 'connected & authed']} />
              <Row cells={[<K>joined</K>, <K>roomId</K>, 'join confirmed']} />
              <Row cells={[<K>message</K>, <K>message</K>, 'a new message arrived']} />
              <Row cells={[<K>error</K>, <K>error</K>, 'something went wrong']} />
            </Table>
          </Block>

          <Block id="stack" title="Stack">
            <ul>
              <li><b>Frontend:</b> React + Vite + TypeScript + Tailwind, native WebSocket + fetch.</li>
              <li><b>api-service:</b> Express, bcrypt, jsonwebtoken, pg.</li>
              <li><b>ws-service:</b> <K>ws</K>, jsonwebtoken, redis, pg.</li>
              <li><b>Data:</b> PostgreSQL (history) + Redis (pub/sub).</li>
            </ul>
            <p>Deeper, line-by-line guides live in the repo’s <K>docs/</K> folder:{' '}
              <K>ARCHITECTURE.md</K>, <K>API-SERVICE.md</K>, <K>WS-SERVICE.md</K>, <K>CLIENT.md</K>.</p>
          </Block>
        </div>
      </div>

      <Footer onHome={onHome} onEnter={onEnter} onDocs={() => { window.location.hash = '#/docs'; }} />
    </div>
  );
}
