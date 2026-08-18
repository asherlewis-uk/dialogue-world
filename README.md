# Dialogue World

**Full-stack AI conversational Second Life.**

Speak in **Build** mode → the Architect materializes real geometry → everyone sees it appear live in **Play** mode.

Grok-style mode switch: **Build | Play**

- **Build** = immersive chat that creates the world
- **Play** = shared 3D Game HUD / canvas (floating islands, crystalline towers of dialogue, avatar circles, markets of creation…)

## Architecture

```
dialogue-world/
├── client/                 # thin immersive frontend (Vanilla + Three.js + Socket.io)
│   ├── index.html
│   ├── css/styles.css
│   └── js/                 # state, net, build, play, structures, app
├── server/                 # full Node backend
│   ├── index.js            # Express + Socket.io
│   ├── world.js            # SQLite persistence + shared world
│   ├── ai.js               # Architect (rules + optional Grok/OpenAI)
│   └── package.json
├── data/                   # SQLite DB lives here
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## Quick Start (local)

```bash
# 1. Install server deps
cd server && npm install && cd ..

# 2. Run
npm start
# → http://localhost:3847
```

Open the URL. Chat in Build, switch to Play, watch the world grow.  
Open a second browser tab — everything is multiplayer and persistent.

### Optional smarter Architect

```bash
cp .env.example .env
# put XAI_API_KEY=... or OPENAI_API_KEY=...
npm start
```

## Docker

```bash
docker compose up --build
# → http://localhost:3847
```

## Features

| Feature | Status |
|---------|--------|
| Grok-style Build \| Play switch | ✅ |
| Real-time multiplayer world | ✅ Socket.io |
| Persistent world (SQLite) | ✅ |
| Architect AI that builds structures | ✅ rules + optional LLM |
| Diegetic Game HUD | ✅ energy, structures, stream |
| Conversation Energy | ✅ |
| Host API `window.__experience` | ✅ |
| Docker ready | ✅ |
| Thin client, zero frontend build | ✅ |

## Host API (browser console)

```js
window.__experience.setMode("play")
window.__experience.speak("raise a crystalline tower of light")
window.__experience.getState()
```

## API (server)

- `GET /api/world` — full world state
- `GET /api/stats` — energy + structure count
- Socket events: `chat:send`, `world:structure`, `world:state`, `presence:update` …

## License

MIT
