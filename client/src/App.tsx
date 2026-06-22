import { useEffect, useState } from 'react';
import { getToken, setToken, clearToken, decodeToken } from './lib/auth';
import { AuthScreen } from './components/AuthScreen';
import { ChatApp } from './components/ChatApp';
import { Landing } from './components/Landing';
import { DocsPage } from './components/DocsPage';

// Tiny hash-based router so a refresh keeps you on the same view:
//   #/        -> landing (home)
//   #/app     -> the chat app (auth screen, or chat once logged in)
function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

function goToApp() {
  window.location.hash = '#/app';
}
function goHome() {
  window.location.hash = '';
}
function goToDocs() {
  window.location.hash = '#/docs';
}

export default function App() {
  const hash = useHashRoute();
  const [token, setTokenState] = useState<string | null>(getToken());
  const me = token ? decodeToken(token) : null;

  // Docs route.
  if (hash.startsWith('#/docs')) {
    return <DocsPage onEnter={goToApp} onHome={goHome} />;
  }

  // Anything that isn't the app route shows the landing page.
  if (!hash.startsWith('#/app')) {
    return <Landing loggedIn={!!token} onEnter={goToApp} onDocs={goToDocs} />;
  }

  // App route, but not logged in -> auth screen.
  if (!token || !me) {
    return (
      <AuthScreen
        onAuthed={(t) => {
          setToken(t);
          setTokenState(t);
        }}
      />
    );
  }

  // Logged in -> chat.
  return (
    <ChatApp
      token={token}
      me={me}
      onLogout={() => {
        clearToken();
        setTokenState(null);
        goHome();
      }}
    />
  );
}
