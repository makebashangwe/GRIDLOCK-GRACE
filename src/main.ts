/* Gridlock & Grace — v0.1, the road puzzle.
   Draw roads so every home's car reaches its shop before the deadline. */
import * as THREE from 'three';
import { createStage } from './engine/stage';
import { runTicks } from './engine/tick';
import { C } from './assets/core';
import { Grid } from './game/grid';
import { RoadView } from './game/roadView';
import { Traffic } from './game/traffic';
import { City } from './game/city';
import { T, SHOP_INFO, SHOP_ORDER } from './game/tuning';

const stage = createStage(document.getElementById('app')!);
const { scene, camera, cam } = stage;
const $ = (id: string) => document.getElementById(id)!;

/* ---------- world ---------- */
const grid = new Grid();
const size = T.tile * grid.n;
const land = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color: C.grass, roughness: 0.95 }));
land.rotation.x = -Math.PI / 2; land.receiveShadow = true; scene.add(land);
const edge = new THREE.Mesh(new THREE.BoxGeometry(size + 6, 2, size + 6), new THREE.MeshStandardMaterial({ color: '#B9A58F', roughness: 0.95 }));
edge.position.y = -1.02; scene.add(edge);
const gridLines = new THREE.GridHelper(size, grid.n, '#8DAA7F', '#8DAA7F');
const gm = gridLines.material as THREE.Material; gm.transparent = true; gm.opacity = 0.28; gridLines.position.y = 0.015; scene.add(gridLines);

const roads = new RoadView(scene, grid);
const traffic = new Traffic(scene, grid);
const city = new City(scene, grid, traffic, $('pins'));
roads.rebuild();
cam.target.set(0, 0, 0); cam.zoom = cam.goalZoom = 1.15;

/* ---------- drawing roads ---------- */
type Tool = 'road' | 'erase' | 'move';
let tool: Tool = 'road';
const ghostMat = new THREE.MeshBasicMaterial({ color: '#4E8FA6', transparent: true, opacity: 0.4, depthWrite: false });
const ghost = new THREE.Mesh(new THREE.PlaneGeometry(T.tile - 0.6, T.tile - 0.6).rotateX(-Math.PI / 2), ghostMat);
ghost.position.y = 0.12; ghost.visible = false; scene.add(ghost);
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
function tileUnder(e: PointerEvent): [number, number] | null {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(floor, hit)) return null;
  const [i, j] = grid.tileAt(hit.x, hit.z); return grid.inside(i, j) ? [i, j] : null;
}
function canPlace(i: number, j: number) { return grid.isFree(i, j) && city.stats.roadTiles > 0; }
function apply(i: number, j: number): boolean {
  const c = grid.idx(i, j);
  if (tool === 'road') {
    if (!canPlace(i, j)) return false;
    city.clearTree(c); grid.road[c] = 1; city.stats.roadTiles--;
  } else {
    if (!grid.road[c]) return false;
    grid.road[c] = 0; city.stats.roadTiles++;
  }
  return true;
}
let stroke: [number, number] | null = null;
function paintTo(to: [number, number]) {
  let changed = false;
  if (!stroke) { changed = apply(...to); stroke = to; }
  else {
    let [i, j] = stroke;
    while (i !== to[0] || j !== to[1]) {   // step one tile at a time (along x first), so diagonal drags stay connected
      if (i !== to[0]) i += Math.sign(to[0] - i); else j += Math.sign(to[1] - j);
      if (apply(i, j)) changed = true;
      stroke = [i, j];
    }
  }
  if (changed) { roads.rebuild(); city.roadsChanged(); }
}
const canvas = stage.renderer.domElement;
// Move tool: one-finger / left-drag pans (for phones and trackpads)
let panFrom: { x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', (e) => {
  if (tool === 'move' && e.button === 0) { panFrom = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); return; }
  if (e.button !== 0 || e.shiftKey || city.stats.over) return;
  const t = tileUnder(e); if (!t) return;
  canvas.setPointerCapture(e.pointerId); stroke = null; paintTo(t);
});
canvas.addEventListener('pointermove', (e) => {
  if (panFrom) {
    const k = (2 * cam.view) / cam.zoom / canvas.clientHeight, dx = (e.clientX - panFrom.x) * k, dy = (e.clientY - panFrom.y) * k / Math.sin(cam.tilt);
    const ca = Math.cos(cam.angle), sa = Math.sin(cam.angle);
    cam.target.x -= dx * ca + dy * sa; cam.target.z -= -dx * sa + dy * ca; panFrom = { x: e.clientX, y: e.clientY }; return;
  }
  const t = tileUnder(e);
  if (tool === 'move') { ghost.visible = false; return; }
  ghost.visible = !!t && !city.stats.over;
  if (!t) return;
  const { x, z } = grid.center(...t); ghost.position.x = x; ghost.position.z = z;
  const ok = tool === 'road' ? canPlace(...t) : grid.isRoad(...t);
  ghostMat.color.set(tool === 'erase' ? '#C8553D' : ok ? '#4E8FA6' : '#C8553D'); ghostMat.opacity = ok ? 0.42 : 0.22;
  if (stroke && (e.buttons & 1)) paintTo(t);
});
const endStroke = () => { stroke = null; panFrom = null; };
canvas.addEventListener('pointerup', endStroke); canvas.addEventListener('pointercancel', endStroke);
canvas.addEventListener('pointerleave', () => (ghost.visible = false));

function setTool(t: Tool) { tool = t; $('toolRoad').classList.toggle('on', t === 'road'); $('toolErase').classList.toggle('on', t === 'erase'); $('toolMove').classList.toggle('on', t === 'move'); }
$('toolRoad').onclick = () => setTool('road'); $('toolErase').onclick = () => setTool('erase'); $('toolMove').onclick = () => setTool('move');
$('zoomIn').onclick = () => (cam.goalZoom = Math.min(9, cam.goalZoom * 1.35)); $('zoomOut').onclick = () => (cam.goalZoom = Math.max(0.15, cam.goalZoom / 1.35));

/* ---------- speed ---------- */
let speed = 1;
function setSpeed(s: number) { speed = s; document.querySelectorAll<HTMLElement>('[data-speed]').forEach((b) => b.classList.toggle('on', Number(b.dataset.speed) === s)); }
document.querySelectorAll<HTMLElement>('[data-speed]').forEach((b) => (b.onclick = () => setSpeed(Number(b.dataset.speed))));
window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') setTool('road');
  if (e.key === 'x' || e.key === 'X') setTool('erase');
  if (e.key === 'm' || e.key === 'M') setTool('move');
  if (e.key === ' ') { e.preventDefault(); setSpeed(speed === 0 ? 1 : 0); }
  if (e.key === '1') setSpeed(1); if (e.key === '2') setSpeed(2); if (e.key === '4') setSpeed(4);
});

/* ---------- HUD ---------- */
$('legend').innerHTML = SHOP_ORDER.map((t) => `<span><i style="background:${SHOP_INFO[t].color}"></i>${SHOP_INFO[t].name}</span>`).join('');
function toast(text: string, tone: 'good' | 'bad' = 'good') {
  const el = document.createElement('div'); el.className = 'toast ' + tone; el.textContent = text; $('toasts').prepend(el);
  setTimeout(() => el.classList.add('out'), 3200); setTimeout(() => el.remove(), 3800);
}
city.onEvent = (text, tone) => { toast(text, tone); if (city.stats.over) gameOver(); };
const clock = (m: number) => { const h = Math.floor(m / 60), mm = Math.floor(m % 60); return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
function hud() {
  const s = city.stats;
  $('day').textContent = `Day ${s.day} · ${clock(s.minute)}`;
  $('tiles').textContent = String(s.roadTiles);
  $('arrived').textContent = String(s.arrived);
  $('failed').textContent = `${s.failed} / ${T.failLimit}`;
  ($('failbar') as HTMLElement).style.width = `${(s.failed / T.failLimit) * 100}%`;
  $('homes').textContent = `${s.homes} homes · ${s.shops} shops · ${traffic.cars.length} cars`;
}
function gameOver() {
  const s = city.stats;
  $('overStats').textContent = `You kept the city moving for ${s.day - 1} day${s.day === 2 ? '' : 's'} and ${clock(s.minute)}. ${s.arrived} trips arrived on time, with ${s.homes} homes and ${s.shops} shops.`;
  $('over').classList.add('show');
}
$('again').onclick = () => location.reload();

/* ---------- loop ---------- */
let last = performance.now(), paintT = 0, hudT = 0;
function loop(now: number) {
  const real = Math.min(0.1, (now - last) / 1000); last = now;
  if (!city.stats.over && speed > 0) {
    const steps = Math.ceil(speed * real / (1 / 30)), dt = (speed * real) / steps;   // small steps keep fast speeds stable
    for (let k = 0; k < steps; k++) { traffic.update(dt); city.update(dt * T.gameMinutesPerSecond, dt); }
  }
  paintT -= real; if (paintT <= 0) { roads.paintLoad(); paintT = 0.4; }
  hudT -= real; if (hudT <= 0) { hud(); hudT = 0.2; }
  runTicks(now / 1000);
  stage.render();
  city.drawPins(camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
setTool('road'); setSpeed(1);
(window as unknown as { __game: unknown }).__game = { city, grid, traffic, cam, roads, paint: (i: number, j: number) => { apply(i, j); roads.rebuild(); city.roadsChanged(); } };
