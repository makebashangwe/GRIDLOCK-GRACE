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
import { findRoute, lanePath, type Pt } from './routes';
import { Traffic, type Car } from './traffic';

const HOUSE_COLORS: [string, string][] = [['#F6E7CF', '#E07A5F'], ['#F3E3CB', '#81B29A'], ['#F6E7CF', '#D99A8B'], ['#F1DFC4', '#6D597A'], ['#F6E7CF', '#F2CC8F'], ['#F3E3CB', '#C8553D']];
/** The block test's code house/shop builder (untyped port). */
const building = M.building as unknown as (spec: Record<string, unknown>) => THREE.Object3D;
const tryDispatchNow = (t: number) => t <= 0;
/** Shops that sell things (and so need deliveries). */
const stocked = (t: ShopType) => t !== 'tow' && t !== 'depot';
/** Service buildings: no customers, no home demand. */
const service = (t: ShopType) => t === 'tow' || t === 'depot';
/** A bus stop: post with a round sign in the line's color and the stop number, a little bench and shelter. Faces +Z. */
function makeBusStop(color: string, n: number): THREE.Object3D {
  const g = new THREE.Group();
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 1.6), new THREE.MeshStandardMaterial({ color, roughness: 0.7 })); roof.position.set(0, 2.7, 0); g.add(roof);
  for (const x of [-1.5, 1.5]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 0.16), new THREE.MeshStandardMaterial({ color: '#3F3A4A' })); p.position.set(x, 1.3, -0.6); g.add(p); }
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 0.08), new THREE.MeshStandardMaterial({ color: '#A9CFDA', transparent: true, opacity: 0.6 })); back.position.set(0, 1.5, -0.65); g.add(back);
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 0.6), new THREE.MeshStandardMaterial({ color: '#B98B5E' })); bench.position.set(0, 0.6, -0.25); g.add(bench);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d')!;
  x.fillStyle = color; x.beginPath(); x.arc(64, 64, 60, 0, Math.PI * 2); x.fill(); x.fillStyle = '#FFFBF4'; x.font = 'bold 72px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), 64, 70);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide })); sign.position.set(1.9, 3.3, 0); g.add(sign);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.3, 6), new THREE.MeshStandardMaterial({ color: '#3F3A4A' })); pole.position.set(1.9, 1.65, -0.05); g.add(pole);
  return shadowAll(g);
}

/** Walls for apartment levels, so a grown street keeps some variety. */
const APT_WALLS = ['#F6E7CF', '#D99A8B', '#F2CC8F', '#A9CFDA', '#E9D8B8', '#81B29A'];
/** The model for a home at each level, scaled to fit inside one 14 m tile. Fronts face +Z. */
function homeModel(level: number, wall: string, roof: string): THREE.Object3D {
  const k = APT_WALLS[(wall.charCodeAt(3) + roof.charCodeAt(4)) % APT_WALLS.length];
  const make: (() => THREE.Object3D)[] = [
    () => building({ w: 8, d: 7, h: 5.4, wall, roof }),
    () => M.makeDuplexApartments() as THREE.Object3D,
    () => (M.makeGardenApartments as unknown as (w: string) => THREE.Object3D)(k),
    () => (M.makeHeritageApartments as unknown as (w: string) => THREE.Object3D)(k === '#F6E7CF' ? '#D99A8B' : k),
    () => (M.makeTowerApartments as unknown as (w: string) => THREE.Object3D)(k),
  ];
  const inner = make[level](), box = new THREE.Box3().setFromObject(inner), size = box.getSize(new THREE.Vector3());
  const fit = Math.min(1, 12 / Math.max(size.x, size.z));
  inner.scale.multiplyScalar(fit);
  const c = box.getCenter(new THREE.Vector3()).multiplyScalar(fit);
  inner.position.set(-c.x, -box.min.y * fit, -c.z);
  const g = new THREE.Group(); g.add(inner); return shadowAll(g);
}
/** The trip a home's pin shows: the one with the least time left. */
function pinTrip(h: Home): Trip | null {
  let best: Trip | null = null;
  for (const t of h.trips) if (active(t) && (!best || t.deadline < best.deadline)) best = t;
  return best;
}
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
export interface Home extends Building {
  kind: 'home'; wants: ShopType; nextTrip: number;
  /** Trips under way (a bigger building has more households, so more trips at once). */
  trips: Trip[];
  /** 0 cottage, 1 duplex, 2 garden walkup, 3 heritage corner, 4 tower. */
  level: number;
  /** On-time trips toward the next level. */
  happy: number;
  wall: string; roof: string;
}
export const LEVEL_NAMES = ['Cottage', 'Duplex', 'Garden Walkup', 'Heritage Corner', 'Tower'];
/** A piece waiting in the player's hand. */
export type Piece = { kind: 'home'; wants: ShopType } | { kind: 'shop'; type: ShopType };
export interface Shop extends Building { kind: 'shop'; type: ShopType; served: number; stock: number; truck: Car | null; warned: boolean }
type AnyBuilding = Home | Shop;
/** A trip: 'waiting' to leave by car, 'out' driving, 'stop' waiting for the bus, 'ride' on the bus, 'shop' inside, 'back' driving home. */
interface Trip { home: Home; type: ShopType; deadline: number; state: 'waiting' | 'out' | 'stop' | 'ride' | 'shop' | 'back'; failed: boolean; shop?: Shop; car?: Car | null; until?: number; bus?: { line: BusLine; from: number; to: number; run?: BusRun } }

export const LINE_COLORS = ['#4E8FA6', '#E07A5F', '#81B29A', '#6D597A', '#F4B860', '#D99A8B'];
export interface BusLine {
  color: string;
  /** Stop tiles (road cells), in the order the bus visits them; it loops back to the first. */
  stops: number[];
  /** Buses running on this line (more on a longer loop, so nobody waits a whole lap). */
  runs: BusRun[];
  /** Distance along one lap where a bus reaches each stop; null when the stops aren't all connected. */
  stopS: number[] | null;
  pts: Pt[] | null;
  lap: number;
  signs: THREE.Object3D[];
}
export interface BusRun { car: Car; visited: Set<number>; riders: Trip[]; dwell: number; pin: HTMLDivElement }
const active = (t: Trip) => t.state === 'waiting' || t.state === 'out' || t.state === 'stop' || t.state === 'ride';

export type GoalId = 'trips' | 'late' | 'nocrash' | 'hand';
export interface Goal { id: GoalId; target: number }
export type UpgradeId = 'roads' | 'lights' | 'round' | 'patience' | 'shop' | 'bridges';
export const UPGRADES: Record<UpgradeId, { name: string; text: string }> = {
  roads: { name: '+20 road tiles', text: 'More road, right now.' },
  lights: { name: '2 free traffic lights', text: 'Your next two lights cost no road.' },
  round: { name: 'A free roundabout', text: 'Your next roundabout costs no road.' },
  patience: { name: 'Patient drivers', text: 'Every trip gets 15 more minutes before it counts as late.' },
  shop: { name: 'A new shop', text: 'The next shop arrives in your hand now.' },
  bridges: { name: '+2 bridge pieces', text: 'Enough for one more river crossing.' },
};
export interface WeekEnd { week: number; goal: Goal; met: boolean; bonus: number; options: UpgradeId[] }

interface Crash { tile: number; cars: Car[]; since: number; tow: Car | null; pin: HTMLDivElement }

export interface Stats { bridges: number; crashes: number; weekday: number; rush: boolean; sandbox: boolean; earned: number; arrived: number; failed: number; homes: number; shops: number; demand: number; roadTiles: number; day: number; minute: number; over: boolean }

export class City {
  homes: Home[] = [];
  shops: Shop[] = [];
  stats: Stats = { bridges: T.startBridges, crashes: 0, weekday: 0, rush: false, sandbox: false, earned: 0, arrived: 0, failed: 0, homes: 0, shops: 0, demand: 0, roadTiles: T.startRoadTiles, day: 1, minute: T.startMinute, over: false };
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

  /** Weekly goal and what's counted toward it. */
  goal: Goal = { id: 'trips', target: 20 };
  week = { arrived: 0, failed: 0, crashes: 0 };
  /** Upgrade tokens and bonuses from Sunday picks. */
  tokens = { lights: 0, round: 0 };
  patience = 0;
  /** Called Sunday night when a week ends; the game waits for the player to pick an upgrade. */
  onWeekEnd: (w: WeekEnd) => void = () => {};

  private towDealtAt = 0;
  /** Crashes waiting for the tow truck. */
  private crashes: Crash[] = [];

  constructor(private scene: THREE.Scene, private grid: Grid, private traffic: Traffic, private pinLayer: HTMLElement) {
    this.plantTrees();
    traffic.onCrash = (a, b, tile) => this.crash(a, b, tile);
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
    for (let d = 0; d < 4; d++) if (this.grid.connects(i, j, d)) return d;
    return Math.floor(Math.random() * 4);
  }

  addHome(i: number, j: number, wants: ShopType = 'grocery'): Home | null {
    const g = this.grid, c = g.idx(i, j); if (!g.isFree(i, j)) return null;
    this.clearTree(c);
    const [wall, roof] = HOUSE_COLORS[this.nextId % HOUSE_COLORS.length];
    const obj = homeModel(0, wall, roof);
    const home: Home = { id: this.nextId++, kind: 'home', wants, i, j, obj, face: this.roadSide(i, j), access: -1, turned: false, pin: this.pin('pin'), nextTrip: this.clock + 15 + Math.random() * 40, trips: [], level: 0, happy: 0, wall, roof };
    g.building[c] = home; this.homes.push(home);
    this.scene.add(obj); this.connect(home); this.popIn(obj); this.count(); this.onChange();
    return home;
  }

  addShop(type: ShopType, i: number, j: number): Shop | null {
    const g = this.grid, c = g.idx(i, j); if (!g.isFree(i, j)) return null;
    this.clearTree(c);
    const info = SHOP_INFO[type];
    const obj = shadowAll(type === 'tow' ? (M.makeHookAndHaulTowShop() as THREE.Object3D)
      : type === 'depot' ? building({ w: 11, d: 9, h: 6.5, wall: '#F6E7CF', roof: info.color, sign: { text: info.sign, color: info.ink }, roofType: 'flat', bays: 2 })
      : building({ w: 10.5, d: 9, h: 7, wall: '#FFF4E2', roof: info.color, awning: info.color, sign: { text: info.sign, color: info.ink }, roofType: 'flat' }));
    const shop: Shop = { id: this.nextId++, kind: 'shop', type, i, j, obj, face: this.roadSide(i, j), access: -1, turned: false, pin: this.pin('pin shop'), served: 0, stock: T.stockMax, truck: null, warned: false };
    shop.pin.style.setProperty('--c', info.color);
    shop.pin.innerHTML = `<span>${info.name}</span>` + (stocked(type) ? '<i class="stock"><i></i></i>' : '');
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
      for (const t of b.trips) if (t.car) { this.traffic.remove(t.car); this.carTrip.delete(t.car); }
    } else {
      this.shops.splice(this.shops.indexOf(b), 1);
      for (const h of this.homes) for (const t of [...h.trips]) {   // anyone heading there turns around and picks again
        if (t.shop !== b) continue;
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
    if (!b.turned && !g.connects(b.i, b.j, b.face)) {
      for (let d = 0; d < 4; d++) if (g.connects(b.i, b.j, d)) { b.face = d; break; }
    }
    b.access = g.connects(b.i, b.j, b.face) ? g.idx(b.i + DX[b.face], b.j + DZ[b.face]) : -1;
    const { x, z } = g.center(b.i, b.j);
    b.obj.position.set(x, 0, z); (b.obj.userData as { rot?: number }).rot = FACE_ROT[b.face];
    if ((b.obj.userData as { grow?: number }).grow !== undefined) b.obj.rotation.y = FACE_ROT[b.face];
  }

  /** Call after any road change. */
  roadsChanged(): void {
    for (const b of [...this.homes, ...this.shops]) this.connect(b);
    for (const l of this.lines) this.rebuildLine(l);
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
  private capacity(): number { const n = this.shops.filter((s) => !service(s.type)).length; return n ? T.homesFirstShop + (n - 1) * T.homesPerShop : 0; }

  /** Hover text for a home: its level and how close it is to growing. */
  homeInfo(i: number, j: number): string {
    const b = this.grid.building[this.grid.idx(i, j)] as AnyBuilding | null;
    if (!b || b.kind !== 'home') return '';
    const n = T.households[b.level], fam = `${n} household${n > 1 ? 's' : ''}`;
    if (b.level >= 4) return `${LEVEL_NAMES[b.level]} · ${fam} · fully grown`;
    return `${LEVEL_NAMES[b.level]} · ${fam} · ${b.happy}/${T.growAt[b.level]} on-time trips to become a ${LEVEL_NAMES[b.level + 1]}`;
  }

  households(): number { let n = 0; for (const h of this.homes) n += T.households[h.level]; return n; }

  /** A home that's been doing well grows into the next building, if the shops have room for more households. */
  private grow(): void {
    for (const h of this.homes) {
      if (h.level >= 4 || h.happy < T.growAt[h.level]) continue;
      const extra = T.households[h.level + 1] - T.households[h.level];
      if (this.capacity() - this.households() < extra) continue;
      this.setLevel(h, h.level + 1);
      this.onEvent(`A home grew into a ${LEVEL_NAMES[h.level]}`, 'good');
      return;   // one at a time
    }
  }

  setLevel(h: Home, level: number, instant = false): void {
    this.scene.remove(h.obj);
    h.level = level; h.happy = 0; h.obj = homeModel(level, h.wall, h.roof);
    this.scene.add(h.obj); this.connect(h); h.obj.rotation.y = FACE_ROT[h.face];
    if (!instant) this.popIn(h.obj);
  }

  /** Deal a new home into the hand when the shops have room for more people. */
  private deal(): void {
    const inHand = this.hand.filter((p) => p.kind === 'home').length;
    this.stats.demand = Math.max(0, this.capacity() - this.households() - inHand);
    if (this.stats.demand <= 0 || this.hand.length >= T.handMax) return;
    const types = [...new Set(this.shops.map((s) => s.type))].filter((t) => !service(t));
    if (!types.length) return;
    const wants = types[Math.floor(Math.random() * types.length)];
    this.hand.push({ kind: 'home', wants });
    this.onEvent(`A family wants to move in near ${SHOP_INFO[wants].name}`, 'good');
  }

  /* ---------------- trips ---------------- */
  private send(trip: Trip, from: AnyBuilding, to: AnyBuilding, onArrive: () => void): boolean {
    if (from.access < 0 || to.access < 0) return false;
    const route = findRoute(this.grid, from.access, to.access); if (!route) return false;
    const pts = lanePath(this.grid, [this.grid.idx(from.i, from.j), ...route, this.grid.idx(to.i, to.j)], Math.random() < 0.5 ? 1 : 0);
    if (!this.traffic.canStart(pts)) return false;
    const car = this.traffic.add(pts, onArrive); if (!car) return false;
    trip.car = car; this.carTrip.set(car, trip); return true;
  }

  private dispatch(trip: Trip): void {
    const home = trip.home;
    if (home.access < 0) return;
    // the closest shop of the right kind, but drivers avoid one that's sold out or nearly (a truck may be coming)
    let best: Shop | null = null, bestLen = Infinity;
    for (const s of this.shops) {
      if (s.type !== trip.type || s.access < 0) continue;
      const r = findRoute(this.grid, home.access, s.access); if (!r) continue;
      const score = r.length + (s.stock <= 0 ? 60 : s.stock < T.stockPerTrip * 3 ? 12 : 0);
      if (score < bestLen) { best = s; bestLen = score; }
    }
    if (!best) return;
    const shop = best;
    const ride = Math.random() < T.busShare ? this.busFor(home, shop) : null;
    if (ride) { trip.state = 'stop'; trip.shop = shop; trip.bus = ride; return; }
    if (this.send(trip, home, shop, () => this.arriveShop(trip))) { trip.state = 'out'; trip.shop = shop; }
  }

  private arriveShop(trip: Trip): void {
    if (trip.car) this.carTrip.delete(trip.car);
    trip.car = null; trip.state = 'shop'; trip.until = this.clock + T.shopVisit;
    const shop = trip.shop;
    if (shop && shop.stock <= 0) {   // sold out: the customer is turned away
      if (!trip.failed) this.fail(trip, 'soldout');
      return;
    }
    if (shop) shop.stock = Math.max(0, shop.stock - T.stockPerTrip);
    if (!trip.failed) {
      this.stats.arrived++; this.week.arrived++; if (trip.shop) trip.shop.served++; trip.home.happy++;
      if (this.stats.arrived % T.tripsPerTile === 0) { this.stats.roadTiles++; this.stats.earned++; this.onEarn(); }
    }
  }

  private finish(trip: Trip): void {
    if (trip.car) this.carTrip.delete(trip.car);
    const h = trip.home, k = h.trips.indexOf(trip); if (k >= 0) h.trips.splice(k, 1);
    h.nextTrip = Math.max(h.nextTrip, this.clock + T.tripCooldown / T.households[h.level]);
  }

  /** Late trips since the last summary, by cause, so a busy minute is one message instead of twenty. */
  private lateLog = { late: 0, soldOut: new Map<string, number>(), crash: 0 };
  /** One summary of what ran late lately (or '' if nothing did). The game calls this every few seconds. */
  lateSummary(): string {
    const L = this.lateLog, parts: string[] = [];
    if (L.late) parts.push(`${L.late} ran out of time in traffic`);
    for (const [name, n] of L.soldOut) parts.push(`${n} found ${name} sold out`);
    if (L.crash) parts.push(`${L.crash} were in crashes`);
    const total = L.late + L.crash + [...L.soldOut.values()].reduce((a, b) => a + b, 0);
    this.lateLog = { late: 0, soldOut: new Map(), crash: 0 };
    if (!total) return '';
    return `${total} late trip${total > 1 ? 's' : ''}: ` + parts.join(', ');
  }

  private fail(trip: Trip, why?: 'soldout' | 'crash'): void {
    trip.failed = true; this.stats.failed++; this.week.failed++; trip.home.happy = Math.max(0, trip.home.happy - 2);
    if (why === 'soldout' && trip.shop) { const n = SHOP_INFO[trip.shop.type].name; this.lateLog.soldOut.set(n, (this.lateLog.soldOut.get(n) ?? 0) + 1); }
    else if (why === 'crash') this.lateLog.crash++; else this.lateLog.late++;
    if (!this.stats.sandbox && this.stats.failed >= T.failLimit) { this.stats.over = true; this.onEvent('Gridlock! The city ran out of patience.', 'bad'); }
  }

  /* ---------------- weekly goals ---------------- */
  goalText(): { text: string; progress: string; frac: number } {
    const g = this.goal, w = this.week, total = w.arrived + w.failed, latePct = total ? (w.failed / total) * 100 : 0;
    switch (g.id) {
      case 'trips': return { text: `Get ${g.target} trips there on time`, progress: `${w.arrived} / ${g.target}`, frac: Math.min(1, w.arrived / g.target) };
      case 'late': return { text: `Keep late trips under ${g.target}% (15+ trips)`, progress: total ? `${latePct.toFixed(0)}% late · ${total} trips` : 'no trips yet', frac: total >= 15 && latePct < g.target ? 1 : Math.min(0.9, total / 15) };
      case 'nocrash': return { text: 'Get through the week with no crashes', progress: w.crashes ? `${w.crashes} crash${w.crashes > 1 ? 'es' : ''}` : 'no crashes yet', frac: w.crashes ? 0 : 1 };
      case 'hand': return { text: 'End the week with an empty hand', progress: `${this.hand.length} piece${this.hand.length === 1 ? '' : 's'} left`, frac: this.hand.length ? 0.3 : 1 };
    }
  }
  private goalMet(): boolean {
    const g = this.goal, w = this.week, total = w.arrived + w.failed;
    if (g.id === 'trips') return w.arrived >= g.target;
    if (g.id === 'late') return total >= 15 && (w.failed / total) * 100 < g.target;
    if (g.id === 'nocrash') return w.crashes === 0;
    return this.hand.length === 0;
  }
  private endWeek(week: number): void {
    const met = this.goalMet(), bonus = met ? 15 : 0;
    this.stats.roadTiles += bonus;
    const pool: UpgradeId[] = ['roads', 'lights', 'round', 'patience', 'shop', 'bridges'];
    for (let k = pool.length - 1; k > 0; k--) { const r = Math.floor(Math.random() * (k + 1)); [pool[k], pool[r]] = [pool[r], pool[k]]; }
    const w: WeekEnd = { week, goal: this.goal, met, bonus, options: pool.slice(0, met ? 3 : 2) };
    // next week's goal
    const ids: GoalId[] = ['trips', 'late', 'nocrash', 'hand'];
    const id = ids[Math.floor(Math.random() * ids.length)];
    this.goal = { id, target: id === 'trips' ? Math.max(20, this.homes.length * 6) : id === 'late' ? 5 : 0 };
    this.week = { arrived: 0, failed: 0, crashes: 0 };
    this.onWeekEnd(w);
  }
  /** Apply the upgrade the player picked. */
  pick(u: UpgradeId): void {
    if (u === 'roads') this.stats.roadTiles += 20;
    if (u === 'lights') this.tokens.lights += 2;
    if (u === 'round') this.tokens.round += 1;
    if (u === 'patience') this.patience += 15;
    if (u === 'bridges') this.stats.bridges += 2;
    if (u === 'shop') { const type = SHOP_ORDER[this.shopsDealt++ % SHOP_ORDER.length]; this.hand.unshift({ kind: 'shop', type }); this.onChange(); }
  }

  /* ---------------- buses ---------------- */
  lines: BusLine[] = [];
  /** The line the Bus tool adds stops to. */
  current = 0;

  private newLine(color = LINE_COLORS[this.lines.length % LINE_COLORS.length]): BusLine {
    const l: BusLine = { color, stops: [], runs: [], stopS: null, pts: null, lap: 0, signs: [] };
    this.lines.push(l); return l;
  }
  startLine(): number {
    const last = this.lines[this.lines.length - 1];
    if (last && last.stops.length === 0) { this.current = this.lines.length - 1; return this.current; }
    if (this.lines.length >= LINE_COLORS.length) return -1;
    this.newLine(); this.current = this.lines.length - 1; return this.current;
  }
  stopAt(c: number): BusLine | null { return this.lines.find((l) => l.stops.includes(c)) ?? null; }

  /** Bus tool click on a road tile: add a stop to the current line, or remove that line's stop. Returns road tiles spent (+) or refunded (-), or null if nothing happened. */
  toggleStop(c: number): number | null {
    const g = this.grid;
    if (!g.road[c] || g.water[c]) return null;
    if (!this.lines.length) this.newLine();
    const line = this.lines[this.current] ?? this.lines[0], other = this.stopAt(c);
    if (other && other !== line) return null;
    if (other) { line.stops.splice(line.stops.indexOf(c), 1); this.rebuildLine(line); return -T.stopCost; }
    line.stops.push(c); this.rebuildLine(line); return T.stopCost;
  }

  /** Recompute a line's loop and its stop signs after a change. */
  rebuildLine(l: BusLine): void {
    const g = this.grid;
    l.stops = l.stops.filter((c) => g.road[c] && !g.water[c]);
    for (const s of l.signs) this.scene.remove(s);
    l.signs = l.stops.map((c, k) => { const s = makeBusStop(l.color, k + 1); const [i, j] = g.ij(c), { x, z } = g.center(i, j); s.position.set(x + 5.6, 0, z + 5.6); this.scene.add(s); return s; });
    for (const r of l.runs) this.endRun(l, r, true);
    l.stopS = null; l.pts = null;
    if (l.stops.length < 2) return;
    const cells: number[] = [l.stops[0]];
    for (let k = 0; k < l.stops.length; k++) {
      const r = findRoute(g, l.stops[k], l.stops[(k + 1) % l.stops.length]);
      if (!r) return;
      cells.push(...r.slice(1));
    }
    const pts = lanePath(g, cells);
    // where along the lap the bus reaches each stop
    const stopS: number[] = []; let sAt = 0, p = 0;
    for (const stop of l.stops) {
      while (p < pts.length - 1) {
        const [i, j] = g.tileAt(pts[p].x, pts[p].z);
        if (g.inside(i, j) && g.idx(i, j) === stop) break;
        sAt += Math.hypot(pts[p + 1].x - pts[p].x, pts[p + 1].z - pts[p].z); p++;
      }
      stopS.push(sAt);
    }
    l.pts = pts; l.stopS = stopS;
    l.lap = pts.slice(1).reduce((acc, q, k) => acc + Math.hypot(q.x - pts[k].x, q.z - pts[k].z), 0);
  }

  /** A bus finished its lap (or the line changed): riders still on board get off and are done. */
  private endRun(l: BusLine, r: BusRun, removeCar = false): void {
    if (removeCar) this.traffic.remove(r.car);
    for (const t of r.riders) if (t.state === 'ride') this.finish(t);
    r.pin.remove(); l.runs.splice(l.runs.indexOf(r), 1);
  }

  /** A line that serves both a home and a shop: stops within walking distance of each. */
  private busFor(home: Home, shop: Shop): { line: BusLine; from: number; to: number } | null {
    const g = this.grid, near = (b: AnyBuilding, c: number) => { const [i, j] = g.ij(c); return Math.abs(i - b.i) + Math.abs(j - b.j) <= T.busWalk; };
    for (const l of this.lines) {
      if (!l.stopS) continue;
      const from = l.stops.findIndex((c) => near(home, c)), to = l.stops.findIndex((c) => near(shop, c));
      if (from >= 0 && to >= 0 && from !== to) return { line: l, from, to };
    }
    return null;
  }

  private updateBuses(realDt: number): void {
    for (const l of this.lines) {
      if (!l.pts || !l.stopS) continue;
      // keep buses spaced around the loop: about one per 90 m of route, up to 4
      const want = Math.max(1, Math.min(4, Math.round(l.lap / 90)));
      const last = l.runs[l.runs.length - 1];
      if (l.runs.length < want && (!last || last.car.s > l.lap / want) && this.traffic.canStart(l.pts)) {
        const obj = (M.makeSchoolBus as unknown as (p: string) => THREE.Object3D)(l.color); shadowAll(obj); obj.scale.setScalar(0.72);
        const pin = document.createElement('div'); pin.className = 'pin bus'; pin.style.setProperty('--c', l.color); this.pinLayer.appendChild(pin);
        const run: BusRun = { car: null as unknown as Car, visited: new Set(), riders: [], dwell: 0, pin };
        const car = this.traffic.addSpecial(l.pts, obj, () => this.endRun(l, run), false);
        if (car) { car.bus = true; run.car = car; l.runs.push(run); } else pin.remove();
      }
      for (const r of l.runs) {
        const bus = r.car;
        if (r.dwell > 0) { r.dwell -= realDt; bus.hold = r.dwell > 0; continue; }
        for (let k = 0; k < l.stopS.length; k++) {
          if (r.visited.has(k) || bus.s < l.stopS[k]) continue;
          r.visited.add(k);
          // riders for this stop get off and walk into their shop
          for (const t of [...r.riders]) if (t.bus?.to === k) { r.riders.splice(r.riders.indexOf(t), 1); if (this.homes.includes(t.home)) this.arriveShop(t); }
          // people waiting here get on
          for (const h of this.homes) for (const t of h.trips) {
            if (t.state !== 'stop' || t.bus?.line !== l || t.bus.from !== k || r.riders.length >= T.busCapacity) continue;
            t.state = 'ride'; t.bus.run = r; r.riders.push(t);
          }
          r.dwell = T.busStopTime; bus.hold = true;
        }
      }
    }
  }

  /* ---------------- deliveries ---------------- */
  /** Send a delivery truck from the highway to any shop running low. */
  private updateDeliveries(): void {
    const g = this.grid;
    // only so many trucks at once, neediest shop first, so deliveries don't flood the streets
    const stockedShops = this.shops.filter((s) => stocked(s.type));
    let onRoad = stockedShops.filter((s) => s.truck).length;
    const cap = T.maxTrucks + Math.floor(stockedShops.length / T.deliveriesPerShops);
    for (const shop of [...stockedShops].sort((a, b) => a.stock - b.stock)) {
      if (onRoad >= cap) break;
      if (shop.truck || shop.stock >= T.restockAt) continue;
      // trucks come in at the nearest highway connection the shop can be reached from
      let route: number[] | null = null, from = -1;
      if (shop.access >= 0) for (const e of g.entries) {
        if (!g.road[e]) continue;
        const r = findRoute(g, e, shop.access); if (r && (!route || r.length < route.length)) { route = r; from = e; }
      }
      if (!route) {
        if (!shop.warned) { shop.warned = true; this.onEvent(`${SHOP_INFO[shop.type].name} is running low: connect it to a HIGHWAY sign at the map's edge so trucks can restock it`, 'bad'); }
        continue;
      }
      const pts = lanePath(g, [...route, g.idx(shop.i, shop.j)]);
      if (!this.traffic.canStart(pts)) continue;
      const truck = M.makeDeliveryTruck(SHOP_INFO[shop.type].color) as THREE.Object3D; shadowAll(truck); truck.scale.setScalar(0.85);
      onRoad++;
      shop.truck = this.traffic.addSpecial(pts, truck, () => {
        shop.stock = T.stockMax; shop.truck = null; shop.warned = false;
        const back = shop.access >= 0 && g.road[from] ? findRoute(g, shop.access, from) : null;
        if (back) {
          const t2 = M.makeDeliveryTruck(SHOP_INFO[shop.type].color) as THREE.Object3D; shadowAll(t2); t2.scale.setScalar(0.85);
          this.traffic.addSpecial(lanePath(g, [g.idx(shop.i, shop.j), ...back]), t2, () => {}, false);
        }
      }, false);
    }
  }

  /* ---------------- potholes and the city depot ---------------- */
  /** Potholes in the road: crew truck on its way, or the crew working (fixAt). */
  holes = new Map<number, { crew: Car | null; fixAt: number; site: THREE.Object3D | null; depot?: Shop }>();
  /** Called when potholes appear or are patched, so the road props can redraw. */
  onHoles: () => void = () => {};

  private updatePotholes(): void {
    const g = this.grid;
    for (let c = 0; c < g.wear.length; c++) {
      if (g.wear[c] < T.potholeAt || !g.road[c] || g.water[c] || g.pothole[c]) continue;
      g.wear[c] = 0; g.pothole[c] = 1; this.holes.set(c, { crew: null, fixAt: -1, site: null }); this.onHoles();
      const hasDepot = this.shops.some((s) => s.type === 'depot') || this.hand.some((p) => p.kind === 'shop' && p.type === 'depot');
      if (!hasDepot) { this.hand.unshift({ kind: 'shop', type: 'depot' }); this.onChange(); this.onEvent('A pothole! The City Depot wants to open: place it and its crew will patch roads', 'bad'); }
    }
    for (const [c, h] of this.holes) {
      if (!g.road[c]) { this.patch(c); continue; }   // the road was erased
      if (h.fixAt >= 0) { if (this.clock >= h.fixAt) this.patch(c, true); continue; }
      if (h.crew) continue;
      for (const depot of this.shops) {
        if (depot.type !== 'depot' || depot.access < 0) continue;
        const route = findRoute(g, depot.access, c); if (!route) continue;
        const pts = lanePath(g, [g.idx(depot.i, depot.j), ...route, route[route.length - 1]]); pts.pop();
        const truck = M.makeDeliveryTruck('#F4B860') as THREE.Object3D; shadowAll(truck); truck.scale.setScalar(0.85);
        h.crew = this.traffic.addSpecial(pts, truck, () => {
          h.crew = null; h.fixAt = this.clock + T.fixTime;
          // the crew parks beside the hole with cones while they work
          const site = new THREE.Group(), [i, j] = g.ij(c), { x, z } = g.center(i, j);
          const parked = M.makeDeliveryTruck('#F4B860') as THREE.Object3D; parked.scale.setScalar(0.85); parked.position.set(-3.2, 0, -3.6); site.add(parked);
          for (const [cx, cz] of [[2.6, -1.2], [2.6, 1.6], [-0.4, 2.4]]) { const cone = M.makeTrafficCone() as THREE.Object3D; cone.scale.setScalar(1.5); cone.position.set(cx, 0, cz); site.add(cone); }
          site.position.set(x, 0.05, z); shadowAll(site); this.scene.add(site); h.site = site; h.depot = depot;
        }, false);
        break;
      }
    }
  }
  private patch(c: number, fixed = false): void {
    const h = this.holes.get(c); if (!h) return;
    if (h.crew) this.traffic.remove(h.crew);
    if (h.site) this.scene.remove(h.site);
    this.holes.delete(c); this.grid.pothole[c] = 0; this.grid.wear[c] = 0; this.onHoles();
    if (!fixed) return;
    this.onEvent('The depot crew patched a pothole', 'good');
    const depot = h.depot, g = this.grid;   // the crew drives back to the depot
    const back = depot && depot.access >= 0 && this.shops.includes(depot) ? findRoute(g, c, depot.access) : null;
    if (depot && back) {
      const t = M.makeDeliveryTruck('#F4B860') as THREE.Object3D; shadowAll(t); t.scale.setScalar(0.85);
      this.traffic.addSpecial(lanePath(g, [...back, g.idx(depot.i, depot.j)]), t, () => {}, false);
    }
  }

  /* ---------------- crashes and towing ---------------- */
  private crash(a: Car, b: Car, tile: number): void {
    this.stats.crashes++; this.week.crashes++;
    for (const car of [a, b]) { const trip = this.carTrip.get(car); if (trip && !trip.failed) this.fail(trip, 'crash'); }
    const pin = document.createElement('div'); pin.className = 'pin crash'; pin.innerHTML = '<b>!</b>Crash'; this.pinLayer.appendChild(pin);
    this.crashes.push({ tile, cars: [a, b], since: this.clock, tow: null, pin });
    const towInHand = this.hand.some((p) => p.kind === 'shop' && p.type === 'tow'), towShops = this.shops.filter((s) => s.type === 'tow').length;
    // a new Hook & Haul with the first crash, then another after every few crashes so every part of town has one nearby
    const deal = !towInHand && (towShops === 0 || this.stats.crashes - this.towDealtAt >= T.crashesPerTow);
    if (deal) { this.towDealtAt = this.stats.crashes; this.hand.unshift({ kind: 'shop', type: 'tow' }); }
    this.onEvent(deal ? (towShops ? 'Crash! Another Hook & Haul wants to open: put it where crashes keep happening' : 'Crash! Hook & Haul wants to open in your town: place it to clear crashes fast')
      : towShops ? 'Crash! Hook & Haul is on the way' : 'Crash! Place Hook & Haul from your hand to clear it', 'bad');
    this.onChange();
  }

  private clearCrash(cr: Crash): void {
    for (const car of cr.cars) {
      this.traffic.remove(car);
      const trip = this.carTrip.get(car); if (trip) { this.carTrip.delete(car); trip.car = null; this.finish(trip); }
    }
    cr.pin.remove(); this.crashes.splice(this.crashes.indexOf(cr), 1);
  }

  private updateCrashes(tryNow: boolean): void {
    for (const cr of [...this.crashes]) {
      if (!cr.tow && this.clock - cr.since > T.crashSelfClear) { this.clearCrash(cr); continue; }
      if (cr.tow || !tryNow) continue;
      // send the nearest connected tow truck
      for (const shop of this.shops) {
        if (shop.type !== 'tow' || shop.access < 0) continue;
        const route = findRoute(this.grid, shop.access, cr.tile); if (!route) continue;
        const pts = lanePath(this.grid, [this.grid.idx(shop.i, shop.j), ...route, route[route.length - 1]]);
        pts.pop();
        const truck = M.makeTowTruck() as THREE.Object3D; shadowAll(truck);
        cr.tow = this.traffic.addSpecial(pts, truck, () => {
          this.clearCrash(cr);
          this.onEvent('Hook & Haul cleared the crash', 'good');
          const back = findRoute(this.grid, cr.tile, shop.access);
          if (back && this.shops.includes(shop)) {
            const home = lanePath(this.grid, [...back, this.grid.idx(shop.i, shop.j)]);
            const t2 = M.makeTowTruck() as THREE.Object3D; shadowAll(t2); this.traffic.addSpecial(home, t2, () => {});
          }
        });
        break;
      }
    }
  }

  /** How busy the streets are right now: rush hours on weekdays, quiet nights, easy weekends. */
  rhythm(): number {
    const m = this.clock % 1440, weekend = this.stats.weekday >= 5;
    const rush = !weekend && ((m >= 7 * 60 && m < 9 * 60) || (m >= 16.5 * 60 && m < 18.5 * 60));
    this.stats.rush = rush;
    if (m < 6 * 60 || m >= 22 * 60) return T.nightFactor;
    if (rush) return T.rushFactor;
    if (m < 7 * 60 || m >= 20 * 60) return 0.5;
    return weekend ? 1.2 : 1;
  }

  /** Advance the city by `gm` game minutes. */
  update(gm: number, realDt: number): void {
    if (this.stats.over) return;
    const before = Math.floor(this.clock / 1440);
    this.clock += gm;
    const day = Math.floor(this.clock / 1440);
    if (day > before) {
      this.stats.roadTiles += T.dailyRoadTiles; this.onEvent(`Day ${day + 1} · +${T.dailyRoadTiles} road tiles`, 'good');
      if (day % 7 === 0) this.endWeek(day / 7);
    }
    this.stats.day = day + 1; this.stats.minute = this.clock % 1440; this.stats.weekday = day % 7;
    const rate = T.baseTripRate * this.rhythm();

    if (this.clock >= this.nextGrow) { this.nextGrow = this.clock + T.growEvery; this.grow(); this.deal(); }
    if (this.clock >= this.nextShop) {
      this.nextShop = this.clock + T.newShopEvery;
      const type = SHOP_ORDER[this.shopsDealt++ % SHOP_ORDER.length];
      this.hand.push({ kind: 'shop', type }); this.onEvent(`New shop to place: ${SHOP_INFO[type].name}`, 'good');
    }
    this.stats.demand = Math.max(0, this.capacity() - this.households() - this.hand.filter((p) => p.kind === 'home').length);

    const types = [...new Set(this.shops.map((s) => s.type))].filter((t) => !service(t));
    this.dispatchT -= realDt;
    this.updateCrashes(tryDispatchNow(this.dispatchT));
    if (tryDispatchNow(this.dispatchT)) { this.updateDeliveries(); this.updatePotholes(); }
    this.updateBuses(realDt);
    const tryDispatch = this.dispatchT <= 0; if (tryDispatch) this.dispatchT = 0.4;
    for (const h of this.homes) {
      const size = T.households[h.level];
      if (h.trips.length < size && this.clock >= h.nextTrip && types.length && Math.random() < gm * rate * size) {
        const type: ShopType = (types as ShopType[]).includes(h.wants) && Math.random() < T.wantShare ? h.wants : types[Math.floor(Math.random() * types.length)];
        h.trips.push({ home: h, type, deadline: this.clock + T.tripDeadline + this.patience, state: 'waiting', failed: false });
        h.nextTrip = this.clock + 4;
      }
      for (const trip of [...h.trips]) {
        if (trip.state === 'waiting' && tryDispatch) this.dispatch(trip);
        if (!trip.failed && active(trip) && this.clock > trip.deadline) {
          this.fail(trip);
          if (trip.state === 'waiting' || trip.state === 'stop') this.finish(trip);   // gave up
        }
        if (trip.state === 'shop' && this.clock >= trip.until!) {
          if (trip.bus) { this.finish(trip); continue; }   // bus riders ride home too: no car
          trip.state = 'back';
          if (!trip.shop || !this.send(trip, trip.shop, h, () => this.finish(trip))) this.finish(trip);   // no way home: they get a ride
        }
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
  drawPins(camera: THREE.Camera, zoom = 1): void {
    const v = new THREE.Vector3();
    const put = (b: AnyBuilding, y: number) => {
      // a trip's timer rides on its car while it's driving, so you can follow it through traffic
      const t = b.kind === 'home' ? pinTrip(b) : null, car = t?.state === 'out' ? t.car : t?.state === 'ride' ? t.bus?.run?.car : null;
      const { x, z } = car ? { x: car.x, z: car.z } : this.grid.center(b.i, b.j);
      v.set(x, car ? 8 : y, z).project(camera);
      b.pin.classList.toggle('riding', !!car);
      b.pin.style.left = ((v.x + 1) / 2) * innerWidth + 'px'; b.pin.style.top = ((1 - v.y) / 2) * innerHeight + 'px';
      return Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    };
    for (const h of this.homes) {
      const t = pinTrip(h), blocked = h.access < 0, show = (blocked || (!!t && (t.state === 'waiting' || t.state === 'out'))) && put(h, 12);
      h.pin.style.display = show ? 'block' : 'none';
      if (!show) continue;
      const left = t ? Math.max(0, (t.deadline - this.clock) / (T.tripDeadline + this.patience)) : 1;
      h.pin.style.setProperty('--c', t?.failed ? '#C8553D' : t ? SHOP_INFO[t.type].color : '#B8A99A');
      h.pin.style.setProperty('--p', String(t?.failed ? 1 : left));
      h.pin.classList.toggle('late', !!t?.failed);
      h.pin.classList.toggle('stuck', blocked);
    }
    for (const l of this.lines) for (const r of l.runs) {   // each bus shows its line color and how many people are riding
      v.set(r.car.x, 9, r.car.z).project(camera);
      r.pin.style.left = ((v.x + 1) / 2) * innerWidth + 'px'; r.pin.style.top = ((1 - v.y) / 2) * innerHeight + 'px';
      r.pin.textContent = String(r.riders.length);
    }
    for (const cr of this.crashes) {
      const [i, j] = this.grid.ij(cr.tile), { x, z } = this.grid.center(i, j); v.set(x, 9, z).project(camera);
      cr.pin.style.left = ((v.x + 1) / 2) * innerWidth + 'px'; cr.pin.style.top = ((1 - v.y) / 2) * innerHeight + 'px';
    }
    const compact = zoom < 1.3;   // zoomed out: shop names shrink to colored dots
    for (const s of this.shops) {
      s.pin.classList.toggle('compact', compact);
      if (!put(s, 13)) { s.pin.style.display = 'none'; continue; }
      s.pin.style.display = 'block'; s.pin.classList.toggle('stuck', s.access < 0);
      if (stocked(s.type)) {
        const bar = s.pin.querySelector<HTMLElement>('.stock > i'); if (bar) bar.style.width = `${(s.stock / T.stockMax) * 100}%`;
        s.pin.classList.toggle('low', s.stock < T.restockAt); s.pin.classList.toggle('out', s.stock <= 0);
      }
    }
  }

  /* ---------------- saving ---------------- */
  /** Everything needed to rebuild this town later. Cars on the road aren't saved: trips simply start fresh. */
  save(): SaveData {
    const g = this.grid, roads: number[] = [];
    for (let c = 0; c < g.road.length; c++) if (g.road[c]) roads.push(c);
    return {
      v: 1, clock: this.clock, nextGrow: this.nextGrow, nextShop: this.nextShop, shopsDealt: this.shopsDealt,
      stats: { ...this.stats }, hand: [...this.hand], roads, potholes: roads.filter((c) => g.pothole[c]), water: [...g.water.keys()].filter((c) => g.water[c]), avenues: roads.filter((c) => g.road[c] === 2), goal: this.goal, week: this.week, tokens: this.tokens, patience: this.patience, lines: this.lines.map((l) => ({ color: l.color, stops: l.stops })),
      junctions: roads.filter((c) => g.junction[c]).map((c) => [c, g.junction[c], g.jspent[c]] as [number, number, number]),
      buildings: [...this.homes, ...this.shops].map((b) => ({ kind: b.kind, i: b.i, j: b.j, face: b.face, turned: b.turned, wants: b.kind === 'home' ? b.wants : undefined, level: b.kind === 'home' ? b.level : undefined, happy: b.kind === 'home' ? b.happy : undefined, type: b.kind === 'shop' ? b.type : undefined, stock: b.kind === 'shop' ? b.stock : undefined })),
    };
  }

  load(d: SaveData): void {
    const g = this.grid;
    if (d.water) { g.water.fill(0); for (const c of d.water) { g.water[c] = 1; this.clearTree(c); } }
    for (const c of d.roads) { g.road[c] = 1; this.clearTree(c); }
    for (const c of d.avenues ?? []) g.road[c] = 2;
    for (const ld of d.lines ?? []) { const l = this.newLine(ld.color); l.stops = ld.stops; }
    for (const c of d.potholes ?? []) { g.pothole[c] = 1; this.holes.set(c, { crew: null, fixAt: -1, site: null }); }
    for (const [c, k, spent] of d.junctions ?? []) { g.junction[c] = k; g.jspent[c] = spent ?? 0; }
    if (d.goal) this.goal = d.goal; if (d.week) this.week = d.week; if (d.tokens) this.tokens = d.tokens; this.patience = d.patience ?? 0;
    for (const b of d.buildings) {
      const made = b.kind === 'home' ? this.addHome(b.i, b.j, b.wants ?? 'grocery') : this.addShop(b.type ?? 'grocery', b.i, b.j);
      if (!made) continue;
      made.face = b.face; made.turned = b.turned; this.connect(made);
      if (made.kind === 'shop' && b.stock !== undefined) made.stock = b.stock;
      if (made.kind === 'home' && b.level) { this.setLevel(made, b.level, true); }
      if (made.kind === 'home') made.happy = b.happy ?? 0;
      made.obj.rotation.y = FACE_ROT[made.face]; delete (made.obj.userData as { grow?: number }).grow; made.obj.scale.setScalar(1);
    }
    this.clock = d.clock; this.nextGrow = d.nextGrow; this.nextShop = d.nextShop; this.shopsDealt = d.shopsDealt;
    this.hand = d.hand; this.stats = { ...this.stats, ...d.stats, over: false };
    for (const h of this.homes) h.nextTrip = this.clock + Math.random() * 30;
    for (const l of this.lines) this.rebuildLine(l);
    this.count(); this.onChange();
  }
}

export interface SaveData {
  v: 1;
  clock: number; nextGrow: number; nextShop: number; shopsDealt: number;
  stats: Stats; hand: Piece[]; roads: number[]; avenues?: number[]; water?: number[]; potholes?: number[];
  junctions?: [number, number, number?][];
  lines?: { color: string; stops: number[] }[];
  goal?: Goal; week?: { arrived: number; failed: number; crashes: number }; tokens?: { lights: number; round: number }; patience?: number;
  buildings: { kind: 'home' | 'shop'; i: number; j: number; face: number; turned: boolean; wants?: ShopType; type?: ShopType; stock?: number; level?: number; happy?: number }[];
}
