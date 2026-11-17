/* The map: a square grid of 14 m tiles. Each tile is grass, road, or holds one building. */
import { T } from './tuning';

/** Directions: 0 = east (+X), 1 = south (+Z), 2 = west (-X), 3 = north (-Z). */
export const DX = [1, 0, -1, 0];
export const DZ = [0, 1, 0, -1];
export const opposite = (d: number) => (d + 2) % 4;

/** What controls a crossing. Only tiles where 3 or 4 roads meet can have one. */
export const J_NONE = 0, J_STOP = 1, J_LIGHT = 2, J_ROUND = 3;

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
  /** Crossing control per tile (J_NONE, J_STOP, J_LIGHT, J_ROUND). */
  readonly junction: Uint8Array;
  /** Road tiles actually spent on each crossing's control (free upgrade tokens spend none). */
  readonly jspent: Uint8Array;

  constructor() {
    const size = this.n * this.n;
    this.road = new Uint8Array(size);
    this.building = new Array(size).fill(null);
    this.tree = new Uint8Array(size);
    this.load = new Uint16Array(size);
    this.junction = new Uint8Array(size);
    this.jspent = new Uint8Array(size);
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
  /** Is this a crossing (a road tile where 3 or 4 roads meet)? */
  isCrossing(c: number): boolean {
    if (!this.road[c]) return false;
    const [i, j] = this.ij(c); let n = 0;
    for (let d = 0; d < 4; d++) if (this.isRoad(i + DX[d], j + DZ[d])) n++;
    return n >= 3;
  }
  /** The control that's actually working on a tile (a sign on a tile that's no longer a crossing does nothing). */
  control(c: number): number { return this.junction[c] && this.isCrossing(c) ? this.junction[c] : J_NONE; }

  /** Bit mask of road neighbors: bit d set when the tile in direction d is road. */
  links(i: number, j: number): number {
    let m = 0;
    for (let d = 0; d < 4; d++) if (this.isRoad(i + DX[d], j + DZ[d])) m |= 1 << d;
    return m;
  }
}
