import { state, setMode, applyWorldState, applyStats, setPresence, setConnected, getPublicState, setWorlds, setVoiceOn, setTts } from './state.js';
import { initBuild, hostSpeak } from './build.js';
import { initPlay, showTip, isReady } from './play.js';
import { connect, on, setMode as netSetMode, isConnected, apiGuest, apiListWorlds, apiCreateWorld, joinWorld, setVoice } from './net.js';

const modeBtns  = document.querySelectorAll('.mode-btn');
const buildView = document.getElementById('build-view');
const playView  = document.getElementById('play-view');

function switchMode(mode) {
  if (mode === state.mode) return;
  setMode(mode);
  netSetMode(mode);
  modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  if (mode === 'play') {
    buildView.classList.add('hidden');
    playView.classList.add('active');
    if (!isReady()) initPlay();
    showTip();
  } else {
    playView.classList.remove('active');
    buildView.classList.remove('hidden');
  }
}

async function refreshWorlds() {
  try {
    const list = await apiListWorlds();
    setWorlds(list);
    renderWorldList(list);
  } catch (e) { console.warn(e); }
}

function renderWorldList(list) {
  const el = document.getElementById('world-list');
  if (!el) return;
  el.innerHTML = (list || []).map(w => `
    <button class="world-item ${w.id === state.currentWorldId ? 'active' : ''}" data-id="${w.id}">
      <span class="w-name">${w.name}</span>
      <span class="w-meta">${w.structureCount || 0} structures · ${Math.round(w.energy||0)}%</span>
    </button>
  `).join('');
  el.querySelectorAll('.world-item').forEach(btn => {
    btn.addEventListener('click', () => {
      joinWorld(btn.dataset.id);
      document.getElementById('world-panel')?.classList.remove('open');
    });
  });
}

export function boot() {
  const savedName = localStorage.getItem('dialogue-name');
  if (!savedName || savedName === 'Traveler') {
    const name = prompt('What should we call you in Dialogue?', 'Traveler') || 'Traveler';
    localStorage.setItem('dialogue-name', name);
    state.name = name;
    apiGuest(name).catch(() => {});
  }

  connect(state.userId, state.name);

  on('net:connected', () => { setConnected(true); refreshWorlds(); });
  on('net:disconnected', () => setConnected(false));
  on('world:state', (world) => {
    applyWorldState(world);
    const label = document.getElementById('world-name-label');
    if (label) label.textContent = world.name || world.id;
  });
  on('world:stats', applyStats);
  on('presence:update', setPresence);

  modeBtns.forEach(btn => btn.addEventListener('click', () => switchMode(btn.dataset.mode)));

  document.getElementById('btn-worlds')?.addEventListener('click', () => {
    document.getElementById('world-panel')?.classList.toggle('open');
    refreshWorlds();
  });
  document.getElementById('btn-create-world')?.addEventListener('click', async () => {
    const name = prompt('Name your new world:');
    if (!name) return;
    const w = await apiCreateWorld(name, 'A new place born from dialogue.');
    if (w?.id) {
      joinWorld(w.id);
      refreshWorlds();
    }
  });

  document.getElementById('btn-tts')?.addEventListener('click', () => {
    setTts(!state.ttsEnabled);
    document.getElementById('btn-tts')?.classList.toggle('active', state.ttsEnabled);
  });
  document.getElementById('btn-voice')?.addEventListener('click', () => {
    const next = !state.voiceOn;
    setVoiceOn(next);
    setVoice(next);
    document.getElementById('btn-voice')?.classList.toggle('active', next);
  });

  initBuild();
  setTimeout(() => { if (!isReady()) initPlay(); }, 600);

  window.__experience = {
    setMode: switchMode,
    getState: getPublicState,
    speak: hostSpeak,
    isConnected,
    joinWorld,
    version: '1.1.0-fullstack-auth-multi-voice'
  };

  console.log('%cDialogue World full-stack ready', 'color:#22d3ee;font-weight:bold');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
