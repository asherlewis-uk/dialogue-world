/**
 * Dialogue World — full-stack multi-world real-time server
 * Auth + multiple worlds + voice signaling + Architect
 */
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { listWorlds, createWorld, getWorld, addMessage, addStructure, getStats, joinWorld } from './world.js';
import { architect } from './ai.js';
import { createGuest, createUser, authFromToken } from './auth.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3847;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

app.post('/api/auth/guest', (req, res) => {
  const name = (req.body?.name || 'Traveler').slice(0, 32);
  res.json(createGuest(name));
});

app.post('/api/auth/user', (req, res) => {
  const name = (req.body?.name || '').trim().slice(0, 32);
  if (!name) return res.status(400).json({ error: 'name required' });
  res.json(createUser(name));
});

app.get('/api/worlds', (req, res) => {
  res.json(listWorlds({ publicOnly: true }));
});

app.post('/api/worlds', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const user = authFromToken(token) || { userId: 'anon', name: 'Traveler' };
  const { name, description, isPublic = true } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const world = createWorld({ name, description, ownerId: user.userId, isPublic });
  res.json(world);
});

app.get('/api/worlds/:id', (req, res) => {
  const w = getWorld(req.params.id);
  if (!w) return res.status(404).json({ error: 'world not found' });
  res.json(w);
});

app.get('/api/health', (_, res) => res.json({ ok: true, version: '1.1.0-multi' }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const presence = new Map();

io.on('connection', (socket) => {
  let user = null;
  let currentWorld = 'default';

  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  user = authFromToken(token);
  if (!user) {
    const g = createGuest(socket.handshake.query?.name || 'Traveler');
    user = { userId: g.userId, name: g.name, role: 'guest' };
    socket.emit('auth:token', g.token);
  }

  presence.set(socket.id, {
    userId: user.userId,
    name: user.name,
    mode: 'build',
    worldId: currentWorld,
    voice: false
  });

  console.log(`[+] ${user.name} joined world ${currentWorld}. Online: ${presence.size}`);

  socket.join(`world:${currentWorld}`);
  joinWorld(currentWorld, user.userId);
  socket.emit('world:state', getWorld(currentWorld));
  io.to(`world:${currentWorld}`).emit('presence:update', getPresenceForWorld(currentWorld));

  socket.on('world:join', (worldId) => {
    if (!worldId) return;
    const w = getWorld(worldId);
    if (!w) return socket.emit('error', { message: 'World not found' });
    socket.leave(`world:${currentWorld}`);
    currentWorld = worldId;
    socket.join(`world:${currentWorld}`);
    const p = presence.get(socket.id);
    if (p) p.worldId = currentWorld;
    joinWorld(currentWorld, user.userId);
    socket.emit('world:state', w);
    io.to(`world:${currentWorld}`).emit('presence:update', getPresenceForWorld(currentWorld));
  });

  socket.on('mode:set', (mode) => {
    const p = presence.get(socket.id);
    if (p) {
      p.mode = mode;
      io.to(`world:${currentWorld}`).emit('presence:update', getPresenceForWorld(currentWorld));
    }
  });

  socket.on('voice:signal', (data) => {
    if (data.to) {
      for (const [sid, p] of presence) {
        if (p.userId === data.to && p.worldId === currentWorld) {
          io.to(sid).emit('voice:signal', { from: user.userId, ...data });
        }
      }
    } else {
      socket.to(`world:${currentWorld}`).emit('voice:signal', { from: user.userId, ...data });
    }
  });

  socket.on('voice:state', (on) => {
    const p = presence.get(socket.id);
    if (p) {
      p.voice = !!on;
      io.to(`world:${currentWorld}`).emit('presence:update', getPresenceForWorld(currentWorld));
    }
  });

  socket.on('chat:send', async ({ text }) => {
    if (!text || typeof text !== 'string' || !text.trim()) return;
    text = text.trim().slice(0, 500);

    const userMsg = addMessage(currentWorld, { role: 'user', text, userId: user.userId });
    io.to(`world:${currentWorld}`).emit('chat:message', userMsg);

    socket.emit('architect:thinking', true);
    try {
      const useLLM = !!(process.env.XAI_API_KEY || process.env.OPENAI_API_KEY);
      const result = await architect(text, { userId: user.userId, useLLM });

      const aiMsg = addMessage(currentWorld, {
        role: 'ai', text: result.reply, tag: result.tag, userId: 'architect'
      });
      io.to(`world:${currentWorld}`).emit('chat:message', aiMsg);
      io.to(`world:${currentWorld}`).emit('architect:speak', { text: result.reply, tag: result.tag });

      if (result.structure) {
        const structure = addStructure(currentWorld, result.structure);
        io.to(`world:${currentWorld}`).emit('world:structure', structure);
        io.to(`world:${currentWorld}`).emit('world:stats', getStats(currentWorld));
      }
    } catch (err) {
      console.error(err);
      const errMsg = addMessage(currentWorld, {
        role: 'ai', text: 'The fabric of reality flickered… try again.', tag: 'glitch'
      });
      io.to(`world:${currentWorld}`).emit('chat:message', errMsg);
    } finally {
      socket.emit('architect:thinking', false);
    }
  });

  socket.on('world:request', () => {
    socket.emit('world:state', getWorld(currentWorld));
  });

  socket.on('disconnect', () => {
    presence.delete(socket.id);
    io.to(`world:${currentWorld}`).emit('presence:update', getPresenceForWorld(currentWorld));
    console.log(`[-] ${user.name} left. Online: ${presence.size}`);
  });
});

function getPresenceForWorld(worldId) {
  return Array.from(presence.values()).filter(p => p.worldId === worldId);
}

httpServer.listen(PORT, () => {
  console.log(`\n  ∞ Dialogue World (multi-world + auth + voice)`);
  console.log(`  → http://localhost:${PORT}\n`);
});
