## Multiplayer Garden Canvas - Initial Architecture (Prototype Phase)

### Goal
Fast-moving prototype of a competitive/cooperative massive(ish) multiplayer garden world: each player owns a small garden plot on a huge shared 2D canvas. Players can plant, help neighbors (water/accelerate growth), or grief (remove / trample) within lightweight rules. Real-time updates via WebSockets.

### Phase 0 Scope (this PR / iteration)
"Just works" in-memory implementation:
* Single Bun process hosting: HTTP (existing) + WebSocket endpoint `/ws`.
* Fixed world size (e.g., 10000 x 10000 tiles).
* Each tile optional Plant object `{ type, plantedAt, ownerId }`.
* Players assigned a deterministic home rectangle (e.g. 8x8) upon first join (simple hashing of user id) – no persistence yet.
* Broadcast full or delta world slices periodically (start: full sync on join + server tick deltas every 1s).
* Client renders a viewport (e.g. 64x64) with pan + basic planting interaction.

### Future (Not in Phase 0)
Sharding, persistence (SQLite/Postgres), auth, anti-botting, protection rules, economy, crafting, biome variation, fog of war, compression (RLE / binary), CRDT or interest management, presence indicators, moderation tools.

---

## Components

| Component | Responsibility |
|-----------|----------------|
| WebSocket Server | Accept connections, assign playerId, maintain sessions, rate-limit actions, apply state mutations, broadcast updates |
| World Model | 2D array (flat typed array) storing plant type + owner + timestamp indexes |
| Tick Scheduler | Every T ms computes growth stage & collects changed tiles for delta push |
| Client State Manager | Maintains latest world viewport window + pending optimistic actions |
| Renderer | Simple grid of div/canvas cells (later: canvas / WebGL) |

### Data Model (Prototype)
```ts
type PlantType = 'seed' | 'flower' | 'tree'; // expand later
interface Plant {
  type: PlantType;
  owner: string;      // playerId
  plantedAt: number;  // epoch ms
}

// Tile representation options:
// 1. Sparse Map<key, Plant>
// 2. Dense arrays (parallel): type[], owner[], plantedAt[]
// Start with sparse Map for simplicity.
```

World key = `"x,y"`.

### Message Protocol (JSON for now)
Envelope:
```ts
interface Msg<T extends string, P = any> { type: T; payload: P }
```
Messages (server -> client):
* `welcome` `{ playerId, worldSize: {w,h}, home: {x,y,w,h}, now }`
* `fullState` `{ tiles: Array<[x,y, plantType, owner, plantedAt]> }` (sent once after welcome)
* `delta` `{ tiles: Array<[x,y, plantType|null, owner?, plantedAt?]> }` (null plantType = cleared)
* `error` `{ code, message }`
* `chat` `{ from, message, ts }` (later)
* `pong` `{ t }
`
Messages (client -> server):
* `plant` `{ x, y, plantType }`
* `clear` `{ x, y }`
* `requestViewport` `{ x, y, w, h }` (Phase 1)
* `ping` `{ t }`

### Basic Rules
* Planting only inside your home OR adjacent to existing owned plant (to allow organic expansion) – phase 0 maybe just home.
* Cooldown: 250ms between plant actions per player.
* Clearing allowed only on owned tiles (anti-grief placeholder).

### Growth (Optional stub)
Compute growth stage client-side from (now - plantedAt). Later convert to server-authoritative.

### Performance Notes
* Start with naive broadcast of every delta to all players.
* Optimize: interest management (only send tiles inside player's viewport) -> binary framing -> compression.

### Scaling Path (Notes)
1. Partition world into regions (e.g., 128x128) -> each region assigned to shard process.
2. Gateway for connection -> route to appropriate shard(s).
3. Persistence via periodic snapshot flush + append-only action log.

### Security / Anti-Grief Roadmap
* Action rate limiter (token bucket).
* Ownership rules, soft protection radius.
* Reputation / moderation queue.
* Signed auth tokens (JWT) + identity provider.

---

## Implementation Order (Concrete)
1. Shared types file `src/shared/protocol.ts`.
2. Server `src/server.ts` adds WebSocket handler at `/ws`.
3. World model module `src/server/world.ts` (Map based).
4. Client WebSocket context + hook `src/client/ws.tsx`.
5. Grid component `src/client/Grid.tsx`.
6. Planting interaction & optimistic UI.
7. Minimal rate limiting & rules.
8. README updates.

---

## Open Questions (Defer)
* Auth user identity vs anonymous ephemeral id.
* Persistence store selection.
* Multi-process scaling threshold.
* Visual theming (ASCII vs pixel vs sprites).

---

Document version: 0.1 (prototype planning)
