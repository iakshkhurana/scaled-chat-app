import { createClient } from 'redis';

// We need TWO connections:
//  - `publisher`: pushes new messages onto a channel.
//  - `subscriber`: listens on channels. (A connection in subscribe mode
//    cannot run normal commands, so it MUST be separate from the publisher.)
//
// Channels are named "room:<roomId>". Every ws-service instance subscribes
// to ALL of them via the pattern "room:*" — so a message published by ANY
// instance reaches the clients connected to EVERY instance. That's what lets
// you run more than one ws-service behind a load balancer.

export const publisher = createClient({ url: process.env.REDIS_URL });
export const subscriber = publisher.duplicate();

publisher.on('error', (err) => console.error('redis publisher error:', err));
subscriber.on('error', (err) => console.error('redis subscriber error:', err));

export function roomChannel(roomId: number): string {
  return `room:${roomId}`;
}

// Pull the roomId back out of a channel name like "room:42".
export function roomIdFromChannel(channel: string): number {
  return Number(channel.slice('room:'.length));
}

export async function connectRedis() {
  await Promise.all([publisher.connect(), subscriber.connect()]);
  console.log('redis connected');
}
