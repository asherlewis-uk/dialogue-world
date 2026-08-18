/**
 * Simple auth: guest tokens + optional named users.
 * No external deps — uses Node crypto for signed tokens.
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const SECRET = process.env.AUTH_SECRET || 'dialogue-world-secret-change-me-in-prod';
const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createGuest(name = 'Traveler') {
  const id = `guest-${uuidv4().slice(0, 8)}`;
  const token = sign({
    sub: id,
    name: name.slice(0, 32) || 'Traveler',
    role: 'guest',
    exp: Date.now() + TOKEN_TTL
  });
  return { userId: id, name: name.slice(0, 32) || 'Traveler', token, role: 'guest' };
}

export function createUser(name) {
  const id = `user-${uuidv4().slice(0, 8)}`;
  const token = sign({
    sub: id,
    name: name.slice(0, 32),
    role: 'user',
    exp: Date.now() + TOKEN_TTL
  });
  return { userId: id, name: name.slice(0, 32), token, role: 'user' };
}

export function authFromToken(token) {
  const payload = verify(token);
  if (!payload) return null;
  return {
    userId: payload.sub,
    name: payload.name || 'Traveler',
    role: payload.role || 'guest'
  };
}
