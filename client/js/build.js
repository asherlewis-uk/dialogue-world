import { state, pushLocalMessage, subscribe, setThinking } from './state.js';
import { sendChat, on } from './net.js';

const chatScroll = () => document.getElementById('chat-scroll');
const userInput  = () => document.getElementById('user-input');
const sendBtn    = () => document.getElementById('send-btn');
const chipsEl    = () => document.getElementById('chips');
const streamEl   = () => document.getElementById('stream');

function renderMessage(msg) {
  const div = document.createElement('div');
  div.className = `msg ${msg.role}`;
  if (msg.role === 'ai') {
    div.innerHTML = `<div class="label">Architect</div>${msg.text}${msg.tag ? `<div class="build-tag">✦ ${msg.tag}</div>` : ''}`;
  } else {
    div.textContent = msg.text;
  }
  chatScroll().appendChild(div);
  chatScroll().scrollTop = chatScroll().scrollHeight;
  if (streamEl()) {
    const b = document.createElement('div');
    b.className = 'stream-bubble';
    b.textContent = msg.role === 'ai' ? (msg.text.slice(0, 80) + (msg.text.length > 80 ? '…' : '')) : msg.text;
    streamEl().appendChild(b);
    while (streamEl().children.length > 4) streamEl().removeChild(streamEl().firstChild);
  }
}

function speak(text) {
  if (!state.ttsEnabled || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  u.pitch = 1.05;
  u.volume = 0.85;
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find(v => /samantha|google uk english female|karen|moira|fiona/i.test(v.name))
    || voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'))
    || voices.find(v => v.lang.startsWith('en'));
  if (preferred) u.voice = preferred;
  speechSynthesis.speak(u);
}

function send() {
  const text = userInput().value.trim();
  if (!text) return;
  userInput().value = '';
  sendChat(text);
}

export function initBuild() {
  const particlesEl = document.getElementById('build-particles');
  if (particlesEl && particlesEl.children.length === 0) {
    for (let i = 0; i < 28; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDuration = (12 + Math.random() * 18) + 's';
      p.style.animationDelay = (Math.random() * 12) + 's';
      p.style.width = p.style.height = (2 + Math.random() * 3) + 'px';
      p.style.background = Math.random() > 0.5 ? 'var(--glow)' : 'var(--accent)';
      particlesEl.appendChild(p);
    }
  }

  chatScroll().innerHTML = '';
  state.messages.forEach(renderMessage);

  sendBtn().addEventListener('click', send);
  userInput().addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  chipsEl().addEventListener('click', e => {
    if (e.target.classList.contains('chip')) {
      userInput().value = e.target.dataset.text;
      send();
    }
  });

  on('chat:message', (msg) => {
    pushLocalMessage(msg);
    renderMessage(msg);
  });
  on('architect:thinking', (v) => {
    setThinking(v);
    document.getElementById('input-bar')?.classList.toggle('thinking', !!v);
  });
  on('architect:speak', ({ text }) => speak(text));

  subscribe((s) => {
    const energyVal = document.getElementById('energy-val');
    const energyFill = document.getElementById('energy-fill');
    const structCount = document.getElementById('struct-count');
    if (energyVal) energyVal.textContent = Math.round(s.energy) + '%';
    if (energyFill) energyFill.style.width = s.energy + '%';
    if (structCount) structCount.textContent = s.structures;
  });
}

export function hostSpeak(text) { sendChat(text); }
