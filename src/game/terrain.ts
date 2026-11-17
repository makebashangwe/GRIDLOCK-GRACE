/* The ground: grass tiles everywhere except the river, which sits lower with stone-and-sand banks,
   plus a river generator for new towns. */
import * as THREE from 'three';
import { C, mat } from '../assets/core';
import { Grid, DX, DZ } from './grid';
import { T } from './tuning';

const WATER_Y = -0.9;

/** Carve a 2-tile-wide river running north to south, wandering a little, off to one side of the town center. */
export function makeRiver(g: Grid): void {
  const mid = Math.floor(g.n / 2);
  let x = mid + 4 + Math.floor(Math.random() * 3);
  for (let j = 0; j < g.n; j++) {
    if (j > 0 && Math.random() < 0.3) x += Math.random() < 0.5 ? -1 : 1;
    x = Math.max(mid + 3, Math.min(g.n - 5, x));
    for (const i of [x, x + 1]) g.water[g.idx(i, j)] = 1;
  }
}

export class TerrainView {
  private group = new THREE.Group();
  constructor(private scene: THREE.Scene, private grid: Grid) { scene.add(this.group); }

  rebuild(): void {
    const g = this.grid, h = T.tile / 2;
    this.scene.remove(this.group); this.group = new THREE.Group(); this.scene.add(this.group);
    const n = g.n * g.n, m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    const tile = new THREE.PlaneGeometry(T.tile, T.tile).rotateX(-Math.PI / 2);
    const land = new THREE.InstancedMesh(tile, new THREE.MeshStandardMaterial({ color: C.grass, roughness: 0.95 }), n);
    const water = new THREE.InstancedMesh(tile, new THREE.MeshStandardMaterial({ color: '#7FB7C9', roughness: 0.25, metalness: 0.05 }), n);
    const bed = new THREE.InstancedMesh(tile, mat('#9C8E7E'), n);
    const bank = new THREE.InstancedMesh(new THREE.BoxGeometry(T.tile, -WATER_Y + 0.05, 1.2), mat('#B8A99A'), n * 4);
    const sand = new THREE.InstancedMesh(new THREE.BoxGeometry(T.tile, 0.12, 1.6), mat('#E9D8B8'), n * 4);
    let a = 0, w = 0, b = 0, sd = 0;
    for (let j = 0; j < g.n; j++) for (let i = 0; i < g.n; i++) {
      const c = g.idx(i, j), { x, z } = g.center(i, j);
      if (!g.water[c]) { m.compose(v.set(x, 0, z), q.identity(), s); land.setMatrixAt(a++, m); continue; }
      m.compose(v.set(x, WATER_Y, z), q.identity(), s); water.setMatrixAt(w, m);
      m.compose(v.set(x, WATER_Y - 0.5, z), q.identity(), s); bed.setMatrixAt(w++, m);
      for (let d = 0; d < 4; d++) {
        const ni = i + DX[d], nj = j + DZ[d];
        if (!g.inside(ni, nj) || g.water[g.idx(ni, nj)]) continue;
        // a sloping stone bank on each side that faces land, with a sandy lip at the waterline
        q.setFromAxisAngle(up, d % 2 === 0 ? Math.PI / 2 : 0);
        m.compose(v.set(x + DX[d] * (h - 0.6), WATER_Y / 2, z + DZ[d] * (h - 0.6)), q, s); bank.setMatrixAt(b++, m);
        m.compose(v.set(x + DX[d] * (h - 1.9), WATER_Y + 0.08, z + DZ[d] * (h - 1.9)), q, s); sand.setMatrixAt(sd++, m);
      }
    }
    land.count = a; water.count = w; bed.count = w; bank.count = b; sand.count = sd;
    for (const im of [land, water, bed, bank, sand]) { im.receiveShadow = true; im.frustumCulled = false; this.group.add(im); }
    bank.castShadow = true;
  }
}
