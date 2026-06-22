import { useEffect, useRef, useState, useCallback } from 'react';
import type { Message } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:5050';

// Anything the server can send us.
type ServerEvent =
  | { type: 'ready'; user: { userId: number; username: string } }
  | { type: 'joined'; roomId: number }
  | { type: 'message'; message: Message }
  | { type: 'error'; error: string };

/**
 * Owns ONE WebSocket connection for the whole app.
 *  - connects with the JWT in the query string
 *  - calls `onEvent` for every server event (we keep the latest callback in a
 *    ref so reconnects don't happen just because the handler changed)
 *  - exposes join() and sendMessage()
 */
export function useSocket(token: string | null, onEvent: (e: ServerEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const event = JSON.parse(e.data) as ServerEvent;
      if (event.type === 'ready') setReady(true);
      onEventRef.current(event);
    };
    ws.onclose = () => setReady(false);
    ws.onerror = () => setReady(false);

    return () => ws.close();
  }, [token]);

  const join = useCallback((roomId: number) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'join', roomId }));
    }
  }, []);

  const sendMessage = useCallback((roomId: number, body: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'message', roomId, body }));
    }
  }, []);

  return { ready, join, sendMessage };
}
