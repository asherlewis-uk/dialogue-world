/**
 * Real-time + auth + multi-world + voice signaling
 */
let socket = null;
let connected = false;
const listeners = new Map();
let token = localStorage.getItem('dialogue-token') || null;

export function connect(userId = null, name = 'Traveler') {
  if (socket) return socket;
  const opts = {
    transports: ['websocket', 'polling'],
    auth: token ? { token } : {},
    query: { name }
  };
  socket = io(opts);

  socket.on('connect', () => {
    connected = true;
    emitLocal('net:connected');
  });
  socket.on('disconnect', () => {
    connected = false;
    emitLocal('net:disconnected');
  });
  socket.on('auth:token', (t) => {
    token = t;
    localStorage.setItem('dialogue-token', t);
  });

  ['world:state', 'world:structure', 'world:stats', 'chat:message',
   'presence:update', 'architect:thinking', 'architect:speak', 'voice:signal', 'error']
    .forEach(evt => socket.on(evt, data => emitLocal(evt, data)));

  return socket;
}

export function isConnected() { return connected && socket?.connected; }
export function sendChat(text) { if (socket) socket.emit('chat:send', { text }); }
export function setMode(mode) { if (socket) socket.emit('mode:set', mode); }
export function joinWorld(worldId) { if (socket) socket.emit('world:join', worldId); }
export function setVoice(on) { if (socket) socket.emit('voice:state', !!on); }
export function signalVoice(data) { if (socket) socket.emit('voice:signal', data); }
export function requestWorld() { if (socket) socket.emit('world:request'); }

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

function emitLocal(event, data) {
  listeners.get(event)?.forEach(fn => { try { fn(data); } catch(e){ console.error(e); } });
}

export async function apiGuest(name) {
  const res = await fetch('/api/auth/guest', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  const data = await res.json();
  token = data.token;
  localStorage.setItem('dialogue-token', token);
  localStorage.setItem('dialogue-name', data.name);
  return data;
}

export async function apiListWorlds() {
  const res = await fetch('/api/worlds');
  return res.json();
}

export async function apiCreateWorld(name, description) {
  const res = await fetch('/api/worlds', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    },
    body: JSON.stringify({ name, description, isPublic: true })
  });
  return res.json();
}

export function getSocket() { return socket; }
export function getToken() { return token; }
