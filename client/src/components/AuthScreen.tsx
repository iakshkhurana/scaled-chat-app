import { useState, type FormEvent } from 'react';
import { login, register } from '../lib/api';
import { Logo } from './Logo';

// Shown when there is no token. On success it hands the JWT up to <App/>.
export function AuthScreen({ onAuthed }: { onAuthed: (token: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isLogin = mode === 'login';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { token } = isLogin
        ? await login(email, password)
        : await register(email, username, password);
      onAuthed(token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full grid md:grid-cols-[1.1fr_1fr] animate-fade-in">
      {/* left: brand panel */}
      <div className="hidden md:flex flex-col justify-between bg-ink text-white p-10">
        <div
          className="flex items-center gap-2.5 font-display font-bold tracking-wide text-lg cursor-pointer"
          onClick={() => { window.location.hash = ''; }}
          title="Home"
        >
          <Logo color="#fff" /> RELAY
        </div>
        <h1 className="text-white text-[clamp(40px,5vw,72px)] leading-[0.98]">
          <span className="text-neutral-500">Talk in</span>
          <br />
          real time.
        </h1>
        <span className="mono-label !text-neutral-500">
          REALTIME CHAT · ROOMS &amp; DMS
        </span>
      </div>

      {/* right: form */}
      <div className="flex items-center justify-center p-10">
        <form className="w-full max-w-[360px]" onSubmit={submit}>
          <span className="mono-label">{isLogin ? 'WELCOME BACK' : 'GET STARTED'}</span>
          <h2 className="text-[34px] mt-3.5 mb-6">{isLogin ? 'Sign in.' : 'Create account.'}</h2>

          <div className="flex flex-col gap-1.5 mb-3.5">
            <label className="mono-label !text-ink-soft">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {!isLogin && (
            <div className="flex flex-col gap-1.5 mb-3.5">
              <label className="mono-label !text-ink-soft">Username</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5 mb-3.5">
            <label className="mono-label !text-ink-soft">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="text-danger text-sm mt-1 mb-3">{error}</div>}

          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? '...' : isLogin ? 'Sign in →' : 'Create account →'}
          </button>

          <div className="mt-4.5 text-sm text-ink-soft">
            {isLogin ? "Don't have an account? " : 'Already have one? '}
            <button
              type="button"
              className="underline font-semibold text-ink"
              onClick={() => {
                setMode(isLogin ? 'register' : 'login');
                setError('');
              }}
            >
              {isLogin ? 'Register' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
