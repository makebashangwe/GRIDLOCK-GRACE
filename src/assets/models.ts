// @ts-nocheck
/* Asset library: every code-built model in the game, ported as-is from the Asset Test
   (ChatGPT-written models plus Claude's). Each function returns a THREE.Group at the origin.
   Conventions: 1 unit = 1 m, Y up. Vehicles face +X. Buildings and signs face +Z.
   Animated parts register a callback on TICK (called every frame with time in seconds).
   Type-checking is off for this file only; new models should go in typed files. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { C, mat, mesh, rbox, shade, shadowAll } from './core';
import { TICK } from '../engine/tick';

const FLASHERS = TICK, ANIM = TICK;
void mat; void shadowAll; void RoundedBoxGeometry;

function signTexture(text, fg, bg = '#ffffff') {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, 504, 120, 56); g.fill();
  g.lineWidth = 8; g.strokeStyle = fg; g.stroke();
  g.fillStyle = fg; g.font = '900 60px Nunito, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function awningMesh(w, color) {
  const g = new THREE.Group();
  const n = Math.max(4, Math.round(w / 1.4)), sw = w / n;
  for (let i = 0; i < n; i++) {
    const s = rbox(sw, 0.4, 3.0, 0.15, i % 2 ? '#FFFFFF' : color);
    s.position.set(-w / 2 + sw * (i + 0.5), 0, 1.5); s.rotation.x = 0.38; g.add(s);
    const sc = mesh(new THREE.SphereGeometry(sw / 2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), i % 2 ? '#FFFFFF' : color);
    sc.rotation.x = Math.PI; sc.position.set(-w / 2 + sw * (i + 0.5), -0.55, 2.85); g.add(sc);
  }
  return g;
}

function building({ w, d, h, wall, roof, floors = 1, awning, sign, door = true, roofType = 'gable', bays = 0 }) {
  const g = new THREE.Group();
  const base = rbox(w + 0.9, 0.7, d + 0.9, 0.25, shade(wall, -0.18)); base.position.y = 0.3; g.add(base);
  const body = rbox(w, h, d, 0.8, wall); body.position.y = h / 2 + 0.25; g.add(body);
  const fh = h / floors;
  const winMatGlass = '#CFE3E6';
  for (let f = 0; f < floors; f++) {
    const n = Math.max(1, Math.floor(w / 4.2));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * w / n;
      if (f === 0 && door && i === Math.floor(n / 2)) continue;
      if (f === 0 && bays) continue;
      const frame = rbox(2.4, 2.6, 0.4, 0.2, '#FFFFFF'); frame.position.set(x, f * fh + fh * 0.58, d / 2 + 0.05); g.add(frame);
      const glass = rbox(1.8, 2.0, 0.3, 0.15, winMatGlass, { opts: { roughness: 0.3 } }); glass.position.set(x, f * fh + fh * 0.58, d / 2 + 0.18); g.add(glass);
    }
    const m = Math.max(1, Math.floor(d / 4.2));
    for (let i = 0; i < m; i++) {
      const z = -d / 2 + (i + 0.5) * d / m;
      for (const sx of [-1, 1]) {
        const frame = rbox(0.4, 2.6, 2.4, 0.2, '#FFFFFF'); frame.position.set(sx * (w / 2 + 0.05), f * fh + fh * 0.58, z); g.add(frame);
        const glass = rbox(0.3, 2.0, 1.8, 0.15, winMatGlass, { opts: { roughness: 0.3 } }); glass.position.set(sx * (w / 2 + 0.18), f * fh + fh * 0.58, z); g.add(glass);
      }
    }
  }
  if (door) {
    const dr = rbox(2.6, 3.8, 0.5, 0.3, shade(roof, -0.12)); dr.position.set(0, 1.9, d / 2 + 0.1); g.add(dr);
    const knob = mesh(new THREE.SphereGeometry(0.18, 8, 6), '#FFD36E'); knob.position.set(0.8, 1.9, d / 2 + 0.42); g.add(knob);
    const step = rbox(3.6, 0.4, 1.4, 0.15, '#E8DAC4'); step.position.set(0, 0.2, d / 2 + 0.7); g.add(step);
  }
  if (bays) {
    for (const bx of [-w * 0.3, w * 0.3]) {
      const frame = rbox(5.6, 5.4, 0.5, 0.3, '#5E5A6B'); frame.position.set(bx, 2.7, d / 2 + 0.05); g.add(frame);
      for (let k = 0; k < 6; k++) { const slat = rbox(4.8, 0.62, 0.4, 0.12, k % 2 ? '#CDBBA6' : '#B8A99A'); slat.position.set(bx, 0.55 + k * 0.78, d / 2 + 0.2); g.add(slat); }
    }
  }
  if (awning) { const a = awningMesh(w * (bays ? 0.25 : 0.86), awning); a.position.set(0, Math.min(fh * 0.92, 5.4), d / 2); g.add(a); }
  if (roofType === 'gable') {
    const ov = 0.9, rh = Math.min(w, d) * 0.38;
    const shape = new THREE.Shape();
    shape.moveTo(-d / 2 - ov, 0); shape.lineTo(0, rh); shape.lineTo(d / 2 + ov, 0); shape.lineTo(-d / 2 - ov, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: w + ov * 2, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 3 });
    geo.translate(0, 0, -(w + ov * 2) / 2);
    const r = mesh(geo, roof); r.rotation.y = Math.PI / 2; r.position.y = h - 0.2; g.add(r);
    const ch = rbox(1.4, 3.4, 1.4, 0.3, shade(roof, -0.15)); ch.position.set(-w * 0.28, h + rh * 0.55, -d * 0.18); g.add(ch);
  } else {
    const r = rbox(w + 1.2, 1.2, d + 1.2, 0.5, roof); r.position.y = h + 0.4; g.add(r);
    const ac = rbox(2.6, 1.4, 2.0, 0.3, '#E6DCCB'); ac.position.set(w * 0.2, h + 1.6, -d * 0.15); g.add(ac);
  }
  if (sign) {
    const tex = signTexture(sign.text, sign.color);
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.85, 13), Math.min(w * 0.85, 13) / 4), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    sm.position.set(0, h - 1.4 + (roofType === 'gable' ? 0 : 0), d / 2 + 0.6); g.add(sm);
  }
  return g;
}

// Size: 2.6m wide x 0.65m deep x 3.8m tall (ChatGPT), shown 2.4x so it reads as a landmark
function makeTow247Sign() {
  const g = new THREE.Group(); g.name = 'tow_247_sign';
  const dark = C.dark, cream = '#F6E7CF', teal = '#4E8FA6', red = '#C8553D', stone = '#B8A99A';
  function box(w, h, d, color, x, y, z, parent = g) { const p = mesh(new THREE.BoxGeometry(w, h, d), color); p.position.set(x, y, z); parent.add(p); return p; }
  const post = mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.25, 8), dark); post.position.y = 1.625; post.name = 'sign_post'; g.add(post);
  const base = rbox(0.65, 0.26, 0.65, 0.07, stone); base.position.y = 0.13; g.add(base);
  box(1.65, 0.1, 0.15, dark, 0, 2.25, 0); box(1.65, 0.1, 0.15, dark, 0, 3.3, 0);
  const housing = rbox(2.6, 1.38, 0.26, 0.16, dark); housing.position.set(0, 2.78, 0); housing.name = 'sign_housing'; g.add(housing);
  for (const side of [-1, 1]) { const panel = rbox(2.38, 1.16, 0.045, 0.08, teal); panel.position.set(0, 2.78, side * 0.15); g.add(panel); }
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256; const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 256); ctx.fillStyle = cream; ctx.fillRect(72, 119, 368, 5);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = cream;
  ctx.font = '900 94px Nunito, Arial, sans-serif'; ctx.fillText('TOW', 256, 69);
  ctx.font = '900 102px Nunito, Arial, sans-serif'; ctx.fillText('24/7', 256, 186);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  // own material (not the shared cache): the cache keys on the options, and a texture in the options is slow to key
  const faceMat = new THREE.MeshStandardMaterial({ color: C.white, map: texture, transparent: true, roughness: 0.82, side: THREE.DoubleSide });
  for (const side of [-1, 1]) { const face = new THREE.Mesh(new THREE.PlaneGeometry(2.21, 1.07), faceMat); face.position.set(0, 2.78, side * 0.179); face.rotation.y = side === 1 ? 0 : Math.PI; g.add(face); }
  for (const x of [-0.93, 0.93]) { const marker = rbox(0.27, 0.13, 0.22, 0.05, '#F2CC8F'); marker.position.set(x, 3.52, 0); g.add(marker); }
  box(1.85, 0.07, 0.29, red, 0, 2.045, 0);
  for (const side of [-1, 1]) { const brace = box(0.09, 0.56, 0.09, dark, side * 0.37, 1.93, 0); brace.rotation.z = side * 0.55; }
  return g;
}

const BANK = [[4.35, 4.8, 0.57, 0.36, C.grass], [4.8, 5.22, 0.36, 0.16, '#B8A99A'], [5.22, 5.65, 0.16, 0.075, '#E9D8B8'], [5.68, 6.02, 0.078, 0.074, '#A9CFDA']];

function makeCozyCar(paint = '#F2CC8F') {
  const g = new THREE.Group();
  g.name = 'cozy_car';
  const L = 5.2, W = 2.6;
  const trim = '#F6E7CF';
  const dark = shade(paint, -0.12);
  const box = (w, h, d, color, o) => mesh(new THREE.BoxGeometry(w, h, d), color, o);
  const rb2 = (w, h, d, r, color, o) => mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), color, o);

  const body = rb2(L, 1.35, W, 0.42, paint); body.position.y = 1.25; g.add(body);
  const cabin = rb2(2.85, 1.3, 2.28, 0.48, C.glass, { opts: { roughness: 0.3 } }); cabin.position.set(-0.25, 2.43, 0); g.add(cabin);
  const roof = rb2(2.85, 0.28, 2.36, 0.13, paint); roof.position.set(-0.25, 3.17, 0); g.add(roof);

  for (const x of [-1.69, 1.19]) { const f = box(0.12, 0.98, 2.3, paint); f.position.set(x, 2.43, 0); g.add(f); }

  for (const side of [-1, 1]) {
    const sill = box(2.65, 0.16, 0.12, dark); sill.position.set(-0.1, 0.68, side * 1.26); g.add(sill);
    const pillar = box(0.13, 1.13, 0.13, paint); pillar.position.set(-0.35, 2.43, side * 1.16); g.add(pillar);
    for (const x of [-0.43, 1.02]) { const s = box(0.045, 0.65, 0.035, dark, { cast: false }); s.position.set(x, 1.35, side * 1.309); g.add(s); }
    for (const x of [-0.85, 0.65]) { const h = box(0.36, 0.1, 0.1, C.white, { cast: false }); h.position.set(x, 1.82, side * 1.33); g.add(h); }
    const mirror = rb2(0.36, 0.28, 0.33, 0.1, paint); mirror.position.set(1.08, 2.12, side * 1.42); g.add(mirror);
    const mg = box(0.055, 0.18, 0.23, C.glass, { cast: false }); mg.position.set(0.88, 2.12, side * 1.42); g.add(mg);
    const head = box(0.11, 0.34, 0.55, C.white); head.position.set(2.62, 1.55, side * 0.84); g.add(head);
    const tail = box(0.1, 0.36, 0.43, '#C8553D'); tail.position.set(-2.62, 1.54, side * 0.85); g.add(tail);
  }

  for (const [name, x, z] of [['wheel_fl', 1.55, 1.28], ['wheel_fr', 1.55, -1.28], ['wheel_rl', -1.55, 1.28], ['wheel_rr', -1.55, -1.28]]) {
    const wheel = new THREE.Group(); wheel.name = name; wheel.position.set(x, 0.64, z);
    const tire = mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.4, 12), C.dark); tire.rotation.x = Math.PI / 2; wheel.add(tire);
    const hub = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.425, 8), trim, { cast: false }); hub.rotation.x = Math.PI / 2; wheel.add(hub);
    const cap = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.44, 6), C.wood, { cast: false }); cap.rotation.x = Math.PI / 2; wheel.add(cap);
    g.add(wheel);
  }

  const fb = box(0.2, 0.28, 2.28, trim); fb.position.set(2.59, 0.92, 0); g.add(fb);
  const rb = box(0.2, 0.26, 2.22, trim); rb.position.set(-2.59, 0.93, 0); g.add(rb);
  const grille = box(0.09, 0.3, 0.86, C.dark, { cast: false }); grille.position.set(2.64, 1.3, 0); g.add(grille);
  const antenna = mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.23, 6), C.dark, { cast: false });
  antenna.position.set(-1.2, 3.41, 0.6); antenna.rotation.z = -0.18; g.add(antenna);
  return g;
}

function makeDeliveryTruck(paint = '#81B29A') {
  const g = new THREE.Group();
  g.name = 'delivery_truck';

  const cream = '#F6E7CF';
  const dark = C.dark;
  const glass = C.glass;

  // Small details use inexpensive box geometry.
  const box = (w, h, d, color, x, y, z) => {
    const part = mesh(new THREE.BoxGeometry(w, h, d), color);
    part.position.set(x, y, z);
    g.add(part);
    return part;
  };

  // Cargo box: rear of truck faces -X.
  const cargo = rbox(4.65, 2.95, 2.48, 0.14, cream);
  cargo.position.set(-1.32, 2.48, 0);
  g.add(cargo);

  // Cargo roof, floor trim and painted side panels.
  box(4.4, 0.09, 2.52, paint, -1.32, 3.96, 0);
  box(4.4, 0.12, 2.52, paint, -1.32, 1.05, 0);

  for (const side of [-1, 1]) {
    box(4.24, 2.52, 0.055, paint,
      -1.32, 2.48, side * 1.265);

    // Decorative cream belt line.
    box(4.25, 0.07, 0.065, cream,
      -1.32, 1.45, side * 1.304);
  }

  // Rounded forward cab.
  const cab = rbox(2.62, 2.38, 2.5, 0.32, paint);
  cab.position.set(2.34, 1.93, 0);
  g.add(cab);

  // Windshield faces +X.
  const windshield = box(
    0.055, 1.03, 1.96, glass,
    3.665, 2.49, 0
  );

  // Windshield frame and central divider.
  box(0.09, 0.07, 2.07, cream, 3.7, 3.04, 0);
  box(0.09, 0.07, 2.07, cream, 3.7, 1.95, 0);
  box(0.07, 1.08, 0.07, cream, 3.71, 2.49, 0);

  // Side windows, frames, mirrors and doors.
  for (const side of [-1, 1]) {
    const z = side * 1.27;

    box(1.28, 0.92, 0.05, glass, 2.32, 2.56, z);

    box(1.36, 0.07, 0.07, cream, 2.32, 3.06, z);
    box(1.36, 0.07, 0.07, cream, 2.32, 2.06, z);
    box(0.07, 1.0, 0.07, cream, 1.64, 2.56, z);
    box(0.07, 1.0, 0.07, cream, 3.0, 2.56, z);

    // Cab door seam and handle.
    box(0.035, 0.78, 0.035, dark,
      1.55, 1.51, side * 1.278);

    box(0.3, 0.08, 0.075, cream,
      2.18, 1.87, side * 1.305);

    // Mirror support and mirror housing.
    box(0.08, 0.08, 0.28, dark,
      3.02, 2.45, side * 1.38);

    box(0.16, 0.43, 0.27, dark,
      3.02, 2.49, side * 1.56);

    box(0.035, 0.31, 0.2, glass,
      2.925, 2.49, side * 1.56);

    // Cab step.
    box(0.9, 0.13, 0.25, dark,
      2.1, 0.82, side * 1.31);
  }

  // Front grille and bumper.
  box(0.065, 0.58, 1.13, dark, 3.68, 1.42, 0);

  for (const y of [1.25, 1.42, 1.59]) {
    box(0.075, 0.035, 0.96, cream, 3.72, y, 0);
  }

  box(0.2, 0.3, 2.48, cream, 3.7, 0.88, 0);

  for (const side of [-1, 1]) {
    // Headlights.
    box(0.075, 0.32, 0.42, C.white,
      3.71, 1.47, side * 0.98);

    // Rear taillights.
    box(0.085, 0.5, 0.23, '#C8553D',
      -3.685, 1.43, side * 1.08);
  }

  // Rear roll-up cargo door.
  box(0.07, 2.38, 2.08, cream, -3.69, 2.49, 0);

  // Horizontal roll-up slats.
  for (let i = 0; i < 11; i++) {
    box(0.025, 0.025, 1.94, '#B8A99A',
      -3.74, 1.41 + i * 0.21, 0);
  }

  // Roll-up door tracks and handle.
  for (const side of [-1, 1]) {
    box(0.09, 2.53, 0.09, dark,
      -3.75, 2.48, side * 1.07);
  }

  box(0.1, 0.08, 0.52, dark, -3.78, 1.43, 0);

  // Rear loading bumper.
  box(0.2, 0.23, 2.4, dark, -3.69, 0.88, 0);

  // Six independent wheel assemblies.
  // Wheel rotation axis is Z, suitable for +X travel.
  const wheels = [
    ['wheel_fl', 2.65,  1.25],
    ['wheel_fr', 2.65, -1.25],
    ['wheel_rl_outer', -2.35,  1.29],
    ['wheel_rl_inner', -2.35,  0.87],
    ['wheel_rr_outer', -2.35, -1.29],
    ['wheel_rr_inner', -2.35, -0.87]
  ];

  for (const [name, x, z] of wheels) {
    const wheel = new THREE.Group();
    wheel.name = name;
    wheel.position.set(x, 0.62, z);

    const tire = mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 0.32, 12),
      dark
    );
    tire.rotation.x = Math.PI / 2;
    wheel.add(tire);

    const hub = mesh(
      new THREE.CylinderGeometry(0.29, 0.29, 0.335, 12),
      cream
    );
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);

    const center = mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.345, 8),
      '#B8A99A'
    );
    center.rotation.x = Math.PI / 2;
    wheel.add(center);

    g.add(wheel);
  }

  // Mudguards behind the rear axle.
  for (const side of [-1, 1]) {
    box(0.13, 0.55, 0.43, dark,
      -3.04, 0.9, side * 1.1);
  }

  // Side signs: canvas texture, no external images.
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 160;

  const ctx = signCanvas.getContext('2d');
  ctx.fillStyle = paint;
  ctx.fillRect(0, 0, 512, 160);

  ctx.fillStyle = cream;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 57px Nunito, sans-serif';
  ctx.fillText('FRESH MARKET', 256, 80);

  const signTexture = new THREE.CanvasTexture(signCanvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;

  for (const side of [-1, 1]) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.55, 1.1),
      new THREE.MeshStandardMaterial({
        map: signTexture,
        roughness: 0.82,
        metalness: 0,
        side: THREE.DoubleSide
      })
    );

    sign.position.set(-1.32, 2.75, side * 1.303);
    sign.rotation.y = side === 1 ? 0 : Math.PI;
    sign.castShadow = false;
    sign.receiveShadow = true;
    g.add(sign);
  }

  return g;
}

function makeSchoolBus(paint = '#F4B860') {   // school-bus version of ChatGPT's city bus
  const g = new THREE.Group();
  g.name = 'school_bus';

  const cream = '#F6E7CF';
  const teal = '#4E8FA6';
  const dark = C.dark;
  const glass = C.glass;
  const stone = '#B8A99A';
  const gold = '#F2CC8F';
  const red = '#C8553D';

  // +X faces forward. Compact details use simple geometry.
  function box(w, h, d, color, x, y, z, parent = g) {
    const p = mesh(new THREE.BoxGeometry(w, h, d), color);
    p.position.set(x, y, z);
    parent.add(p);
    return p;
  }

  function cylinder(radius, depth, color, x, y, z, sides = 12, parent = g) {
    const p = mesh(
      new THREE.CylinderGeometry(radius, radius, depth, sides),
      color
    );
    p.rotation.x = Math.PI / 2;
    p.position.set(x, y, z);
    parent.add(p);
    return p;
  }

  // Main long-bodied transit bus.
  const body = rbox(10.3, 2.95, 2.57, 0.31, paint);
  body.position.y = 2.02;
  body.name = 'bus_body';
  g.add(body);

  // Rounded roof cap and cream lower fascia.
  const roof = rbox(10.1, 0.28, 2.53, 0.13, paint);
  roof.position.y = 3.45;
  g.add(roof);

  box(9.9, 0.34, 2.58, cream, 0, 0.88, 0);
  box(9.75, 0.10, 2.59, dark, 0, 1.1, 0);

  // Long window ribbons on both sides.
  for (const side of [-1, 1]) {
    const z = side * 1.31;

    // Dark window surround.
    box(8.75, 1.13, 0.045, dark, -0.27, 2.65, z);

    // Eight evenly spaced passenger windows.
    for (let i = 0; i < 8; i++) {
      const x = -4.15 + i * 1.11;

      box(0.98, 0.96, 0.055, glass,
        x, 2.65, side * 1.345);

      // Vertical black divider between windows.
      box(0.065, 1.04, 0.06, dark,
        x + 0.52, 2.65, side * 1.355);
    }

    // Long accent stripe below windows.
    box(9.64, 0.09, 0.055, dark,
      0, 1.9, side * 1.322);

    box(9.58, 0.07, 0.055, dark,
      0, 1.5, side * 1.335);
    box(9.58, 0.07, 0.055, dark,
      0, 1.22, side * 1.335);

    // Wheel-side skirt.
    box(9.7, 0.13, 0.10, dark,
      0, 0.73, side * 1.28);
  }

  // Large wraparound windshield.
  box(0.07, 1.52, 2.19, glass, 5.18, 2.55, 0);

  // Windshield perimeter.
  box(0.10, 0.10, 2.28, dark, 5.23, 3.34, 0);
  box(0.10, 0.09, 2.28, dark, 5.23, 1.75, 0);
  for (const side of [-1, 1]) {
    box(0.10, 1.57, 0.08, dark,
      5.23, 2.55, side * 1.13);
  }

  // Destination sign above windshield.
  const sign = new THREE.Group();
  sign.name = 'destination_sign';
  sign.position.set(5.24, 3.37, 0);
  g.add(sign);

  box(0.08, 0.34, 1.69, dark, 0, 0, 0, sign);

  // Simple geometric route indicators.
  for (const z of [-0.54, -0.27, 0, 0.27, 0.54]) {
    box(0.09, 0.055, 0.16, gold,
      0.05, 0, z, sign);
  }

  // Front grille.
  box(0.085, 0.37, 1.17, dark, 5.19, 1.28, 0);
  for (const y of [1.18, 1.29, 1.40]) {
    box(0.095, 0.025, 1.04, stone, 5.24, y, 0);
  }

  // Headlights and bumper.
  for (const side of [-1, 1]) {
    box(0.09, 0.34, 0.40, C.white,
      5.22, 1.48, side * 0.98);
    box(0.09, 0.09, 0.35, gold,
      5.23, 1.73, side * 0.98);
  }

  box(0.20, 0.28, 2.55, dark, 5.21, 0.83, 0);

  // Passenger entrance doors on right side (-Z).
  // Front and middle folding doors are independently named.
  for (const [name, x, width] of [
    ['door_front', 3.62, 1.30],
    ['door_middle', -1.34, 1.24]
  ]) {
    const door = new THREE.Group();
    door.name = name;
    door.position.set(x, 1.78, -1.345);
    g.add(door);

    // Door surround.
    box(width + 0.12, 2.05, 0.065, dark,
      0, 0, 0, door);

    // Pair of glazed folding panels.
    for (const side of [-1, 1]) {
      const panel = new THREE.Group();
      panel.name = side > 0 ? 'panel_left' : 'panel_right';
      panel.position.x = side * width * 0.25;
      door.add(panel);

      box(width * 0.45, 1.87, 0.07, cream,
        0, 0, -0.04, panel);

      box(width * 0.36, 1.34, 0.075, glass,
        0, 0.20, -0.085, panel);

      box(0.055, 0.78, 0.08, dark,
        -side * width * 0.16, -0.33, -0.11, panel);
    }

    // Step under entrance.
    box(width + 0.18, 0.12, 0.30, stone,
      x, 0.74, -1.36);
  }

  // Side mirrors and tall supports.
  for (const side of [-1, 1]) {
    box(0.11, 0.09, 0.34, dark,
      4.86, 2.64, side * 1.46);

    box(0.18, 0.52, 0.29, dark,
      4.86, 2.57, side * 1.67);

    box(0.025, 0.39, 0.23, glass,
      4.75, 2.57, side * 1.67);
  }

  // Rear engine grille and taillights.
  box(0.085, 0.68, 1.42, dark,
    -5.2, 1.68, 0);

  for (let i = 0; i < 5; i++) {
    box(0.095, 0.035, 1.28, stone,
      -5.25, 1.43 + i * 0.12, 0);
  }

  for (const side of [-1, 1]) {
    box(0.10, 0.55, 0.27, red,
      -5.22, 1.42, side * 1.03);

    box(0.10, 0.15, 0.25, gold,
      -5.23, 1.1, side * 1.03);
  }

  box(0.20, 0.24, 2.50, dark, -5.2, 0.84, 0);

  // Three roof HVAC/vent modules.
  for (const x of [-2.9, -0.7, 1.45]) {
    const vent = new THREE.Group();
    vent.name = `roof_vent_${x}`;
    vent.position.set(x, 3.67, 0);
    g.add(vent);

    const housing = rbox(
      1.26, 0.29, 1.12, 0.08, stone
    );
    vent.add(housing);

    // Dark top vent slats.
    for (let i = 0; i < 4; i++) {
      box(0.93, 0.025, 0.06, dark,
        0, 0.17, -0.35 + i * 0.23, vent);
    }
  }

  // Four chunky independently animated wheels.
  const wheels = [
    ['wheel_fl', 3.55, 1.30],
    ['wheel_fr', 3.55, -1.30],
    ['wheel_rl', -3.45, 1.30],
    ['wheel_rr', -3.45, -1.30]
  ];

  for (const [name, x, z] of wheels) {
    const wheel = new THREE.Group();
    wheel.name = name;
    wheel.position.set(x, 0.66, z);

    cylinder(0.66, 0.43, dark,
      0, 0, 0, 12, wheel);

    cylinder(0.34, 0.45, stone,
      0, 0, 0, 12, wheel);

    cylinder(0.12, 0.46, cream,
      0, 0, 0, 8, wheel);

    g.add(wheel);
  }

  return g;
}

function makePoliceCar(paint = '#4E8FA6') {
  const g = new THREE.Group();
  g.name = 'state_patrol_cruiser';

  const silver = '#B8A99A';
  const cream = '#F6E7CF';
  const dark = C.dark;
  const glass = C.glass;
  const red = '#C8553D';
  const blue = '#4E8FA6';

  // +X is forward. All positions are relative to ground center.
  function box(w, h, d, color, x, y, z) {
    const p = mesh(new THREE.BoxGeometry(w, h, d), color);
    p.position.set(x, y, z);
    g.add(p);
    return p;
  }

  // Sporty, low-slung sedan body with long front hood.
  const body = rbox(5.5, 1.12, 2.6, 0.34, silver);
  body.position.y = 1.21;
  g.add(body);

  // Two-tone painted hood and rear deck.
  const hood = rbox(1.72, 0.19, 2.43, 0.12, paint);
  hood.position.set(1.87, 1.83, 0);
  g.add(hood);

  const trunk = box(1.14, 0.14, 2.43, paint, -2.13, 1.81, 0);

  // Dark lower valance and sporty rocker panels.
  box(5.1, 0.16, 2.5, dark, 0, 0.77, 0);

  for (const side of [-1, 1]) {
    box(2.8, 0.12, 0.1, dark,
      -0.1, 0.75, side * 1.26);
  }

  // Wide, low cabin with tinted glass.
  const cabin = rbox(2.78, 1.13, 2.25, 0.29, glass, {
    opts: { roughness: 0.3 }
  });
  cabin.position.set(-0.3, 2.3, 0);
  g.add(cabin);

  // Contrasting painted roof.
  const roof = rbox(2.52, 0.17, 2.29, 0.09, paint);
  roof.position.set(-0.35, 2.92, 0);
  g.add(roof);

  // Windshield and rear glass frames.
  for (const x of [-1.68, 1.08]) {
    box(0.1, 0.91, 2.27, paint, x, 2.3, 0);
  }

  // Side windows, pillars and door markings.
  for (const side of [-1, 1]) {
    const z = side * 1.145;

    // Central B-pillar.
    box(0.12, 0.96, 0.12, paint, -0.43, 2.3, z);

    // Window trim.
    box(2.52, 0.055, 0.09, dark,
      -0.3, 1.81, side * 1.18);

    // Two-tone side panel.
    box(2.82, 0.47, 0.035, paint,
      -0.27, 1.42, side * 1.317);

    // Thin cream stripe.
    box(3.65, 0.055, 0.04, cream,
      -0.1, 1.69, side * 1.34);

    // Door seams.
    for (const x of [-0.47, 0.94]) {
      box(0.03, 0.63, 0.035, dark,
        x, 1.26, side * 1.335);
    }

    // Handles.
    for (const x of [-0.97, 0.43]) {
      box(0.31, 0.075, 0.075, dark,
        x, 1.67, side * 1.35);
    }

    // Door shield: stylized eight-sided state patrol emblem.
    const shield = mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.04, 8),
      cream
    );
    shield.rotation.x = Math.PI / 2;
    shield.position.set(0.37, 1.38, side * 1.36);
    g.add(shield);

    const shieldCenter = mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.045, 8),
      dark
    );
    shieldCenter.rotation.x = Math.PI / 2;
    shieldCenter.position.set(0.37, 1.38, side * 1.389);
    g.add(shieldCenter);

    // Side mirrors.
    box(0.11, 0.07, 0.21, dark,
      1.04, 2.04, side * 1.33);

    box(0.28, 0.21, 0.25, paint,
      1.07, 2.06, side * 1.45);

    // Driver-side style spotlight.
    if (side === 1) {
      const spotlight = mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.14, 10),
        dark
      );
      spotlight.rotation.z = Math.PI / 2;
      spotlight.position.set(1.02, 2.16, 1.58);
      spotlight.name = 'driver_spotlight';
      g.add(spotlight);
    }
  }

  // Wide, aggressive front grille.
  box(0.08, 0.42, 1.48, dark, 2.77, 1.28, 0);

  for (const y of [1.16, 1.29, 1.42]) {
    box(0.09, 0.025, 1.32, silver, 2.82, y, 0);
  }

  // Slim headlights and rear taillights.
  for (const side of [-1, 1]) {
    box(0.09, 0.23, 0.43, C.white,
      2.79, 1.52, side * 1.03);

    box(0.09, 0.24, 0.52, red,
      -2.79, 1.54, side * 0.96);
  }

  // Heavy-duty pursuit push bar.
  box(0.18, 0.25, 2.43, dark, 2.77, 0.87, 0);

  for (const side of [-1, 1]) {
    box(0.12, 0.68, 0.12, dark,
      3.01, 1.16, side * 0.79);
  }

  box(0.12, 0.11, 1.72, dark, 3.01, 1.4, 0);
  box(0.12, 0.1, 1.72, dark, 3.01, 1.03, 0);

  // Rear bumper and license plate.
  box(0.17, 0.24, 2.36, dark, -2.76, 0.88, 0);
  box(0.035, 0.18, 0.48, cream, -2.86, 1.12, 0);

  // Low-profile emergency lightbar.
  box(1.24, 0.075, 0.53, dark, -0.35, 3.04, 0);

  const modules = [
    ['lightbar_red', -0.66, red],
    ['lightbar_blue', -0.04, blue]
  ];

  for (const [name, x, color] of modules) {
    const light = new THREE.Group();
    light.name = name;
    light.position.set(x, 3.16, 0);

    const lens = mesh(
      new THREE.BoxGeometry(0.56, 0.17, 0.47),
      color
    );
    light.add(lens);
    g.add(light);
  }

  // Small emergency lights embedded in grille.
  for (const [z, color] of [
    [-0.43, red],
    [0.43, blue]
  ]) {
    box(0.095, 0.1, 0.21, color,
      2.85, 1.33, z);
  }

  // Four separately named wheel assemblies.
  const wheels = [
    ['wheel_fl', 1.65, 1.28],
    ['wheel_fr', 1.65, -1.28],
    ['wheel_rl', -1.72, 1.28],
    ['wheel_rr', -1.72, -1.28]
  ];

  for (const [name, x, z] of wheels) {
    const wheel = new THREE.Group();
    wheel.name = name;
    wheel.position.set(x, 0.61, z);

    const tire = mesh(
      new THREE.CylinderGeometry(0.61, 0.61, 0.4, 12),
      dark
    );
    tire.rotation.x = Math.PI / 2;
    wheel.add(tire);

    const rim = mesh(
      new THREE.CylinderGeometry(0.31, 0.31, 0.42, 12),
      silver
    );
    rim.rotation.x = Math.PI / 2;
    wheel.add(rim);

    const cap = mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.43, 8),
      cream
    );
    cap.rotation.x = Math.PI / 2;
    wheel.add(cap);

    g.add(wheel);
  }

  return g;
}

function makeFireTruck(paint = '#C8553D') {
  const g = new THREE.Group();
  g.name = 'fire_engine';

  const cream = '#F6E7CF';
  const gold = '#F2CC8F';
  const red = '#C8553D';
  const dark = C.dark;
  const silver = '#B8A99A';
  const glass = C.glass;
  const blue = '#4E8FA6';

  // Reusable primitive: small details stay inexpensive.
  function box(w, h, d, color, x, y, z, parent = g) {
    const p = mesh(new THREE.BoxGeometry(w, h, d), color);
    p.position.set(x, y, z);
    parent.add(p);
    return p;
  }

  function cyl(radius, depth, color, x, y, z, segments = 10, parent = g) {
    const p = mesh(
      new THREE.CylinderGeometry(radius, radius, depth, segments),
      color
    );
    p.rotation.x = Math.PI / 2;
    p.position.set(x, y, z);
    parent.add(p);
    return p;
  }

  // +X is the front. Cab-over design with almost no hood.
  const cab = rbox(2.8, 2.67, 2.58, 0.27, paint);
  cab.position.set(2.7, 2.06, 0);
  cab.name = 'cab_shell';
  g.add(cab);

  // Tall rear equipment body.
  const equipment = rbox(5.4, 2.9, 2.58, 0.16, paint);
  equipment.position.set(-1.45, 2.34, 0);
  equipment.name = 'equipment_body';
  g.add(equipment);

  // Cream cab roof with front brow and rear roof lip.
  box(2.66, 0.16, 2.58, cream, 2.7, 3.46, 0);
  box(0.19, 0.2, 2.58, cream, 4.03, 3.34, 0);
  box(5.2, 0.12, 2.5, cream, -1.45, 3.83, 0);

  // Large forward windshield, split into two panes.
  for (const side of [-1, 1]) {
    box(0.055, 1.05, 0.94, glass,
      4.117, 2.73, side * 0.51);

    box(0.08, 1.16, 0.07, cream,
      4.16, 2.73, side * 1.02);
  }

  box(0.08, 1.15, 0.09, cream, 4.16, 2.73, 0);
  box(0.08, 0.09, 2.12, cream, 4.16, 3.34, 0);
  box(0.08, 0.08, 2.12, dark, 4.16, 2.13, 0);

  // Windshield wipers.
  for (const z of [-0.52, 0.52]) {
    const wiper = box(0.045, 0.035, 0.75, dark,
      4.18, 2.25, z);
    wiper.rotation.x = 0.15;
  }

  // Front chrome-inspired grille, badge and bumper.
  box(0.1, 0.63, 1.32, dark, 4.13, 1.44, 0);

  for (const y of [1.25, 1.42, 1.59]) {
    box(0.11, 0.045, 1.21, silver, 4.2, y, 0);
  }

  box(0.14, 0.27, 2.6, cream, 4.17, 0.86, 0);

  // Large headlights, turn signals and front tow hooks.
  for (const side of [-1, 1]) {
    box(0.09, 0.38, 0.42, C.white,
      4.17, 1.6, side * 0.99);

    box(0.1, 0.09, 0.39, gold,
      4.19, 1.85, side * 0.99);

    box(0.16, 0.19, 0.13, dark,
      4.27, 0.76, side * 0.82);
  }

  // Cab side windows and doors.
  for (const side of [-1, 1]) {
    const z = side * 1.308;

    // Oversized rectangular side glass.
    box(1.62, 0.92, 0.055, glass, 2.78, 2.77, z);

    box(1.71, 0.085, 0.08, cream, 2.78, 3.28, z);
    box(1.71, 0.075, 0.08, cream, 2.78, 2.24, z);
    box(0.09, 1.04, 0.08, cream, 1.88, 2.76, z);

    // Window divider.
    box(0.085, 1.02, 0.08, paint, 2.72, 2.76, z);

    // Individual cab door group.
    const door = new THREE.Group();
    door.name = side === 1 ? 'door_left' : 'door_right';
    door.position.set(2.49, 1.51, z);
    g.add(door);

    box(1.66, 0.045, 0.035, cream,
      0, 0.38, side * 0.02, door);

    box(0.035, 0.93, 0.035, dark,
      -0.82, -0.09, side * 0.025, door);

    box(0.32, 0.095, 0.075, cream,
      0.27, 0.28, side * 0.065, door);

    // Bold cream stripe and tiny department insignia.
    box(1.72, 0.19, 0.045, cream,
      2.7, 1.48, side * 1.325);

    // Mirror bracket and large rectangular mirror.
    box(0.1, 0.08, 0.35, dark,
      3.76, 2.59, side * 1.43);

    box(0.18, 0.48, 0.34, dark,
      3.76, 2.57, side * 1.65);

    box(0.025, 0.35, 0.26, glass,
      3.65, 2.57, side * 1.65);

    // Deep cab entry step.
    box(1.18, 0.16, 0.29, silver,
      2.7, 0.79, side * 1.35);
  }

  // Rear compartments: 3 roll-up equipment lockers on each side.
  // Contrasting shutter panels give the truck a recognizable profile.
  for (const side of [-1, 1]) {
    const z = side * 1.308;

    const compartments = [
      { x: -3.16, w: 1.52 },
      { x: -1.42, w: 1.46 },
      { x:  0.28, w: 1.45 }
    ];

    for (let i = 0; i < compartments.length; i++) {
      const { x, w } = compartments[i];

      // Outer dark frame.
      box(w + 0.13, 2.0, 0.065, dark,
        x, 2.34, z);

      // Cream roller shutter.
      box(w, 1.87, 0.07, cream,
        x, 2.34, side * 1.357);

      // Horizontal shutter ribs.
      for (let j = 0; j < 6; j++) {
        box(w - 0.11, 0.025, 0.02, silver,
          x, 1.62 + j * 0.29, side * 1.401);
      }

      // Locking handle.
      box(0.39, 0.08, 0.06, dark,
        x, 1.58, side * 1.44);
    }

    // Long reflective-style stripe above lockers.
    box(5.1, 0.09, 0.08, gold,
      -1.45, 3.52, side * 1.335);

    // Low side skirt and steps.
    box(4.9, 0.15, 0.13, dark,
      -1.45, 0.93, side * 1.31);

    // Rear wheel arch visual accent.
    box(1.75, 0.12, 0.12, silver,
      -2.65, 1.33, side * 1.36);
  }

  // Exposed hose reels behind the cab.
  // The reels are distinct from the compartment shutters.
  for (const side of [-1, 1]) {
    const z = side * 1.41;

    const reel = new THREE.Group();
    reel.name = side === 1 ? 'hose_reel_left' : 'hose_reel_right';
    reel.position.set(0.55, 2.12, z);
    g.add(reel);

    // Horizontal drum with cream rims.
    cyl(0.36, 0.1, dark, 0, 0, 0, 12, reel);
    cyl(0.29, 0.115, gold, 0, 0, side * 0.055, 12, reel);
    cyl(0.17, 0.125, red, 0, 0, side * 0.068, 10, reel);
    cyl(0.065, 0.13, dark, 0, 0, side * 0.073, 8, reel);
  }

  // Roof ladder assembly: separate named pivot and ladder.
  const ladderPivot = new THREE.Group();
  ladderPivot.name = 'ladder_pivot';
  ladderPivot.position.set(-1.52, 3.93, 0);
  g.add(ladderPivot);

  // Turntable pedestal.
  const turntable = mesh(
    new THREE.CylinderGeometry(0.37, 0.42, 0.16, 12),
    dark
  );
  turntable.position.y = 0.05;
  ladderPivot.add(turntable);

  const ladder = new THREE.Group();
  ladder.name = 'ladder_extension';
  ladder.position.y = 0.21;
  ladderPivot.add(ladder);

  // Parallel ladder rails running along X.
  for (const side of [-1, 1]) {
    box(4.65, 0.12, 0.14, cream,
      0, 0, side * 0.43, ladder);
  }

  // Eleven evenly spaced rungs.
  for (let i = 0; i < 11; i++) {
    box(0.09, 0.065, 0.92, silver,
      -2.15 + i * 0.43, 0, 0, ladder);
  }

  // Front ladder tip and grab rails.
  for (const side of [-1, 1]) {
    box(0.11, 0.23, 0.1, gold,
      2.31, 0.1, side * 0.43, ladder);
  }

  // Roof warning beacons, independently controllable.
  for (const [name, z, color] of [
    ['beacon_left',  -0.95, red],
    ['beacon_right',  0.95, blue]
  ]) {
    const beacon = new THREE.Group();
    beacon.name = name;
    beacon.position.set(3.39, 3.67, z);

    const base = mesh(
      new THREE.CylinderGeometry(0.14, 0.17, 0.08, 10),
      dark
    );
    beacon.add(base);

    const lens = mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.2, 10),
      color
    );
    lens.position.y = 0.13;
    beacon.add(lens);

    g.add(beacon);
  }

  // Rear pump connection panel and hose outlets.
  box(0.08, 1.35, 1.7, dark, -4.18, 2.22, 0);

  for (const z of [-0.57, 0, 0.57]) {
    cyl(0.18, 0.11, silver,
      -4.23, 2.23, z, 10);
  }

  // Rear roller access panel.
  box(0.09, 0.76, 2.18, cream,
    -4.19, 3.25, 0);

  for (let i = 0; i < 3; i++) {
    box(0.03, 0.035, 2.0, silver,
      -4.25, 2.99 + i * 0.22, 0);
  }

  // Rear taillights and chunky bumper.
  for (const side of [-1, 1]) {
    box(0.12, 0.52, 0.24, red,
      -4.22, 1.46, side * 1.05);

    box(0.13, 0.15, 0.22, gold,
      -4.23, 1.16, side * 1.05);
  }

  box(0.24, 0.25, 2.55, dark, -4.22, 0.83, 0);

  // Six wheels: front steering pair and four rear dual tires.
  // The tire axle runs along Z for movement along +X.
  const wheels = [
    ['wheel_fl',       2.72,  1.3],
    ['wheel_fr',       2.72, -1.3],
    ['wheel_rl_outer', -2.75,  1.32],
    ['wheel_rl_inner', -2.75,  0.94],
    ['wheel_rr_outer', -2.75, -1.32],
    ['wheel_rr_inner', -2.75, -0.94]
  ];

  for (const [name, x, z] of wheels) {
    const wheel = new THREE.Group();
    wheel.name = name;
    wheel.position.set(x, 0.63, z);

    const tire = mesh(
      new THREE.CylinderGeometry(0.63, 0.63, 0.33, 10),
      dark
    );
    tire.rotation.x = Math.PI / 2;
    wheel.add(tire);

    const hub = mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.35, 10),
      silver
    );
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);

    g.add(wheel);
  }

  // Rear mudflaps and contrasting underbody.
  for (const side of [-1, 1]) {
    box(0.12, 0.48, 0.4, dark,
      -3.52, 0.84, side * 1.15);
  }

  box(4.7, 0.13, 2.25, dark, -1.47, 0.84, 0);

  return g;
}

function makeAmbulance(paint = '#F6E7CF') {
  const g = new THREE.Group();
  g.name = 'ambulance';

  const teal = '#4E8FA6';
  const red = '#C8553D';
  const cream = '#F6E7CF';
  const dark = C.dark;
  const glass = C.glass;
  const stone = '#B8A99A';

  function box(w, h, d, color, x, y, z, parent = g) {
    const p = mesh(new THREE.BoxGeometry(w, h, d), color);
    p.position.set(x, y, z);
    parent.add(p);
    return p;
  }

  function makeCross(size, color, x, y, z, rotY = 0, parent = g) {
    const cross = new THREE.Group();
    cross.position.set(x, y, z);
    cross.rotation.y = rotY;
    box(size * 0.34, size, 0.03, color, 0, 0, 0, cross);
    box(size, size * 0.34, 0.03, color, 0, 0, 0, cross);
    parent.add(cross);
    return cross;
  }

  // Main forms: short front cab + tall patient box.
  const cab = rbox(2.28, 2.08, 2.52, 0.26, paint);
  cab.position.set(1.8, 1.67, 0);
  cab.name = 'cab_shell';
  g.add(cab);

  const module = rbox(4.18, 2.62, 2.52, 0.15, paint);
  module.position.set(-1.12, 2.0, 0);
  module.name = 'patient_module';
  g.add(module);

  // Roof caps to create a more distinct ambulance silhouette.
  box(2.1, 0.14, 2.46, stone, 1.76, 2.77, 0);
  box(4.0, 0.14, 2.46, stone, -1.12, 3.33, 0);

  // Lower skirt.
  box(6.1, 0.14, 2.45, dark, 0, 0.74, 0);

  // Windshield and front face.
  box(0.06, 1.02, 1.96, glass, 2.96, 2.2, 0);
  box(0.09, 1.12, 2.07, paint, 2.99, 2.2, 0);
  box(0.09, 1.08, 0.08, paint, 3.0, 2.2, 0);
  box(0.09, 0.09, 2.08, stone, 3.0, 2.79, 0);
  box(0.09, 0.08, 2.08, dark, 3.0, 1.64, 0);

  // Front grille and bumper.
  box(0.08, 0.42, 1.24, dark, 2.98, 1.24, 0);
  for (const y of [1.11, 1.24, 1.37]) {
    box(0.09, 0.025, 1.1, stone, 3.03, y, 0);
  }
  box(0.17, 0.25, 2.5, dark, 3.04, 0.84, 0);

  // Headlights and front markers.
  for (const side of [-1, 1]) {
    box(0.09, 0.32, 0.42, C.white, 3.03, 1.55, side * 0.95);
    box(0.09, 0.08, 0.28, red, 3.04, 1.88, side * 0.98);
  }

  // Cab side windows, mirrors, and doors.
  for (const side of [-1, 1]) {
    const z = side * 1.275;

    box(1.12, 0.82, 0.055, glass, 1.72, 2.28, z);
    box(1.2, 0.07, 0.08, stone, 1.72, 2.74, z);
    box(1.2, 0.06, 0.08, stone, 1.72, 1.83, z);
    box(0.07, 0.9, 0.08, paint, 1.12, 2.28, z);

    // Door seam and handle.
    box(0.035, 0.82, 0.035, dark, 1.07, 1.52, side * 1.295);
    box(0.28, 0.08, 0.075, dark, 1.65, 1.78, side * 1.32);

    // Side mirror.
    box(0.1, 0.07, 0.22, dark, 2.25, 2.1, side * 1.34);
    box(0.24, 0.21, 0.24, paint, 2.28, 2.12, side * 1.46);
  }

  // Side stripe across cab + patient module.
  for (const side of [-1, 1]) {
    box(5.86, 0.32, 0.04, teal, -0.1, 1.56, side * 1.319);
    box(5.86, 0.055, 0.04, red, -0.1, 1.81, side * 1.34);
  }

  // Patient module side windows and trim.
  for (const side of [-1, 1]) {
    const z = side * 1.305;

    // Forward side window near patient seat area.
    box(0.92, 0.62, 0.055, glass, -0.1, 2.55, z);
    box(1.0, 0.06, 0.08, stone, -0.1, 2.9, z);

    // Side equipment/compartment outlines.
    box(1.18, 1.05, 0.03, stone, -2.2, 2.23, side * 1.332);
    box(0.04, 1.0, 0.03, dark, -2.74, 2.23, side * 1.35);
    box(0.04, 1.0, 0.03, dark, -1.66, 2.23, side * 1.35);
    box(1.08, 0.04, 0.03, dark, -2.2, 2.71, side * 1.35);
    box(1.08, 0.04, 0.03, dark, -2.2, 1.75, side * 1.35);
    box(0.26, 0.08, 0.05, dark, -2.2, 1.78, side * 1.37);

    // Cream medical emblem square with red cross.
    box(0.82, 0.82, 0.05, cream, -0.92, 2.12, side * 1.335);
    makeCross(0.48, red, -0.92, 2.12, side * 1.366);
  }

  // Rear double doors.
  for (const side of [-1, 1]) {
    const door = new THREE.Group();
    door.name = side > 0 ? 'rear_door_left' : 'rear_door_right';
    door.position.set(-3.08, 2.0, side * 0.63);
    g.add(door);

    box(0.08, 2.04, 1.16, paint, 0, 0, 0, door);
    box(0.09, 0.62, 0.5, glass, -0.01, 0.42, 0, door);
    box(0.03, 2.0, 0.04, dark, -0.05, 0, 0, door);
    box(0.03, 0.92, 0.04, dark, -0.05, -0.55, 0, door);
    box(0.05, 0.18, 0.1, dark, -0.08, -0.25, side * -0.24, door);
  }

  // Rear center seam and bumper.
  box(0.035, 2.08, 0.06, dark, -3.11, 2.0, 0);
  box(0.2, 0.24, 2.48, dark, -3.16, 0.84, 0);

  // Rear lights.
  for (const side of [-1, 1]) {
    box(0.1, 0.44, 0.22, red, -3.15, 1.48, side * 1.05);
    box(0.1, 0.16, 0.2, teal, -3.15, 1.13, side * 1.05);
  }

  // Back medical emblem square with red cross.
  box(0.05, 0.82, 0.82, cream, -3.14, 2.2, 0);
  makeCross(0.48, red, -3.17, 2.2, 0, Math.PI / 2);

  // Roof beacons as named groups.
  const beaconLeft = new THREE.Group();
  beaconLeft.name = 'beacon_left';
  beaconLeft.position.set(1.55, 3.02, 0.78);
  box(0.28, 0.06, 0.38, dark, 0, 0, 0, beaconLeft);
  box(0.24, 0.16, 0.34, red, 0, 0.11, 0, beaconLeft);
  g.add(beaconLeft);

  const beaconRight = new THREE.Group();
  beaconRight.name = 'beacon_right';
  beaconRight.position.set(1.55, 3.02, -0.78);
  box(0.28, 0.06, 0.38, dark, 0, 0, 0, beaconRight);
  box(0.24, 0.16, 0.34, teal, 0, 0.11, 0, beaconRight);
  g.add(beaconRight);

  // Rear upper corner flashers.
  for (const side of [-1, 1]) {
    box(0.14, 0.14, 0.22, red, -3.08, 3.1, side * 1.01);
    box(0.14, 0.14, 0.22, teal, -3.08, 2.84, side * 1.01);
  }

  // Roof vent / AC pod for silhouette.
  box(0.88, 0.22, 0.72, stone, -1.45, 3.53, 0);
  box(0.58, 0.06, 0.48, dark, -1.45, 3.67, 0);

  // Entry step on patient module side.
  box(0.72, 0.14, 0.28, stone, -1.05, 0.8, 1.35);

  // Four wheel groups.
  const wheels = [
    ['wheel_fl', 1.78, 1.28],
    ['wheel_fr', 1.78, -1.28],
    ['wheel_rl', -1.92, 1.28],
    ['wheel_rr', -1.92, -1.28]
  ];

  for (const [name, x, z] of wheels) {
    const wheel = new THREE.Group();
    wheel.name = name;
    wheel.position.set(x, 0.62, z);

    const tire = mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 0.38, 12),
      dark
    );
    tire.rotation.x = Math.PI / 2;
    wheel.add(tire);

    const rim = mesh(
      new THREE.CylinderGeometry(0.31, 0.31, 0.4, 12),
      stone
    );
    rim.rotation.x = Math.PI / 2;
    wheel.add(rim);

    const cap = mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.41, 8),
      cream
    );
    cap.rotation.x = Math.PI / 2;
    wheel.add(cap);

    g.add(wheel);
  }

  return g;
}

function makeTowTruck(paint = '#F2CC8F') {
  const g = new THREE.Group();
  g.name = 'hook_and_haul_tow_truck';

  const P = {
    yellow: paint,
    cream: '#F6E7CF',
    orange: '#E07A5F',
    dark: '#3F3A4A',
    steel: '#B8A99A',
    glass: '#A9CFDA',
    white: '#FFFFFF',
    amber: '#F4B860',
    red: '#C8553D',
    teal: '#4E8FA6'
  };

  // Front faces +X; ground at Y = 0.
  function box(w, h, d, color, x, y, z, parent = g) {
    const m = mesh(new THREE.BoxGeometry(w, h, d), color);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  function rounded(w, h, d, r, color, x, y, z, parent = g) {
    const m = rbox(w, h, d, r, color);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  function cylinder(radius, depth, color, x, y, z, parent = g) {
    const m = mesh(
      new THREE.CylinderGeometry(radius, radius, depth, 12),
      color
    );
    m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  // --------------------------------
  // CHASSIS AND UNDERBODY
  // --------------------------------

  rounded(7.3, 0.34, 2.05, 0.11,
    P.dark, 0, 0.87, 0);

  // Two visible chassis rails.
  for (const z of [-0.82, 0.82]) {
    box(6.75, 0.22, 0.17,
      P.steel, -0.15, 0.67, z);
  }

  // Front engine hood.
  rounded(1.65, 1.12, 2.45, 0.2,
    P.cream, 2.76, 1.58, 0);

  // Main upright cabin.
  const cab = rounded(
    2.45, 2.35, 2.44, 0.24,
    P.cream, 1.15, 1.98, 0
  );
  cab.name = 'truck_cab';

  // Cabin roof.
  rounded(2.52, 0.22, 2.48, 0.1,
    P.yellow, 1.12, 3.22, 0);

  // Hood grille.
  box(0.075, 0.56, 1.22,
    P.dark, 3.64, 1.54, 0);

  for (const y of [1.37, 1.52, 1.67]) {
    box(0.085, 0.035, 1.05,
      P.steel, 3.7, y, 0);
  }

  // Front headlights.
  for (const z of [-0.98, 0.98]) {
    box(0.085, 0.3, 0.37,
      P.white, 3.66, 1.81, z);

    box(0.09, 0.08, 0.34,
      P.amber, 3.68, 2.01, z);
  }

  // Front bumper.
  rounded(0.32, 0.29, 2.58, 0.06,
    P.dark, 3.73, 0.98, 0);

  // Windshield.
  box(0.075, 1.12, 2.08,
    P.glass, 2.42, 2.44, 0);

  box(0.085, 0.09, 2.2,
    P.dark, 2.46, 3.04, 0);

  // Side cab windows and doors.
  for (const side of [-1, 1]) {
    const z = side * 1.245;

    // Door outline.
    box(1.31, 1.57, 0.05,
      P.steel, 1.0, 1.78, z);

    box(1.23, 1.48, 0.055,
      P.cream, 1.0, 1.79, side * 1.281);

    // Tinted window.
    box(1.08, 0.79, 0.06,
      P.glass, 1.0, 2.52, side * 1.32);

    // Window bottom trim.
    box(1.12, 0.055, 0.07,
      P.dark, 1.0, 2.1, side * 1.35);

    // Door handle.
    box(0.27, 0.085, 0.065,
      P.dark, 0.61, 1.92, side * 1.35);

    // Side step.
    box(1.37, 0.13, 0.33,
      P.dark, 1.0, 0.84, side * 1.32);

    // Side mirror support.
    box(0.14, 0.08, 0.37,
      P.dark, 2.18, 2.68, side * 1.43);

    rounded(0.29, 0.49, 0.18, 0.045,
      P.dark, 2.18, 2.68, side * 1.63);
  }

  // --------------------------------
  // TOWING BODY
  // --------------------------------

  // Rear equipment deck.
  rounded(4.02, 0.47, 2.5, 0.12,
    P.yellow, -2.1, 1.29, 0);

  // Raised side storage cabinets.
  for (const side of [-1, 1]) {
    const z = side * 0.96;

    const cabinet = rounded(
      2.85, 0.86, 0.57, 0.08,
      P.yellow, -1.76, 1.87, z
    );
    cabinet.name = side < 0
      ? 'tool_cabinet_left'
      : 'tool_cabinet_right';

    // Cabinet doors.
    for (const x of [-2.55, -1.52, -0.5]) {
      box(0.86, 0.62, 0.04,
        P.cream, x, 1.87, side * 1.275);

      box(0.32, 0.055, 0.045,
        P.dark, x, 1.87, side * 1.309);
    }

    // Dark protective rail on top.
    box(3.1, 0.12, 0.13,
      P.dark, -1.76, 2.36, side * 1.14);

    // Lower hazard stripe.
    for (let i = 0; i < 7; i++) {
      const stripe = box(
        0.26, 0.15, 0.025,
        i % 2 === 0 ? P.dark : P.yellow,
        -3.13 + i * 0.43,
        1.1,
        side * 1.283
      );
      stripe.rotation.z = -0.46;
    }
  }

  // Protective bulkhead behind cab.
  box(0.28, 1.45, 2.4,
    P.dark, -0.19, 2.07, 0);

  box(0.18, 0.92, 2.2,
    P.yellow, -0.21, 2.16, 0);

  // Rear bumper.
  rounded(0.28, 0.32, 2.55, 0.06,
    P.dark, -4.0, 0.95, 0);

  // Taillights.
  for (const z of [-1.06, 1.06]) {
    box(0.075, 0.24, 0.27,
      P.red, -4.17, 1.38, z);
  }

  // --------------------------------
  // HYDRAULIC TOW BOOM
  // --------------------------------

  const boomPivot = new THREE.Group();
  boomPivot.name = 'tow_boom_pivot';
  boomPivot.position.set(-1.0, 2.04, 0);
  g.add(boomPivot);

  // Main angled steel boom.
  const boom = rounded(
    3.25, 0.31, 0.48, 0.06,
    P.dark, -1.45, 0.56, 0, boomPivot
  );
  boom.rotation.z = -0.25;

  // Yellow telescoping boom extension.
  const extension = rounded(
    1.72, 0.22, 0.36, 0.045,
    P.yellow, -2.82, 0.88, 0, boomPivot
  );
  extension.name = 'tow_boom_extension';
  extension.rotation.z = -0.25;

  // Boom end bracket.
  box(0.24, 0.62, 0.73,
    P.steel, -3.62, 1.0, 0, boomPivot);

  // Hydraulic cylinder.
  const hydraulic = box(
    1.65, 0.17, 0.17,
    P.steel, -1.59, 0.13, 0.41, boomPivot
  );
  hydraulic.rotation.z = -0.22;

  // --------------------------------
  // REAR WHEEL-LIFT ASSEMBLY
  // --------------------------------

  const lift = new THREE.Group();
  lift.name = 'wheel_lift';
  lift.position.set(-4.14, 0.69, 0);
  g.add(lift);

  // Main extension arm.
  rounded(1.15, 0.21, 0.3, 0.04,
    P.dark, -0.48, 0, 0, lift);

  // Crossbar for lifting a vehicle's front tires.
  rounded(0.3, 0.2, 2.25, 0.035,
    P.steel, -1.03, -0.02, 0, lift);

  // Tire cradles.
  for (const side of [-1, 1]) {
    const z = side * 0.86;

    box(0.68, 0.13, 0.2,
      P.dark, -1.24, -0.04, z, lift);

    box(0.14, 0.28, 0.22,
      P.yellow, -1.51, 0.05, z, lift);

    box(0.14, 0.24, 0.22,
      P.yellow, -0.94, 0.04, z, lift);
  }

  // --------------------------------
  // EMERGENCY BEACON LIGHTBAR
  // --------------------------------

  const lightbar = new THREE.Group();
  lightbar.name = 'emergency_lightbar';
  lightbar.position.set(1.06, 3.43, 0);
  g.add(lightbar);

  box(0.52, 0.09, 1.78,
    P.dark, 0, 0, 0, lightbar);

  for (const z of [-0.58, 0.58]) {
    rounded(0.42, 0.19, 0.51, 0.045,
      P.amber, 0, 0.14, z, lightbar);
  }

  rounded(0.36, 0.17, 0.28, 0.035,
    P.white, 0, 0.14, 0, lightbar);

  // --------------------------------
  // WHEELS
  // --------------------------------

  const wheels = [
    ['wheel_front_left', 2.82, 1.26],
    ['wheel_front_right', 2.82, -1.26],
    ['wheel_rear_left', -2.82, 1.26],
    ['wheel_rear_right', -2.82, -1.26]
  ];

  for (const [name, x, z] of wheels) {
    const wheel = new THREE.Group();
    wheel.name = name;
    wheel.position.set(x, 0.68, z);
    g.add(wheel);

    cylinder(0.66, 0.35,
      P.dark, 0, 0, 0, wheel);

    cylinder(0.37, 0.365,
      P.steel, 0, 0, 0, wheel);

    cylinder(0.14, 0.375,
      P.cream, 0, 0, 0, wheel);

    // Wheel lug details.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;

      const lug = mesh(
        new THREE.SphereGeometry(0.045, 6, 4),
        P.dark
      );

      lug.position.set(
        Math.cos(a) * 0.25,
        Math.sin(a) * 0.25,
        z > 0 ? 0.195 : -0.195
      );

      wheel.add(lug);
    }
  }

  // --------------------------------
  // REAR WORK LIGHTS
  // --------------------------------

  for (const z of [-0.85, 0.85]) {
    box(0.16, 0.23, 0.27,
      P.dark, -0.38, 2.8, z);

    box(0.08, 0.17, 0.22,
      P.white, -0.49, 2.8, z);
  }

  return g;
}

function makeRoundTree(foliage = '#9DBA8E') {
  const g = new THREE.Group(); g.name = 'round_tree';
  const trunkColor = C.wood, foliageDark = shade(foliage, -0.10), foliageLight = shade(foliage, 0.08);
  const trunk = mesh(new THREE.CylinderGeometry(0.28, 0.43, 3.0, 10), trunkColor); trunk.position.y = 1.5; g.add(trunk);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; const root = mesh(new THREE.CylinderGeometry(0.09, 0.22, 0.85, 6), trunkColor);
    root.position.set(Math.cos(a) * 0.32, 0.34, Math.sin(a) * 0.32); root.rotation.z = Math.cos(a) * 0.55; root.rotation.x = -Math.sin(a) * 0.55; g.add(root); }
  const crown = new THREE.Group(); crown.name = 'tree_canopy'; g.add(crown);
  function leafBall(radius, color, x, y, z, scale = [1, 1, 1]) { const p = mesh(new THREE.IcosahedronGeometry(radius, 1), color); p.position.set(x, y, z); p.scale.set(...scale); crown.add(p); return p; }
  leafBall(1.72, foliage, 0, 4.65, 0, [1.15, 1.03, 1.15]);
  for (const [x, y, z, r, color] of [[-1.28, 4.65, 0.30, 1.05, foliageDark], [1.28, 4.73, -0.20, 1.02, foliage], [0.12, 4.55, 1.31, 1.02, foliageLight], [-0.20, 4.65, -1.28, 1.05, foliageDark],
    [-0.75, 5.53, 0.35, 0.88, foliageLight], [0.78, 5.52, -0.25, 0.92, foliage], [0.05, 3.85, 0.91, 0.83, foliageDark], [-0.82, 4.05, -0.68, 0.81, foliage]]) leafBall(r, color, x, y, z);
  for (const [angle, len] of [[0.25, 1.0], [2.35, 0.95], [4.35, 1.08]]) { const branch = mesh(new THREE.CylinderGeometry(0.10, 0.18, len, 7), trunkColor);
    branch.position.set(Math.cos(angle) * 0.34, 3.05, Math.sin(angle) * 0.34); branch.rotation.z = Math.cos(angle) * 0.7; branch.rotation.x = -Math.sin(angle) * 0.7; g.add(branch); }
  return g;
}

function makeCypressTree(foliage = '#81B29A') {
  const g = new THREE.Group(); g.name = 'cypress_tree';
  const darkGreen = shade(foliage, -0.12), lightGreen = shade(foliage, 0.07);
  const trunk = mesh(new THREE.CylinderGeometry(0.13, 0.26, 6.7, 8), C.wood); trunk.position.y = 3.35; g.add(trunk);
  const crown = new THREE.Group(); crown.name = 'cypress_canopy'; g.add(crown);
  [{ y: 2.55, h: 2.15, rb: 0.69, rt: 0.88 }, { y: 3.65, h: 2.25, rb: 0.88, rt: 0.91 }, { y: 4.85, h: 2.25, rb: 0.91, rt: 0.75 }, { y: 6.02, h: 2.10, rb: 0.76, rt: 0.47 }, { y: 7.12, h: 1.65, rb: 0.48, rt: 0.055 }]
    .forEach((s, i) => { const part = mesh(new THREE.CylinderGeometry(s.rt, s.rb, s.h, 10, 1), [darkGreen, foliage, foliage, lightGreen, foliage][i]); part.position.y = s.y; crown.add(part); });
  [[-0.55, 3.12, 0.2, 0.43], [0.58, 4.12, -0.1, 0.43], [-0.48, 5.12, -0.12, 0.39], [0.38, 6.15, 0.21, 0.35], [0.12, 4.75, 0.65, 0.37], [-0.17, 3.75, -0.67, 0.38], [0.05, 6.85, -0.32, 0.27]]
    .forEach(([x, y, z, radius], i) => { const p = mesh(new THREE.IcosahedronGeometry(radius, 0), i % 2 === 0 ? darkGreen : lightGreen); p.position.set(x, y, z); p.scale.set(0.85, 1.7, 0.85); crown.add(p); });
  const base = mesh(new THREE.CylinderGeometry(0.19, 0.39, 0.65, 8), C.wood); base.position.y = 0.325; g.add(base);
  return g;
}

function makeAutumnMaple(foliage = '#E07A5F') {
  const g = new THREE.Group(); g.name = 'autumn_maple';
  const trunk = mesh(new THREE.CylinderGeometry(0.28, 0.46, 3.2, 9), C.wood); trunk.position.y = 1.6; g.add(trunk);
  for (const [a, len] of [[0, 1.6], [2.1, 1.45], [4.2, 1.5]]) { const branch = mesh(new THREE.CylinderGeometry(0.11, 0.22, len, 7), C.wood);
    branch.position.set(Math.cos(a) * 0.45, 3.2, Math.sin(a) * 0.45); branch.rotation.z = Math.cos(a) * 0.65; branch.rotation.x = -Math.sin(a) * 0.65; g.add(branch); }
  const crown = new THREE.Group(); crown.name = 'maple_canopy'; g.add(crown);
  for (const [x, y, z, r, color] of [[0, 4.7, 0, 1.55, foliage], [-1.35, 4.5, 0.25, 1.08, '#F2CC8F'], [1.32, 4.65, -0.15, 1.14, foliage], [0.15, 4.55, 1.35, 1.02, '#D99A8B'],
    [-0.35, 4.7, -1.3, 1.05, foliage], [-0.75, 5.58, 0.25, 0.95, '#F2CC8F'], [0.75, 5.65, -0.25, 0.92, foliage], [0, 3.95, 0.9, 0.9, '#D99A8B']]) {
    const leaf = mesh(new THREE.IcosahedronGeometry(r, 0), color); leaf.position.set(x, y, z); crown.add(leaf); }
  return g;
}

function makeWeepingWillow(foliage = '#81B29A') {
  const g = new THREE.Group(); g.name = 'weeping_willow';
  const trunk = mesh(new THREE.CylinderGeometry(0.3, 0.48, 4.0, 10), C.wood); trunk.position.y = 2; g.add(trunk);
  const crown = new THREE.Group(); crown.name = 'willow_canopy'; g.add(crown);
  const crownTop = mesh(new THREE.IcosahedronGeometry(1.8, 1), foliage); crownTop.scale.set(1.45, 0.65, 1.35); crownTop.position.y = 5.65; crown.add(crownTop);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, radius = 2.0 + (i % 3) * 0.14, length = 2.15 + (i % 4) * 0.35;
    const hanging = mesh(new THREE.CylinderGeometry(0.12, 0.28, length, 6), i % 3 === 0 ? '#9DBA8E' : foliage);
    hanging.position.set(Math.cos(a) * radius, 5.25 - length * 0.35, Math.sin(a) * radius); hanging.rotation.z = Math.cos(a) * 0.12; hanging.rotation.x = -Math.sin(a) * 0.12; crown.add(hanging); }
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const p = mesh(new THREE.IcosahedronGeometry(0.58, 0), '#9DBA8E');
    p.scale.set(0.7, 1.65, 0.7); p.position.set(Math.cos(a) * 1.45, 3.65 + (i % 2) * 0.4, Math.sin(a) * 1.45); crown.add(p); }
  return g;
}

function makeEvergreenPine(foliage = '#81B29A') {
  const g = new THREE.Group(); g.name = 'evergreen_pine';
  const trunk = mesh(new THREE.CylinderGeometry(0.19, 0.34, 7.8, 8), C.wood); trunk.position.y = 3.9; g.add(trunk);
  const canopy = new THREE.Group(); canopy.name = 'pine_canopy'; g.add(canopy);
  [[2.4, 2.5, 1.65], [3.65, 2.65, 1.47], [4.95, 2.7, 1.25], [6.2, 2.65, 0.95], [7.35, 2.25, 0.61]].forEach(([y, height, radius], i) => {
    const cone = mesh(new THREE.ConeGeometry(radius, height, 9, 1), i % 2 === 0 ? foliage : '#9DBA8E'); cone.position.y = y; canopy.add(cone); });
  const top = mesh(new THREE.ConeGeometry(0.32, 0.85, 8), foliage); top.position.y = 8.05; canopy.add(top);
  return g;
}

function makeBlossomTree(foliage = '#D99A8B') {
  const g = new THREE.Group(); g.name = 'blossom_tree';
  const trunk = mesh(new THREE.CylinderGeometry(0.22, 0.36, 2.95, 9), C.wood); trunk.position.y = 1.475; g.add(trunk);
  for (const a of [-0.6, 0.8, 2.5]) { const branch = mesh(new THREE.CylinderGeometry(0.09, 0.17, 1.55, 7), C.wood);
    branch.position.set(Math.cos(a) * 0.38, 3.0, Math.sin(a) * 0.38); branch.rotation.z = Math.cos(a) * 0.62; branch.rotation.x = -Math.sin(a) * 0.62; g.add(branch); }
  const crown = new THREE.Group(); crown.name = 'blossom_canopy'; g.add(crown);
  for (const [x, y, z, r, color] of [[0, 4.25, 0, 1.25, foliage], [-1.12, 4.2, 0.35, 0.94, '#F6E7CF'], [1.16, 4.35, 0.15, 0.96, foliage], [0.3, 4.1, 1.17, 0.97, '#D99A8B'],
    [-0.28, 4.15, -1.08, 0.9, foliage], [-0.5, 5.02, 0.3, 0.81, '#F6E7CF'], [0.72, 5.08, -0.18, 0.84, foliage]]) {
    const blossom = mesh(new THREE.IcosahedronGeometry(r, 1), color); blossom.position.set(x, y, z); crown.add(blossom); }
  return g;
}

function makeTrafficCone() {
 const g=new THREE.Group();g.name='traffic_cone';
 const base=mesh(new THREE.BoxGeometry(.6,.1,.6),C.dark);base.position.y=.05;g.add(base);
 const cone=mesh(new THREE.ConeGeometry(.25,.8,8),'#E07A5F');cone.position.y=.5;g.add(cone);
 const stripe=mesh(new THREE.CylinderGeometry(.12,.16,.13,8),C.white);stripe.position.y=.48;g.add(stripe);
 return g;
}

function makePothole(withWater = false) {
  const g = new THREE.Group(); g.name = 'pothole';
  const asphalt = '#46434E', edge = '#77717A', gravel = '#938A80';
  const outer = [[1.20, 0], [0.88, 0.48], [0.36, 0.76], [-0.42, 0.72], [-0.99, 0.36], [-1.16, -0.12], [-0.75, -0.62], [-0.18, -0.81], [0.62, -0.57]];
  const inner = outer.map(([x, z]) => [x * 0.78, z * 0.77]);
  function ring(outerPts, innerPts, color, y) {
    const v = [];
    for (let i = 0; i < outerPts.length; i++) { const j = (i + 1) % outerPts.length, a = outerPts[i], b = outerPts[j], c = innerPts[i], d = innerPts[j];
      v.push(a[0], y, a[1], b[0], y, b[1], c[0], y, c[1], b[0], y, b[1], d[0], y, d[1], c[0], y, c[1]); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geometry.computeVertexNormals();
    // own double-sided material, so the shared material cache isn't changed for anything else
    const surface = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide })); surface.receiveShadow = true; g.add(surface);
  }
  ring(outer, inner, edge, 0.035);
  const shape = new THREE.Shape(); inner.forEach(([x, z], i) => { if (i === 0) shape.moveTo(x, -z); else shape.lineTo(x, -z); }); shape.closePath();
  const pit = mesh(new THREE.ShapeGeometry(shape), asphalt, { cast: false }); pit.rotation.x = -Math.PI / 2; pit.position.y = 0.025; g.add(pit);
  for (const [x, z, r] of [[-1.08, 0.55, 0.12], [0.98, -0.51, 0.10], [-0.51, -0.80, 0.09], [0.48, 0.79, 0.11]]) {
    const rock = mesh(new THREE.IcosahedronGeometry(r, 0), gravel); rock.scale.set(1.2, 0.35, 0.8); rock.position.set(x, 0.045, z); g.add(rock); }
  if (withWater) { const puddle = mesh(new THREE.CircleGeometry(0.55, 10), '#7FB7C9', { cast: false, opts: { roughness: 0.25 } }); puddle.rotation.x = -Math.PI / 2; puddle.scale.set(1.35, 0.8, 1); puddle.position.set(0.08, 0.036, -0.04); g.add(puddle); }
  return g;
}

function makeRoadCrewBarrier() {
  const g = new THREE.Group(); g.name = 'road_crew_barrier';
  const orange = '#E07A5F', cream = '#F6E7CF', dark = C.dark, amber = '#F4B860';
  function box(w, h, d, color, x, y, z, parent = g) { const p = mesh(new THREE.BoxGeometry(w, h, d), color); p.position.set(x, y, z); parent.add(p); return p; }
  for (const x of [-1.15, 1.15]) { box(0.17, 1.28, 0.17, dark, x, 0.75, 0); box(0.33, 0.16, 0.88, dark, x, 0.10, 0); }
  for (const y of [0.67, 1.13]) {
    box(2.55, 0.31, 0.14, orange, 0, y, 0.02);
    for (let i = 0; i < 5; i++) { const s = box(0.28, 0.32, 0.025, cream, -0.98 + i * 0.49, y, 0.105); s.rotation.z = -0.48; }
    for (let i = 0; i < 5; i++) { const s = box(0.28, 0.32, 0.025, cream, -0.98 + i * 0.49, y, -0.105); s.rotation.z = 0.48; }
  }
  const beacon = new THREE.Group(); beacon.name = 'warning_beacon'; beacon.position.set(0, 1.41, 0); g.add(beacon);
  box(0.32, 0.08, 0.28, dark, 0, 0, 0, beacon);
  // own glowing material so the blink doesn't spread to every lantern that shares this amber
  const bulbMat = new THREE.MeshStandardMaterial({ color: amber, emissive: amber, emissiveIntensity: 0.2, roughness: 0.4 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), bulbMat); bulb.scale.y = 0.8; bulb.position.y = 0.17; beacon.add(bulb);
  const ph = Math.random() * 2; FLASHERS.push((t) => { bulbMat.emissiveIntensity = ((t * 1.4 + ph) % 1) < 0.5 ? 2.4 : 0.15; });
  return g;
}

function makeStopSign() {
  const g = new THREE.Group(); g.name = 'stop_sign';
  const red = '#C8553D', white = C.white, steel = '#B8A99A', dark = C.dark;
  function box(w, h, d, color, x, y, z, parent = g) { const m = mesh(new THREE.BoxGeometry(w, h, d), color); m.position.set(x, y, z); parent.add(m); return m; }
  const post = mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.72, 8), steel); post.position.set(0, 1.36, -0.045); post.name = 'sign_post'; g.add(post);
  const collar = rbox(0.18, 0.12, 0.18, 0.03, dark); collar.position.set(0, 0.06, -0.045); g.add(collar);
  for (const y of [2.13, 2.78]) box(0.22, 0.06, 0.04, steel, 0, y, -0.03);
  // octagons: rotation (PI/2, PI/8, 0) spins the 8-sided disc flat-topped, then stands it up facing +Z
  const oct = (r, depth, color, z, name) => { const m = mesh(new THREE.CylinderGeometry(r, r, depth, 8), color); m.rotation.set(Math.PI / 2, Math.PI / 8, 0); m.position.set(0, 2.45, z); if (name) m.name = name; g.add(m); return m; };
  oct(0.53, 0.06, dark, -0.01, 'octagonal_plate'); oct(0.495, 0.022, red, 0.03); oct(0.452, 0.01, white, 0.046); oct(0.395, 0.012, red, 0.051);
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256; const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 256); ctx.fillStyle = '#FFFFFF'; ctx.font = '900 168px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('STOP', 256, 138);
  const textTex = new THREE.CanvasTexture(canvas); textTex.colorSpace = THREE.SRGBColorSpace;
  // own material (the shared material cache can't key on a texture)
  const text = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), new THREE.MeshStandardMaterial({ color: white, map: textTex, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, roughness: 0.8, depthWrite: false }));
  text.position.set(0, 2.45, 0.058); text.name = 'stop_text'; g.add(text);
  for (const y of [2.1, 2.8]) { const bolt = mesh(new THREE.SphereGeometry(0.02, 6, 4), steel); bolt.position.set(0, y, 0.055); g.add(bolt); }
  return g;
}

function makeOnRampEntranceSign(label = 'FREEWAY ENTRANCE') {
  const g = new THREE.Group(); g.name = 'on_ramp_entrance_sign';
  const green = '#4D806B', darkGreen = '#355D50', cream = '#F6E7CF', steel = '#B8A99A', dark = C.dark;
  function box(w, h, d, color, x, y, z, parent = g) { const m = mesh(new THREE.BoxGeometry(w, h, d), color); m.position.set(x, y, z); parent.add(m); return m; }
  const footing = rbox(0.72, 0.25, 0.72, 0.06, steel); footing.position.y = 0.125; g.add(footing);
  const post = mesh(new THREE.CylinderGeometry(0.105, 0.13, 3.95, 8), steel); post.position.y = 2.0; post.name = 'sign_post'; g.add(post);
  for (const y of [3.15, 4.03]) box(1.95, 0.09, 0.12, dark, 0, y, -0.17);
  const panel = rbox(2.8, 1.32, 0.17, 0.08, darkGreen); panel.position.set(0, 3.66, 0); panel.name = 'sign_panel'; g.add(panel);
  for (const side of [-1, 1]) { const face = rbox(2.63, 1.15, 0.025, 0.035, green); face.position.set(0, 3.66, side * 0.096); g.add(face); }
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 384; const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 768, 384); ctx.strokeStyle = cream; ctx.lineWidth = 10; ctx.strokeRect(25, 22, 718, 340);
  ctx.fillStyle = cream; ctx.font = 'bold 75px Nunito, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 384, 125, 650);
  ctx.beginPath(); ctx.moveTo(190, 225); ctx.lineTo(510, 225); ctx.lineTo(510, 180); ctx.lineTo(625, 268); ctx.lineTo(510, 348); ctx.lineTo(510, 304); ctx.lineTo(190, 304); ctx.closePath(); ctx.fill();
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  for (const side of [-1, 1]) { const art = new THREE.Mesh(new THREE.PlaneGeometry(2.45, 1.05), new THREE.MeshStandardMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, roughness: 0.85, depthWrite: false }));
    art.position.set(0, 3.66, side * 0.117); art.rotation.y = side === 1 ? 0 : Math.PI; art.name = side === 1 ? 'sign_front_artwork' : 'sign_back_artwork'; g.add(art); }
  box(0.28, 0.12, 0.32, dark, 0, 0.3, 0);
  return g;
}

function makeMiniRoundabout() {
  const g = new THREE.Group(); g.name = 'mini_roundabout';
  const apron = mesh(new THREE.CylinderGeometry(4.7, 4.8, 0.2, 40), '#CFC2AE', { cast: false }); apron.position.y = 0.1; g.add(apron);
  for (let i = 0; i < 20; i++) {   // brick bands on the apron
    const p = new THREE.Group(); p.rotation.y = (i / 20) * Math.PI * 2;
    const b = mesh(new THREE.BoxGeometry(0.9, 0.04, 0.22), '#B8A99A', { cast: false }); b.position.set(4.1, 0.21, 0); p.add(b); g.add(p);
  }
  const curb = mesh(new THREE.CylinderGeometry(3.5, 3.6, 0.75, 40), C.curbTop); curb.position.y = 0.375; g.add(curb);
  const grass = mesh(new THREE.CylinderGeometry(3.15, 3.15, 0.14, 40), C.grass, { cast: false }); grass.position.y = 0.76; g.add(grass);
  const tree = makeBlossomTree(); tree.scale.setScalar(0.8); tree.position.y = 0.8; g.add(tree);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, f = mesh(new THREE.IcosahedronGeometry(0.34, 0), i % 3 === 0 ? '#F4B860' : i % 3 === 1 ? '#E07A5F' : '#D99A8B');
    f.position.set(Math.cos(a) * 2.55, 0.98, Math.sin(a) * 2.55); g.add(f);
  }
  for (let i = 0; i < 30; i++) {   // dashed edge line around the circulating lane
    const p = new THREE.Group(); p.rotation.y = (i / 30) * Math.PI * 2;
    const d = mesh(new THREE.PlaneGeometry(0.28, 1.0), C.lane, { cast: false }); d.rotation.x = -Math.PI / 2; d.position.set(5.2, 0.05, 0); p.add(d); g.add(p);
  }
  return g;
}

function makeYieldTooth() {
  const s = new THREE.Shape(); s.moveTo(0, -0.62); s.lineTo(-0.42, 0.38); s.lineTo(0.42, 0.38); s.closePath();
  const geo = new THREE.ShapeGeometry(s); geo.rotateX(-Math.PI / 2);
  return mesh(geo, '#FFFFFF', { cast: false });
}

function makeWarningTriangle() {
  const g = new THREE.Group(); g.name = 'warning_triangle';
  for (const [rz, x, y] of [[0, 0, 0.12], [Math.PI / 3, -0.24, 0.52], [-Math.PI / 3, 0.24, 0.52]]) {
    const b = mesh(new THREE.BoxGeometry(0.9, 0.1, 0.05), '#E07A5F'); b.rotation.z = rz; b.position.set(x, y + 0.08, 0); g.add(b);
  }
  const inner = mesh(new THREE.CircleGeometry(0.2, 3), '#F6E7CF'); inner.rotation.z = Math.PI / 2; inner.position.set(0, 0.42, 0.03); g.add(inner);
  const foot = mesh(new THREE.BoxGeometry(0.7, 0.05, 0.35), C.dark); foot.position.y = 0.03; g.add(foot);
  return g;
}

function makeWoodenFence(length = 3) {
  const g = new THREE.Group(); g.name = 'wooden_privacy_fence';
  const wood = '#B98B5E', lightWood = '#C99A70', darkWood = '#95714F';
  function box(w, h, d, color, x, y, z) { const m = mesh(new THREE.BoxGeometry(w, h, d), color); m.position.set(x, y, z); g.add(m); return m; }
  for (const x of [-length / 2, length / 2]) { box(0.17, 2.0, 0.18, darkWood, x, 1.0, 0); box(0.23, 0.1, 0.24, lightWood, x, 2.04, 0); }
  for (const y of [0.43, 1.42]) box(length, 0.13, 0.11, darkWood, 0, y, -0.09);
  const count = Math.max(1, Math.floor((length - 0.24) / 0.255)), spacing = (length - 0.24) / count;
  for (let i = 0; i < count; i++) box(0.24, 1.82, 0.095, i % 4 === 0 ? lightWood : wood, -length / 2 + 0.12 + spacing * (i + 0.5), 0.96, 0.045);
  return g;
}

function makeChainLinkFence(length = 3, height = 2.2) {
  const g = new THREE.Group(); g.name = 'chain_link_fence';
  const steel = '#B8A99A', dark = '#77717A';
  function box(w, h, d, color, x, y, z) { const m = mesh(new THREE.BoxGeometry(w, h, d), color); m.position.set(x, y, z); g.add(m); return m; }
  for (const x of [-length / 2, length / 2]) {
    const post = mesh(new THREE.CylinderGeometry(0.065, 0.075, height, 6), steel); post.position.set(x, height / 2, 0); g.add(post);
    const cap = mesh(new THREE.CylinderGeometry(0.105, 0.08, 0.09, 6), dark); cap.position.set(x, height + 0.035, 0); g.add(cap); }
  for (const y of [0.22, height - 0.12]) box(length, 0.065, 0.065, steel, 0, y, 0);
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256; const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 256); ctx.strokeStyle = 'rgba(195, 202, 200, 0.85)'; ctx.lineWidth = 4;
  for (let offset = -256; offset <= 512; offset += 32) { ctx.beginPath(); ctx.moveTo(offset, 0); ctx.lineTo(offset + 256, 256); ctx.stroke(); ctx.beginPath(); ctx.moveTo(offset, 0); ctx.lineTo(offset - 256, 256); ctx.stroke(); }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(length / 2.5, height / 2.2); texture.colorSpace = THREE.SRGBColorSpace;
  const fenceMesh = new THREE.Mesh(new THREE.PlaneGeometry(length - 0.08, height - 0.3), new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.85, metalness: 0.15 }));
  fenceMesh.position.y = height / 2; fenceMesh.name = 'chain_link_mesh'; fenceMesh.castShadow = false; g.add(fenceMesh);
  return g;
}

function makeFlag(colors = { field: '#E07A5F', band: '#F6E7CF', sun: '#F2CC8F' }) {
  const g = new THREE.Group(); g.name = 'flag';
  const pole = mesh(new THREE.CylinderGeometry(0.13, 0.16, 10, 8), '#F6E7CF'); pole.position.y = 5; g.add(pole);
  const ball = mesh(new THREE.SphereGeometry(0.28, 10, 8), colors.sun); ball.position.y = 10.15; g.add(ball);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160; const k = cv.getContext('2d');
  k.fillStyle = colors.field; k.fillRect(0, 0, 256, 160);
  k.fillStyle = colors.band; k.fillRect(0, 62, 256, 36);
  k.fillStyle = colors.sun; k.beginPath(); k.arc(70, 80, 30, 0, Math.PI * 2); k.fill();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(4, 2.5, 12, 4); geo.translate(2, 0, 0);
  const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide }));
  cloth.position.set(0.12, 8.6, 0); cloth.castShadow = true; g.add(cloth);
  const pos = geo.attributes.position, base = Float32Array.from(pos.array), phase = Math.random() * 6;
  ANIM.push((t) => {
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1], amt = x / 4;
      pos.array[i * 3 + 2] = Math.sin(x * 1.7 - t * 4.5 + phase) * 0.32 * amt;
      pos.array[i * 3 + 1] = y - amt * amt * 0.25 + Math.sin(x * 1.3 - t * 3.2 + phase) * 0.06 * amt;
    }
    pos.needsUpdate = true; geo.computeVertexNormals();
  });
  return g;
}

function makeHookAndHaulTowShop(wall = '#F6E7CF') {
  const g = new THREE.Group();
  g.name = 'hook_and_haul_v2';

  const P = {
    cream: '#F6E7CF',
    yellow: '#F2CC8F',
    gold: '#E7B95F',
    sage: '#81B29A',
    teal: '#4E8FA6',
    dark: '#3F3A4A',
    stone: '#B8A99A',
    lightStone: '#E9D8B8',
    glass: '#A9CFDA',
    wood: '#B98B5E',
    glow: '#F4B860',
    white: '#FFFFFF'
  };

  function box(w, h, d, color, x, y, z, parent = g) {
    const m = mesh(new THREE.BoxGeometry(w, h, d), color);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  function rounded(w, h, d, r, color, x, y, z) {
    const m = rbox(w, h, d, r, color);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }

  function cylinder(r1, r2, h, color, x, y, z) {
    const m = mesh(
      new THREE.CylinderGeometry(r1, r2, h, 8),
      color
    );
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }

  // ----------------------------------
  // BUILDING SHELL
  // Front faces +Z.
  // ----------------------------------

  rounded(11.25, 4.12, 8.7, 0.14, wall, 0, 2.32, 0)
    .name = 'main_shell';

  box(11.5, 0.36, 8.95, P.stone, 0, 0.2, 0);

  // Flat roof and low parapet.
  rounded(11.65, 0.22, 9.02, 0.06,
    P.dark, 0, 4.5, 0);

  box(11.7, 0.22, 0.25, P.yellow,
    0, 4.65, -4.52);

  for (const x of [-5.73, 5.73]) {
    box(0.22, 0.22, 9.02, P.yellow,
      x, 4.65, 0);
  }

  // ----------------------------------
  // INTEGRATED SIGNAGE FASCIA
  // One clean architectural band.
  // ----------------------------------

  const fascia = rounded(
    11.4, 1.1, 0.25, 0.04,
    P.dark, 0, 4.65, 4.46
  );
  fascia.name = 'integrated_sign_fascia';

  // Thin continuous yellow top/bottom trim.
  box(11.45, 0.09, 0.29, P.yellow,
    0, 5.24, 4.46);

  box(11.45, 0.08, 0.29, P.yellow,
    0, 4.09, 4.46);

  function signTexture(title, subtitle, width = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, width, 256);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = P.cream;
    ctx.font = '900 115px Arial, sans-serif';
    ctx.fillText(title, width / 2, 99, width - 32);

    if (subtitle) {
      ctx.fillStyle = P.yellow;
      ctx.font = '700 43px Arial, sans-serif';
      ctx.fillText(subtitle, width / 2, 200, width - 32);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function signage(w, h, x, y, texture) {
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      material
    );
    face.position.set(x, y, 4.615);
    face.renderOrder = 2;
    g.add(face);
    return face;
  }

  // Main storefront brand occupies the left fascia.
  signage(
    6.5, 0.92, -2.15, 4.65,
    signTexture('HOOK & HAUL', 'TOWING  •  RECOVERY')
  ).name = 'main_brand_sign';

  // Secondary information is integrated into same band.
  signage(
    3.0, 0.85, 3.7, 4.65,
    signTexture('24/7', 'TOWING SERVICE', 512)
  ).name = 'service_sign';

  // Small vertical separation within the fascia.
  box(0.07, 0.75, 0.06, P.yellow,
    1.62, 4.65, 4.63);

  // ----------------------------------
  // OFFICE STOREFRONT
  // ----------------------------------

  // Dark framing panel behind entrance/window.
  box(6.5, 3.26, 0.12, P.dark,
    -2.28, 2.21, 4.39);

  const storefrontGlass = [
    [-4.36, 1.45],
    [-0.18, 1.45]
  ];

  for (const [x, width] of storefrontGlass) {
    box(width + 0.15, 2.15, 0.11,
      P.cream, x, 2.03, 4.47);

    box(width, 2.0, 0.08,
      P.glass, x, 2.04, 4.53);

    box(0.055, 2.0, 0.045,
      P.white, x, 2.04, 4.59);

    box(width, 0.06, 0.045,
      P.white, x, 2.43, 4.59);

    // Window sill.
    box(width + 0.25, 0.12, 0.25,
      P.stone, x, 0.97, 4.57);
  }

  // Entrance frame.
  box(1.55, 2.62, 0.18,
    P.cream, -2.33, 1.79, 4.49);

  const door = new THREE.Group();
  door.name = 'office_door';
  door.position.set(-2.95, 0.45, 4.59);
  g.add(door);

  box(1.23, 2.4, 0.1,
    P.teal, 0.615, 1.2, 0, door);

  box(1.02, 1.72, 0.05,
    P.glass, 0.615, 1.49, 0.07, door);

  box(0.075, 0.42, 0.06,
    P.dark, 1.04, 1.13, 0.11, door);

  // Entrance awning: smaller and tucked under signage.
  const awning = rounded(
    2.15, 0.16, 1.08, 0.045,
    P.yellow, -2.33, 3.39, 4.82
  );
  awning.name = 'office_awning';

  box(2.12, 0.055, 0.15, P.cream,
    -2.33, 3.31, 5.35);

  // Clean door landing.
  box(2.1, 0.13, 1.0, P.stone,
    -2.33, 0.13, 4.9);

  // ----------------------------------
  // GARAGE / SERVICE BAY
  // ----------------------------------

  // Recessed dark opening with structural frame.
  box(3.65, 3.38, 0.16,
    P.dark, 3.54, 2.17, 4.39);

  box(3.25, 3.06, 0.1,
    P.lightStone, 3.54, 2.06, 4.49);

  const garage = new THREE.Group();
  garage.name = 'garage_door';
  garage.position.set(3.54, 0.53, 4.57);
  g.add(garage);

  box(3.08, 2.85, 0.08,
    P.lightStone, 0, 1.425, 0, garage);

  // Horizontal roll-up panels.
  for (let i = 1; i < 9; i++) {
    box(3.09, 0.035, 0.025,
      P.stone, 0, i * 0.315, 0.055, garage);
  }

  // Three high glass inserts.
  for (const x of [-0.83, 0, 0.83]) {
    box(0.64, 0.34, 0.035,
      P.dark, x, 2.37, 0.09, garage);

    box(0.55, 0.25, 0.04,
      P.glass, x, 2.37, 0.115, garage);
  }

  // Service bay canopy instead of an oversized sign.
  box(3.75, 0.18, 0.72,
    P.yellow, 3.54, 3.74, 4.7);

  box(3.75, 0.075, 0.14,
    P.dark, 3.54, 3.63, 5.04);

  // Concrete garage threshold.
  box(3.78, 0.11, 0.85,
    P.stone, 3.54, 0.14, 4.8);

  // Protective bollards.
  for (const x of [1.53, 5.56]) {
    cylinder(0.11, 0.13, 0.87,
      P.yellow, x, 0.49, 5.05);

    cylinder(0.135, 0.135, 0.09,
      P.dark, x, 0.94, 5.05);
  }

  // ----------------------------------
  // LIGHTING
  // ----------------------------------

  // Warm lamps mounted on facade, not above the sign.
  for (const x of [-3.45, -1.1]) {
    box(0.17, 0.27, 0.16,
      P.dark, x, 3.61, 4.49);

    box(0.13, 0.18, 0.18,
      P.glow, x, 3.61, 4.61);
  }

  // Garage floodlights under the canopy.
  for (const x of [2.57, 4.49]) {
    box(0.35, 0.10, 0.22,
      P.dark, x, 3.59, 4.94);

    box(0.24, 0.035, 0.16,
      P.glow, x, 3.53, 4.94);
  }

  // ----------------------------------
  // SIDE AND REAR DETAILS
  // ----------------------------------

  // Side wall color band (no floating sign).
  box(0.09, 0.13, 5.5,
    P.yellow, 5.67, 3.58, -0.2);

  // Side utility windows.
  for (const z of [-2.3, 0.3]) {
    box(0.11, 1.25, 1.3,
      P.dark, 5.68, 2.57, z);

    box(0.12, 1.1, 1.13,
      P.glass, 5.75, 2.57, z);
  }

  // Rear access door.
  box(1.2, 2.33, 0.13,
    P.dark, -3.8, 1.48, -4.42);

  box(1.02, 2.15, 0.12,
    P.sage, -3.8, 1.48, -4.51);

  // Ventilation units.
  for (const x of [0.5, 2.9]) {
    const ac = new THREE.Group();
    ac.name = `roof_ac_${x}`;
    ac.position.set(x, 4.95, -1.2);
    g.add(ac);

    box(1.08, 0.57, 0.85,
      P.stone, 0, 0, 0, ac);

    box(0.9, 0.09, 0.7,
      P.lightStone, 0, 0.33, 0, ac);

    for (let i = 0; i < 4; i++) {
      box(0.83, 0.035, 0.025,
        P.dark, 0, -0.19 + i * 0.13, 0.44, ac);
    }
  }

  // Small roof exhaust.
  cylinder(0.18, 0.18, 0.6,
    P.dark, -3.6, 4.95, -2.3);

  cylinder(0.3, 0.3, 0.09,
    P.stone, -3.6, 5.28, -2.3);

  // ----------------------------------
  // LANDSCAPING
  // ----------------------------------

  for (const x of [-4.6, -0.1]) {
    box(0.88, 0.37, 0.55,
      P.wood, x, 0.29, 4.93);

    for (const dx of [-0.23, 0.23]) {
      const bush = mesh(
        new THREE.IcosahedronGeometry(0.31, 0),
        P.sage
      );
      bush.position.set(x + dx, 0.64, 4.93);
      g.add(bush);
    }
  }

  return g;
}

function makeDuplexApartments() {
  const g = new THREE.Group();
  g.name = 'duplex_apartments_v2';

  const P = {
    cream: '#F6E7CF',
    warmWhite: '#FFF1DC',
    sage: '#81B29A',
    coral: '#E07A5F',
    terracotta: '#C97860',
    roof: '#6D597A',
    roofLight: '#84708F',
    brick: '#C98E77',
    mortar: '#E9C6B2',
    stone: '#B8A99A',
    wood: '#B98B5E',
    dark: '#3F3A4A',
    glass: '#A9CFDA',
    glow: '#F4B860',
    grass: '#9DBA8E'
  };

  function box(w,h,d,color,x,y,z,parent=g) {
    const m = mesh(new THREE.BoxGeometry(w,h,d),color);
    m.position.set(x,y,z);
    parent.add(m);
    return m;
  }

  function rounded(w,h,d,r,color,x,y,z,parent=g) {
    const m = rbox(w,h,d,r,color);
    m.position.set(x,y,z);
    parent.add(m);
    return m;
  }

  function cylinder(rt,rb,h,color,x,y,z,sides=8,parent=g) {
    const m = mesh(
      new THREE.CylinderGeometry(rt,rb,h,sides),
      color
    );
    m.position.set(x,y,z);
    parent.add(m);
    return m;
  }

  function triangleFace(w,h,color,x,y,z) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',
      new THREE.Float32BufferAttribute([
        -w/2,0,0,
         w/2,0,0,
         0,h,0
      ],3)
    );
    geo.computeVertexNormals();

    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide }));
    m.castShadow = m.receiveShadow = true;
    m.position.set(x,y,z);
    g.add(m);
    return m;
  }

  // ============================================
  // FOUNDATION + MAIN SHARED STRUCTURE
  // ============================================

  rounded(13.1,0.38,8.85,0.08,
    P.stone,0,0.19,-0.3);

  // Two separate townhouse masses.
  // Each home has its own facade color.
  for (const side of [-1,1]) {
    const cx = side * 3.18;
    const wall = side < 0 ? P.cream : P.warmWhite;

    rounded(6.28,5.85,8.45,0.15,
      wall,cx,3.12,-0.3);

    // Brick masonry base.
    box(6.25,0.78,8.52,
      P.brick,cx,0.78,-0.3);

    // Front brick courses.
    for(let i=0;i<3;i++){
      box(6.24,0.025,0.035,
        P.mortar,cx,0.46+i*0.23,3.98);
    }

    // Vertical corner trim.
    for(const x of [cx-3.02,cx+3.02]){
      box(0.15,4.72,0.16,
        P.warmWhite,x,3.75,4.0);
    }

    // First-to-second-story trim.
    box(6.23,0.17,0.24,
      P.warmWhite,cx,3.43,4.04);

    // Roof eave trim.
    box(6.5,0.17,0.32,
      P.warmWhite,cx,6.08,4.1);
  }

  // Shared seam between units.
  box(0.16,5.9,0.23,
    P.stone,0,3.12,4.03);

  // ============================================
  // TWO FRONT-FACING GABLE ROOFS
  // ============================================

  // Each ridge runs front-to-back (+Z).
  for(const side of [-1,1]){
    const cx=side*3.18;
    const ridgeY=8.35;
    const eaveY=6.12;
    const halfWidth=3.45;
    const halfSlope=Math.sqrt(
      halfWidth*halfWidth+
      (ridgeY-eaveY)*(ridgeY-eaveY)
    );

    // Roof slopes reach from side walls to central ridge.
    for(const direction of [-1,1]){
      const slope=box(
        halfSlope*1.04,0.21,9.25,
        side<0?P.roof:P.roofLight,
        cx+direction*halfWidth/2,
        (ridgeY+eaveY)/2,
        -0.30
      );

      slope.rotation.z=
        direction*Math.atan2(
          eaveY-ridgeY,halfWidth
        );
    }

    // Front triangular gable face.
    triangleFace(
      6.65,2.16,
      side<0?P.cream:P.warmWhite,
      cx,6.08,4.035
    );

    // Front gable trim, following the slopes.
    for(const direction of [-1,1]){
      const trim=box(
        halfSlope*1.04,0.16,0.16,
        P.warmWhite,
        cx+direction*halfWidth/2,
        (ridgeY+eaveY)/2,
        4.24
      );

      trim.rotation.z=
        direction*Math.atan2(
          eaveY-ridgeY,halfWidth
        );
    }

    // Ridge cap.
    box(0.25,0.16,9.3,
      P.dark,cx,8.4,-0.3);

    // Small circular attic vent.
    const vent=cylinder(
      0.32,0.32,0.08,
      P.stone,cx,6.99,4.105,12
    );
    vent.rotation.x=Math.PI/2;

    for(const dx of [-0.13,0,0.13]){
      box(0.035,0.34,0.045,
        P.dark,cx+dx,6.99,4.17);
    }

    // Minimal roof shingle rows.
    // These aren't individual tiles.
    // Just subtle lines for texture.
    for(let i=0;i<4;i++){
      const t=(i+1)/5;
      for(const direction of [-1,1]){
        const x=cx+direction*halfWidth*t;
        const y=ridgeY-(ridgeY-eaveY)*t+0.12;

        const line=box(
          0.035,0.03,8.9,
          P.dark,x,y,-0.3
        );
        line.rotation.z=0;
      }
    }
  }

  // ============================================
  // WINDOWS
  // ============================================

  function windowFront(x,y,w=1.5,h=1.5){
    const win=new THREE.Group();
    win.name='window';
    win.position.set(x,y,4.10);
    g.add(win);

    box(w+0.21,h+0.21,0.15,
      P.warmWhite,0,0,0,win);

    box(w,h,0.16,
      P.dark,0,0,0.09,win);

    box(w-0.12,h-0.12,0.17,
      P.glass,0,0,0.16,win);

    // Cross muntin.
    box(0.07,h-0.1,0.035,
      P.warmWhite,0,0,0.26,win);

    box(w-0.1,0.07,0.035,
      P.warmWhite,0,0.10,0.26,win);

    // Projecting sill.
    box(w+0.35,0.14,0.42,
      P.stone,0,-h/2-0.11,0.16,win);

    // Header.
    box(w+0.34,0.11,0.25,
      P.warmWhite,0,h/2+0.15,0.10,win);
  }

  // Two identical window layouts, one for each home.
  for(const side of [-1,1]){
    const cx=side*3.18;

    // Ground-level living room windows.
    windowFront(cx-1.72,2.2,1.55,1.48);

    // Upstairs bedrooms.
    windowFront(cx-1.65,4.92,1.43,1.42);
    windowFront(cx+1.62,4.92,1.43,1.42);

    // Ground-floor kitchen window.
    windowFront(cx+1.58,2.18,1.16,1.3);
  }

  // Side windows on exposed building ends.
  for(const side of [-1,1]){
    for(const y of [2.3,4.9]){
      for(const z of [-2.55,0.75]){
        const x=side*6.41;

        box(0.13,1.35,1.42,
          P.warmWhite,x,y,z);

        box(0.14,1.19,1.25,
          P.glass,x+side*0.08,y,z);

        box(0.05,1.18,0.075,
          P.warmWhite,x+side*0.17,y,z);

        box(0.33,0.12,1.55,
          P.stone,x+side*0.10,y-0.73,z);
      }
    }
  }

  // Rear windows.
  for(const side of [-1,1]){
    const cx=side*3.18;

    for(const y of [2.1,4.85]){
      for(const dx of [-1.5,1.5]){
        box(1.45,1.45,0.15,
          P.warmWhite,cx+dx,y,-4.57);

        box(1.28,1.28,0.16,
          P.glass,cx+dx,y,-4.66);

        box(0.065,1.28,0.05,
          P.warmWhite,cx+dx,y,-4.76);
      }
    }
  }

  // ============================================
  // TWO COVERED FRONT PORCHES
  // ============================================

  for(const side of [-1,1]){
    const cx=side*3.18;
    const accent=side<0?P.sage:P.coral;

    const porch=new THREE.Group();
    porch.name=side<0?'porch_unit_a':'porch_unit_b';
    g.add(porch);

    // Each door is slightly inward from the unit center.
    const doorX=cx+0.20;

    // Porch foundation.
    rounded(3.1,0.32,1.75,0.07,
      P.stone,doorX,0.27,4.69,porch);

    // Entry step.
    box(2.82,0.15,0.52,
      P.mortar,doorX,0.12,5.60,porch);

    // Porch columns.
    for(const dx of [-1.35,1.35]){
      const x=doorX+dx;

      box(0.18,2.8,0.18,
        P.warmWhite,x,1.92,5.37,porch);

      box(0.29,0.32,0.29,
        P.stone,x,0.55,5.37,porch);

      box(0.29,0.15,0.29,
        P.warmWhite,x,3.30,5.37,porch);
    }

    // Flat porch roof tucked below second-floor windows.
    rounded(3.3,0.24,2.03,0.06,
      P.roof,doorX,3.38,4.58,porch);

    box(3.35,0.12,0.18,
      P.warmWhite,doorX,3.24,5.55,porch);

    // Door surround.
    box(1.65,2.52,0.16,
      P.warmWhite,doorX,1.72,4.17,porch);

    // Hinged door group.
    const door=new THREE.Group();
    door.name=side<0?'door_unit_a':'door_unit_b';
    door.position.set(doorX-0.65,0.47,4.27);
    porch.add(door);

    box(1.30,2.35,0.10,
      accent,0.65,1.175,0,door);

    // Upper glass inset.
    box(0.78,0.82,0.035,
      P.dark,0.65,1.65,0.07,door);

    box(0.69,0.73,0.04,
      P.glass,0.65,1.65,0.095,door);

    // Bottom recessed panels.
    for(const y of [0.53,1.03]){
      box(0.85,0.34,0.035,
        side<0?P.cream:P.mortar,
        0.65,y,0.07,door);
    }

    // Handle on door opening edge.
    const knob=mesh(
      new THREE.SphereGeometry(0.07,8,6),
      P.glow
    );
    knob.position.set(1.14,1.11,0.13);
    door.add(knob);

    // Porch wall sconce.
    box(0.16,0.33,0.16,
      P.dark,doorX+1.08,2.48,4.20,porch);

    box(0.11,0.19,0.17,
      P.glow,doorX+1.08,2.48,4.31,porch);

    // Unit number plaque.
    box(0.37,0.21,0.08,
      P.dark,doorX-1.07,2.21,4.17,porch);

    // Mailbox.
    rounded(0.38,0.42,0.25,0.04,
      P.stone,doorX-1.1,1.66,4.33,porch);

    box(0.26,0.035,0.03,
      P.dark,doorX-1.1,1.73,4.49,porch);

    // Small porch planter.
    rounded(0.55,0.37,0.48,0.06,
      P.wood,doorX+1.12,0.67,5.06,porch);

    const shrub=mesh(
      new THREE.IcosahedronGeometry(0.39,1),
      P.sage
    );
    shrub.position.set(doorX+1.12,1.12,5.06);
    porch.add(shrub);
  }

  // ============================================
  // BAY WINDOW DETAIL
  // ============================================

  // Slightly projecting side bay windows add
  // dimension to the ground floor.
  for(const side of [-1,1]){
    const cx=side*3.18;
    const x=cx-1.72;

    // Low projecting bay ledge.
    rounded(2.12,0.18,0.68,0.06,
      P.stone,x,1.30,4.25);

    // Small sloped bay roof.
    const hood=box(
      2.24,0.16,0.84,
      side<0?P.roof:P.roofLight,
      x,3.05,4.27
    );
    hood.rotation.x=-0.12;
  }

  // ============================================
  // CHIMNEYS AND ROOF DETAILS
  // ============================================

  for(const side of [-1,1]){
    const cx=side*3.18;

    // Chimney emerges from rear roof slope.
    box(0.74,1.35,0.72,
      P.brick,cx+1.85,7.49,-2.6);

    box(0.92,0.14,0.91,
      P.stone,cx+1.85,8.22,-2.6);

    box(0.48,0.10,0.43,
      P.dark,cx+1.85,8.32,-2.6);

    // Small roof vent.
    cylinder(0.16,0.19,0.41,
      P.dark,cx-1.18,7.39,-2.78,8);
  }

  // ============================================
  // LANDSCAPING
  // ============================================

  // Individual narrow front garden beds.
  for(const side of [-1,1]){
    const cx=side*3.18;

    // Small hedge line beside windows.
    for(const dx of [-2.52,-1.82,-1.12]){
      const shrub=mesh(
        new THREE.IcosahedronGeometry(0.38,0),
        side<0?P.sage:P.grass
      );
      shrub.scale.set(1.05,0.85,0.83);
      shrub.position.set(cx+dx,0.52,4.49);
      g.add(shrub);
    }

    // Flower pot near front step.
    cylinder(0.29,0.24,0.36,
      P.terracotta,cx+2.24,0.33,5.16,8);

    const foliage=mesh(
      new THREE.IcosahedronGeometry(0.36,0),
      P.sage
    );
    foliage.position.set(cx+2.24,0.70,5.16);
    g.add(foliage);

    // Subtle pathway leading away from porch.
    box(1.72,0.06,1.20,
      P.mortar,cx+0.20,0.04,6.13);
  }

  // Central hedge dividing the two residences.
  for(const z of [4.42,5.12,5.82]){
    const hedge=mesh(
      new THREE.IcosahedronGeometry(0.38,0),
      P.sage
    );
    hedge.scale.set(0.65,0.85,0.92);
    hedge.position.set(0,0.47,z);
    g.add(hedge);
  }

  // Rear utility meters.
  for(const x of [-3.0,3.0]){
    box(0.49,0.68,0.21,
      P.stone,x,1.32,-4.59);

    box(0.36,0.07,0.04,
      P.dark,x,1.54,-4.72);
  }

  return g;
}

function makeHeritageApartments(wall = '#D99A8B') {
  const g = new THREE.Group();
  g.name = 'heritage_corner_apartments';
  const roofColor = '#6D597A', cream = '#F6E7CF', dark = C.dark, glass = C.glass, stone = '#B8A99A';
  function part(w, h, d, color, x, y, z, parent = g) { const p = mesh(new THREE.BoxGeometry(w, h, d), color); p.position.set(x, y, z); parent.add(p); return p; }
  const building = rbox(11.25, 13.2, 10.9, 0.16, wall); building.position.y = 6.8; g.add(building);
  part(11.5, 0.55, 11.15, stone, 0, 0.37, 0);
  for (const y of [3.45, 6.7, 9.95, 13.25]) part(11.6, 0.17, 11.2, cream, 0, y, 0);
  const upperRoof = rbox(11.4, 1.4, 11.0, 0.32, roofColor); upperRoof.position.y = 14.14; g.add(upperRoof);
  part(10.5, 0.2, 10.2, dark, 0, 14.95, 0);
  for (let floor = 0; floor < 4; floor++) { const y = 2.02 + floor * 3.25;
    for (const x of [-4.0, -1.35, 1.35, 4.0]) {
      if (floor === 0 && Math.abs(x) < 2) continue;   // keep the ground-floor center clear for the entry
      part(1.56, 2.12, 0.075, cream, x, y, 5.52); part(1.32, 1.85, 0.085, glass, x, y, 5.58);
      part(0.075, 1.86, 0.095, cream, x, y, 5.64); part(1.36, 0.07, 0.095, cream, x, y + 0.42, 5.64);
      part(1.73, 0.14, 0.38, stone, x, y - 1.13, 5.72); part(1.74, 0.16, 0.22, cream, x, y + 1.12, 5.65);
    } }
  for (const side of [-1, 1]) for (let floor = 0; floor < 4; floor++) { const y = 2.02 + floor * 3.25;
    for (const z of [-3.5, -1.1, 1.3, 3.7]) { part(0.075, 1.92, 1.4, cream, side * 5.67, y, z); part(0.085, 1.7, 1.18, glass, side * 5.71, y, z); part(0.36, 0.14, 1.55, stone, side * 5.78, y - 1.05, z); } }
  part(3.0, 3.15, 0.36, stone, 0, 1.65, 5.64); part(2.35, 2.67, 0.12, dark, 0, 1.58, 5.88);
  for (const side of [-1, 1]) { const door = new THREE.Group(); door.name = side > 0 ? 'entry_right' : 'entry_left'; g.add(door);
    part(1.05, 2.5, 0.11, C.wood, side * 0.56, 1.51, 5.97, door); part(0.48, 0.82, 0.12, glass, side * 0.56, 1.98, 6.04, door); part(0.085, 0.12, 0.1, cream, side * 0.13, 1.45, 6.08, door); }
  part(3.6, 0.17, 1.03, stone, 0, 0.23, 6.0); part(3.2, 0.16, 0.65, cream, 0, 0.43, 5.85);
  part(3.8, 0.23, 1.55, roofColor, 0, 3.45, 6.03);
  for (const x of [-1.65, 1.65]) part(0.1, 2.6, 0.1, dark, x, 1.95, 6.58);
  for (const x of [-3.7, 0, 3.7]) { const dormer = new THREE.Group(); dormer.name = `dormer_${x}`; g.add(dormer);
    part(1.65, 1.38, 0.45, cream, x, 14.27, 5.42, dormer); part(1.32, 1.04, 0.09, glass, x, 14.25, 5.7, dormer); part(0.07, 1.04, 0.1, dark, x, 14.25, 5.77, dormer); part(1.92, 0.22, 0.8, roofColor, x, 15.04, 5.48, dormer); }
  part(0.95, 1.3, 0.9, wall, -3.65, 15.24, -3.4); part(1.12, 0.2, 1.07, stone, -3.65, 15.96, -3.4);
  for (const x of [1.8, 3.2]) part(0.65, 0.48, 0.65, dark, x, 15.21, -3.35);
  return g;
}

function makeGardenApartments(wall = '#F6E7CF') {
  const g = new THREE.Group(); g.name = 'garden_apartments';
  const roofColor = '#E07A5F', trim = '#FFFFFF', dark = C.dark, glass = C.glass, wood = C.wood;
  function part(w, h, d, color, x, y, z, parent = g) { const p = mesh(new THREE.BoxGeometry(w, h, d), color); p.position.set(x, y, z); parent.add(p); return p; }
  const shell = rbox(13.2, 10.3, 8.8, 0.2, wall); shell.position.y = 5.35; g.add(shell);
  part(13.5, 0.36, 9.1, '#B8A99A', 0, 0.25, 0);
  for (const y of [3.75, 7.08]) part(13.4, 0.16, 9.05, roofColor, 0, y, 0);
  for (const side of [-1, 1]) { const slope = part(13.8, 0.28, 5.45, roofColor, 0, 11.02, side * 2.22); slope.rotation.x = side * 0.24; }
  // gable ends (the triangles under the roof at each end, missing in the original)
  const tri = new THREE.Shape(); tri.moveTo(-4.4, 0); tri.lineTo(4.4, 0); tri.lineTo(0, 1.25); tri.closePath();
  const triGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.2, bevelEnabled: false });
  for (const side of [-1, 1]) { const cap = mesh(triGeo, wall); cap.rotation.y = Math.PI / 2; cap.position.set(side * 6.5 - 0.1, 10.45, 0); g.add(cap); }
  for (const y of [2.25, 5.55, 8.85]) for (const x of [-5.1, -2.6, 2.6, 5.1]) {
    part(1.5, 1.58, 0.07, trim, x, y, 4.435); part(1.3, 1.38, 0.085, glass, x, y, 4.485); part(0.07, 1.38, 0.09, trim, x, y, 4.54); part(1.65, 0.13, 0.32, '#B8A99A', x, y - 0.83, 4.57); }
  for (const y of [2.25, 5.55, 8.85]) for (const x of [-4.8, -1.6, 1.6, 4.8]) { part(1.35, 1.45, 0.07, trim, x, y, -4.445); part(1.17, 1.27, 0.08, glass, x, y, -4.49); }
  part(2.1, 2.75, 0.1, wood, 0, 1.63, 4.48); part(0.95, 1.23, 0.11, glass, 0, 2.02, 4.55); part(3.2, 0.23, 1.6, roofColor, 0, 3.15, 5.03); part(3.0, 0.17, 0.7, '#B8A99A', 0, 0.2, 4.96);
  for (const side of [-1, 1]) for (const y of [4.0, 7.3]) { const x = side * 3.85; const balcony = new THREE.Group(); balcony.name = `balcony_${side > 0 ? 'right' : 'left'}_${y}`; g.add(balcony);
    part(2.85, 0.18, 1.25, '#B8A99A', x, y, 4.88, balcony); part(2.85, 0.83, 0.09, trim, x, y + 0.49, 5.47, balcony);
    for (const dx of [-1.32, 0, 1.32]) part(0.09, 0.87, 0.1, wood, x + dx, y + 0.49, 5.47, balcony);
    const door = new THREE.Group(); door.name = 'sliding_door'; balcony.add(door);
    part(1.15, 2.2, 0.09, glass, x, y + 1.18, 4.48, door); part(0.07, 2.2, 0.1, trim, x, y + 1.18, 4.55, door); }
  for (const x of [-1.95, 1.95]) { part(1.35, 0.54, 0.7, '#B98B5E', x, 0.34, 5.18);
    for (const dx of [-0.38, 0.18]) { const bush = mesh(new THREE.IcosahedronGeometry(0.43, 0), C.grass); bush.position.set(x + dx, 0.88, 5.18); g.add(bush); } }
  for (const x of [-4.5, 4.5]) { part(0.9, 0.45, 0.75, dark, x, 11.45, 0); part(1.05, 0.12, 0.9, '#B8A99A', x, 11.75, 0); }
  return g;
}

function makeTowerApartments(wall = '#F6E7CF') {
  const g = new THREE.Group();
  g.name = 'tower_apartments';

  const sage = '#81B29A';
  const coral = '#D99A8B';
  const plum = '#6D597A';
  const cream = '#F6E7CF';
  const white = C.white;
  const glass = C.glass;
  const dark = C.dark;
  const stone = '#B8A99A';
  const wood = C.wood;

  function box(w, h, d, color, x, y, z, parent = g) {
    const p = mesh(new THREE.BoxGeometry(w, h, d), color);
    p.position.set(x, y, z);
    parent.add(p);
    return p;
  }

  // Ten-story residential tower with a contrasting vertical wing.
  const shell = rbox(11.5, 29.6, 10.0, 0.18, wall);
  shell.position.set(0, 15.05, -0.35);
  shell.name = 'tower_shell';
  g.add(shell);

  // Low podium gives the high-rise a substantial entrance.
  const podium = rbox(12.6, 3.2, 10.9, 0.22, stone);
  podium.position.set(0, 1.7, -0.3);
  g.add(podium);

  // Two tall colored facade bands.
  box(1.4, 29.4, 0.17, sage, -4.7, 15.1, 4.73);
  box(1.12, 29.4, 0.17, coral, 4.85, 15.1, 4.73);

  // Horizontal architectural floor bands.
  for (let floor = 1; floor <= 9; floor++) {
    const y = 3.35 + floor * 2.87;

    box(11.72, 0.115, 10.15, white,
      0, y, -0.35);
  }

  // Front windows: three vertical bays per floor.
  // Simple glass planes reduce polygon costs.
  for (let floor = 0; floor < 9; floor++) {
    const y = 5.15 + floor * 2.87;

    for (const x of [-2.9, 0, 2.9]) {
      // Dark inset surround.
      box(1.85, 1.83, 0.07, dark,
        x, y, 4.69);

      // Blue-tinted glass.
      box(1.69, 1.66, 0.075, glass,
        x, y, 4.74);

      // Vertical mullion.
      box(0.06, 1.67, 0.045, white,
        x, y, 4.79);
    }
  }

  // Side facade: compact windows on both ends.
  for (const side of [-1, 1]) {
    for (let floor = 0; floor < 9; floor++) {
      const y = 5.15 + floor * 2.87;

      for (const z of [-2.6, 1.7]) {
        box(0.075, 1.68, 1.55, dark,
          side * 5.8, y, z);

        box(0.08, 1.52, 1.38, glass,
          side * 5.85, y, z);
      }
    }
  }

  // Rear facade: simpler glazing pattern.
  for (let floor = 0; floor < 9; floor++) {
    const y = 5.15 + floor * 2.87;

    for (const x of [-3.3, 0, 3.3]) {
      box(1.62, 1.68, 0.065, glass,
        x, y, -5.41);

      box(1.76, 0.11, 0.3, stone,
        x, y - 0.9, -5.47);
    }
  }

  // Projecting private balconies on the front.
  // Alternating arrangement breaks up the tower silhouette.
  for (let floor = 0; floor < 8; floor++) {
    const y = 6.47 + floor * 2.87;
    const x = floor % 2 === 0 ? -2.85 : 2.85;

    const balcony = new THREE.Group();
    balcony.name = `tower_balcony_${floor + 1}`;
    g.add(balcony);

    // Concrete slab.
    box(2.65, 0.16, 1.45, stone,
      x, y, 5.18, balcony);

    // Glass front railing.
    box(2.45, 0.82, 0.065, glass,
      x, y + 0.49, 5.88, balcony);

    // Rails and vertical supports.
    box(2.55, 0.085, 0.09, dark,
      x, y + 0.92, 5.88, balcony);

    for (const dx of [-1.22, 1.22]) {
      box(0.085, 0.89, 0.085, dark,
        x + dx, y + 0.49, 5.88, balcony);
    }

    // Side safety panels.
    for (const dx of [-1.25, 1.25]) {
      box(0.06, 0.8, 1.25, glass,
        x + dx, y + 0.49, 5.18, balcony);
    }
  }

  // Tall double-height glass entrance lobby.
  box(5.2, 2.75, 0.15, dark,
    0, 1.65, 5.22);

  box(5.02, 2.56, 0.16, glass,
    0, 1.65, 5.32);

  // Two separately named entrance doors.
  for (const side of [-1, 1]) {
    const door = new THREE.Group();
    door.name = side < 0
      ? 'lobby_door_left'
      : 'lobby_door_right';

    door.position.set(side * 0.68, 0.3, 5.43);
    g.add(door);

    box(1.24, 2.35, 0.08, glass,
      0, 1.175, 0, door);

    box(0.065, 2.35, 0.09, white,
      side * 0.58, 1.175, 0.05, door);

    box(0.075, 0.55, 0.09, dark,
      -side * 0.39, 1.1, 0.09, door);
  }

  // Prominent floating entrance canopy.
  const canopy = rbox(
    6.1, 0.3, 2.1, 0.1, sage
  );
  canopy.position.set(0, 3.15, 5.58);
  g.add(canopy);

  // Entry columns and stone steps.
  for (const x of [-2.75, 2.75]) {
    box(0.16, 2.7, 0.16, dark,
      x, 1.64, 6.35);
  }

  box(6.45, 0.16, 1.48, stone,
    0, 0.18, 5.56);

  box(5.9, 0.13, 0.65, cream,
    0, 0.33, 5.12);

  // Architectural crown at top of tower.
  box(11.8, 0.33, 10.25, plum,
    0, 30.0, -0.35);

  // Roof perimeter parapet.
  for (const z of [-5.2, 4.5]) {
    box(11.8, 0.85, 0.2, cream,
      0, 30.57, z);
  }

  for (const x of [-5.8, 5.8]) {
    box(0.2, 0.85, 9.8, cream,
      x, 30.57, -0.35);
  }

  // Rooftop penthouse utility enclosure.
  const rooftop = rbox(
    5.0, 2.5, 4.0, 0.14, sage
  );
  rooftop.position.set(-1.65, 31.42, -1.55);
  rooftop.name = 'roof_utility_room';
  g.add(rooftop);

  // Rooftop utility windows.
  for (const x of [-3.05, -1.65, -0.25]) {
    box(0.87, 0.78, 0.075, glass,
      x, 31.6, 0.5);
  }

  // Three rooftop HVAC boxes.
  for (const x of [1.9, 3.1, 4.3]) {
    const ac = new THREE.Group();
    ac.name = `roof_ac_${x}`;
    ac.position.set(x, 30.72, -2.6);
    g.add(ac);

    box(0.85, 0.72, 0.8, stone,
      0, 0, 0, ac);

    for (let i = 0; i < 3; i++) {
      box(0.68, 0.04, 0.035, dark,
        0, -0.2 + i * 0.19, 0.43, ac);
    }
  }

  // Small water tank, raised above rooftop.
  const waterTank = new THREE.Group();
  waterTank.name = 'rooftop_water_tank';
  waterTank.position.set(3.5, 31.0, 1.85);
  g.add(waterTank);

  for (const dx of [-0.45, 0.45]) {
    for (const dz of [-0.38, 0.38]) {
      box(0.09, 1.1, 0.09, dark,
        dx, 0.55, dz, waterTank);
    }
  }

  const tank = mesh(
    new THREE.CylinderGeometry(0.58, 0.58, 1.15, 10),
    plum
  );
  tank.position.y = 1.35;
  waterTank.add(tank);

  const tankTop = mesh(
    new THREE.CylinderGeometry(0.64, 0.64, 0.1, 10),
    cream
  );
  tankTop.position.y = 1.96;
  waterTank.add(tankTop);

  // Entry planters and small shrubs.
  for (const x of [-4.65, 4.65]) {
    box(1.35, 0.55, 0.8, wood,
      x, 0.39, 5.45);

    for (const dx of [-0.3, 0.3]) {
      const shrub = mesh(
        new THREE.IcosahedronGeometry(0.39, 0),
        C.grass
      );
      shrub.position.set(x + dx, 0.92, 5.45);
      g.add(shrub);
    }
  }

  // Ground-floor exterior wall lanterns.
  for (const x of [-3.3, 3.3]) {
    box(0.2, 0.4, 0.18, dark,
      x, 2.25, 5.25);

    box(0.15, 0.25, 0.19, '#F4B860',
      x, 2.25, 5.38);
  }

  return g;
}

function makeRiverBank() {
  const g = new THREE.Group();
  g.name = 'river_bank';

  const waterColor = '#7FB7C9';
  const grassColor = C.grass;
  const stoneColor = '#B8A99A';
  const sandColor = '#E9D8B8';
  const reedColor = '#81B29A';

  // Low-cost mesh helpers for environmental details.
  function box(w, h, d, color, x, y, z) {
    const m = mesh(new THREE.BoxGeometry(w, h, d), color);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }

  function cylinder(rt, rb, h, sides, color, x, y, z) {
    const m = mesh(
      new THREE.CylinderGeometry(rt, rb, h, sides),
      color
    );
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }

  // Water occupies the +Z side of the tile.
  // Flat boundaries allow adjacent river tiles to connect.
  const water = box(
    14, 0.12, 14,
    waterColor, 0, 0.015, 0
  );
  water.name = 'river_water';

  // Shoreline curves gently between identical tile-edge endpoints.
  // This prevents gaps when multiple tiles are placed side by side.
  const shore = [
    [-7, -2.0],
    [-5.8, -1.92],
    [-4.6, -1.58],
    [-3.3, -1.45],
    [-2.1, -1.73],
    [-0.8, -2.18],
    [0.6, -2.36],
    [2.0, -2.04],
    [3.3, -1.65],
    [4.7, -1.52],
    [5.9, -1.76],
    [7, -2.0]
  ];

  // Construct a continuous sculpted bank strip.
  // Each strip shares vertices, reducing geometry cost.
  function makeStrip(nearOffset, farOffset, topY, bottomY, color) {
    const vertices = [];
    const indices = [];

    for (let i = 0; i < shore.length; i++) {
      const [x, z] = shore[i];

      vertices.push(
        x, topY, z + nearOffset,
        x, bottomY, z + farOffset
      );

      if (i < shore.length - 1) {
        const a = i * 2;
        indices.push(
          a, a + 1, a + 2,
          a + 1, a + 3, a + 2
        );
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const m = mesh(geo, color, { receive: true });
    m.material.side = THREE.DoubleSide;
    g.add(m);
    return m;
  }

  // Main grassy ground, custom polygon following the shore.
  const grassShape = new THREE.Shape();
  // fix: shape Y becomes -Z after rotateX(-PI/2), so mirror it to keep grass on the shore side
  grassShape.moveTo(-7, 7);
  grassShape.lineTo(7, 7);

  for (let i = shore.length - 1; i >= 0; i--) {
    grassShape.lineTo(shore[i][0], -(shore[i][1] - 0.65));
  }

  grassShape.closePath();

  const grassGeo = new THREE.ShapeGeometry(grassShape);
  grassGeo.rotateX(-Math.PI / 2);

  const grass = mesh(grassGeo, grassColor);
  grass.position.y = 0.57;
  grass.name = 'riverbank_grass';
  g.add(grass);

  // Layered shoreline: grassy slope, exposed earth, sandy lip.
  makeStrip(-0.65, -0.2, 0.57, 0.36, grassColor);
  makeStrip(-0.2, 0.22, 0.36, 0.16, stoneColor);
  makeStrip(0.22, 0.65, 0.16, 0.075, sandColor);

  // Subtle shallow-water color bands.
  // These create depth without image textures.
  makeStrip(0.68, 1.02, 0.078, 0.074, '#A9CFDA');

  // Decorative stones along the shore.
  const stones = [
    [-5.7, -1.95, 0.38, 0.24, 0.29],
    [-4.85, -1.62, 0.23, 0.18, 0.2],
    [-2.9, -1.78, 0.48, 0.28, 0.33],
    [-1.8, -2.18, 0.22, 0.15, 0.18],
    [0.25, -2.55, 0.34, 0.22, 0.25],
    [1.1, -2.38, 0.19, 0.13, 0.18],
    [3.0, -1.95, 0.43, 0.25, 0.29],
    [4.45, -1.7, 0.25, 0.18, 0.2],
    [5.85, -1.98, 0.36, 0.24, 0.28]
  ];

  for (let i = 0; i < stones.length; i++) {
    const [x, z, w, h, d] = stones[i];

    const rock = mesh(
      new THREE.DodecahedronGeometry(0.5, 0),
      i % 3 === 0 ? C.curbSide : stoneColor
    );

    rock.scale.set(w * 1.5, h, d * 1.5);
    rock.position.set(x, 0.17, z);
    rock.rotation.set(0.12, i * 0.67, 0.1);
    g.add(rock);
  }

  // Small clusters of reeds along the waterline.
  const reedClusters = [
    [-5.1, -1.5],
    [-3.7, -1.3],
    [-1.1, -2.05],
    [1.75, -1.92],
    [3.85, -1.52],
    [5.35, -1.65]
  ];

  for (let i = 0; i < reedClusters.length; i++) {
    const [cx, cz] = reedClusters[i];

    for (let j = 0; j < 3; j++) {
      const x = cx + (j - 1) * 0.18;
      const z = cz + (j % 2) * 0.13;
      const h = 0.48 + ((i + j) % 3) * 0.12;

      const reed = cylinder(
        0.025, 0.065, h, 5,
        reedColor, x, 0.35 + h / 2, z
      );

      reed.rotation.z = (j - 1) * 0.18;
    }
  }

  // Three chunky low-poly bushes farther inland.
  const bushes = [
    [-5.4, -5.4, 0.65],
    [-0.7, -5.8, 0.82],
    [4.9, -5.2, 0.72]
  ];

  for (const [x, z, radius] of bushes) {
    const bush = mesh(
      new THREE.IcosahedronGeometry(radius, 0),
      reedColor
    );
    bush.scale.set(1.15, 0.65, 0.85);
    bush.position.set(x, 0.78, z);
    bush.rotation.y = x * 0.4;
    g.add(bush);
  }

  // Driftwood near the shore.
  const driftwood = cylinder(
    0.09, 0.12, 1.35, 7,
    C.wood, 2.2, 0.24, -2.55
  );
  driftwood.rotation.z = Math.PI / 2;
  driftwood.rotation.y = 0.25;

  // A few small lily pads in the water.
  const pads = [
    [-4.3, 2.0, 0.34],
    [-3.85, 2.35, 0.24],
    [2.7, 3.5, 0.38],
    [3.25, 3.25, 0.22],
    [5.1, 1.4, 0.28]
  ];

  for (const [x, z, radius] of pads) {
    const pad = mesh(
      new THREE.CylinderGeometry(
        radius, radius, 0.035, 9
      ),
      reedColor
    );
    pad.position.set(x, 0.095, z);
    pad.name = 'lily_pad';
    g.add(pad);
  }

  // Gentle water highlights, built from simple geometry.
  // No transparency, animation, or external textures.
  const ripples = [
    [-5.1, 3.7, 0.8],
    [-1.6, 1.5, 0.6],
    [1.3, 5.1, 0.9],
    [4.65, 4.5, 0.65]
  ];

  for (const [x, z, length] of ripples) {
    const ripple = box(
      length, 0.012, 0.035,
      C.glass, x, 0.086, z
    );
    ripple.rotation.y = -0.12;
  }

  return g;
}

function rkFlat(points, y, color) {   // flat polygon from [x, z] points
  const s = new THREE.Shape(); s.moveTo(points[0][0], -points[0][1]); for (const [x, z] of points.slice(1)) s.lineTo(x, -z); s.closePath();
  const geo = new THREE.ShapeGeometry(s); geo.rotateX(-Math.PI / 2); const m = mesh(geo, color); m.position.y = y; return m;
}

function rkStrip(a, b, ya, yb, color) {   // sloped band between two matching point rows
  const v = [], idx = [];
  for (let i = 0; i < a.length; i++) { v.push(a[i][0], ya, a[i][1], b[i][0], yb, b[i][1]); if (i < a.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.82, side: THREE.DoubleSide })); m.receiveShadow = true; return m;
}

function rkBankDecor(g, pts) {   // stones and reeds along a shore line
  pts.forEach(([x, z], i) => {
    if (i % 3 === 0) { const s = mesh(new THREE.DodecahedronGeometry(0.25 + (i % 4) * 0.06, 0), '#B8A99A'); s.position.set(x, 0.3, z); s.scale.y = 0.65; g.add(s); }
    if (i % 5 === 2) for (let r = 0; r < 3; r++) { const reed = mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.1 + r * 0.25, 5), '#81B29A'); reed.position.set(x + r * 0.18 - 0.18, 0.75, z + (r % 2) * 0.15); reed.rotation.z = (r - 1) * 0.15; g.add(reed); }
  });
}

function makeRiverBend() {
  const g = new THREE.Group(); g.name = 'river_bend';
  const water = mesh(new THREE.BoxGeometry(28, 0.12, 28), '#7FB7C9'); water.position.y = 0.015; g.add(water);
  const arc = (r) => { const p = []; for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI / 2; p.push([-14 + r * Math.cos(a), 14 - r * Math.sin(a)]); } return p; };
  g.add(rkFlat([[-14, 14], ...arc(4.35)], 0.57, C.grass));
  g.add(rkFlat([...arc(23.65), [-14, -14], [14, -14], [14, 14]], 0.57, C.grass));
  for (const [e0, e1, y0, y1, col] of BANK) { g.add(rkStrip(arc(e0), arc(e1), y0, y1, col)); g.add(rkStrip(arc(28 - e0), arc(28 - e1), y0, y1, col)); }
  rkBankDecor(g, arc(4.6)); rkBankDecor(g, arc(23.4));
  return g;
}

function makeRiverEnd() {
  const g = new THREE.Group(); g.name = 'river_end';
  const water = mesh(new THREE.BoxGeometry(28, 0.12, 28), '#7FB7C9'); water.position.y = 0.015; g.add(water);
  const cap = (rho) => { const p = [[rho, -14], [rho, -7], [rho, 0]]; for (let i = 1; i < 24; i++) { const f = (i / 24) * Math.PI; p.push([rho * Math.cos(f), rho * Math.sin(f)]); } p.push([-rho, 0], [-rho, -7], [-rho, -14]); return p; };
  g.add(rkFlat([...cap(9.65), [-14, -14], [-14, 14], [14, 14], [14, -14]], 0.57, C.grass));
  for (const [e0, e1, y0, y1, col] of BANK) g.add(rkStrip(cap(14 - e0), cap(14 - e1), y0, y1, col));
  rkBankDecor(g, cap(9.4));
  const lily = (x, z) => { const l = mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 10), '#81B29A', { cast: false }); l.position.set(x, 0.1, z); g.add(l); };
  lily(-3, 4); lily(-1.6, 5.4); lily(3.2, 2.2);
  return g;
}

function makeCitizenParts() {
  const T = (g, x, y, z) => { g.translate(x, y, z); return g; };
  const flat = (g, sz) => { g.scale(1, 1, sz); return g; };
  const joints = { hipL: [0.3, 1.15, 0], hipR: [-0.3, 1.15, 0], shoulderL: [0.69, 2.2, 0], shoulderR: [-0.69, 2.2, 0], neck: [0, 2.42, 0] };

  // torso: tapered body plus a soft shoulder dome, a little flatter front-to-back
  const torso = mergeGeometries([
    flat(T(new THREE.CylinderGeometry(0.58, 0.68, 1.1, 10, 1, true), 0, 1.75, 0), 0.8),
    flat(T(new THREE.SphereGeometry(0.58, 10, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1), 0, 2.3, 0), 0.8),
  ]);
  const band = flat(T(new THREE.CylinderGeometry(0.615, 0.64, 0.28, 10, 1, true).scale(1.03, 1, 1.03), 0, 1.86, 0), 0.8);
  const hips = flat(T(new THREE.CylinderGeometry(0.69, 0.64, 0.42, 10), 0, 1.1, 0), 0.8);
  const leg = () => T(new THREE.CylinderGeometry(0.24, 0.21, 1.0, 7), 0, -0.5, 0);
  const shoe = () => { const g = T(new THREE.BoxGeometry(0.4, 0.24, 0.62), 0, -1.03, 0.09); return g; };
  const arm = () => T(new THREE.CylinderGeometry(0.17, 0.15, 0.86, 6), 0, -0.43, 0);
  const hand = () => T(new THREE.IcosahedronGeometry(0.2, 0), 0, -0.93, 0.02);
  // head on the neck origin
  const head = T(new THREE.SphereGeometry(0.8, 10, 7), 0, 0.78, 0);
  const eyes = mergeGeometries([T(new THREE.BoxGeometry(0.09, 0.15, 0.06), 0.25, 0.84, 0.76), T(new THREE.BoxGeometry(0.09, 0.15, 0.06), -0.25, 0.84, 0.76)]);
  const cheeks = mergeGeometries([0.43, -0.43].map((x) => T(new THREE.IcosahedronGeometry(0.11, 0).scale(1, 0.7, 0.5), x, 0.62, 0.7)));
  const dome = (r, cut) => new THREE.SphereGeometry(r, 10, 4, 0, Math.PI * 2, 0, Math.PI * cut);
  const hairShort = T(dome(0.86, 0.5).rotateX(-0.28), 0, 0.84, -0.03);
  const hairLong = mergeGeometries([T(dome(0.87, 0.52).rotateX(-0.25), 0, 0.84, -0.03), T(new THREE.BoxGeometry(1.5, 1.05, 0.42), 0, 0.42, -0.5)]);
  const hairBun = mergeGeometries([T(dome(0.86, 0.5).rotateX(-0.28), 0, 0.84, -0.03), T(new THREE.SphereGeometry(0.34, 8, 6), 0, 1.55, -0.42)]);
  const cap = mergeGeometries([T(dome(0.88, 0.44), 0, 0.86, 0), T(new THREE.BoxGeometry(0.95, 0.07, 0.62), 0, 1.04, 0.68)]);
  const backpack = T(new THREE.BoxGeometry(0.95, 1.0, 0.42), 0, 1.78, -0.68);
  return { joints, torso, band, hips, legL: leg(), legR: leg(), shoeL: shoe(), shoeR: shoe(), armL: arm(), armR: arm(), handL: hand(), handR: hand(), head, eyes, cheeks, hairShort, hairLong, hairBun, cap, backpack };
}

export {
  makeCozyCar,
  makeDeliveryTruck,
  makeSchoolBus,
  makePoliceCar,
  makeFireTruck,
  makeAmbulance,
  makeTowTruck,
  makeRoundTree,
  makeCypressTree,
  makeAutumnMaple,
  makeWeepingWillow,
  makeEvergreenPine,
  makeBlossomTree,
  makeTrafficCone,
  makePothole,
  makeRoadCrewBarrier,
  makeStopSign,
  makeOnRampEntranceSign,
  makeMiniRoundabout,
  makeYieldTooth,
  makeWarningTriangle,
  makeWoodenFence,
  makeChainLinkFence,
  makeFlag,
  makeHookAndHaulTowShop,
  makeDuplexApartments,
  makeHeritageApartments,
  makeGardenApartments,
  makeTowerApartments,
  makeRiverBank,
  rkFlat,
  rkStrip,
  rkBankDecor,
  makeRiverBend,
  makeRiverEnd,
  makeCitizenParts,
  signTexture,
  awningMesh,
  building,
  makeTow247Sign,
};
