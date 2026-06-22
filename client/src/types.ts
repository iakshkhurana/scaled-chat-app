// Shapes returned by the api-service + ws-service.

export interface Room {
  id: number;
  name: string | null; // null for a brand-new public room with no name; DMs get the partner's name from /me/rooms
  type: 'public' | 'dm';
  created_at: string;
}

export interface Message {
  id: string; // BIGSERIAL comes back as a string
  room_id: number;
  sender_id: number;
  username: string;
  body: string;
  created_at: string;
}

export interface User {
  id: number;
  username: string;
}

// What we decode out of the JWT to know who "I" am.
export interface CurrentUser {
  userId: number;
  username: string;
}
