/* Routing: A* over road tiles (busy tiles cost more, so drivers spread out),
   then the route is turned into a smooth lane path a car can follow. */
import { Grid, DX, DZ } from './grid';
import { T } from './tuning';

/** Shortest road route between two road tiles (cell indexes), or null if they aren't connected. */
export function findRoute(g: Grid, from: number, to: number): number[] | null {
  if (!g.road[from] || !g.road[to]) return null;
  if (from === to) return [from];
  const n = g.n, size = n * n;
  const cost = new Float32Array(size).fill(Infinity), prev = new Int32Array(size).fill(-1), done = new Uint8Array(size);
  const [ti, tj] = g.ij(to);
  const open: number[] = [from]; cost[from] = 0;
  const f = (c: number) => { const [i, j] = g.ij(c); return cost[c] + Math.abs(i - ti) + Math.abs(j - tj); };
  while (open.length) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (f(open[k]) < f(open[bi])) bi = k;
    const c = open[bi]; open.splice(bi, 1);
    if (c === to) break;
    if (done[c]) continue; done[c] = 1;
    const [i, j] = g.ij(c);
    for (let d = 0; d < 4; d++) {
      const ni = i + DX[d], nj = j + DZ[d];
      if (!g.isRoad(ni, nj)) continue;
      const nc = g.idx(ni, nj), step = 1 + Math.min(g.load[nc], 8) * 0.35;
      if (cost[c] + step < cost[nc]) { cost[nc] = cost[c] + step; prev[nc] = c; open.push(nc); }
    }
  }
  if (prev[to] < 0) return null;
  const path = [to]; for (let c = to; c !== from; ) { c = prev[c]; path.unshift(c); }
  return path;
}

export interface Pt { x: number; z: number }

/** Lane path through a chain of tiles: start building tile, road tiles..., end building tile.
    Cars drive on the right, cross tile edges in their lane, and round each turn with a curve. */
export function lanePath(g: Grid, chain: number[]): Pt[] {
  const pts: Pt[] = [];
  const dirOf = (a: number, b: number) => { const [ai, aj] = g.ij(a), [bi, bj] = g.ij(b); for (let d = 0; d < 4; d++) if (ai + DX[d] === bi && aj + DZ[d] === bj) return d; return 0; };
  const edge = (a: number, b: number): Pt => {
    const d = dirOf(a, b), [ai, aj] = g.ij(a), c = g.center(ai, aj);
    const rx = -DZ[d], rz = DX[d];   // right-hand side of travel
    return { x: c.x + DX[d] * T.tile / 2 + rx * T.laneOffset, z: c.z + DZ[d] * T.tile / 2 + rz * T.laneOffset };
  };
  for (let k = 0; k < chain.length - 1; k++) {
    const e = edge(chain[k], chain[k + 1]);
    if (k > 0) {   // the tile chain[k] is a road tile: curve if the direction changes inside it
      const din = dirOf(chain[k - 1], chain[k]), dout = dirOf(chain[k], chain[k + 1]);
      const last = pts[pts.length - 1];
      if (din !== dout) {
        const ctl = DX[din] !== 0 ? { x: e.x, z: last.z } : { x: last.x, z: e.z };
        for (const t of [0.25, 0.5, 0.75]) {
          const u = 1 - t;
          pts.push({ x: u * u * last.x + 2 * u * t * ctl.x + t * t * e.x, z: u * u * last.z + 2 * u * t * ctl.z + t * t * e.z });
        }
      }
    }
    pts.push(e);
  }
  // pull a little into the start and end tiles so cars appear at the driveway and disappear at the door
  if (pts.length) {
    const a = pts[0], b = pts[pts.length - 1];
    const s0 = g.center(...g.ij(chain[0])), s1 = g.center(...g.ij(chain[chain.length - 1]));
    pts.unshift({ x: a.x + (s0.x - a.x) * 0.35, z: a.z + (s0.z - a.z) * 0.35 });
    pts.push({ x: b.x + (s1.x - b.x) * 0.35, z: b.z + (s1.z - b.z) * 0.35 });
  }
  return pts;
}
