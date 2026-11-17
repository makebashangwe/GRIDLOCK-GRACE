/* The city, built by the player from a blank map, one choice at a time (like Dorfromantik):
   - homes and shops arrive in a hand of pieces; the player places each one where they want it
   - every home wants one kind of shop; a home placed close to the shop it wants makes quick, on-time trips
   - shops create demand: while there's room, new homes keep arriving in the hand
   - every building's front door must face a road; the player can turn buildings, or erase one to pick it back up
   Every home sends its car on trips to shops. A trip that hasn't reached its shop by its deadline
   is a failed trip (the core score). Too many failed trips and the city is gridlocked: the run ends. */
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

interface Building extends Placed {
  obj: THREE.Object3D;
  /** Direction the front door faces (0 east, 1 south, 2 west, 3 north). */
  face: number;
  /** Road tile in front of the door, or -1 when the door faces no road. */
  access: number;
  /** True once the player has turned it: it keeps that facing instead of turning toward a road on its own. */
  turned: boolean;
  pin: HTMLDivElement;
}
export interface Home extends Building { kind: 'home'; wants: ShopType; nextTrip: number; trip: Trip | null }
/** A piece waiting in the player's hand. */
export type Piece = { kind: 'home'; wants: ShopType } | { kind: 'shop'; type: ShopType };
export interface Shop extends Building { kind: 'shop'; type: ShopType; served: number }
type AnyBuilding = Home | Shop;
interface Trip { home: Home; type: ShopType; deadline: number; state: 'waiting' | 'out' | 'shop' | 'back'; failed: boolean; shop?: Shop; car?: Car | null; until?: number }

export interface Stats { sandbox: boolean; earned: number; arrived: number; failed: number; homes: number; shops: number; demand: number; roadTiles: number; day: number; minute: number; over: boolean }

export class City {
  homes: Home[] = [];
  shops: Shop[] = [];
  stats: Stats = { sandbox: false, earned: 0, arrived: 0, failed: 0, homes: 0, shops: 0, demand: 0, roadTiles: T.startRoadTiles, day: 1, minute: T.startMinute, over: false };
  clock = T.startMinute;   // game minutes since day 1 midnight
  /** The hand: the next piece to place is hand[0]. Starts with a grocery and three homes that want it. */
  hand: Piece[] = [{ kind: 'shop', type: 'grocery' }, { kind: 'home', wants: 'grocery' }, { kind: 'home', wants: 'grocery' }, { kind: 'home', wants: 'grocery' }];
  private nextGrow = T.startMinute + T.growEvery;
  private nextShop = T.startMinute + T.newShopEvery;
  private shopsDealt = 1;
  private trees = new Map<number, THREE.Object3D>();
  private nextId = 1;
  private dispatchT = 0;
  private carTrip = new Map<Car, Trip>();
  onEvent: (text: string, tone?: 'good' | 'bad') => void = () => {};
  /** Called when buildings appear or vanish, or the hand changes. */
  onChange: () => void = () => {};
  /** Called when an on-time trip earns a road tile. */
  onEarn: () => void = () => {};

  constructor(private scene: THREE.Scene, private grid: Grid, private traffic: Traffic, private pinLayer: HTMLElement) {
    this.plantTrees();
  }

  /* ---------------- trees ---------------- */
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

  /* ---------------- placing, turning, removing ---------------- */
  private pin(cls: string): HTMLDivElement { const el = document.createElement('div'); el.className = cls; this.pinLayer.appendChild(el); return el; }

  /** First direction from a tile that has a road, or a random one. */
  private roadSide(i: number, j: number): number {
    for (let d = 0; d < 4; d++) if (this.grid.isRoad(i + DX[d], j + DZ[d])) return d;
    return Math.floor(Math.random() * 4);
  }

  addHome(i: number, j: number, wants: ShopType = 'grocery'): Home | null {
    const g = this.grid, c = g.idx(i, j); if (!g.isFree(i, j)) return null;
    this.clearTree(c);
    const [wall, roof] = HOUSE_COLORS[this.nextId % HOUSE_COLORS.length];
    const obj = shadowAll(building({ w: 8, d: 7, h: 5.4, wall, roof }));
    const home: Home = { id: this.nextId++, kind: 'home', wants, i, j, obj, face: this.roadSide(i, j), access: -1, turned: false, pin: this.pin('pin'), nextTrip: this.clock + 15 + Math.random() * 40, trip: null };
    g.building[c] = home; this.homes.push(home);
    this.scene.add(obj); this.connect(home); this.popIn(obj); this.count(); this.onChange();
    return home;
  }

  addShop(type: ShopType, i: number, j: number): Shop | null {
    const g = this.grid, c = g.idx(i, j); if (!g.isFree(i, j)) return null;
    this.clearTree(c);
    const info = SHOP_INFO[type];
    const obj = shadowAll(building({ w: 10.5, d: 9, h: 7, wall: '#FFF4E2', roof: info.color, awning: info.color, sign: { text: info.sign, color: info.ink }, roofType: 'flat' }));
    const shop: Shop = { id: this.nextId++, kind: 'shop', type, i, j, obj, face: this.roadSide(i, j), access: -1, turned: false, pin: this.pin('pin shop'), served: 0 };
    shop.pin.style.setProperty('--c', info.color); shop.pin.textContent = info.name;
    g.building[c] = shop; this.shops.push(shop);
    this.scene.add(obj); this.connect(shop); this.popIn(obj); this.count(); this.onChange();
    return shop;
  }

  /** Turn a building a quarter turn clockwise (seen from above). Its door now needs a road on that side. */
  turn(i: number, j: number): boolean {
    const b = this.grid.building[this.grid.idx(i, j)] as AnyBuilding | null; if (!b) return false;
    b.face = (b.face + 3) % 4; b.turned = true;
    this.connect(b);
    (b.obj.userData as { spin?: number }).spin = 0;   // little hop as it turns
    return true;
  }

  /** Bulldoze the building on a tile. Its trip and car go with it. */
  remove(i: number, j: number): boolean {
    const g = this.grid, c = g.idx(i, j), b = g.building[c] as AnyBuilding | null; if (!b) return false;
    this.scene.remove(b.obj); b.pin.remove(); g.building[c] = null;
    if (b.kind === 'home') {
      this.homes.splice(this.homes.indexOf(b), 1);
      if (b.trip?.car) { this.traffic.remove(b.trip.car); this.carTrip.delete(b.trip.car); }
    } else {
      this.shops.splice(this.shops.indexOf(b), 1);
      for (const h of this.homes) {   // anyone heading there turns around and picks again
        const t = h.trip; if (!t || t.shop !== b) continue;
        if (t.car) { this.traffic.remove(t.car); this.carTrip.delete(t.car); t.car = null; }
        if (t.state === 'out') t.state = 'waiting'; else this.finish(t);
      }
    }
    this.hand.unshift(b.kind === 'home' ? { kind: 'home', wants: b.wants } : { kind: 'shop', type: b.type });   // back into the hand
    this.count(); this.onChange();
    return true;
  }

  /** Place the next piece from the hand on a tile. */
  placeNext(i: number, j: number): boolean {
    const p = this.hand[0]; if (!p || !this.grid.isFree(i, j)) return false;
    const ok = p.kind === 'home' ? this.addHome(i, j, p.wants) : this.addShop(p.type, i, j);
    if (ok) this.hand.shift();
    return !!ok;
  }

  /** Tiles (as the crow flies, in road tiles) from a spot to the nearest shop of a kind, or -1 if there's none. */
  distanceTo(type: ShopType, i: number, j: number): number {
    let best = -1;
    for (const s of this.shops) if (s.type === type) { const d = Math.abs(s.i - i) + Math.abs(s.j - j); if (best < 0 || d < best) best = d; }
    return best;
  }

  private count(): void { this.stats.homes = this.homes.length; this.stats.shops = this.shops.length; }
  private popIn(obj: THREE.Object3D): void { obj.scale.setScalar(0.01); (obj.userData as { grow?: number }).grow = 0; }

  /** Which road (if any) is in front of the door. Buildings the player hasn't turned face a road by themselves. */
  private connect(b: AnyBuilding): void {
    const g = this.grid;
    if (!b.turned && !g.isRoad(b.i + DX[b.face], b.j + DZ[b.face])) {
      for (let d = 0; d < 4; d++) if (g.isRoad(b.i + DX[d], b.j + DZ[d])) { b.face = d; break; }
    }
    b.access = g.isRoad(b.i + DX[b.face], b.j + DZ[b.face]) ? g.idx(b.i + DX[b.face], b.j + DZ[b.face]) : -1;
    const { x, z } = g.center(b.i, b.j);
    b.obj.position.set(x, 0, z); (b.obj.userData as { rot?: number }).rot = FACE_ROT[b.face];
    if ((b.obj.userData as { grow?: number }).grow !== undefined) b.obj.rotation.y = FACE_ROT[b.face];
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

  /* ---------------- new pieces ---------------- */
  /** How many homes the shops can support. */
  private capacity(): number { return this.shops.length ? T.homesFirstShop + (this.shops.length - 1) * T.homesPerShop : 0; }

  /** Deal a new home into the hand when the shops have room for more people. */
  private deal(): void {
    const inHand = this.hand.filter((p) => p.kind === 'home').length;
    this.stats.demand = Math.max(0, this.capacity() - this.homes.length - inHand);
    if (this.stats.demand <= 0 || this.hand.length >= T.handMax) return;
    const types = [...new Set(this.shops.map((s) => s.type))];
    const wants = types[Math.floor(Math.random() * types.length)];
    this.hand.push({ kind: 'home', wants });
    this.onEvent(`A family wants to move in near ${SHOP_INFO[wants].name}`, 'good');
  }

  /* ---------------- trips ---------------- */
  private send(trip: Trip, from: AnyBuilding, to: AnyBuilding, onArrive: () => void): boolean {
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
    if (!trip.failed) {
      this.stats.arrived++; if (trip.shop) trip.shop.served++;
      if (this.stats.arrived % T.tripsPerTile === 0) { this.stats.roadTiles++; this.stats.earned++; this.onEarn(); }
    }
  }

  private finish(trip: Trip): void {
    if (trip.car) this.carTrip.delete(trip.car);
    const h = trip.home; h.trip = null; h.nextTrip = this.clock + T.tripEvery[0] + Math.random() * (T.tripEvery[1] - T.tripEvery[0]);
  }

  private fail(trip: Trip): void {
    trip.failed = true; this.stats.failed++;
    this.onEvent(`A trip to ${SHOP_INFO[trip.type].name} missed its deadline`, 'bad');
    if (!this.stats.sandbox && this.stats.failed >= T.failLimit) { this.stats.over = true; this.onEvent('Gridlock! The city ran out of patience.', 'bad'); }
  }

  /** Advance the city by `gm` game minutes. */
  update(gm: number, realDt: number): void {
    if (this.stats.over) return;
    const before = Math.floor(this.clock / 1440);
    this.clock += gm;
    const day = Math.floor(this.clock / 1440);
    if (day > before) { this.stats.roadTiles += T.dailyRoadTiles; this.onEvent(`Day ${day + 1} · +${T.dailyRoadTiles} road tiles`, 'good'); }
    this.stats.day = day + 1; this.stats.minute = this.clock % 1440;

    if (this.clock >= this.nextGrow) { this.nextGrow = this.clock + T.growEvery; this.deal(); }
    if (this.clock >= this.nextShop) {
      this.nextShop = this.clock + T.newShopEvery;
      const type = SHOP_ORDER[this.shopsDealt++ % SHOP_ORDER.length];
      this.hand.push({ kind: 'shop', type }); this.onEvent(`New shop to place: ${SHOP_INFO[type].name}`, 'good');
    }
    this.stats.demand = Math.max(0, this.capacity() - this.homes.length - this.hand.filter((p) => p.kind === 'home').length);

    const types = [...new Set(this.shops.map((s) => s.type))];
    this.dispatchT -= realDt;
    const tryDispatch = this.dispatchT <= 0; if (tryDispatch) this.dispatchT = 0.4;
    for (const h of this.homes) {
      if (!h.trip && this.clock >= h.nextTrip && types.length) {
        const type = types.includes(h.wants) && Math.random() < T.wantShare ? h.wants : types[Math.floor(Math.random() * types.length)];
        h.trip = { home: h, type, deadline: this.clock + T.tripDeadline, state: 'waiting', failed: false };
      }
      const trip = h.trip; if (!trip) continue;
      if (trip.state === 'waiting' && tryDispatch) this.dispatch(trip);
      if (!trip.failed && (trip.state === 'waiting' || trip.state === 'out') && this.clock > trip.deadline) {
        this.fail(trip);
        if (trip.state === 'waiting') this.finish(trip);   // gave up
      }
      if (trip.state === 'shop' && this.clock >= trip.until!) {
        trip.state = 'back';
        if (!trip.shop || !this.send(trip, trip.shop, h, () => this.finish(trip))) this.finish(trip);   // no way home: they get a ride
      }
    }
  }

  /** Building animations: grow in when new, a little hop and turn when the player turns one. */
  animate(realDt: number): void {
    for (const b of [...this.homes, ...this.shops]) {
      const u = b.obj.userData as { grow?: number; rot?: number; spin?: number };
      if (u.grow !== undefined) {
        u.grow = Math.min(1, u.grow + realDt * 2.2); const e = 1 - Math.pow(1 - u.grow, 3);
        b.obj.scale.setScalar(0.01 + e * 0.99 + Math.sin(u.grow * Math.PI) * 0.12);
        if (u.grow >= 1) { b.obj.scale.setScalar(1); delete u.grow; }
      }
      if (u.rot !== undefined) {
        let d = u.rot - b.obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        b.obj.rotation.y += d * Math.min(1, realDt * 12);
      }
      if (u.spin !== undefined) { u.spin = Math.min(1, u.spin + realDt * 4); b.obj.position.y = Math.sin(u.spin * Math.PI) * 1.2; if (u.spin >= 1) { b.obj.position.y = 0; delete u.spin; } }
    }
  }

  /** Floating pins: homes show where their car is going (ring = time left); a "!" means the door faces no road. */
  drawPins(camera: THREE.Camera): void {
    const v = new THREE.Vector3();
    const put = (b: AnyBuilding, y: number) => {
      const { x, z } = this.grid.center(b.i, b.j); v.set(x, y, z).project(camera);
      b.pin.style.left = ((v.x + 1) / 2) * innerWidth + 'px'; b.pin.style.top = ((1 - v.y) / 2) * innerHeight + 'px';
      return Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    };
    for (const h of this.homes) {
      const t = h.trip, blocked = h.access < 0, show = (blocked || (!!t && (t.state === 'waiting' || t.state === 'out'))) && put(h, 12);
      h.pin.style.display = show ? 'block' : 'none';
      if (!show) continue;
      const left = t ? Math.max(0, (t.deadline - this.clock) / T.tripDeadline) : 1;
      h.pin.style.setProperty('--c', t?.failed ? '#C8553D' : t ? SHOP_INFO[t.type].color : '#B8A99A');
      h.pin.style.setProperty('--p', String(t?.failed ? 1 : left));
      h.pin.classList.toggle('late', !!t?.failed);
      h.pin.classList.toggle('stuck', blocked);
    }
    for (const s of this.shops) {
      if (!put(s, 13)) { s.pin.style.display = 'none'; continue; }
      s.pin.style.display = 'block'; s.pin.classList.toggle('stuck', s.access < 0);
    }
  }

  /* ---------------- saving ---------------- */
  /** Everything needed to rebuild this town later. Cars on the road aren't saved: trips simply start fresh. */
  save(): SaveData {
    const g = this.grid, roads: number[] = [];
    for (let c = 0; c < g.road.length; c++) if (g.road[c]) roads.push(c);
    return {
      v: 1, clock: this.clock, nextGrow: this.nextGrow, nextShop: this.nextShop, shopsDealt: this.shopsDealt,
      stats: { ...this.stats }, hand: [...this.hand], roads,
      buildings: [...this.homes, ...this.shops].map((b) => ({ kind: b.kind, i: b.i, j: b.j, face: b.face, turned: b.turned, wants: b.kind === 'home' ? b.wants : undefined, type: b.kind === 'shop' ? b.type : undefined })),
    };
  }

  load(d: SaveData): void {
    const g = this.grid;
    for (const c of d.roads) { g.road[c] = 1; this.clearTree(c); }
    for (const b of d.buildings) {
      const made = b.kind === 'home' ? this.addHome(b.i, b.j, b.wants ?? 'grocery') : this.addShop(b.type ?? 'grocery', b.i, b.j);
      if (!made) continue;
      made.face = b.face; made.turned = b.turned; this.connect(made);
      made.obj.rotation.y = FACE_ROT[made.face]; delete (made.obj.userData as { grow?: number }).grow; made.obj.scale.setScalar(1);
    }
    this.clock = d.clock; this.nextGrow = d.nextGrow; this.nextShop = d.nextShop; this.shopsDealt = d.shopsDealt;
    this.hand = d.hand; this.stats = { ...this.stats, ...d.stats, over: false };
    for (const h of this.homes) h.nextTrip = this.clock + Math.random() * 30;
    this.count(); this.onChange();
  }
}

export interface SaveData {
  v: 1;
  clock: number; nextGrow: number; nextShop: number; shopsDealt: number;
  stats: Stats; hand: Piece[]; roads: number[];
  buildings: { kind: 'home' | 'shop'; i: number; j: number; face: number; turned: boolean; wants?: ShopType; type?: ShopType }[];
}
