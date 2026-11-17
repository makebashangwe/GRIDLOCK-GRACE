/* Asset gallery: every model in the library laid out in rows with a label,
   so a broken or changed model is easy to spot. Open /gallery.html in dev. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createStage } from './engine/stage';
import { runTicks } from './engine/tick';
import { C, rbox, shadowAll } from './assets/core';
import * as M from './assets/models';
import * as H from './assets/highway';

const stage = createStage(document.getElementById('app')!);
const { scene, camera, cam } = stage;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ color: C.street, roughness: 0.9 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

type Entry = [label: string, make: () => THREE.Object3D, scale?: number];
const rows: [string, Entry[]][] = [
  ['Vehicles', [
    ['Cozy car', () => M.makeCozyCar('#E07A5F')], ['Delivery truck', () => M.makeDeliveryTruck('#81B29A')], ['School bus', () => M.makeSchoolBus()],
    ['Police car', () => M.makePoliceCar()], ['Fire truck', () => M.makeFireTruck()], ['Ambulance', () => M.makeAmbulance()], ['Tow truck', () => M.makeTowTruck()],
  ]],
  ['Trees', [
    ['Round', () => M.makeRoundTree()], ['Cypress', () => M.makeCypressTree()], ['Autumn maple', () => M.makeAutumnMaple()],
    ['Weeping willow', () => M.makeWeepingWillow()], ['Pine', () => M.makeEvergreenPine()], ['Blossom', () => M.makeBlossomTree()],
  ]],
  ['Road kit', [
    ['Stop sign', () => M.makeStopSign(), 1.8], ['Traffic cone', () => M.makeTrafficCone(), 1.6], ['Pothole', () => M.makePothole()],
    ['Road-crew barrier', () => M.makeRoadCrewBarrier(), 1.4], ['Warning triangle', () => M.makeWarningTriangle(), 1.4],
    ['Freeway entrance sign', () => M.makeOnRampEntranceSign(), 1.6], ['Mini roundabout', () => M.makeMiniRoundabout()],
  ]],
  ['Props', [
    ['Wooden fence', () => M.makeWoodenFence(6)], ['Chain-link fence', () => M.makeChainLinkFence(6, 2.4)], ['Flag', () => M.makeFlag()], ['TOW 24/7 sign', () => M.makeTow247Sign(), 2.4],
  ]],
  ['Buildings', [
    ['Hook & Haul', () => M.makeHookAndHaulTowShop(), 1.4], ['Duplex', () => M.makeDuplexApartments()], ['Heritage Corner', () => M.makeHeritageApartments()],
    ['Garden Walkup', () => M.makeGardenApartments()], ['Tower', () => M.makeTowerApartments()],
  ]],
  ['Highway kit (code)', [
    ['Straight (bridge in code)', () => H.makeHighwayStraight()], ['Ramp', () => H.makeHighwayRamp()], ['Curve', () => H.makeHighwayCurve()],
    ['T-junction', () => H.makeHighwayT()], ['Tall pillar (level 2)', () => H.makeTallPillar()], ['Level 2 over level 1', () => H.makeStackedCrossing()],
  ]],
  ['River', [['Straight bank', () => M.makeRiverBank()], ['Bend', () => M.makeRiverBend()], ['End', () => M.makeRiverEnd()]]],
];

const labels: { el: HTMLDivElement; pos: THREE.Vector3 }[] = [];
const errors: string[] = [];
let z = 0;
for (const [title, entries] of rows) {
  let x = 0, rowDepth = 0;
  const placed: { obj: THREE.Object3D; size: THREE.Vector3; label: string }[] = [];
  for (const [label, make, s = 1] of entries) {
    try {
      const obj = make(); obj.scale.multiplyScalar(s); shadowAll(obj);
      const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3());
      placed.push({ obj, size, label }); rowDepth = Math.max(rowDepth, size.z);
    } catch (err) { errors.push(`${label}: ${(err as Error).message}`); }
  }
  for (const { obj, size, label } of placed) {
    const pad = rbox(size.x + 4, 0.4, rowDepth + 4, 0.4, C.curbTop, { cast: false });
    pad.position.set(x + size.x / 2 + 2, 0.2, z - rowDepth / 2 - 2); scene.add(pad);
    const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3());
    obj.position.set(x + size.x / 2 + 2 - c.x, 0.4 - box.min.y, z - rowDepth / 2 - 2 - c.z); scene.add(obj);
    labels.push({ el: tag(label), pos: new THREE.Vector3(x + size.x / 2 + 2, size.y + 1.5, z - rowDepth / 2 - 2) });
    x += size.x + 8;
  }
  labels.push({ el: tag(title, true), pos: new THREE.Vector3(-14, 1, z - rowDepth / 2 - 2) });
  z -= rowDepth + 18;
}

// the Meshy pieces, loaded from public/models
const glbs = ['bridge_straight_v02', 'house', 'school', 'factory', 'police_station', 'fire_station', 'cityhall', 'stadium'];
const loader = new GLTFLoader();
let gx = 0;
for (const name of glbs) {
  const at = gx; gx += 50;
  loader.load(`${import.meta.env.BASE_URL}models/${name}.glb`, (g) => {
    const obj = g.scene, box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3());
    obj.scale.setScalar(36 / Math.max(size.x, size.z)); shadowAll(obj);
    const b2 = new THREE.Box3().setFromObject(obj), c = b2.getCenter(new THREE.Vector3());
    obj.position.set(at + 20 - c.x, -b2.min.y, z - 22 - c.z); scene.add(obj);
    labels.push({ el: tag(name.replace('_', ' ')), pos: new THREE.Vector3(at + 20, b2.getSize(new THREE.Vector3()).y + 2, z - 22) });
  }, undefined, (err) => errors.push(`${name}.glb: ${String(err)}`));
}
labels.push({ el: tag('Meshy models', true), pos: new THREE.Vector3(-14, 1, z - 22) });

function tag(text: string, big = false): HTMLDivElement {
  const el = document.createElement('div'); el.textContent = text; el.className = big ? 'tag big' : 'tag';
  document.body.appendChild(el); return el;
}

cam.target.set(60, 0, -60); cam.zoom = cam.goalZoom = 0.55;
const v = new THREE.Vector3();
(function loop() {
  runTicks(performance.now() / 1000);
  stage.render();
  for (const { el, pos } of labels) {
    v.copy(pos).project(camera);
    el.style.left = ((v.x + 1) / 2) * innerWidth + 'px'; el.style.top = ((1 - v.y) / 2) * innerHeight + 'px';
    el.style.display = Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05 ? 'none' : 'block';
  }
  const status = document.getElementById('status')!;
  status.textContent = errors.length ? `${errors.length} model(s) failed: ${errors.join(' · ')}` : 'All models built.';
  status.className = errors.length ? 'bad' : '';
  requestAnimationFrame(loop);
})();
(window as unknown as { __gallery: unknown }).__gallery = { cam, errors };
