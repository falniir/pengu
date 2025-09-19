// Shared protocol & data model types for Multiplayer Garden Canvas prototype
// Document version 0.1 (prototype planning)

export interface Tile { x: number; y: number; plant?: Plant }




// Player configuration
export interface PlayerConfig {
  maxPlants: number; // max number of plants player can have at once
  rateLimit: RateLimiterConfig; // rate limit for plant/clear actions
}

export interface PlayerProfile {
  id: string;
  name: string;
  color: string; // e.g. "#ff0000"
  skin: string;  // e.g. "elf", "gnome", "human"
  config: PlayerConfig;
}



export type PlantType = 'seed' | 'flower' | 'tree';

export interface Plant {
  type: PlantType;
  owner: string; // playerId
  plantedAt: number; // epoch ms
}

export interface WorldSize { w: number; h: number }
export interface Rect { x: number; y: number; w: number; h: number }

// Generic message envelope
export interface Msg<T extends string, P = any> { type: T; payload: P }

// Server -> Client messages
export interface WelcomePayload {
  playerId: string;
  worldSize: WorldSize;
  home: Rect;
  now: number;
}

export type FullStateTile = [x: number, y: number, plantType: PlantType, owner: string, plantedAt: number];
export interface FullStatePayload { tiles: FullStateTile[] }

// Delta tile: plantType null indicates cleared tile. Owner & plantedAt only when plantType not null.
export type DeltaTile = [x: number, y: number, plantType: PlantType | null, owner?: string, plantedAt?: number];
export interface DeltaPayload { tiles: DeltaTile[] }

export interface ErrorPayload { code: string; message: string }
export interface PongPayload { t: number }

export interface PlayerState { id: PlayerProfile["id"]; x: number; y: number; home: Rect }
export interface PlayersSnapshotPayload { players: PlayerState[] }
export interface PlayerDeltaPayload { id: PlayerProfile["id"]; x: number; y: number }
export interface MoveActionPayload { dx: number; dy: number }

// Client -> Server messages
export interface PlantActionPayload { x: number; y: number; plantType: PlantType }
export interface ClearActionPayload { x: number; y: number }
export interface PingPayload { t: number }
export interface RequestViewportPayload { x: number; y: number; w: number; h: number }

// Discriminated union helpers
export type ServerToClient =
  | Msg<'welcome', WelcomePayload>
  | Msg<'fullState', FullStatePayload>
  | Msg<'delta', DeltaPayload>
  | Msg<'error', ErrorPayload>
  | Msg<'pong', PongPayload>
  | Msg<'players', PlayersSnapshotPayload>
  | Msg<'playerMove', PlayerDeltaPayload>;

export type ClientToServer =
  | Msg<'plant', PlantActionPayload>
  | Msg<'clear', ClearActionPayload>
  | Msg<'ping', PingPayload>
  | Msg<'requestViewport', RequestViewportPayload>
  | Msg<'move', MoveActionPayload>;

// Type guards
export function isClientToServer(msg: any): msg is ClientToServer {
  return msg && typeof msg === 'object' && typeof msg.type === 'string';
}

export const WORLD_WIDTH = 50;
export const WORLD_HEIGHT = 50;

// Home plot size (prototype fixed)
export const HOME_SIZE = 20; // 8x8 rectangle

export function homeRectForPlayer(playerId: string): Rect {
  // Simple deterministic hash -> position within world bounds minus home size
  const h = murmur3(playerId);
  const maxX = WORLD_WIDTH - HOME_SIZE;
  const maxY = WORLD_HEIGHT - HOME_SIZE;
  const x = h % maxX;
  const y = Math.floor(h / maxX) % maxY;
  return { x, y, w: HOME_SIZE, h: HOME_SIZE };
}

// Lightweight murmur3-ish hash for determinism (not cryptographic)
export function murmur3(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return (h >>> 0);
}

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export interface RateLimiterConfig { intervalMs: number; max: number }

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(private config: RateLimiterConfig) {
    this.tokens = config.max;
    this.lastRefill = Date.now();
  }

  take(): boolean {
    this.refill();
    if (this.tokens > 0) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  private refill() {
    const now = Date.now();
    const delta = now - this.lastRefill;
    if (delta >= this.config.intervalMs) {
      const n = Math.floor(delta / this.config.intervalMs);
      this.tokens = Math.min(this.config.max, this.tokens + n);
      this.lastRefill += n * this.config.intervalMs;
    }
  }
}
