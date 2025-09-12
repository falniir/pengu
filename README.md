## Multiplayer Garden Canvas Prototype

Phase 0 prototype implementing an in-memory world, WebSocket server, and simple React client grid.

### Install
## Getting Started

Install dependencies:

```bash
bun install
```

Build client and start server (dev):

```bash
bun dev
```

Build client and start server (production):

```bash
bun start
```

Open your browser to [http://localhost:3000](http://localhost:3000) to view the app.

## Project Structure

- `src/server.ts`: Bun HTTP/WebSocket server
- `src/shared/protocol.ts`: Shared types and protocol
- `src/server/world.ts`: World model
- `src/client/`: Client React app
- `src/index.html`: Client entrypoint

## Features

- Real-time multiplayer garden world
- Plant, clear, pan viewport
- Home plot assignment

---

This project uses Bun v1+ and React 19. See ARCHITECTURE.md for design notes.

### Development
---
Generated on: 2025-09-12
Open: http://localhost:3000/

### Production Build & Run
```bash
bun run build
bun run server
```
Or single command:
```bash
bun start
```

### Architecture Summary
See `ARCHITECTURE.md` for details. Key aspects implemented:
* World: 10k x 10k sparse Map of plants.
* Player: Anonymous id; deterministic 8x8 home plot.
* Actions: Plant / Clear with basic ownership + cooldown (250ms) + rate limit.
* Sync: Full snapshot on connect + delta broadcast each second.
* Client: 64x64 viewport, pan controls (8 tile steps), simple color-coded cells.

### Next Potential Enhancements
* Interest-based viewport deltas instead of global broadcast.
* Binary framing & compression.
* Persistence layer & auth.
* Growth stages and visuals.
* Anti-grief rules beyond ownership.

---
Generated on: 2025-09-12
