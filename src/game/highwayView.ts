/* Draws the elevated highway tile by tile, in the Blender bridge's look: a street-gray deck at 6.9 m,
   coral railings on every open side, octagonal stone pillars at the tile corners (so they stand on
   sidewalk corners when the deck crosses a street), and sloped ramps at the ends. All instanced. */
import * as THREE from 'three';
import { C, mat } from '../assets/core';
import { Grid, DX, DZ } from './grid';
import { T } from './tuning';

const MAX = 30 * 30, RAIL_Y = 1.55, POST_H = 1.4, RAMP_T = 1.0;

export class HighwayView {
  private deck: THREE.InstancedMesh;
  private ramp: THREE.InstancedMesh;
  private rails: THREE.InstancedMesh;
  private posts: THREE.InstancedMesh;
  private pillars: THREE.InstancedMesh;
  private dashes: THREE.InstancedMesh;
  private m = new THREE.Matrix4(); private base = new THREE.Matrix4(); private local = new THREE.Matrix4();
  private q = new THREE.Quaternion(); private v = new THREE.Vector3(); private one = new THREE.Vector3(1, 1, 1);
  private e = new THREE.Euler();

  constructor(scene: THREE.Scene, private grid: Grid) {
    const H = T.hwyTop, rampLen = Math.hypot(T.tile, H);
    this.deck = new THREE.InstancedMesh(new THREE.BoxGeometry(T.tile, 1.8, T.tile), mat(C.street), MAX);
    this.ramp = new THREE.InstancedMesh(new THREE.BoxGeometry(rampLen, RAMP_T, T.tile), mat(C.street), MAX);
    this.rails = new THREE.InstancedMesh(new THREE.BoxGeometry(T.tile, 0.38, 0.38), mat('#E07A5F'), MAX * 4);
    this.posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, POST_H, 0.34), mat('#E07A5F'), MAX * 20);
    this.pillars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.85, 0.95, 1, 8), mat('#B8A99A'), MAX * 2);
    this.dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(3.2, 0.42).rotateX(-Math.PI / 2), mat(C.lane), MAX * 2);
    for (const im of [this.deck, this.ramp, this.rails, this.posts, this.pillars, this.dashes]) {
      im.castShadow = im !== this.dashes; im.receiveShadow = true; im.count = 0; im.frustumCulled = false; scene.add(im);
    }
  }

  private put(im: THREE.InstancedMesh, k: number, x: number, y: number, z: number, yaw: number, sy = 1): void {
    this.q.setFromEuler(this.e.set(0, yaw, 0)); this.m.compose(this.v.set(x, y, z), this.q, this.v2.set(1, sy, 1)); im.setMatrixAt(k, this.m);
  }
  private v2 = new THREE.Vector3();
  /** Place an instance at a local offset inside the ramp's tilted frame. */
  private putLocal(im: THREE.InstancedMesh, k: number, x: number, y: number, z: number): void {
    this.local.makeTranslation(x, y, z); this.m.multiplyMatrices(this.base, this.local); im.setMatrixAt(k, this.m);
  }

  rebuild(): void {
    const g = this.grid, H = T.hwyTop, h = T.tile / 2;
    let dk = 0, rp = 0, rl = 0, ps = 0, pl = 0, ds = 0;
    for (let c = 0; c < g.hwy.length; c++) {
      if (!g.hwy[c]) continue;
      const [i, j] = g.ij(c), { x, z } = g.center(i, j), links = g.hwyLinks(c), down = g.rampDir(c);
      if (down >= 0) {
        // ramp: rises from the ground at its open side up to the deck at its other side
        const up = (down + 2) % 4, yaw = Math.atan2(-DZ[up], DX[up]), a = Math.atan2(H, T.tile);
        this.q.setFromEuler(this.e.set(0, yaw, a, 'YXZ'));
        this.base.compose(this.v.set(x, H / 2 - RAMP_T / 2 / Math.cos(a), z), this.q, this.one);
        this.ramp.setMatrixAt(rp++, this.base);
        const L = Math.hypot(T.tile, H) / 2;
        for (const side of [-1, 1]) {
          this.putLocal(this.rails, rl++, 0, RAMP_T / 2 + RAIL_Y, side * (h - 0.3));
          for (let k = -2; k <= 2; k++) this.putLocal(this.posts, ps++, (k / 2.2) * L, RAMP_T / 2 + POST_H / 2, side * (h - 0.3));
        }
        // one pillar pair under the high half
        const px = x + DX[up] * 3.5, pz = z + DZ[up] * 3.5, ph = H * 0.75 - 1.2;
        for (const side of [-1, 1]) this.put(this.pillars, pl++, px - DZ[up] * side * 5.4, ph / 2, pz + DX[up] * side * 5.4, 0, ph);
        continue;
      }
      this.put(this.deck, dk++, x, H - 0.9, z, 0);
      for (let k = 0; k < 4; k++) {
        if (links & (1 << k)) continue;
        const ex = x + DX[k] * (h - 0.3), ez = z + DZ[k] * (h - 0.3), yaw = k % 2 === 0 ? Math.PI / 2 : 0;
        this.put(this.rails, rl++, ex, H + RAIL_Y, ez, yaw);
        for (let p = -2; p <= 2; p++) this.put(this.posts, ps++, ex + (k % 2 === 0 ? 0 : p * 3.2), H + POST_H / 2, ez + (k % 2 === 0 ? p * 3.2 : 0), 0);
      }
      const ph = H - 1.8;   // pillars at two opposite corners
      for (const s of [-1, 1]) this.put(this.pillars, pl++, x + s * 5.9, ph / 2, z + s * 5.9, 0, ph);
      const ew = links === 0b0101 || links === 0b0001 || links === 0b0100, ns = links === 0b1010 || links === 0b0010 || links === 0b1000;
      if (ew || ns) for (const off of [-3.5, 3.5]) this.put(this.dashes, ds++, x + (ns ? 0 : off), H + 0.02, z + (ns ? off : 0), ns ? Math.PI / 2 : 0);
    }
    this.deck.count = dk; this.ramp.count = rp; this.rails.count = rl; this.posts.count = ps; this.pillars.count = pl; this.dashes.count = ds;
    for (const im of [this.deck, this.ramp, this.rails, this.posts, this.pillars, this.dashes]) im.instanceMatrix.needsUpdate = true;
  }
}
