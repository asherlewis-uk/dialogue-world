/**
 * The Architect — turns free-form conversation into world-building actions.
 * Rule-based core (always works) + optional LLM enhancement if OPENAI_API_KEY / XAI_API_KEY present.
 */

const TYPE_KEYWORDS = [
  { type: 'tower',   keys: ['tower', 'crystal', 'spire', 'obelisk', 'monolith', 'beacon'] },
  { type: 'island',  keys: ['island', 'garden', 'float', 'tree', 'forest', 'waterfall', 'grove'] },
  { type: 'market',  keys: ['market', 'plaza', 'bazaar', 'stall', 'shop', 'trade', 'marketplace'] },
  { type: 'avatars', keys: ['avatar', 'friend', 'circle', 'people', 'gather', 'sit', 'community', 'group'] },
  { type: 'city',    keys: ['city', 'home', 'house', 'sanctuary', 'neighborhood', 'village', 'town'] }
];

function detectType(text) {
  const lower = text.toLowerCase();
  for (const { type, keys } of TYPE_KEYWORDS) {
    if (keys.some(k => lower.includes(k))) return type;
  }
  return 'generic';
}

function randomPos(type) {
  if (type === 'tower' || type === 'avatars') return { x: 0, y: 0, z: 0 };
  if (type === 'market') return { x: 12 + (Math.random()-0.5)*4, y: 0, z: -8 + (Math.random()-0.5)*4 };
  if (type === 'city') return { x: -14 + (Math.random()-0.5)*6, y: 0, z: 10 + (Math.random()-0.5)*6 };
  // island / generic
  const angle = Math.random() * Math.PI * 2;
  const dist = 12 + Math.random() * 14;
  return {
    x: Math.cos(angle) * dist,
    y: type === 'island' ? 5 + Math.random() * 6 : 2 + Math.random() * 5,
    z: Math.sin(angle) * dist
  };
}

const REPLIES = {
  tower:   'A magnificent crystalline tower of pure dialogue light rises. Its facets catch every spoken word and refract them into new paths.',
  island:  'Lush floating islands bloom into existence — waterfalls of light, dream forests, soft moss platforms that drift on conversation currents.',
  market:  'The Market of Creations opens. Stalls of ideas, glowing canopies, and avatars trading stories materialize around the plaza.',
  avatars: 'A circle of friends gathers on the glowing platform. Their conversation threads weave new constellations into the sky.',
  city:    'Entire neighborhoods of narrative architecture unfold — homes that remember every conversation that shaped them.',
  generic: 'Beautiful. I have woven your words into the fabric of this world. A new structure takes form.'
};

/**
 * Process a user message and return { reply, structure? }
 */
export async function architect(text, { userId = 'anon', useLLM = false } = {}) {
  const type = detectType(text);
  const pos = randomPos(type);
  const seed = Math.random();

  let reply = REPLIES[type] || REPLIES.generic;
  let tag = type === 'generic' ? 'new structure' : type;

  // Optional LLM enhancement (if key present)
  if (useLLM && (process.env.XAI_API_KEY || process.env.OPENAI_API_KEY)) {
    try {
      const enhanced = await callLLM(text, type);
      if (enhanced?.reply) reply = enhanced.reply;
      if (enhanced?.tag) tag = enhanced.tag;
    } catch (e) {
      console.warn('LLM call failed, falling back to rules:', e.message);
    }
  }

  // make generic replies a bit more personal
  if (type === 'generic') {
    reply = `I hear you. “${text.slice(0, 48)}${text.length > 48 ? '…' : ''}” has been woven into the world as a new luminous form.`;
  }

  return {
    reply,
    tag,
    structure: {
      type,
      pos,
      seed,
      createdBy: userId
    }
  };
}

async function callLLM(userText, detectedType) {
  const key = process.env.XAI_API_KEY || process.env.OPENAI_API_KEY;
  const base = process.env.XAI_API_KEY
    ? 'https://api.x.ai/v1'
    : 'https://api.openai.com/v1';
  const model = process.env.XAI_API_KEY ? 'grok-beta' : 'gpt-4o-mini';

  const system = `You are the Architect of a living virtual world called Dialogue.
Users speak and you materialize structures. Current detected type: ${detectedType}.
Reply in 1-2 poetic sentences describing what you just built. Keep it warm, immersive, second-person.
Also return a short tag (2-4 words). Respond as JSON: {"reply":"...","tag":"..."}`;

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userText }
      ],
      temperature: 0.85,
      max_tokens: 120,
      response_format: { type: 'json_object' }
    })
  });

  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  return JSON.parse(content);
}
