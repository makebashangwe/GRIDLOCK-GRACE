/* Draws every road tile: asphalt, sidewalks on the open sides, sidewalk corners, lane dashes and
   crosswalks at junctions. All pieces are instanced; the whole road network is a handful of draw calls.
   Jammed tiles tint amber (slow) and red (jammed). */
import * as THREE from 'three';
import { C, mat } from '../assets/core';
import { Grid, DX, DZ } from './grid';
import { T } from './tuning';

const MAX = 30 * 30;
const WALK = 2.2, WALK_H = 0.3, WALK_AV = 1.2;
const STREET = new THREE.Color(C.street), SLOW = new THREE.Color('#B8875A'), JAM = new THREE.Color('#C8553D');

export class RoadView {
  private asphalt: THREE.InstancedMesh;
  private walks: THREE.InstancedMesh;
  private corners: THREE.InstancedMesh;
  private dashes: THREE.InstancedMesh;
  private stripes: THREE.InstancedMesh;
  private solids: THREE.InstancedMesh;
  private cells: number[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3(1, 1, 1);
  private up = new THREE.Vector3(0, 1, 0);
  private tint = new THREE.Color();

  constructor(scene: THREE.Scene, private grid: Grid) {
    const flat = new THREE.PlaneGeometry(T.tile, T.tile).rotateX(-Math.PI / 2);
    this.asphalt = new THREE.InstancedMesh(flat, new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.92 }), MAX);
    this.walks = new THREE.InstancedMesh(new THREE.BoxGeometry(T.tile, WALK_H, WALK), mat(C.curbTop), MAX * 4);
    this.corners = new THREE.InstancedMesh(new THREE.BoxGeometry(WALK, WALK_H, WALK), mat(C.curbTop), MAX * 4);
    this.dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(3.2, 0.42).rotateX(-Math.PI / 2), mat(C.lane), MAX * 8);
    this.stripes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.8, 3.2).rotateX(-Math.PI / 2), mat('#FFFFFF'), MAX * 24);
    this.solids = new THREE.InstancedMesh(new THREE.PlaneGeometry(T.tile, 0.22).rotateX(-Math.PI / 2), mat(C.lane), MAX * 2);
    for (const im of [this.asphalt, this.walks, this.corners, this.dashes, this.stripes, this.solids]) {
      im.receiveShadow = true; im.count = 0; im.frustumCulled = false; scene.add(im);
    }
    this.walks.castShadow = this.corners.castShadow = true;
  }

  private put(im: THREE.InstancedMesh, k: number, x: number, y: number, z: number, rot: number, sx = 1, sz = 1): void {
    this.q.setFromAxisAngle(this.up, rot); this.m.compose(this.v.set(x, y, z), this.q, this.s.set(sx, 1, sz)); im.setMatrixAt(k, this.m);
  }

  /** Rebuild after any road change. */
  rebuild(): void {
    const g = this.grid, h = T.tile / 2;
    let a = 0, w = 0, c = 0, d = 0, s = 0, so = 0;
    this.cells = [];
    for (let j = 0; j < g.n; j++) for (let i = 0; i < g.n; i++) {
      if (!g.isRoad(i, j)) continue;
      const { x, z } = g.center(i, j), links = g.links(i, j), deg = [0, 1, 2, 3].filter((k) => links & (1 << k)).length;
      this.cells.push(g.idx(i, j));
      const av = g.isAvenue(g.idx(i, j)), walk = av ? WALK_AV : WALK, ws = walk / WALK;
      this.put(this.asphalt, a++, x, 0.03, z, 0);
      // sidewalk along each side that isn't connected to another road
      for (let k = 0; k < 4; k++) {
        if (links & (1 << k)) continue;
        this.put(this.walks, w++, x + DX[k] * (h - walk / 2), WALK_H / 2, z + DZ[k] * (h - walk / 2), k % 2 === 0 ? Math.PI / 2 : 0, 1, ws);
      }
      // sidewalk corner squares where two connected sides meet
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4;
        if ((links & (1 << k)) && (links & (1 << k2))) {
          const cx = x + (DX[k] + DX[k2]) * (h - walk / 2), cz = z + (DZ[k] + DZ[k2]) * (h - walk / 2);
          this.put(this.corners, c++, cx, WALK_H / 2, cz, 0, ws, ws);
        }
      }
      // lane dashes on straight pieces and dead ends
      const ew = (links & 0b0101) !== 0 && (links & 0b1010) === 0, ns = (links & 0b1010) !== 0 && (links & 0b0101) === 0;
      if (deg <= 2 && (ew || ns || deg === 0)) {
        const rot = ns ? Math.PI / 2 : 0;
        if (av) {
          // avenue: a double center line, and dashes between the two lanes on each side
          for (const side of [-0.25, 0.25]) this.put(this.solids, so++, x + (ns ? side : 0), 0.05, z + (ns ? 0 : side), rot);
          for (const lane of [-3.0, 3.0]) for (const off of [-3.5, 3.5]) this.put(this.dashes, d++, x + (ns ? lane : off), 0.05, z + (ns ? off : lane), rot);
        } else for (const off of [-3.5, 3.5]) this.put(this.dashes, d++, x + (ns ? 0 : off), 0.05, z + (ns ? off : 0), rot);
      }
      // crosswalks across each arm of a junction
      if (deg >= 3) {
        for (let k = 0; k < 4; k++) {
          if (!(links & (1 << k))) continue;
          for (let t = -3; t <= 3; t++) {
            const along = h - 1.8, across = t * 1.25;
            const px = x + DX[k] * along + (DX[k] === 0 ? across : 0), pz = z + DZ[k] * along + (DZ[k] === 0 ? across : 0);
            this.put(this.stripes, s++, px, 0.05, pz, DX[k] !== 0 ? Math.PI / 2 : 0);
          }
        }
      }
    }
    this.asphalt.count = a; this.walks.count = w; this.corners.count = c; this.dashes.count = d; this.stripes.count = s; this.solids.count = so;
    for (const im of [this.asphalt, this.walks, this.corners, this.dashes, this.stripes, this.solids]) im.instanceMatrix.needsUpdate = true;
    this.paintLoad();
  }

  /** Tint tiles by how many cars are on them. Called a few times a second. */
  paintLoad(): void {
    const g = this.grid;
    this.cells.forEach((cell, k) => {
      const n = g.load[cell];
      this.tint.copy(STREET);
      if (n >= T.jamAt) this.tint.lerp(JAM, 0.55); else if (n >= T.slowAt) this.tint.lerp(SLOW, 0.55);
      this.asphalt.setColorAt(k, this.tint);
    });
    if (this.asphalt.instanceColor) this.asphalt.instanceColor.needsUpdate = true;
  }
}
