import type { MouseEvent } from 'react';
import { Logo } from './Logo';
import { Footer } from './Footer';

const LOGOS = ['exa', 'Corgi', 'Orchid', 'clad labs', 'Lopus', 'Odysser'];

const FEATURES = [
  { k: '01', title: 'Public rooms', body: 'Spin up a channel in one click. Everyone joins, history stays, and nothing slips through the cracks.' },
  { k: '02', title: 'Direct messages', body: 'Private one-to-one conversations — just as quick and reliable as everything else.' },
  { k: '03', title: 'Instant by default', body: 'Messages appear the moment they are sent. No refresh, no waiting, no lag.' },
];

const STATS = [
  { n: 'Instant', label: 'every message, live' },
  { n: 'Unlimited', label: 'rooms & direct messages' },
  { n: '1 click', label: 'to start a conversation' },
];

const TESTIMONIALS = [
  { quote: 'We moved our whole team over in an afternoon. Messages just appear now — it feels alive.', name: 'Yuan Teoh', role: 'Operations Lead' },
  { quote: 'Rooms for projects, DMs for quick questions. Our communication finally feels organised.', name: 'Ishan Goswami', role: 'Product' },
  { quote: 'Everyone got it on day one. No training, no manual — they just started chatting.', name: 'Ana Paula Olaiz', role: 'People' },
];

const FAQ = [
  { q: 'What is RELAY?', a: 'RELAY is a realtime chat app for teams — public rooms and private direct messages, with every message delivered the instant it is sent.' },
  { q: 'Can I have private conversations?', a: 'Yes. Direct messages are private between you and one other person — nobody else can see them.' },
  { q: 'Is my chat history saved?', a: 'Always. Reopen any room or DM and your conversation is right where you left it.' },
  { q: 'How many rooms can I create?', a: 'As many as you like. There is no limit on rooms or direct messages.' },
  { q: 'How do I get started?', a: 'Create an account, make a room or start a DM, and you are chatting in seconds.' },
];

// purple-meadow photo, echoing the agnost.ai preview backdrop
const PREVIEW_BG =
  'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=2400&q=80';

export function Landing({
  loggedIn,
  onEnter,
  onDocs,
}: {
  loggedIn: boolean;
  onEnter: () => void;
  onDocs: () => void;
}) {
  const cta = loggedIn ? 'Open app' : 'Try now';

  // Smooth-scroll in-page links without changing the URL hash.
  function onAnchorClick(e: MouseEvent<HTMLElement>) {
    const link = (e.target as HTMLElement).closest('a');
    const href = link?.getAttribute('href');
    if (link && href?.startsWith('#')) {
      e.preventDefault();
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  return (
    <div className="animate-fade-in overflow-x-hidden">
      {/* nav */}
      <nav className="sticky top-0 z-30 flex items-center justify-between px-10 py-4 bg-white/90 backdrop-blur border-b border-line">
        <div className="flex items-center gap-2.5 font-display font-bold tracking-wide text-lg">
          <Logo /> RELAY
        </div>
        <div className="hidden md:flex gap-7 mono-label" onClick={onAnchorClick}>
          <a href="#features">FEATURES</a>
          <a href="#faq">FAQ</a>
          <a href="#contact">CONTACT</a>
        </div>
        <div className="flex gap-2.5">
          <button className="btn" onClick={onDocs}>Docs</button>
          <button className="btn btn-primary" onClick={onEnter}>{cta}</button>
        </div>
      </nav>

      {/* hero */}
      <header className="max-w-[1000px] mx-auto px-10 pt-[90px] pb-14 text-center flex flex-col items-center gap-6">
        <span className="badge">● LIVE · BUILT FOR TEAMS</span>
        <h1 className="text-[clamp(44px,8vw,104px)] leading-[0.95] tracking-tight">
          <span className="text-neutral-300">Your team should</span>
          <br />
          talk in real time.
        </h1>
        <p className="max-w-[620px] text-lg text-ink-soft m-0">
          Rooms for every project, DMs for quick questions, and messages that land the instant
          they are sent. RELAY keeps your whole team on the same page.
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          <button className="btn btn-primary btn-lg" onClick={onEnter}>{cta} →</button>
          <button className="btn btn-lg" onClick={onDocs}>View docs</button>
        </div>
      </header>

      {/* logo strip */}
      <section className="flex flex-wrap items-center justify-center gap-12 px-10 pb-14 border-b border-line">
        {LOGOS.map((l) => (
          <span key={l} className="font-display font-bold text-2xl text-neutral-300 tracking-tight">
            {l}
          </span>
        ))}
      </section>

      {/* product preview ON a photo backdrop (agnost style) */}
      <section
        className="bg-cover bg-center py-20 px-6"
        style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.15),rgba(0,0,0,0.15)), url(${PREVIEW_BG})` }}
      >
        <div className="relative max-w-[980px] mx-auto">
          <span className="badge absolute -top-3.5 left-16 bg-white !text-online z-[2]">● LIVE PREVIEW</span>
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] border border-ink rounded-[10px] overflow-hidden min-h-[340px] shadow-[0_30px_80px_rgba(0,0,0,0.25)] bg-white">
            <div className="hidden md:block bg-soft border-r border-line p-4">
              <div className="mono-label !text-[10px] mb-2">ROOMS</div>
              <div className="px-2 py-1.5 rounded bg-white font-semibold border-l-2 border-ink"># coding-discussions</div>
              <div className="px-2 py-1.5 rounded text-ink-soft"># general</div>
              <div className="mono-label !text-[10px] mb-2 mt-3.5">DIRECT MESSAGES</div>
              <div className="px-2 py-1.5 rounded text-ink-soft">@ akshkhurana</div>
            </div>
            <div className="flex flex-col">
              <div className="px-5 py-4 border-b border-line font-display font-semibold"># coding-discussions</div>
              <div className="flex-1 p-5 flex flex-col gap-3">
                <div className="self-start max-w-[70%] bg-soft border border-line rounded-md px-3 py-2 text-sm">Anyone up for pair programming?</div>
                <div className="self-start max-w-[70%] bg-soft border border-line rounded-md px-3 py-2 text-sm">Yeah, joining now 🚀</div>
                <div className="self-end max-w-[70%] bg-ink text-white rounded-md px-3 py-2 text-sm">on my way</div>
              </div>
              <div className="mx-5 mb-5 border border-line rounded-md px-3 py-2.5 text-muted text-sm">Message #coding-discussions</div>
            </div>
          </div>
        </div>
      </section>

      {/* features */}
      <section id="features" className="max-w-[1100px] mx-auto px-10 py-20 flex flex-col items-center gap-4 text-center">
        <span className="badge">FEATURES</span>
        <h2 className="text-[clamp(32px,5vw,56px)] leading-[1.02] max-w-[760px]">
          Everything a chat needs, nothing it doesn’t.
        </h2>
        <div className="grid md:grid-cols-3 gap-4 w-full mt-6 text-left">
          {FEATURES.map((f) => (
            <div key={f.k} className="border border-line rounded-[10px] p-6 flex flex-col gap-2.5">
              <span className="mono-label">{f.k}</span>
              <h3 className="text-[22px]">{f.title}</h3>
              <p className="text-ink-soft m-0">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* why (dark) */}
      <section className="bg-ink text-white py-[90px] px-10 flex flex-col items-center gap-5 text-center bg-[radial-gradient(circle_at_50%_0%,#1f1f1f_0%,#0a0a0a_60%)]">
        <span className="badge !border-neutral-700 !text-neutral-300">WHY RELAY</span>
        <h2 className="text-white text-[clamp(36px,6vw,72px)] leading-[0.98]">
          Stop refreshing.
          <br />
          Start chatting.
        </h2>
        <p className="max-w-[600px] text-neutral-400 m-0 text-[17px]">
          Conversations should feel alive. RELAY delivers every message the instant it happens, so
          your team never sits there waiting for the page to update.
        </p>
        <div className="grid md:grid-cols-3 gap-10 mt-8">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="font-display font-bold text-[44px]">{s.n}</div>
              <div className="mono-label !text-neutral-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* testimonials */}
      <section className="max-w-[1100px] mx-auto px-10 py-20 flex flex-col items-center gap-4 text-center">
        <span className="badge">LOVED BY TEAMS</span>
        <h2 className="text-[clamp(32px,5vw,56px)] leading-[1.02] max-w-[760px]">
          From sign up to live chat, in seconds.
        </h2>
        <div className="grid md:grid-cols-3 gap-4 w-full mt-6 text-left">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="border border-line rounded-[10px] p-6 bg-soft flex flex-col justify-between gap-5">
              <p className="text-[17px] m-0">“{t.quote}”</p>
              <div className="flex items-center gap-3">
                <span className="w-[26px] h-[26px] rounded-full bg-ink text-white inline-flex items-center justify-center font-mono text-[11px]">
                  {t.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <div className="font-semibold">{t.name}</div>
                  <div className="mono-label">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* faq */}
      <section id="faq" className="max-w-[820px] mx-auto px-10 py-20 flex flex-col items-center gap-4 text-center">
        <span className="badge">FREQUENTLY ASKED QUESTIONS</span>
        <h2 className="text-[clamp(32px,5vw,56px)]">FAQ</h2>
        <div className="w-full mt-3 text-left">
          {FAQ.map((item, i) => (
            <details key={item.q} className="border-b border-line py-1.5 group" open={i === 0}>
              <summary className="list-none cursor-pointer flex items-center gap-4 py-5 font-display font-semibold text-xl [&::-webkit-details-marker]:hidden">
                <span className="mono-label !text-white bg-ink px-1.5 py-1 rounded">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {item.q}
              </summary>
              <p className="text-ink-soft m-0 pb-5 pl-[52px] max-w-[680px]">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* final cta */}
      <section id="contact" className="text-center py-[90px] px-10 flex flex-col items-center gap-7 border-t border-line">
        <h2 className="text-[clamp(32px,5vw,56px)]">Ready to talk in real time?</h2>
        <button className="btn btn-primary btn-lg" onClick={onEnter}>Start free →</button>
      </section>

      <Footer onHome={() => { window.location.hash = ''; }} onEnter={onEnter} onDocs={onDocs} />
    </div>
  );
}
