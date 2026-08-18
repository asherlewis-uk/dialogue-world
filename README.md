# Dialogue World

**Full-stack AI conversational Second Life** — multi-world, auth, voice, real-time multiplayer.

Speak in **Build** → Architect materializes geometry → everyone in **Play** sees it live.

## Features (v1.1)

- **Build | Play** Grok-style mode switch
- **Multi-world**: create & join many worlds
- **Auth**: guest tokens + named users (signed tokens)
- **Voice**: Architect TTS (browser Speech Synthesis) + voice presence + WebRTC signaling ready
- **Real-time multiplayer** via Socket.io
- **Persistent worlds** (SQLite)
- **Architect AI**: rule-based + optional Grok / OpenAI LLM
- **Diegetic Game HUD**, Conversation Energy, structure spawning
- Docker + zero-frontend-build

## Quick Start

```bash
git clone https://github.com/asherlewis-uk/dialogue-world.git
cd dialogue-world
cd server && npm install && cd ..
npm start
# → http://localhost:3847
```

Optional LLM:
```bash
cp .env.example .env
# XAI_API_KEY=... or OPENAI_API_KEY=...
```

Docker:
```bash
docker compose up --build
```

## Architecture

```
client/          immersive Vanilla + Three.js + Socket.io frontend
server/
  index.js       Express + Socket.io + multi-world rooms + voice signaling
  world.js       multi-world SQLite persistence
  ai.js          Architect
  auth.js        guest + named signed tokens
data/            SQLite
```

## Host API

```js
window.__experience.setMode("play")
window.__experience.speak("raise a crystalline tower")
window.__experience.joinWorld("some-world-id")
window.__experience.getState()
```

## License

MIT
