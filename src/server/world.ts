import { tileKey } from '../shared/protocol';
import type { Plant, PlantType } from '../shared/protocol';

export interface WorldChange {
  x: number; y: number; plant: Plant | null;
}

export class World {
  // key -> Plant
  private tiles = new Map<string, Plant>();
  private pendingChanges: WorldChange[] = [];

  constructor(public readonly width: number, public readonly height: number) {}

  get(x: number, y: number): Plant | undefined {
    return this.tiles.get(tileKey(x, y));
  }

  plant(x: number, y: number, plant: Plant): boolean {
    if (!this.inBounds(x, y)) return false;
    const k = tileKey(x, y);
    this.tiles.set(k, plant);
    this.pendingChanges.push({ x, y, plant });
    return true;
  }

  clear(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const k = tileKey(x, y);
    const existed = this.tiles.delete(k);
    if (existed) this.pendingChanges.push({ x, y, plant: null });
    return existed;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  // Returns and clears queued changes
  flushChanges(): WorldChange[] {
    const c = this.pendingChanges;
    this.pendingChanges = [];
    return c;
  }

  // Full snapshot export
  snapshot(): Array<[number, number, PlantType, string, number]> {
    const out: Array<[number, number, PlantType, string, number]> = [];
    for (const [k, plant] of this.tiles) {
      const parts = k.split(',');
      const sx = parts[0] ?? '0';
      const sy = parts[1] ?? '0';
      const x = parseInt(sx, 10);
      const y = parseInt(sy, 10);
      out.push([x, y, plant.type, plant.owner, plant.plantedAt]);
    }
    return out;
  }
}
