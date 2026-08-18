export const state = {
  mode: 'build',
  energy: 72,
  structures: 3,
  messages: [],
  objects: [],
  objectMeta: [],
  cameraTarget: { x: 0, y: 8, z: 0 },
  autoOrbit: true,
  presence: [],
  thinking: false,
  connected: false,
  voiceOn: false,
  currentWorldId: 'default',
  currentWorldName: 'The Dialogue',
  worlds: [],
  userId: localStorage.getItem('dialogue-user-id') || `traveler-${Math.random().toString(36).slice(2,8)}`,
  name: localStorage.getItem('dialogue-name') || 'Traveler',
  ttsEnabled: localStorage.getItem('dialogue-tts') !== '0'
};
localStorage.setItem('dialogue-user-id', state.userId);

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function notify(reason = 'update') { listeners.forEach(fn => fn(state, reason)); }

export function setMode(mode) { state.mode = mode; notify('mode'); }
export function applyWorldState(world) {
  if (!world) return;
  state.energy = world.energy ?? 72;
  state.structures = world.structureCount ?? world.structures?.length ?? 0;
  state.messages = world.messages || [];
  state.objectMeta = (world.structures || []).map(s => ({ id: s.id, type: s.type, pos: s.pos, seed: s.seed }));
  state.currentWorldId = world.id;
  state.currentWorldName = world.name || world.id;
  notify('world');
}
export function applyStats(stats) {
  if (!stats) return;
  state.energy = stats.energy;
  state.structures = stats.structures;
  notify('stats');
}
export function pushLocalMessage(msg) {
  state.messages.push(msg);
  if (state.messages.length > 80) state.messages.shift();
  notify('message');
}
export function setThinking(v) { state.thinking = !!v; notify('thinking'); }
export function setPresence(list) { state.presence = list || []; notify('presence'); }
export function setConnected(v) { state.connected = !!v; notify('net'); }
export function setCameraTarget(x, y, z) { state.cameraTarget = { x, y, z }; notify('camera'); }
export function toggleAutoOrbit() { state.autoOrbit = !state.autoOrbit; notify('orbit'); }
export function setVoiceOn(v) { state.voiceOn = !!v; notify('voice'); }
export function setWorlds(list) { state.worlds = list || []; notify('worlds'); }
export function setTts(v) {
  state.ttsEnabled = !!v;
  localStorage.setItem('dialogue-tts', v ? '1' : '0');
  notify('tts');
}
export function registerObject(group, meta) {
  if (group) state.objects.push(group);
  if (meta) state.objectMeta.push(meta);
  notify('object');
}
export function getPublicState() {
  return {
    mode: state.mode, energy: state.energy, structures: state.structures,
    connected: state.connected, presence: state.presence.length,
    thinking: state.thinking, world: state.currentWorldId, voice: state.voiceOn
  };
}
