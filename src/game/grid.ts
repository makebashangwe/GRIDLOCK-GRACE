/* The map: a square grid of 14 m tiles. Each tile is grass, road, or holds one building. */
import { T } from './tuning';

/** Directions: 0 = east (+X), 1 = south (+Z), 2 = west (-X), 3 = north (-Z). */
export const DX = [1, 0, -1, 0];
export const DZ = [0, 1, 0, -1];
export const opposite = (d: number) => (d + 2) % 4;

export interface Placed {
  id: number;
  kind: 'home' | 'shop';
  i: number;
  j: number;
}

export class Grid {
  readonly n = T.mapTiles;
  readonly road: Uint8Array;
  readonly building: (Placed | null)[];
  readonly tree: Uint8Array;
  /** Cars currently on each tile, refreshed every frame by traffic. */
  readonly load: Uint16Array;

  constructor() {
    const size = this.n * this.n;
    this.road = new Uint8Array(size);
    this.building = new Array(size).fill(null);
    this.tree = new Uint8Array(size);
    this.load = new Uint16Array(size);
  }

  idx(i: number, j: number): number { return j * this.n + i; }
  ij(c: number): [number, number] { return [c % this.n, Math.floor(c / this.n)]; }
  inside(i: number, j: number): boolean { return i >= 0 && j >= 0 && i < this.n && j < this.n; }
  isRoad(i: number, j: number): boolean { return this.inside(i, j) && this.road[this.idx(i, j)] === 1; }
  isFree(i: number, j: number): boolean { const c = this.idx(i, j); return this.inside(i, j) && !this.road[c] && !this.building[c]; }

  /** World position of a tile's center. */
  center(i: number, j: number): { x: number; z: number } {
    return { x: (i - this.n / 2 + 0.5) * T.tile, z: (j - this.n / 2 + 0.5) * T.tile };
  }
  /** Tile under a world position (may be outside the map). */
  tileAt(x: number, z: number): [number, number] {
    return [Math.floor(x / T.tile + this.n / 2), Math.floor(z / T.tile + this.n / 2)];
  }
  /** Bit mask of road neighbors: bit d set when the tile in direction d is road. */
  links(i: number, j: number): number {
    let m = 0;
    for (let d = 0; d < 4; d++) if (this.isRoad(i + DX[d], j + DZ[d])) m |= 1 << d;
    return m;
  }
}
