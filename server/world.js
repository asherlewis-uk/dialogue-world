/**
 * Shared world state + SQLite persistence
 * Structures created by any user appear for everyone in Play mode.
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../data/world.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS worlds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    energy REAL DEFAULT 72,
    created_at INTEGER,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS structures (
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL,
    type TEXT NOT NULL,
    pos_x REAL, pos_y REAL, pos_z REAL,
    seed REAL,
    created_by TEXT,
    created_at INTEGER,
    FOREIGN KEY (world_id) REFERENCES worlds(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    tag TEXT,
    user_id TEXT,
    created_at INTEGER,
    FOREIGN KEY (world_id) REFERENCES worlds(id)
  );

  CREATE INDEX IF NOT EXISTS idx_structures_world ON structures(world_id);
  CREATE INDEX IF NOT EXISTS idx_messages_world ON messages(world_id);
`);

// Ensure default world exists
const defaultWorld = db.prepare('SELECT id FROM worlds WHERE id = ?').get('default');
if (!defaultWorld) {
  const now = Date.now();
  db.prepare('INSERT INTO worlds (id, name, energy, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run('default', 'The Dialogue', 72, now, now);

  // seed starter structures
  const seed = [
    { type: 'tower',   pos: {x:0, y:0, z:0}, seed: 0.42 },
    { type: 'island',  pos: {x:18, y:8, z:4}, seed: 0.17 },
    { type: 'market',  pos: {x:12, y:0, z:-8}, seed: 0.88 },
    { type: 'avatars', pos: {x:0, y:0, z:0}, seed: 0.55 }
  ];
  const insert = db.prepare(`
    INSERT INTO structures (id, world_id, type, pos_x, pos_y, pos_z, seed, created_by, created_at)
    VALUES (?, 'default', ?, ?, ?, ?, ?, 'system', ?)
  `);
  seed.forEach(s => insert.run(uuidv4(), s.type, s.pos.x, s.pos.y, s.pos.z, s.seed, now));
}

export function getWorld(worldId = 'default') {
  const world = db.prepare('SELECT * FROM worlds WHERE id = ?').get(worldId);
  if (!world) return null;

  const structures = db.prepare(`
    SELECT id, type, pos_x as x, pos_y as y, pos_z as z, seed, created_by, created_at
    FROM structures WHERE world_id = ? ORDER BY created_at
  `).all(worldId);

  const messages = db.prepare(`
    SELECT id, role, text, tag, user_id, created_at
    FROM messages WHERE world_id = ? ORDER BY created_at DESC LIMIT 60
  `).all(worldId).reverse();

  return {
    id: world.id,
    name: world.name,
    energy: world.energy,
    structures: structures.map(s => ({
      id: s.id,
      type: s.type,
      pos: { x: s.x, y: s.y, z: s.z },
      seed: s.seed,
      createdBy: s.created_by
    })),
    messages,
    structureCount: structures.length
  };
}

export function addMessage(worldId, { role, text, tag = null, userId = null }) {
  const id = uuidv4();
  const now = Date.now();
  db.prepare(`
    INSERT INTO messages (id, world_id, role, text, tag, user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, worldId, role, text, tag, userId, now);

  // keep energy climbing with conversation
  db.prepare('UPDATE worlds SET energy = MIN(100, energy + ?), updated_at = ? WHERE id = ?')
    .run(role === 'user' ? 1.5 : 0.8, now, worldId);

  return { id, role, text, tag, userId, created_at: now };
}

export function addStructure(worldId, { type, pos, seed = Math.random(), userId = 'anon' }) {
  const id = uuidv4();
  const now = Date.now();
  db.prepare(`
    INSERT INTO structures (id, world_id, type, pos_x, pos_y, pos_z, seed, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, worldId, type, pos.x, pos.y, pos.z, seed, userId, now);

  db.prepare('UPDATE worlds SET energy = MIN(100, energy + 6), updated_at = ? WHERE id = ?')
    .run(now, worldId);

  return {
    id,
    type,
    pos,
    seed,
    createdBy: userId,
    created_at: now
  };
}

export function bumpEnergy(worldId, delta = 1) {
  db.prepare('UPDATE worlds SET energy = MIN(100, energy + ?), updated_at = ? WHERE id = ?')
    .run(delta, Date.now(), worldId);
}

export function getStats(worldId = 'default') {
  const world = db.prepare('SELECT energy FROM worlds WHERE id = ?').get(worldId);
  const count = db.prepare('SELECT COUNT(*) as c FROM structures WHERE world_id = ?').get(worldId);
  return { energy: world?.energy ?? 72, structures: count?.c ?? 0 };
}
