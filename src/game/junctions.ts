/* The props that show how each crossing is controlled: a stop sign on every approach,
   a traffic light on every approach (lamps follow the light phase), or a mini roundabout island. */
import * as THREE from 'three';
import { makeStopSign, makeMiniRoundabout } from '../assets/models';
import { mesh, rbox, shadowAll, C } from '../assets/core';
import { Grid, DX, DZ, opposite, J_STOP, J_ROUND } from './grid';
import { greenAxis } from './traffic';

const RED = new THREE.Color('#E05A48'), GREEN = new THREE.Color('#7FD18B'), OFF = new THREE.Color('#4A4555');

interface Placed { kind: number; obj: THREE.Group; lamps?: { axis: number; red: THREE.MeshStandardMaterial; green: THREE.MeshStandardMaterial }[] }

/** A small traffic signal: pole, a head with red / amber / green lamps. Faces +Z. */
function makeSignal(): { g: THREE.Group; red: THREE.MeshStandardMaterial; green: THREE.MeshStandardMaterial } {
  const g = new THREE.Group(); g.name = 'traffic_signal';
  const pole = mesh(new THREE.CylinderGeometry(0.14, 0.18, 5.2, 8), C.dark); pole.position.y = 2.6; g.add(pole);
  const head = rbox(0.9, 2.3, 0.7, 0.2, C.dark); head.position.set(0, 5.6, 0); g.add(head);
  const lamp = (color: THREE.Color, y: number) => {
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2, roughness: 0.4 });
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), m); l.position.set(0, y, 0.33); g.add(l); return m;
  };
  const red = lamp(RED.clone(), 6.25); lamp(new THREE.Color('#F4B860'), 5.6).emissiveIntensity = 0.05; const green = lamp(GREEN.clone(), 4.95);
  return { g, red, green };
}

export class JunctionView {
  private placed = new Map<number, Placed>();
  constructor(private scene: THREE.Scene, private grid: Grid) {}

  /** Match the props to the grid after any change. */
  sync(): void {
    const g = this.grid;
    for (const [c, p] of this.placed) if (g.control(c) !== p.kind) { this.scene.remove(p.obj); this.placed.delete(c); }
    for (let c = 0; c < g.junction.length; c++) {
      const kind = g.control(c); if (!kind || this.placed.has(c)) continue;
      const [i, j] = g.ij(c), { x, z } = g.center(i, j), obj = new THREE.Group(); obj.position.set(x, 0, z);
      const p: Placed = { kind, obj };
      if (kind === J_ROUND) {
        const r = makeMiniRoundabout() as THREE.Group; r.scale.setScalar(0.72); obj.add(r);
      } else {
        p.lamps = [];
        for (let d = 0; d < 4; d++) {
          if (!g.connects(i, j, d)) continue;
          // the approach from side d: cars drive in heading opposite(d); the post stands on their right-hand corner
          const od = opposite(d), rx = -DZ[od], rz = DX[od];
          const px = DX[d] * 5.9 + rx * 5.9, pz = DZ[d] * 5.9 + rz * 5.9, face = Math.atan2(DX[d], DZ[d]);
          if (kind === J_STOP) {
            const s = makeStopSign() as THREE.Group; s.scale.setScalar(1.6); s.position.set(px, 0.3, pz); s.rotation.y = face; obj.add(s);
          } else {
            const sig = makeSignal(); sig.g.position.set(px, 0.3, pz); sig.g.rotation.y = face; obj.add(sig.g);
            p.lamps.push({ axis: d % 2 === 0 ? 0 : 1, red: sig.red, green: sig.green });
          }
        }
      }
      shadowAll(obj); this.scene.add(obj); this.placed.set(c, p);
    }
  }

  /** Light the lamps for the current phase. */
  update(clock: number): void {
    const axis = greenAxis(clock);
    for (const p of this.placed.values()) {
      if (!p.lamps) continue;
      for (const l of p.lamps) {
        const go = l.axis === axis;
        l.green.emissive.copy(go ? GREEN : OFF); l.green.emissiveIntensity = go ? 1.6 : 0.1; l.green.color.copy(go ? GREEN : OFF);
        l.red.emissive.copy(go ? OFF : RED); l.red.emissiveIntensity = go ? 0.1 : 1.6; l.red.color.copy(go ? OFF : RED);
      }
    }
  }
}
