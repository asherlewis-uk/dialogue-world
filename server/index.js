/**
 * Dialogue World — full-stack real-time server
 * Express + Socket.io
 * Build chat → Architect AI → structure spawn → broadcast to all Play clients
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getWorld, addMessage, addStructure, getStats } from './world.js';
import { architect } from './ai.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3847;
const WORLD_ID = 'default';

const app = express();
app.use(cors());
app.use(express.json());

// Serve the immersive client
app.use(express.static(path.join(__dirname, '../client')));

// REST API
app.get('/api/world', (req, res) => {
  res.json(getWorld(WORLD_ID));
});

app.get('/api/stats', (req, res) => {
  res.json(getStats(WORLD_ID));
});

app.get('/api/health', (_, res) => res.json({ ok: true, version: '1.0.0' }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Track presence
const presence = new Map(); // socket.id → { userId, name, mode }

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId || `anon-${socket.id.slice(0, 6)}`;
  const name = socket.handshake.query.name || 'Traveler';
  presence.set(socket.id, { userId, name, mode: 'build' });

  console.log(`[+] ${name} (${userId}) joined. Online: ${presence.size}`);

  // Send full world state on join
  socket.emit('world:state', getWorld(WORLD_ID));
  socket.emit('presence:update', Array.from(presence.values()));

  // Broadcast presence
  io.emit('presence:update', Array.from(presence.values()));

  // Mode change (Build ↔ Play)
  socket.on('mode:set', (mode) => {
    const p = presence.get(socket.id);
    if (p) {
      p.mode = mode;
      io.emit('presence:update', Array.from(presence.values()));
    }
  });

  // Chat / Build
  socket.on('chat:send', async ({ text }) => {
    if (!text || typeof text !== 'string' || text.trim().length === 0) return;
    text = text.trim().slice(0, 500);

    // store user message
    const userMsg = addMessage(WORLD_ID, {
      role: 'user',
      text,
      userId
    });
    io.emit('chat:message', userMsg);

    // Architect thinks
    socket.emit('architect:thinking', true);

    try {
      const useLLM = !!(process.env.XAI_API_KEY || process.env.OPENAI_API_KEY);
      const result = await architect(text, { userId, useLLM });

      // store AI reply
      const aiMsg = addMessage(WORLD_ID, {
        role: 'ai',
        text: result.reply,
        tag: result.tag,
        userId: 'architect'
      });
      io.emit('chat:message', aiMsg);

      // spawn structure for everyone
      if (result.structure) {
        const structure = addStructure(WORLD_ID, result.structure);
        io.emit('world:structure', structure);
        io.emit('world:stats', getStats(WORLD_ID));
      }
    } catch (err) {
      console.error('Architect error', err);
      const errMsg = addMessage(WORLD_ID, {
        role: 'ai',
        text: 'The fabric of reality flickered for a moment… try again.',
        tag: 'glitch'
      });
      io.emit('chat:message', errMsg);
    } finally {
      socket.emit('architect:thinking', false);
    }
  });

  // Client can request a rebuild of a structure (for late joiners etc.)
  socket.on('world:request', () => {
    socket.emit('world:state', getWorld(WORLD_ID));
  });

  socket.on('disconnect', () => {
    presence.delete(socket.id);
    io.emit('presence:update', Array.from(presence.values()));
    console.log(`[-] ${name} left. Online: ${presence.size}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n  ∞ Dialogue World server`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → Build | Play full-stack ready\n`);
  if (process.env.XAI_API_KEY || process.env.OPENAI_API_KEY) {
    console.log('  LLM Architect: enabled');
  } else {
    console.log('  LLM Architect: rule-based (set XAI_API_KEY or OPENAI_API_KEY for smarter replies)');
  }
});
