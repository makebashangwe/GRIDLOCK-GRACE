/* Routing: A* over road tiles (busy tiles cost more, so drivers spread out),
   then the route is turned into a smooth lane path a car can follow. */
import { Grid, DX, DZ, J_ROUND } from './grid';
import { T } from './tuning';

/* Route nodes: a ground tile is its cell index c; the highway deck above it is c + n*n. */
export const isHigh = (g: Grid, node: number) => node >= g.n * g.n;
export const cellOf = (g: Grid, node: number) => node % (g.n * g.n);

/** Shortest route between two ground road tiles (cell indexes), over streets and highways, or null if they
    aren't connected. Busy tiles cost more, so drivers spread out; highways cost less, so drivers use them. */
export function findRoute(g: Grid, from: number, to: number): number[] | null {
  if (!g.road[from] || !g.road[to]) return null;
  if (from === to) return [from];
  const size = g.n * g.n;
  const cost = new Float32Array(size * 2).fill(Infinity), prev = new Int32Array(size * 2).fill(-1), done = new Uint8Array(size * 2);
  const [ti, tj] = g.ij(to);
  const open: number[] = [from]; cost[from] = 0;
  // the estimate must never overshoot, so it counts every tile at the cheapest (highway) price
  const f = (v: number) => { const [i, j] = g.ij(v % size); return cost[v] + 0.45 * (Math.abs(i - ti) + Math.abs(j - tj)); };
  const relax = (v: number, w: number, step: number) => { if (cost[v] + step < cost[w]) { cost[w] = cost[v] + step; prev[w] = v; open.push(w); } };
  while (open.length) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (f(open[k]) < f(open[bi])) bi = k;
    const v = open[bi]; open.splice(bi, 1);
    if (v === to) break;
    if (done[v]) continue; done[v] = 1;
    const high = v >= size, c = v % size, [i, j] = g.ij(c);
    for (let d = 0; d < 4; d++) {
      const ni = i + DX[d], nj = j + DZ[d]; if (!g.inside(ni, nj)) continue;
      const nc = g.idx(ni, nj);
      if (!high) {
        if (g.connects(i, j, d)) { const av = g.isAvenue(nc); relax(v, nc, (av ? 0.65 : 1) + Math.min(g.load[nc], 8) * (av ? 0.15 : 0.35)); }
        if (g.hwy[nc] && g.rampDir(nc) === (d + 2) % 4) relax(v, nc + size, 0.6);   // onto a ramp
      } else {
        if (g.hwy[nc]) relax(v, nc + size, 0.45 + Math.min(g.hload[nc], 10) * 0.08);
        if (g.rampDir(c) === d && g.road[nc]) relax(v, nc, 0.6);   // off the ramp onto the street
      }
    }
  }
  if (prev[to] < 0) return null;
  const path = [to]; for (let c = to; c !== from; ) { c = prev[c]; path.unshift(c); }
  return path;
}

/** A point on a lane path; y is the height (0 on the street, the deck top on a highway). */
export interface Pt { x: number; z: number; y?: number }

/** Lane path through a chain of tiles: start building tile, road tiles..., end building tile.
    Cars drive on the right, cross tile edges in their lane, and round each turn with a curve.
    `lane` picks the inner (0) or outer (1) lane on avenues. */
export function lanePath(g: Grid, chain: number[], lane = 0): Pt[] {
  const pts: Pt[] = [];
  const size = g.n * g.n, cell = (v: number) => v % size, high = (v: number) => v >= size;
  const dirOf = (a: number, b: number) => { const [ai, aj] = g.ij(cell(a)), [bi, bj] = g.ij(cell(b)); for (let d = 0; d < 4; d++) if (ai + DX[d] === bi && aj + DZ[d] === bj) return d; return 0; };
  const edge = (a: number, b: number): Pt => {
    const d = dirOf(a, b), [ai, aj] = g.ij(cell(a)), c = g.center(ai, aj);
    const rx = -DZ[d], rz = DX[d];   // right-hand side of travel
    const ground = !high(a) && !high(b);
    const off = ground && g.isAvenue(a) && g.isAvenue(b) ? T.avenueLanes[lane] : T.laneOffset;   // on avenues, keep to this car's lane
    // between two deck tiles the edge is up at the deck; anywhere a ramp meets the street it's on the ground
    return { x: c.x + DX[d] * T.tile / 2 + rx * off, z: c.z + DZ[d] * T.tile / 2 + rz * off, y: high(a) && high(b) ? T.hwyTop : 0 };
  };
  for (let k = 0; k < chain.length - 1; k++) {
    const e = edge(chain[k], chain[k + 1]);
    if (k > 0) {   // the tile chain[k] is a road tile: curve if the direction changes inside it
      const din = dirOf(chain[k - 1], chain[k]), dout = dirOf(chain[k], chain[k + 1]);
      const last = pts[pts.length - 1];
      const tileY = high(chain[k]) && g.rampDir(cell(chain[k])) < 0 ? T.hwyTop : 0;
      if (!high(chain[k]) && g.control(chain[k]) === J_ROUND) {
        // roundabout: go counter-clockwise (seen from above) around the island from the entry to the exit
        const c = g.center(...g.ij(cell(chain[k]))), R = 5.2;
        const ang = (p: Pt) => Math.atan2(-(p.z - c.z), p.x - c.x);
        const a0 = ang(last); let a1 = ang(e); while (a1 <= a0 + 0.3) a1 += Math.PI * 2;
        for (let a = a0 + 0.35; a < a1 - 0.2; a += 0.38) pts.push({ x: c.x + Math.cos(a) * R, z: c.z - Math.sin(a) * R, y: 0 });
      } else if (din !== dout) {
        const ctl = DX[din] !== 0 ? { x: e.x, z: last.z } : { x: last.x, z: e.z };
        for (const t of [0.25, 0.5, 0.75]) {
          const u = 1 - t;
          pts.push({ x: u * u * last.x + 2 * u * t * ctl.x + t * t * e.x, z: u * u * last.z + 2 * u * t * ctl.z + t * t * e.z, y: tileY });
        }
      }
    }
    pts.push(e);
  }
  // pull a little into the start and end tiles so cars appear at the driveway and disappear at the door
  if (pts.length) {
    const a = pts[0], b = pts[pts.length - 1];
    const s0 = g.center(...g.ij(cell(chain[0]))), s1 = g.center(...g.ij(cell(chain[chain.length - 1])));
    pts.unshift({ x: a.x + (s0.x - a.x) * 0.35, z: a.z + (s0.z - a.z) * 0.35, y: 0 });
    pts.push({ x: b.x + (s1.x - b.x) * 0.35, z: b.z + (s1.z - b.z) * 0.35, y: 0 });
  }
  return pts;
}
