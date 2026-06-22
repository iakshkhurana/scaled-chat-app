import type { CurrentUser } from '../types';

const TOKEN_KEY = 'relay_token';

// We keep the JWT in localStorage so a refresh keeps you logged in.
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// A JWT is "<header>.<payload>.<signature>", each part base64url-encoded.
// We only read the payload to display the username / know our own id.
// (We do NOT trust this for security — the server verifies the signature.)
export function decodeToken(token: string): CurrentUser | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const data = JSON.parse(json);
    return { userId: data.userId, username: data.username };
  } catch {
    return null;
  }
}
