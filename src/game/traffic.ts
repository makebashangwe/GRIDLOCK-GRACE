/* Cars: each one follows a lane path, keeps a gap to the car ahead, and takes turns at crossings
   (the car with the lower number goes first, so two cars never wait on each other forever).
   Drawn as the ChatGPT cozy car merged into two pieces and instanced: two draw calls for every car. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeCozyCar } from '../assets/models';
import { shade } from '../assets/core';
import { Grid, J_STOP, J_LIGHT, J_ROUND } from './grid';
import { T } from './tuning';
import type { Pt } from './routes';

const MAXCARS = 1500;
const PAINTS = ['#E07A5F', '#4E8FA6', '#F2CC8F', '#81B29A', '#6D597A', '#D99A8B', '#F6E7CF', '#F4B860'];

export interface Car {
  id: number;
  pts: Pt[];
  lens: number[];
  /** distance from the start to the end of each segment */
  cum: number[];
  total: number;
  s: number;
  seg: number;
  v: number;
  x: number; z: number; hx: number; hz: number;
  paint: number;
  onArrive: () => void;
  /** The crossing this car has already made its full stop for. */
  stoppedFor: number;
  wait: number;
}

/** Which direction has green at traffic lights: 0 = east-west, 1 = north-south. */
export function greenAxis(clock: number): number { return Math.floor(clock / T.lightGreen) % 2; }

/** Bake the cozy car into a paint piece (tinted per car) and a fixed-color piece. */
function bakeCar(): { paint: THREE.BufferGeometry; rest: THREE.BufferGeometry } {
  const SENT = '#ff00ff', SENT_DARK = shade(SENT, -0.12);
  const g = makeCozyCar(SENT) as THREE.Group; g.updateMatrixWorld(true);
  const paint: THREE.BufferGeometry[] = [], rest: THREE.BufferGeometry[] = [];
  const dark = new THREE.Color(SENT_DARK), darkF = (dark.r + dark.b) / 2;
  g.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    let geo = m.geometry.clone().applyMatrix4(m.matrixWorld); if (geo.index) geo = geo.toNonIndexed();
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    const col = (m.material as THREE.MeshStandardMaterial).color, hex = '#' + col.getHexString();
    const isPaint = hex === SENT || hex === SENT_DARK, base = isPaint ? new THREE.Color().setScalar(hex === SENT ? 1 : darkF) : col;
    const n = geo.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = base.r; c[i * 3 + 1] = base.g; c[i * 3 + 2] = base.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); (isPaint ? paint : rest).push(geo);
  });
  return { paint: mergeGeometries(paint)!, rest: mergeGeometries(rest)! };
}

export class Traffic {
  cars: Car[] = [];
  private nextId = 1;
  private paintIM: THREE.InstancedMesh;
  private restIM: THREE.InstancedMesh;
  private M = new THREE.Matrix4(); private Q = new THREE.Quaternion(); private V = new THREE.Vector3(); private S = new THREE.Vector3(1, 1, 1);
  private UP = new THREE.Vector3(0, 1, 0); private col = new THREE.Color();
  private hash = new Map<number, Car[]>();

  constructor(scene: THREE.Scene, private grid: Grid) {
    const baked = bakeCar();
    this.paintIM = new THREE.InstancedMesh(baked.paint, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), MAXCARS);
    this.restIM = new THREE.InstancedMesh(baked.rest, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), MAXCARS);
    for (const im of [this.paintIM, this.restIM]) { im.castShadow = im.receiveShadow = true; im.frustumCulled = false; im.count = 0; scene.add(im); }
  }

  /** Is the start of a path clear enough to pull out? */
  canStart(pts: Pt[]): boolean {
    const p = pts[0];
    for (const c of this.near(p.x, p.z)) if ((c.x - p.x) ** 2 + (c.z - p.z) ** 2 < 36) return false;
    return true;
  }

  add(pts: Pt[], onArrive: () => void): Car | null {
    if (this.cars.length >= MAXCARS || pts.length < 2) return null;
    const lens: number[] = [], cum: number[] = []; let total = 0;
    for (let k = 0; k < pts.length - 1; k++) { const l = Math.hypot(pts[k + 1].x - pts[k].x, pts[k + 1].z - pts[k].z); lens.push(l); total += l; cum.push(total); }
    const id = this.nextId++;
    const car: Car = { id, pts, lens, cum, total, s: 0, seg: 0, v: 0, x: pts[0].x, z: pts[0].z, hx: 1, hz: 0, paint: id % PAINTS.length, onArrive, stoppedFor: -1, wait: 0 };
    this.place(car); this.cars.push(car); return car;
  }

  remove(car: Car): void { const k = this.cars.indexOf(car); if (k >= 0) this.cars.splice(k, 1); }

  private key(x: number, z: number) { return (Math.floor(x / 10) + 500) * 2000 + (Math.floor(z / 10) + 500); }
  private *near(x: number, z: number): Generator<Car> {
    const cx = Math.floor(x / 10), cz = Math.floor(z / 10);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = this.hash.get((cx + a + 500) * 2000 + (cz + b + 500)); if (l) yield* l; }
  }

  private place(c: Car): void {
    while (c.seg < c.lens.length - 1 && c.s > this.segEnd(c, c.seg)) c.seg++;
    const start = this.segEnd(c, c.seg) - c.lens[c.seg], u = c.lens[c.seg] > 0 ? (c.s - start) / c.lens[c.seg] : 0;
    const a = c.pts[c.seg], b = c.pts[c.seg + 1];
    c.x = a.x + (b.x - a.x) * u; c.z = a.z + (b.z - a.z) * u;
    const l = Math.hypot(b.x - a.x, b.z - a.z); if (l > 0.01) { c.hx = (b.x - a.x) / l; c.hz = (b.z - a.z) / l; }
  }
  private segEnd(c: Car, seg: number): number { return c.cum[seg]; }

  /** What a crossing ahead asks of this car: true = hold before entering it. */
  private holdAtCrossing(c: Car, clock: number, dt: number): boolean {
    const g = this.grid;
    const [ci, cj] = g.tileAt(c.x, c.z), [ai, aj] = g.tileAt(c.x + c.hx * 5.5, c.z + c.hz * 5.5);
    if (!g.inside(ai, aj) || (ai === ci && aj === cj)) return false;
    const ahead = g.idx(ai, aj), kind = g.control(ahead);
    if (kind === J_STOP) {
      if (c.stoppedFor === ahead) return false;
      if (c.v < 0.4) { c.wait += dt; if (c.wait >= T.stopWait) { c.stoppedFor = ahead; c.wait = 0; return false; } }
      return true;
    }
    if (kind === J_LIGHT) return (Math.abs(c.hx) > Math.abs(c.hz) ? 0 : 1) !== greenAxis(clock);
    if (kind === J_ROUND) {   // yield to cars already going round
      for (const o of this.near(c.x, c.z)) {
        if (o === c || o.v < 0.5) continue;
        const [oi, oj] = g.tileAt(o.x, o.z);
        if (oi === ai && oj === aj && (o.x - c.x) ** 2 + (o.z - c.z) ** 2 < 100) return true;
      }
    }
    return false;
  }

  /** Move every car by dt real seconds (already scaled for game speed). clock = game minutes (for traffic lights). */
  update(dt: number, clock = 0): void {
    const g = this.grid;
    this.hash.clear(); g.load.fill(0);
    for (const c of this.cars) {
      const k = this.key(c.x, c.z); let l = this.hash.get(k); if (!l) this.hash.set(k, (l = [])); l.push(c);
      const [i, j] = g.tileAt(c.x, c.z); if (g.inside(i, j)) g.load[g.idx(i, j)]++;
    }
    const arrived: Car[] = [];
    for (const c of this.cars) {
      let blocked = false;
      for (const o of this.near(c.x, c.z)) {
        if (o === c) continue;
        const dx = o.x - c.x, dz = o.z - c.z, along = dx * c.hx + dz * c.hz;
        if (along <= 0.2 || along > T.followGap) continue;
        const side = Math.abs(dx * -c.hz + dz * c.hx);
        if (side > 1.9) continue;
        const same = o.hx * c.hx + o.hz * c.hz;
        if (same > 0.6) { blocked = true; break; }          // queue behind the car ahead
        if (same > -0.6 && o.id < c.id) { blocked = true; break; }   // crossing traffic: lower number goes first
      }
      if (!blocked && this.holdAtCrossing(c, clock, dt)) blocked = true;
      const [ti, tj] = g.tileAt(c.x, c.z), inRound = g.inside(ti, tj) && g.control(g.idx(ti, tj)) === J_ROUND;
      const want = blocked ? 0 : inRound ? T.roundSpeed : T.carSpeed;
      c.v += Math.max(-T.carAccel * 2.5 * dt, Math.min(T.carAccel * dt, want - c.v));
      c.s += c.v * dt;
      if (c.s >= c.total) { arrived.push(c); continue; }
      this.place(c);
    }
    for (const c of arrived) { this.remove(c); c.onArrive(); }
    this.draw();
  }

  /** Cars standing still right now: used by the HUD as a "how jammed is it" read. */
  stopped(): number { let n = 0; for (const c of this.cars) if (c.v < 0.5) n++; return n; }

  private draw(): void {
    let k = 0;
    for (const c of this.cars) {
      this.Q.setFromAxisAngle(this.UP, Math.atan2(-c.hz, c.hx));
      this.M.compose(this.V.set(c.x, 0.05, c.z), this.Q, this.S);
      this.paintIM.setMatrixAt(k, this.M); this.restIM.setMatrixAt(k, this.M);
      this.paintIM.setColorAt(k, this.col.set(PAINTS[c.paint]));
      k++;
    }
    this.paintIM.count = this.restIM.count = k;
    this.paintIM.instanceMatrix.needsUpdate = this.restIM.instanceMatrix.needsUpdate = true;
    if (this.paintIM.instanceColor) this.paintIM.instanceColor.needsUpdate = true;
  }
}
