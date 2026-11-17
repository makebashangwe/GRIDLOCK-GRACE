/* Highway kit, built in code to match Keba's Blender bridge (Bridge_Straight_v02):
   street-gray deck 14.4 m wide and 1.8 m thick, deck top at 6.9 m, coral railings 4.3 m tall
   with posts every 6 m, octagonal stone pillars. Pieces are swept along a center line, so any
   length, slope or curve keeps the same look.
   Each piece runs along +X from its start point, deck top at `top`. */
import * as THREE from 'three';
import { C, mat, mesh } from './core';

export const HW = {
  width: 14.4,
  thick: 1.8,
  top: 6.9,          // level 1 deck top (the bridge)
  top2: 13.8,        // level 2 deck top: its underside clears level 1's railings
  railH: 4.32,
  railInset: 0.45,
  postEvery: 6,
  pillarR: 1.2,
  pillarSpread: 4.8, // pillar offset from the center line
  deck: C.street,
  rail: '#E07A5F',
  stone: '#B8A99A',
  wall: C.curbSide,
};

/** A sample along a piece's center line: position of the deck top and the travel direction. */
interface Sample { x: number; y: number; z: number; tx: number; tz: number }

/** Build a solid 4-sided prism through cross-sections (corners: top-left, top-right, bottom-right, bottom-left). Flat-shaded. */
function prism(sections: THREE.Vector3[][], caps = true): THREE.BufferGeometry {
  const pos: number[] = [];
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
  };
  for (let k = 0; k < sections.length - 1; k++) {
    const [a0, b0, c0, d0] = sections[k], [a1, b1, c1, d1] = sections[k + 1];
    quad(a0, a1, b1, b0);   // top
    quad(b0, b1, c1, c0);   // right side
    quad(c0, c1, d1, d0);   // bottom
    quad(d0, d1, a1, a0);   // left side
  }
  if (caps) {
    const [a, b, c, d] = sections[0]; quad(a, b, c, d);
    const [e, f, g, h] = sections[sections.length - 1]; quad(f, e, h, g);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Cross-sections of a strip offset sideways from the center line, from `lo` to `hi` (meters, + = left of travel). */
function strip(samples: Sample[], lo: number, hi: number, yTop: (s: Sample) => number, yBot: (s: Sample) => number): THREE.Vector3[][] {
  return samples.map((s) => {
    const nx = -s.tz, nz = s.tx;   // left of travel
    const L = new THREE.Vector3(s.x + nx * hi, 0, s.z + nz * hi), R = new THREE.Vector3(s.x + nx * lo, 0, s.z + nz * lo);
    const t = yTop(s), b = yBot(s);
    return [new THREE.Vector3(L.x, t, L.z), new THREE.Vector3(R.x, t, R.z), new THREE.Vector3(R.x, b, R.z), new THREE.Vector3(L.x, b, L.z)];
  });
}

function arcLengths(samples: Sample[]): number[] {
  const out = [0];
  for (let k = 1; k < samples.length; k++) out.push(out[k - 1] + Math.hypot(samples[k].x - samples[k - 1].x, samples[k].y - samples[k - 1].y, samples[k].z - samples[k - 1].z));
  return out;
}
function sampleAt(samples: Sample[], lens: number[], d: number): Sample {
  let k = 0; while (k < lens.length - 2 && lens[k + 1] < d) k++;
  const u = (d - lens[k]) / Math.max(1e-6, lens[k + 1] - lens[k]), a = samples[k], b = samples[k + 1];
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u, tx: a.tx + (b.tx - a.tx) * u, tz: a.tz + (b.tz - a.tz) * u };
}

export interface DeckOptions {
  /** Leave a gap in the railing on one side (meters along the piece), e.g. where a branch joins. */
  railGaps?: { side: 1 | -1; from: number; to: number }[];
  /** Skip pillars (when another piece supports this one). */
  noPillars?: boolean;
  /** Lane markings on the deck. */
  markings?: boolean;
  /** Pillar spacing along the deck. */
  pillarEvery?: number;
}

/** The deck, railings, markings and supports for any center line. */
export function buildDeck(samples: Sample[], opts: DeckOptions = {}): THREE.Group {
  const g = new THREE.Group();
  const W = HW.width / 2, lens = arcLengths(samples), total = lens[lens.length - 1];
  // deck slab (its underside never goes below the ground)
  const deck = new THREE.Mesh(prism(strip(samples, -W, W, (s) => s.y, (s) => Math.max(0, s.y - HW.thick))), mat(HW.deck));
  deck.castShadow = deck.receiveShadow = true; g.add(deck);

  // railings: a continuous top rail and posts every 6 m on both sides
  for (const side of [1, -1] as const) {
    const off = side * (W - HW.railInset);
    const gaps = (opts.railGaps ?? []).filter((q) => q.side === side);
    const inGap = (d: number) => gaps.some((q) => d > q.from && d < q.to);
    // split the rail into runs around the gaps
    let run: Sample[] = [];
    const flush = () => {
      if (run.length > 1) {
        const r = new THREE.Mesh(prism(strip(run, off - 0.22, off + 0.22, (s) => s.y + HW.railH, (s) => s.y + HW.railH - 0.42)), mat(HW.rail));
        r.castShadow = true; g.add(r);
      }
      run = [];
    };
    for (let k = 0; k < samples.length; k++) { if (inGap(lens[k])) flush(); else run.push(samples[k]); }
    flush();
    const n = Math.max(1, Math.round(total / HW.postEvery));
    for (let k = 0; k <= n; k++) {
      const d = Math.min(total - 0.5, Math.max(0.5, (k / n) * total)); if (inGap(d)) continue;
      const s = sampleAt(samples, lens, d);
      const post = mesh(new THREE.BoxGeometry(0.42, HW.railH, 0.42), HW.rail);
      post.position.set(s.x - s.tz * off, s.y + HW.railH / 2, s.z + s.tx * off);
      post.rotation.y = Math.atan2(-s.tz, s.tx); g.add(post);
    }
  }

  // lane markings: center dashes and two edge lines
  if (opts.markings !== false) {
    for (const off of [W - 1.7, -(W - 1.7)]) {
      const e = new THREE.Mesh(prism(strip(samples, off - 0.13, off + 0.13, (s) => s.y + 0.03, (s) => s.y), false), mat(C.lane));
      e.receiveShadow = true; g.add(e);
    }
    for (let d = 3; d < total - 2; d += 7) {
      const s = sampleAt(samples, lens, d);
      const dash = mesh(new THREE.BoxGeometry(3.2, 0.04, 0.42), C.lane, { cast: false });
      dash.position.set(s.x, s.y + 0.02, s.z); dash.rotation.y = Math.atan2(-s.tz, s.tx);
      dash.rotation.z = Math.atan2(sampleAt(samples, lens, d + 0.5).y - s.y, 0.5); g.add(dash);
    }
  }

  // supports: octagonal pillar pairs where the deck is high, a solid wall where it's low
  if (!opts.noPillars) {
    const every = opts.pillarEvery ?? 24;
    const low = samples.filter((s) => s.y - HW.thick < 3.2);
    if (low.length > 1 && samples.some((s) => s.y < 1)) {
      // ramp foot: one continuous retaining wall under the low part
      const idx = samples.map((s, k) => (s.y - HW.thick < 3.2 ? k : -1)).filter((k) => k >= 0);
      const part = samples.slice(idx[0], idx[idx.length - 1] + 2);
      const wall = new THREE.Mesh(prism(strip(part, -(W - 0.6), W - 0.6, (s) => Math.max(0, s.y - HW.thick), () => 0)), mat(HW.wall));
      wall.castShadow = wall.receiveShadow = true; g.add(wall);
    }
    const n = Math.max(1, Math.round(total / every));
    for (let k = 0; k <= n; k++) {
      const d = n === 1 ? total / 2 : 4 + (k / n) * (total - 8);
      if (n === 1 && k > 0) break;
      const s = sampleAt(samples, lens, d), h = s.y - HW.thick;
      if (h < 3.2) continue;
      for (const side of [1, -1]) g.add(pillar(s.x - s.tz * side * HW.pillarSpread, s.z + s.tx * side * HW.pillarSpread, h));
    }
  }
  return g;
}

/** One octagonal stone pillar from the ground up to height h. */
export function pillar(x: number, z: number, h: number): THREE.Mesh {
  const p = mesh(new THREE.CylinderGeometry(HW.pillarR, HW.pillarR * 1.08, h, 8), HW.stone);
  p.position.set(x, h / 2, z); return p;
}

const line = (length: number, y: (u: number) => number, steps = 24): Sample[] => {
  const out: Sample[] = [];
  for (let k = 0; k <= steps; k++) { const u = k / steps; out.push({ x: -length / 2 + u * length, y: y(u), z: 0, tx: 1, tz: 0 }); }
  return out;
};

/** Straight elevated piece (the bridge, in code). */
export function makeHighwayStraight(length = 24, top = HW.top): THREE.Group {
  const g = buildDeck(line(length, () => top, 2), { pillarEvery: 24 }); g.name = 'highway_straight';
  if (top > HW.top + 1) {   // level 2: the same pillars, taller, with a cap beam
    g.children.filter((o) => (o as THREE.Mesh).geometry instanceof THREE.CylinderGeometry).forEach((o) => g.remove(o));
    for (const x of length > 30 ? [-length / 2 + 6, length / 2 - 6] : [0]) g.add(makeTallPillar(top - HW.thick, x));
  }
  return g;
}

/** Ramp from street level (left end) up to the deck (right end), with an S-curve so both ends sit flat. */
export function makeHighwayRamp(length = 56, top = HW.top): THREE.Group {
  const ease = (u: number) => u * u * (3 - 2 * u);
  const g = buildDeck(line(length, (u) => 0.3 + (top - 0.3) * ease(u), 28), { pillarEvery: 14 });
  g.name = 'highway_ramp'; return g;
}

/** Curve: starts heading +X, turns right (toward +Z) by `angle`, at a constant height. */
export function makeHighwayCurve(radius = 30, angle = Math.PI / 2, top = HW.top): THREE.Group {
  const out: Sample[] = [], steps = Math.max(8, Math.round((radius * angle) / 2.5));
  for (let k = 0; k <= steps; k++) { const th = (k / steps) * angle; out.push({ x: radius * Math.sin(th), y: top, z: radius - radius * Math.cos(th), tx: Math.cos(th), tz: Math.sin(th) }); }
  const g = buildDeck(out, { pillarEvery: 22 }); g.name = 'highway_curve'; return g;
}

/** T-junction: a straight through-deck along X with a branch leaving toward +Z from its middle. */
export function makeHighwayT(length = 44, branch = 22, top = HW.top): THREE.Group {
  const g = new THREE.Group(); g.name = 'highway_t';
  const half = HW.width / 2;
  g.add(buildDeck(line(length, () => top, 4), { railGaps: [{ side: 1, from: length / 2 - half, to: length / 2 + half }], noPillars: true }));
  const br: Sample[] = [];
  for (let k = 0; k <= 4; k++) { const d = half - 0.2 + (k / 4) * branch; br.push({ x: 0, y: top - 0.002, z: d, tx: 0, tz: 1 }); }
  g.add(buildDeck(br, { noPillars: true, railGaps: [] }));
  // supports: a 2 x 2 cluster under the junction and a pair under each far end
  const h = top - HW.thick;
  for (const x of [-half + 1.6, half - 1.6]) for (const z of [-half + 1.6, half - 1.6]) g.add(pillar(x, z, h));
  for (const x of [-length / 2 + 5, length / 2 - 5]) for (const z of [-HW.pillarSpread, HW.pillarSpread]) g.add(pillar(x, z, h));
  for (const x of [-HW.pillarSpread, HW.pillarSpread]) g.add(pillar(x, half + branch - 4, h));
  return g;
}

/** Tall pillar for level 2: two columns, a tie beam halfway, and a cap beam the deck sits on.
    `spread` is the distance between columns; use 22+ to straddle a level-1 deck below. */
export function makeTallPillar(height = HW.top2 - HW.thick, x = 0, spread = HW.pillarSpread * 2): THREE.Group {
  const g = new THREE.Group(); g.name = 'tall_pillar';
  for (const s of [-1, 1]) g.add(pillar(x, (s * spread) / 2, height - 1.2));
  const cap = mesh(new THREE.BoxGeometry(3.2, 1.2, spread + 3.6), HW.stone); cap.position.set(x, height - 0.6, 0); g.add(cap);
  if (height > 9) { const tie = mesh(new THREE.BoxGeometry(1.4, 0.9, spread), HW.stone); tie.position.set(x, height * 0.45, 0); g.add(tie); }
  return g;
}

/** Demo: a level-2 deck crossing over a level-1 deck on straddle pillars. */
export function makeStackedCrossing(): THREE.Group {
  const g = new THREE.Group(); g.name = 'stacked_crossing';
  g.add(makeHighwayStraight(48, HW.top));
  const upper = buildDeck(line(56, () => HW.top2, 2), { noPillars: true });
  upper.rotation.y = Math.PI / 2; g.add(upper);
  for (const z of [-20, 20]) { const p = makeTallPillar(HW.top2 - HW.thick); p.rotation.y = Math.PI / 2; p.position.z = z; g.add(p); }
  return g;
}
