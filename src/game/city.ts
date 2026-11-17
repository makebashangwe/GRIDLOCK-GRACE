/* The city: homes and shops appear over time; every home sends a car on trips to shops.
   A trip that hasn't reached its shop by its deadline is a failed trip (the core score).
   Too many failed trips and the city is gridlocked: the run ends. */
import * as THREE from 'three';
import * as M from '../assets/models';
import { shadowAll } from '../assets/core';
import { Grid, DX, DZ, type Placed } from './grid';
import { T, SHOP_INFO, SHOP_ORDER, type ShopType } from './tuning';
import { findRoute, lanePath } from './routes';
import { Traffic, type Car } from './traffic';

const HOUSE_COLORS: [string, string][] = [['#F6E7CF', '#E07A5F'], ['#F3E3CB', '#81B29A'], ['#F6E7CF', '#D99A8B'], ['#F1DFC4', '#6D597A'], ['#F6E7CF', '#F2CC8F'], ['#F3E3CB', '#C8553D']];
/** The block test's code house/shop builder (untyped port). */
const building = M.building as unknown as (spec: Record<string, unknown>) => THREE.Object3D;
const FACE_ROT = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];

interface Building extends Placed { obj: THREE.Object3D; face: number; access: number; pin: HTMLDivElement }
export interface Home extends Building { kind: 'home'; nextTrip: number; trip: Trip | null }
export interface Shop extends Building { kind: 'shop'; type: ShopType; served: number }
interface Trip { home: Home; type: ShopType; deadline: number; state: 'waiting' | 'out' | 'shop' | 'back'; failed: boolean; shop?: Shop; car?: Car | null; until?: number }

export interface Stats { arrived: number; failed: number; homes: number; shops: number; roadTiles: number; day: number; minute: number; over: boolean }

export class City {
  homes: Home[] = [];
  shops: Shop[] = [];
  stats: Stats = { arrived: 0, failed: 0, homes: 0, shops: 0, roadTiles: T.startRoadTiles, day: 1, minute: T.startMinute, over: false };
  clock = T.startMinute;   // game minutes since day 1 midnight
  private nextHome = T.startMinute + T.newHomeEvery;
  private nextShop = T.startMinute + T.newShopEvery;
  private shopCount = 0;
  private trees = new Map<number, THREE.Object3D>();
  private nextId = 1;
  private dispatchT = 0;
  private carTrip = new Map<Car, Trip>();
  onEvent: (text: string, tone?: 'good' | 'bad') => void = () => {};

  constructor(private scene: THREE.Scene, private grid: Grid, private traffic: Traffic, private pinLayer: HTMLElement) {
    this.plantTrees();
    const mid = Math.floor(grid.n / 2);
    this.addShop('grocery', this.findSpot(mid + 2, mid, 2, 4));
    for (let k = 0; k < T.startHomes; k++) this.addHome(this.findSpot(mid - 2, mid, 1, 3));
  }

  /* ---------------- placement ---------------- */
  private plantTrees(): void {
    const g = this.grid, kinds = [M.makeRoundTree, M.makeCypressTree, M.makeAutumnMaple, M.makeBlossomTree, M.makeEvergreenPine];
    const mid = g.n / 2;
    for (let k = 0; k < 90; k++) {
      const i = Math.floor(Math.random() * g.n), j = Math.floor(Math.random() * g.n);
      if (Math.abs(i - mid) < 3 && Math.abs(j - mid) < 3) continue;
      const c = g.idx(i, j); if (g.tree[c]) continue;
      const t = kinds[k % kinds.length]() as THREE.Object3D, { x, z } = g.center(i, j);
      t.position.set(x + (Math.random() - 0.5) * 6, 0, z + (Math.random() - 0.5) * 6); t.scale.setScalar(0.8 + Math.random() * 0.35);
      shadowAll(t); this.scene.add(t); g.tree[c] = 1; this.trees.set(c, t);
    }
  }
  clearTree(c: number): void { const t = this.trees.get(c); if (t) { this.scene.remove(t); this.trees.delete(c); this.grid.tree[c] = 0; } }

  /** A free tile near (ci, cj) between rMin and rMax tiles away (widens if the ring is full). */
  private findSpot(ci: number, cj: number, rMin: number, rMax: number): [number, number] {
    const g = this.grid;
    for (let tries = 0; tries < 400; tries++) {
      const r = rMax + Math.floor(tries / 60);
      const i = ci + Math.round((Math.random() * 2 - 1) * r), j = cj + Math.round((Math.random() * 2 - 1) * r);
      if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) < rMin) continue;
      if (i < 1 || j < 1 || i >= g.n - 1 || j >= g.n - 1 || !g.isFree(i, j)) continue;
      // keep one tile of breathing room from other buildings when possible
      let crowded = false;
      if (tries < 250) for (let d = 0; d < 4; d++) { const b = g.building[g.idx(i + DX[d], j + DZ[d])]; if (b) crowded = true; }
      if (!crowded) return [i, j];
    }
    return [ci, cj];
  }

  private pin(cls: string): HTMLDivElement { const el = document.createElement('div'); el.className = cls; this.pinLayer.appendChild(el); return el; }

  private addHome([i, j]: [number, number]): void {
    const g = this.grid, c = g.idx(i, j); if (!g.isFree(i, j)) return;
    this.clearTree(c);
    const [wall, roof] = HOUSE_COLORS[this.homes.length % HOUSE_COLORS.length];
    const obj = shadowAll(building({ w: 8, d: 7, h: 5.4, wall, roof }));
    const home: Home = { id: this.nextId++, kind: 'home', i, j, obj, face: Math.floor(Math.random() * 4), access: -1, pin: this.pin('pin'), nextTrip: this.clock + 20 + Math.random() * 40, trip: null };
    g.building[c] = home; this.homes.push(home); this.stats.homes = this.homes.length;
    this.scene.add(obj); this.connect(home); this.popIn(obj);
  }

  private addShop(type: ShopType, [i, j]: [number, number]): void {
    const g = this.grid, c = g.idx(i, j); if (!g.isFree(i, j)) return;
    this.clearTree(c);
    const info = SHOP_INFO[type];
    const obj = shadowAll(building({ w: 10.5, d: 9, h: 7, wall: '#FFF4E2', roof: info.color, awning: info.color, sign: { text: info.sign, color: info.ink }, roofType: 'flat' }));
    const shop: Shop = { id: this.nextId++, kind: 'shop', type, i, j, obj, face: Math.floor(Math.random() * 4), access: -1, pin: this.pin('pin shop'), served: 0 };
    shop.pin.style.setProperty('--c', info.color); shop.pin.textContent = info.name;
    g.building[c] = shop; this.shops.push(shop); this.stats.shops = this.shops.length;
    this.scene.add(obj); this.connect(shop); this.popIn(obj);
  }

  private popIn(obj: THREE.Object3D): void { obj.scale.setScalar(0.01); (obj.userData as { grow?: number }).grow = 0; }

  /** Point a building at a road next to it (keeps its current facing if that side is still road). */
  private connect(b: Home | Shop): void {
    const g = this.grid;
    let face = -1;
    if (g.isRoad(b.i + DX[b.face], b.j + DZ[b.face])) face = b.face;
    else for (let d = 0; d < 4; d++) if (g.isRoad(b.i + DX[d], b.j + DZ[d])) { face = d; break; }
    b.access = face >= 0 ? g.idx(b.i + DX[face], b.j + DZ[face]) : -1;
    if (face >= 0) b.face = face;
    const { x, z } = g.center(b.i, b.j);
    b.obj.position.set(x, 0, z); b.obj.rotation.y = FACE_ROT[b.face];
  }

  /** Call after any road change. */
  roadsChanged(): void {
    for (const b of [...this.homes, ...this.shops]) this.connect(b);
    // cars whose route now runs over a removed road: send them back to try again
    for (const car of [...this.traffic.cars]) {
      const trip = this.carTrip.get(car); if (!trip) continue;
      const pts = car.pts, g = this.grid;
      let broken = false;
      for (let k = 1; k < pts.length - 1 && !broken; k++) { const [i, j] = g.tileAt(pts[k].x, pts[k].z); if (!g.isRoad(i, j)) broken = true; }
      if (!broken) continue;
      this.traffic.remove(car); this.carTrip.delete(car);
      if (trip.state === 'out') { trip.state = 'waiting'; trip.car = null; } else if (trip.state === 'back') this.finish(trip);
    }
  }

  /* ---------------- trips ---------------- */
  private send(trip: Trip, from: Building, to: Building, onArrive: () => void): boolean {
    if (from.access < 0 || to.access < 0) return false;
    const route = findRoute(this.grid, from.access, to.access); if (!route) return false;
    const pts = lanePath(this.grid, [this.grid.idx(from.i, from.j), ...route, this.grid.idx(to.i, to.j)]);
    if (!this.traffic.canStart(pts)) return false;
    const car = this.traffic.add(pts, onArrive); if (!car) return false;
    trip.car = car; this.carTrip.set(car, trip); return true;
  }

  private dispatch(trip: Trip): void {
    const home = trip.home;
    if (home.access < 0) return;
    // nearest reachable shop of the right kind
    let best: Shop | null = null, bestLen = Infinity;
    for (const s of this.shops) {
      if (s.type !== trip.type || s.access < 0) continue;
      const r = findRoute(this.grid, home.access, s.access);
      if (r && r.length < bestLen) { best = s; bestLen = r.length; }
    }
    if (!best) return;
    const shop = best;
    if (this.send(trip, home, shop, () => this.arriveShop(trip))) { trip.state = 'out'; trip.shop = shop; }
  }

  private arriveShop(trip: Trip): void {
    if (trip.car) this.carTrip.delete(trip.car);
    trip.car = null; trip.state = 'shop'; trip.until = this.clock + T.shopVisit;
    if (!trip.failed) { this.stats.arrived++; trip.shop!.served++; }
  }

  private finish(trip: Trip): void {
    if (trip.car) this.carTrip.delete(trip.car);
    const h = trip.home; h.trip = null; h.nextTrip = this.clock + T.tripEvery[0] + Math.random() * (T.tripEvery[1] - T.tripEvery[0]);
  }

  private fail(trip: Trip): void {
    trip.failed = true; this.stats.failed++;
    this.onEvent(`A trip to ${SHOP_INFO[trip.type].name} missed its deadline`, 'bad');
    if (this.stats.failed >= T.failLimit) { this.stats.over = true; this.onEvent('Gridlock! The city ran out of patience.', 'bad'); }
  }

  /** Advance the city by `gm` game minutes. */
  update(gm: number, realDt: number): void {
    if (this.stats.over) return;
    const before = Math.floor(this.clock / 1440);
    this.clock += gm;
    const day = Math.floor(this.clock / 1440);
    if (day > before) { this.stats.roadTiles += T.dailyRoadTiles; this.onEvent(`Day ${day + 1} · +${T.dailyRoadTiles} road tiles`, 'good'); }
    this.stats.day = day + 1; this.stats.minute = this.clock % 1440;

    const mid = Math.floor(this.grid.n / 2), reach = 3 + Math.floor(this.homes.length / 5);
    if (this.clock >= this.nextHome) { this.nextHome += T.newHomeEvery; this.addHome(this.findSpot(mid, mid, 1, Math.min(reach, mid - 2))); }
    if (this.clock >= this.nextShop) {
      this.nextShop += T.newShopEvery; this.shopCount++;
      const type = SHOP_ORDER[this.shopCount % SHOP_ORDER.length];
      this.addShop(type, this.findSpot(mid, mid, Math.min(reach, mid - 4), Math.min(reach + 3, mid - 2)));
      this.onEvent(`New shop: ${SHOP_INFO[type].name}`, 'good');
    }

    const types = [...new Set(this.shops.map((s) => s.type))];
    this.dispatchT -= realDt;
    const tryDispatch = this.dispatchT <= 0; if (tryDispatch) this.dispatchT = 0.4;
    for (const h of this.homes) {
      if (!h.trip && this.clock >= h.nextTrip && types.length) {
        const type = types[Math.floor(Math.random() * types.length)];
        h.trip = { home: h, type, deadline: this.clock + T.tripDeadline, state: 'waiting', failed: false };
      }
      const trip = h.trip; if (!trip) continue;
      if (trip.state === 'waiting' && tryDispatch) this.dispatch(trip);
      if (!trip.failed && (trip.state === 'waiting' || trip.state === 'out') && this.clock > trip.deadline) {
        this.fail(trip);
        if (trip.state === 'waiting') this.finish(trip);   // gave up
      }
      if (trip.state === 'shop' && this.clock >= trip.until!) {
        const shop = trip.shop!;
        trip.state = 'back';
        if (!this.send(trip, shop, h, () => this.finish(trip))) this.finish(trip);   // no way home: they get a ride
      }
    }
    for (const b of [...this.homes, ...this.shops]) {   // grow-in animation for new buildings
      const u = b.obj.userData as { grow?: number };
      if (u.grow !== undefined) { u.grow = Math.min(1, u.grow + realDt * 2.2); const e = 1 - Math.pow(1 - u.grow, 3); b.obj.scale.setScalar(0.01 + e * 0.99 + Math.sin(u.grow * Math.PI) * 0.12); if (u.grow >= 1) { b.obj.scale.setScalar(1); delete u.grow; } }
    }
  }

  /** Floating pins over homes with a trip (color = where they're going, ring = time left). */
  drawPins(camera: THREE.Camera): void {
    const v = new THREE.Vector3();
    const put = (b: Building, y: number) => {
      const { x, z } = this.grid.center(b.i, b.j); v.set(x, y, z).project(camera);
      b.pin.style.left = ((v.x + 1) / 2) * innerWidth + 'px'; b.pin.style.top = ((1 - v.y) / 2) * innerHeight + 'px';
      return Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    };
    for (const h of this.homes) {
      const t = h.trip, show = !!t && (t.state === 'waiting' || t.state === 'out') && put(h, 12);
      h.pin.style.display = show ? 'block' : 'none';
      if (!show || !t) continue;
      const left = Math.max(0, (t.deadline - this.clock) / T.tripDeadline);
      h.pin.style.setProperty('--c', t.failed ? '#C8553D' : SHOP_INFO[t.type].color);
      h.pin.style.setProperty('--p', String(t.failed ? 1 : left));
      h.pin.classList.toggle('late', t.failed);
      h.pin.classList.toggle('stuck', t.state === 'waiting' && h.access < 0);
    }
    for (const s of this.shops) s.pin.style.display = put(s, 13) ? 'block' : 'none';
  }
}
