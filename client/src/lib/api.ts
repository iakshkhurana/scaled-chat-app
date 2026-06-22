import { getToken } from './auth';
import type { Room, Message, User } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

// One small wrapper around fetch that:
//  - prefixes the API url
//  - attaches "Authorization: Bearer <token>" automatically
//  - throws the server's error message so the UI can show it
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `request failed (${res.status})`);
  }
  return data as T;
}

// ---- auth ----
export function register(email: string, username: string, password: string) {
  return request<{ token: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, username, password }),
  });
}

export function login(email: string, password: string) {
  return request<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// ---- rooms ----
export function getPublicRooms() {
  return request<{ rooms: Room[] }>('/rooms').then((r) => r.rooms);
}

export function createRoom(name: string) {
  return request<{ room: Room }>('/rooms', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }).then((r) => r.room);
}

export function getMyRooms() {
  return request<{ rooms: Room[] }>('/me/rooms').then((r) => r.rooms);
}

// ---- messages (history) ----
export function getMessages(roomId: number, before?: string) {
  const qs = before ? `?before=${before}` : '';
  return request<{ messages: Message[]; nextCursor: string | null }>(
    `/rooms/${roomId}/messages${qs}`
  );
}

// ---- dms / users ----
export function getUsers() {
  return request<{ users: User[] }>('/users').then((r) => r.users);
}

export function createDm(userId: number) {
  return request<{ roomId: number }>(`/dms/${userId}`, { method: 'POST' }).then(
    (r) => r.roomId
  );
}
