/* Gridlock & Grace — v0.1, the road puzzle.
   Draw roads so every home's car reaches its shop before the deadline. */
import * as THREE from 'three';
import { createStage } from './engine/stage';
import { runTicks } from './engine/tick';
import { Grid } from './game/grid';
import { RoadView } from './game/roadView';
import { TerrainView, makeRiver } from './game/terrain';
import { makeOnRampEntranceSign } from './assets/models';
import { shadowAll } from './assets/core';
import { JunctionView } from './game/junctions';
import { J_NONE, J_STOP, J_LIGHT, J_ROUND } from './game/grid';
import { Traffic } from './game/traffic';
import { City, UPGRADES, type SaveData, type WeekEnd } from './game/city';
import { T, SHOP_INFO, SHOP_ORDER } from './game/tuning';

const stage = createStage(document.getElementById('app')!);
const { scene, camera, cam } = stage;
const $ = (id: string) => document.getElementById(id)!;

/* ---------- world ---------- */
const grid = new Grid();
const size = T.tile * grid.n;
const edge = new THREE.Mesh(new THREE.BoxGeometry(size + 6, 2, size + 6), new THREE.MeshStandardMaterial({ color: '#B9A58F', roughness: 0.95 }));
edge.position.y = -2.6; scene.add(edge);   // the slab sits below the riverbed so the water shows
const gridLines = new THREE.GridHelper(size, grid.n, '#8DAA7F', '#8DAA7F');
const gm = gridLines.material as THREE.Material; gm.transparent = true; gm.opacity = 0.28; gridLines.position.y = 0.015; scene.add(gridLines);

const roads = new RoadView(scene, grid);
const traffic = new Traffic(scene, grid);
const city = new City(scene, grid, traffic, $('pins'));
/* ---------- saving: the town autosaves and comes back when you return ---------- */
const SAVE_KEY = 'gridlock-grace-town-v1';
let loaded = false;
try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { city.load(JSON.parse(raw) as SaveData); loaded = true; } } catch { /* a broken save just means a fresh town */ }
if (!loaded) { makeRiver(grid); for (let c = 0; c < grid.water.length; c++) if (grid.water[c]) city.clearTree(c); }
const terrain = new TerrainView(scene, grid); terrain.rebuild();
// the highway connection on the west edge: always a road, can't be erased
if (!grid.building[grid.entry]) { grid.road[grid.entry] = Math.max(1, grid.road[grid.entry]); city.clearTree(grid.entry); }
{
  const [ei, ej] = grid.ij(grid.entry), { x, z } = grid.center(ei, ej);
  const stub = new THREE.Mesh(new THREE.BoxGeometry(60, 2.6, T.tile), new THREE.MeshStandardMaterial({ color: '#B9A58F', roughness: 0.95 }));
  stub.position.set(x - T.tile / 2 - 30, -1.27, z); scene.add(stub);
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(60, 9.6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#5E5A6B', roughness: 0.9 }));
  deck.position.set(x - T.tile / 2 - 30, 0.04, z); deck.receiveShadow = true; scene.add(deck);
  const sign = makeOnRampEntranceSign('HIGHWAY') as THREE.Object3D; shadowAll(sign); sign.scale.setScalar(1.3);
  sign.position.set(x - 2, 0, z - T.tile / 2 - 1); sign.rotation.y = -Math.PI / 2; scene.add(sign);
}
const saveNow = () => { try { if (!city.stats.over) localStorage.setItem(SAVE_KEY, JSON.stringify(city.save())); } catch { /* storage full or blocked */ } };
setInterval(saveNow, 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
window.addEventListener('pagehide', saveNow);
const junctions = new JunctionView(scene, grid);
roads.rebuild(); junctions.sync(); roads.syncPotholes(scene);
city.onHoles = () => roads.syncPotholes(scene);
cam.target.set(0, 0, 0); cam.zoom = cam.goalZoom = 1.15;

/* ---------- drawing roads ---------- */
type Tool = 'road' | 'avenue' | 'place' | 'turn' | 'junction' | 'erase' | 'move' | 'rotate';
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
function canPlace(i: number, j: number) {
  const c = grid.idx(i, j);
  if (grid.inside(i, j) && grid.water[c] && !grid.road[c]) return city.stats.bridges > 0;   // a bridge piece
  return grid.isFree(i, j) && city.stats.roadTiles > 0;
}
/* ---------- crossings: stop sign -> traffic light -> roundabout -> nothing ---------- */
const J_INFO: Record<number, { name: string; note: string }> = {
  [J_NONE]: { name: 'No control', note: 'fast, but busy crossings get messy' },
  [J_STOP]: { name: 'Stop sign', note: 'free · every car stops, then goes' },
  [J_LIGHT]: { name: 'Traffic light', note: `${T.lightCost} road tiles · directions take turns` },
  [J_ROUND]: { name: 'Roundabout', note: `${T.roundCost} road tiles · keeps traffic flowing` },
};
const junctionCost = (k: number) => (k === J_LIGHT ? T.lightCost : k === J_ROUND ? T.roundCost : 0);
const nextJunction = (k: number) => (k + 1) % 4;
function cycleJunction(i: number, j: number): void {
  const c = grid.idx(i, j);
  if (!grid.isCrossing(c)) { toast('Crossings are where 3 or 4 roads meet', 'bad'); return; }
  const from = grid.junction[c], to = nextJunction(from);
  // a free token from a Sunday pick covers a light or a roundabout
  const token = to === J_LIGHT && city.tokens.lights > 0 ? 'lights' : to === J_ROUND && city.tokens.round > 0 ? 'round' : null;
  const cost = token ? 0 : junctionCost(to), refund = grid.jspent[c];
  if (cost - refund > city.stats.roadTiles) { toast(`${J_INFO[to].name} needs ${junctionCost(to)} road tiles`, 'bad'); return; }
  city.stats.roadTiles += refund - cost; grid.jspent[c] = cost; grid.junction[c] = to;
  if (token) city.tokens[token]--;
  roads.rebuild(); junctions.sync(); city.roadsChanged();
  toast(`${J_INFO[to].name}${token ? ' (free)' : ''}`, 'good');
}

/** One tile of a drag: roads go down, erase removes a building (back to the hand) or a road. */
function apply(i: number, j: number): boolean {
  const c = grid.idx(i, j);
  if (tool === 'road') {
    if (!canPlace(i, j)) return false;
    if (grid.water[c]) { grid.road[c] = 1; city.stats.bridges--; if (!city.stats.bridges) toast('That was your last bridge piece. Sunday picks can bring more.', 'bad'); return true; }
    city.clearTree(c); grid.road[c] = 1; city.stats.roadTiles--;
    if (city.stats.roadTiles === 0 && !toldEmpty) { toldEmpty = true; toast(`Out of road. Every ${T.tripsPerTile} on-time trips earn a tile, and more come each morning.`, 'bad'); }
    return true;
  }
  if (tool === 'avenue') {
    // new avenue on grass, or upgrade a street (pay the difference)
    const cost = grid.water[c] ? -1 : grid.road[c] === 1 ? T.avenueCost - 1 : grid.isFree(i, j) ? T.avenueCost : -1;
    if (cost < 0 || cost > city.stats.roadTiles) return false;
    city.clearTree(c); grid.road[c] = 2; city.stats.roadTiles -= cost;
    return true;
  }
  if (tool === 'erase') {
    if (grid.building[c]) { city.remove(i, j); return true; }
    if (!grid.road[c]) return false;
    if (c === grid.entry) { toast('That road is the highway connection: delivery trucks come in there', 'bad'); return false; }
    if (grid.water[c]) city.stats.bridges++; else city.stats.roadTiles += grid.road[c];
    city.stats.roadTiles += grid.jspent[c]; grid.junction[c] = J_NONE; grid.wear[c] = 0; grid.jspent[c] = 0; grid.road[c] = 0;
    return true;
  }
  return false;
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
  if (changed) { roads.rebuild(); junctions.sync(); city.roadsChanged(); }
}
const canvas = stage.renderer.domElement;
// Move and Rotate tools: one-finger / left-drag pans or orbits (for phones and trackpads)
let toolDrag: { x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', (e) => {
  if ((tool === 'move' || tool === 'rotate') && e.button === 0) { toolDrag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); return; }
  if (e.button !== 0 || e.shiftKey || e.altKey || city.stats.over) return;
  const t = tileUnder(e); if (!t) return;
  if (tool === 'place') { if (city.placeNext(...t)) { drawHand(); if (!city.hand.length) setTool('road'); } return; }
  if (tool === 'turn') { city.turn(...t); return; }
  if (tool === 'junction') { cycleJunction(...t); return; }
  canvas.setPointerCapture(e.pointerId); stroke = null; paintTo(t);
});
canvas.addEventListener('pointermove', (e) => {
  if (toolDrag) {
    const dx = e.clientX - toolDrag.x, dy = e.clientY - toolDrag.y;
    if (tool === 'rotate') stage.orbitBy(dx, dy); else stage.panBy(dx, dy);
    toolDrag = { x: e.clientX, y: e.clientY }; return;
  }
  const t = tileUnder(e);
  ghost.visible = !!t && !city.stats.over;
  if (!t) { hintAt(null, ''); return; }
  if (tool === 'rotate') { ghost.visible = false; return; }
  if (tool === 'move') { ghost.visible = false; hintAt(e, city.homeInfo(...t)); return; }
  const { x, z } = grid.center(...t); ghost.position.x = x; ghost.position.z = z;
  const c = grid.idx(...t);
  const ok = tool === 'road' ? canPlace(...t) : tool === 'avenue' ? (grid.road[c] === 1 && city.stats.roadTiles >= T.avenueCost - 1) || (grid.isFree(...t) && city.stats.roadTiles >= T.avenueCost) : tool === 'place' ? grid.isFree(...t) && city.hand.length > 0
    : tool === 'turn' ? !!grid.building[c] : tool === 'junction' ? grid.isCrossing(c) : !!grid.building[c] || grid.isRoad(...t);
  ghostMat.color.set(tool === 'erase' ? '#C8553D' : ok ? (tool === 'place' ? pieceColor() : '#4E8FA6') : '#C8553D'); ghostMat.opacity = ok ? 0.42 : 0.22;
  const info = (tool === 'turn' || tool === 'erase' || tool === 'place') ? city.homeInfo(...t) : '';
  if (info && !(tool === 'place' && ok)) { hintAt(e, info); return; }
  hintAt(e, tool === 'road' && ok && grid.water[c] ? `Bridge · uses 1 of your ${city.stats.bridges} bridge pieces · crosses east-west` : tool === 'avenue' && ok ? (grid.road[c] === 1 ? `Upgrade to avenue · ${T.avenueCost - 1} road tile` : `Avenue · ${T.avenueCost} road tiles`) : tool === 'place' && ok ? placeHint(...t) : tool === 'junction' && ok ? `Next: ${J_INFO[nextJunction(grid.junction[c])].name} · ${J_INFO[nextJunction(grid.junction[c])].note}` : '');
  if (stroke && (e.buttons & 1)) paintTo(t);
});
const endStroke = () => { stroke = null; toolDrag = null; };
canvas.addEventListener('pointerleave', () => hintAt(null, ''));
canvas.addEventListener('pointerup', endStroke); canvas.addEventListener('pointercancel', endStroke);
canvas.addEventListener('pointerleave', () => (ghost.visible = false));

const TOOLS: [Tool, string][] = [['road', 'toolRoad'], ['avenue', 'toolAvenue'], ['place', 'toolPlace'], ['turn', 'toolTurn'], ['junction', 'toolJunction'], ['erase', 'toolErase'], ['move', 'toolMove'], ['rotate', 'toolRotate']];
function setTool(t: Tool) { tool = t; for (const [k, id] of TOOLS) $(id).classList.toggle('on', k === t); if (t !== 'place') hintAt(null, ''); }
for (const [k, id] of TOOLS) $(id).onclick = () => setTool(k);
$('zoomIn').onclick = () => (cam.goalZoom = Math.min(9, cam.goalZoom * 1.35)); $('zoomOut').onclick = () => (cam.goalZoom = Math.max(0.15, cam.goalZoom / 1.35));

/* ---------- the hand: pieces waiting to be placed ---------- */
const pieceColor = () => { const p = city.hand[0]; return !p ? '#4E8FA6' : SHOP_INFO[p.kind === 'home' ? p.wants : p.type].color; };
function placeHint(i: number, j: number): string {
  const p = city.hand[0]; if (!p) return '';
  if (p.kind === 'shop') return `Place ${SHOP_INFO[p.type].name} here`;
  const d = city.distanceTo(p.wants, i, j), name = SHOP_INFO[p.wants].name;
  if (d < 0) return `Wants ${name} (none placed yet)`;
  return `${d} tile${d === 1 ? '' : 's'} from ${name}` + (d <= 4 ? ' · great spot' : d <= 8 ? ' · okay' : ' · far');
}
function hintAt(e: PointerEvent | null, text: string) {
  const el = $('hint'); el.style.display = text ? 'block' : 'none'; if (!text || !e) return;
  el.textContent = text; el.style.left = e.clientX + 16 + 'px'; el.style.top = e.clientY - 34 + 'px';
}
function drawHand() {
  const h = city.hand;
  $('handList').innerHTML = h.length ? h.map((p, k) => {
    const color = SHOP_INFO[p.kind === 'home' ? p.wants : p.type].color;
    const label = p.kind === 'home' ? `Home · wants ${SHOP_INFO[p.wants].name}` : SHOP_INFO[p.type].name;
    return `<div class="piece${k === 0 ? ' next' : ''}"><i class="${p.kind}" style="--c:${color}"></i><span>${k === 0 ? '<b>Next:</b> ' : ''}${label}</span></div>`;
  }).join('') : '<div class="empty">Nothing to place right now. Build roads; more homes come when your shops have room.</div>';
  ($('toolPlace') as HTMLButtonElement).disabled = !h.length;
}
city.onChange = drawHand;
drawHand();

/* ---------- speed ---------- */
let speed = 1;
function setSpeed(s: number) { speed = s; document.querySelectorAll<HTMLElement>('[data-speed]').forEach((b) => b.classList.toggle('on', Number(b.dataset.speed) === s)); }
document.querySelectorAll<HTMLElement>('[data-speed]').forEach((b) => (b.onclick = () => setSpeed(Number(b.dataset.speed))));
window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') setTool('road');
  if (e.key === 'p' || e.key === 'P') setTool('place');
  if (e.key === 't' || e.key === 'T') setTool('turn');
  if (e.key === 'v' || e.key === 'V') setTool('avenue');
  if (e.key === 'j' || e.key === 'J') setTool('junction');
  if (e.key === 'x' || e.key === 'X') setTool('erase');
  if (e.key === 'm' || e.key === 'M') setTool('move');
  if (e.key === 'o' || e.key === 'O') setTool('rotate');
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
// on-time trips earn road: the tile counter pops, and the first time you run dry we explain how to get more
city.onEarn = () => { const el = $('tiles'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); };
let toldEmpty = false;
const clock = (m: number) => { const h = Math.floor(m / 60), mm = Math.floor(m % 60); return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
function hud() {
  const s = city.stats;
  $('day').innerHTML = `${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][s.weekday]} · Day ${s.day} · ${clock(s.minute)}` + (s.rush ? ' <span class="rush">Rush hour</span>' : '');
  $('tiles').textContent = String(s.roadTiles);
  $('arrived').textContent = String(s.arrived);
  $('failed').textContent = s.sandbox ? String(s.failed) : `${s.failed} / ${T.failLimit}`;
  ($('failbar') as HTMLElement).style.width = s.sandbox ? '0%' : `${(s.failed / T.failLimit) * 100}%`;
  $('mode').textContent = s.sandbox ? 'Sandbox' : '';
  const gl = city.goalText(); $('goalText').textContent = gl.text; $('goalProg').textContent = gl.progress; ($('goalBar') as HTMLElement).style.width = `${gl.frac * 100}%`;
  const tk = city.tokens; $('tokens').textContent = [`${s.bridges} bridge piece${s.bridges === 1 ? '' : 's'}`,tk.lights ? `${tk.lights} free light${tk.lights > 1 ? 's' : ''}` : '', tk.round ? `${tk.round} free roundabout${tk.round > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
  $('homes').textContent = `${s.homes} homes (${city.households()} households) · ${s.shops} shops · ${traffic.cars.length} cars · room for ${s.demand} more`;
  drawHand();
}
function gameOver() {
  const s = city.stats;
  const n = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`;
  $('overStats').textContent = `Too many trips ran late. Your town reached Day ${s.day}, ${clock(s.minute)}, with ${n(s.homes, 'home')} and ${n(s.shops, 'shop')}; ${n(s.arrived, 'trip')} arrived on time.`;
  $('over').classList.add('show');
}
let speedBeforeWeek = 1;
city.onWeekEnd = (w: WeekEnd) => {
  speedBeforeWeek = speed || 1; setSpeed(0);
  const gl = { trips: `Get ${w.goal.target} trips there on time`, late: `Keep late trips under ${w.goal.target}%`, nocrash: 'No crashes all week', hand: 'End the week with an empty hand' }[w.goal.id];
  $('weekTitle').textContent = `Week ${w.week} done`;
  $('weekGoal').innerHTML = w.met ? `<b>Goal met:</b> ${gl}. +${w.bonus} road tiles, and you get three choices.` : `<b>Goal missed:</b> ${gl}. Pick one of two upgrades.`;
  $('weekOptions').innerHTML = w.options.map((u) => `<button data-up="${u}"><b>${UPGRADES[u].name}</b><span>${UPGRADES[u].text}</span></button>`).join('');
  document.querySelectorAll<HTMLButtonElement>('[data-up]').forEach((b) => (b.onclick = () => {
    city.pick(b.dataset.up as keyof typeof UPGRADES); $('week').classList.remove('show'); setSpeed(speedBeforeWeek); hud(); saveNow();
    toast(`New week: ${city.goalText().text}`, 'good');
  }));
  $('week').classList.add('show');
};
$('again').onclick = () => { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } location.reload(); };
// keep building: the town carries on in Sandbox (no failed-trip limit)
$('keep').onclick = () => { city.stats.over = false; city.stats.sandbox = true; $('over').classList.remove('show'); saveNow(); toast('Sandbox: keep building, no fail limit', 'good'); };
$('newTown').onclick = () => { if (confirm('Start a new town? This one will be cleared.')) { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } location.reload(); } };

/* ---------- day and night ---------- */
const hemi = scene.children.find((o) => (o as THREE.HemisphereLight).isHemisphereLight) as THREE.HemisphereLight;
const DAY_BG = new THREE.Color('#EADBC4'), NIGHT_BG = new THREE.Color('#6A6380'), DUSK_BG = new THREE.Color('#E9B99A');
function daylight(m: number): number {   // 0 at night, 1 in the day, smooth dawn (5:30-7:30) and dusk (18:30-20:30)
  const h = m / 60, ramp = (a: number, b: number, x: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  const v = ramp(5.5, 7.5, h) * (1 - ramp(18.5, 20.5, h));
  return v * v * (3 - 2 * v);
}
function light(m: number) {
  const d = daylight(m), dusk = Math.max(0, 1 - Math.abs(d - 0.5) * 2) * (m > 12 * 60 ? 1 : 0.6);
  hemi.intensity = 0.85 + 0.7 * d; stage.sun.intensity = 0.45 + 1.85 * d;
  (scene.background as THREE.Color).copy(NIGHT_BG).lerp(DAY_BG, d).lerp(DUSK_BG, dusk * 0.5);
}

/* ---------- loop ---------- */
let last = performance.now(), paintT = 0, hudT = 0;
function loop(now: number) {
  const real = Math.min(0.1, (now - last) / 1000); last = now;
  if (!city.stats.over && speed > 0) {
    const steps = Math.ceil(speed * real / (1 / 30)), dt = (speed * real) / steps;   // small steps keep fast speeds stable
    for (let k = 0; k < steps; k++) { traffic.update(dt, city.clock); city.update(dt * T.gameMinutesPerSecond, dt); }
  }
  paintT -= real; if (paintT <= 0) { roads.paintLoad(); paintT = 0.4; }
  hudT -= real; if (hudT <= 0) { hud(); hudT = 0.2; }
  city.animate(real); light(city.stats.minute); junctions.update(city.clock);
  runTicks(now / 1000);
  stage.render();
  city.drawPins(camera, cam.zoom);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
setTool('place'); setSpeed(1);
(window as unknown as { __game: unknown }).__game = { city, grid, traffic, cam, roads, junction: (i: number, j: number) => cycleJunction(i, j), avenue: (i: number, j: number) => { const was = tool; tool = 'avenue'; apply(i, j); tool = was; roads.rebuild(); junctions.sync(); city.roadsChanged(); }, endWeek: () => { city.clock = (Math.floor(city.clock / 1440 / 7) + 1) * 7 * 1440 - 1; }, paint: (i: number, j: number) => { const was = tool; tool = 'road'; apply(i, j); tool = was; roads.rebuild(); junctions.sync(); city.roadsChanged(); } };
