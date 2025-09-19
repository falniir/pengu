#!/usr/bin/env bun

import { WORLD_WIDTH, WORLD_HEIGHT, homeRectForPlayer, TokenBucket, type ClientToServer, type Plant, type PlantType, type ServerToClient, type PlayerState } from './shared/protocol';
import { readFileSync } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import { World } from './server/world';

// Basic utility to generate player ids (anonymous)
function generatePlayerId(): string {
  return 'p_' + Math.random().toString(36).slice(2, 10);
}

// Bun types: ServerWebSocket is provided at runtime; declare a minimal alias for TS if not present.
type ServerWS<T = unknown> = any; // fallback minimal type

const PORT = Number(process.env.WS_PORT ?? process.env.PORT ?? 3001); // added

interface ClientSession {
  id: string;
  socket: ServerWS<ClientSession>;
  home: { x: number; y: number; w: number; h: number };
  rateLimiter: TokenBucket; // planting limiter
  lastPlantAt: number;
  x: number;
  y: number;
}

const world = new World(WORLD_WIDTH, WORLD_HEIGHT);

const TICK_MS = 1000; // delta broadcast interval
const PLANT_COOLDOWN_MS = 250;
const RATE_LIMIT = { intervalMs: 1000, max: 20 }; // 20 actions per second burst

const clients = new Set<ClientSession>();
const players = new Map<string, ClientSession>();

function send(socket: ServerWS<ClientSession>, msg: ServerToClient) {
  try { socket.send(JSON.stringify(msg)); } catch {}
}

function broadcast(msg: ServerToClient) {
  const data = JSON.stringify(msg);
  for (const c of clients) {
    try { c.socket.send(data); } catch {}
  }
}

function canPlantInHome(client: ClientSession, x: number, y: number): boolean {
  const { x: hx, y: hy, w, h } = client.home;
  return x >= hx && y >= hy && x < hx + w && y < hy + h;
}

function broadcastPlayersSnapshot() {
  const payload = { players: Array.from(players.values()).map(p => ({ id: p.id, x: p.x, y: p.y, home: p.home })) };
  broadcast({ type: 'players', payload });
}

function handleAction(client: ClientSession, msg: ClientToServer) {
  switch (msg.type) {
    case 'move': {
      const { dx, dy } = msg.payload;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return; // simple validation
      const nx = client.x + dx;
      const ny = client.y + dy;
      if (nx < 0 || ny < 0 || nx >= WORLD_WIDTH || ny >= WORLD_HEIGHT) return;
      client.x = nx; client.y = ny;
      broadcast({ type: 'playerMove', payload: { id: client.id, x: nx, y: ny } });
      break;
    }
    case 'plant': {
      const { x, y, plantType } = msg.payload;
      const now = Date.now();
      if (now - client.lastPlantAt < PLANT_COOLDOWN_MS) return;
      if (!client.rateLimiter.take()) return;
      if (!canPlantInHome(client, x, y)) return;
      const plant: Plant = { type: plantType as PlantType, owner: client.id, plantedAt: now };
      world.plant(x, y, plant);
      client.lastPlantAt = now;
      break;
    }
    case 'clear': {
      const { x, y } = msg.payload;
      const p = world.get(x, y);
      if (!p) return;
      if (p.owner !== client.id) return; // ownership rule
      world.clear(x, y);
      break;
    }
    case 'ping': {
      send(client.socket, { type: 'pong', payload: { t: msg.payload.t } });
      break;
    }
    case 'requestViewport': {
      // Phase 0: ignore, we always broadcast all changes
      break;
    }
  }
}

Bun.serve<{ id: string }, any>({
  port: PORT, // use env-configured port
  fetch(req, server) {
    const { pathname } = new URL(req.url);
    if (pathname === '/ws') {
      const id = generatePlayerId();
      if (server.upgrade(req, { data: { id } })) {
        return; // upgraded
      }
      return new Response('Upgrade failed', { status: 500 });
    }
    // Static file serving from dist
    const distDir = path.resolve(process.cwd(), 'dist');
    let filePath = path.join(distDir, pathname === '/' ? 'index.html' : pathname.slice(1));
    if (!filePath.startsWith(distDir)) {
      return new Response('Forbidden', { status: 403 });
    }
    if (existsSync(filePath)) {
      try {
        const data = readFileSync(filePath);
        const ext = path.extname(filePath);
        const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream';
        return new Response(data, { headers: { 'content-type': type } });
      } catch (e) {
        return new Response('Error reading file', { status: 500 });
      }
    }
    // Fallback 404
    return new Response('Not found', { status: 404 });
  },
  websocket: {
    open(ws) {
      const id = ws.data.id;
      const home = homeRectForPlayer(id);
      const session: ClientSession = {
        id,
        socket: ws as any,
        home,
        rateLimiter: new TokenBucket(RATE_LIMIT),
        lastPlantAt: 0,
        x: home.x + Math.floor(home.w / 2),
        y: home.y + Math.floor(home.h / 2),
      };
      (ws as any).data = session;
      clients.add(session);
      players.set(id, session);

      send(ws as any, { type: 'welcome', payload: { playerId: id, worldSize: { w: WORLD_WIDTH, h: WORLD_HEIGHT }, home, now: Date.now() } });
      send(ws as any, { type: 'fullState', payload: { tiles: world.snapshot() } });
      broadcastPlayersSnapshot();
      console.log('Client connected', id);
    },
    message(ws, message) {
      let parsed: any;
      try { parsed = JSON.parse(String(message)); } catch { return; }
      if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') return;
      const session = (ws as any).data as ClientSession | undefined;
      if (!session) return;
      handleAction(session, parsed as ClientToServer);
    },
    close(ws, code, reason) {
      const session = (ws as any).data as ClientSession | undefined;
      if (session) {
        clients.delete(session);
        players.delete(session.id);
        broadcastPlayersSnapshot();
        console.log('Client disconnected', session.id, 'code=', code, 'reason=', reason);
      }
    },
  }
});

// Tick scheduler: every T ms broadcast deltas
setInterval(() => {
  const changes = world.flushChanges();
  if (changes.length === 0) return;
  const tiles = changes.map(c => c.plant ? [c.x, c.y, c.plant.type, c.plant.owner, c.plant.plantedAt] : [c.x, c.y, null]);
  broadcast({ type: 'delta', payload: { tiles } as any });
}, TICK_MS);

console.log(`Garden server listening on ws://localhost:${PORT}/ws`);
