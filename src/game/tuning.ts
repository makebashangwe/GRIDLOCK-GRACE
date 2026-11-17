/* Every number the road puzzle runs on, in one place, so playtests can tune them
   without touching game code (Simulation Rules: "they live in one tuning file"). */
export const T = {
  /** Road tile size in meters: one 2-lane street with sidewalks. */
  tile: 14,
  /** Map is mapTiles x mapTiles road tiles. */
  mapTiles: 30,
  /** Distance from road center to the middle of each lane (right-hand traffic). */
  laneOffset: 1.7,

  /** Clock: 1 game minute = 0.25 real seconds at 1x (a 6-minute day). */
  gameMinutesPerSecond: 4,
  startMinute: 7 * 60,

  /** Road budget: tiles to start with, and tiles added every morning. */
  startRoadTiles: 45,
  dailyRoadTiles: 18,
  /** On-time trips earn road: one tile for every this many cars that arrive on time. */
  tripsPerTile: 2,

  /** Cars. */
  carSpeed: 11,
  carAccel: 9,
  followGap: 7.2,

  /** Trips: a trip that hasn't reached its shop this many game minutes after it starts has failed. */
  tripDeadline: 120,
  /** Game minutes between a home's trips (random in this range). Only used for a new home's first trip. */
  tripEvery: [90, 180] as [number, number],
  /** Daily rhythm: on average a home starts a trip every 1/baseTripRate game minutes in the daytime,
      three times as often in rush hour, and rarely at night. A home rests this long after each trip. */
  baseTripRate: 1 / 110,
  rushFactor: 3,
  nightFactor: 0.12,
  tripCooldown: 30,
  /** Game minutes a car spends at the shop before heading home. */
  shopVisit: 10,

  /** City growth: homes arrive in the hand while the shops have room for them. */
  homesFirstShop: 6,
  homesPerShop: 5,
  /** Game minutes between new homes being dealt (while there's demand). */
  growEvery: 35,
  /** Game minutes between new shops being dealt. */
  newShopEvery: 330,
  /** Most pieces the hand holds at once. */
  handMax: 6,
  /** Share of a home's trips that go to the shop it wants (the rest go anywhere). */
  wantShare: 0.75,
  /** The run ends at this many failed trips. */
  failLimit: 12,

  /** Crossings: how long a car waits at a stop sign (real seconds at 1x), how long each traffic-light
      direction stays green (game minutes), road-tile cost of a light and a roundabout. */
  stopWait: 0.7,
  lightGreen: 22,
  lightCost: 2,
  roundCost: 4,
  roundSpeed: 6.5,

  /** Road colors: cars on one tile at once before it shows as slow (amber) and jammed (red). */
  slowAt: 3,
  jamAt: 5,
};

export type ShopType = 'grocery' | 'cafe' | 'pizza';
export const SHOP_INFO: Record<ShopType, { name: string; sign: string; color: string; ink: string }> = {
  grocery: { name: 'Fresh Market', sign: 'Fresh Market', color: '#81B29A', ink: '#4E8F6A' },
  cafe: { name: 'Corner Café', sign: 'Corner Café', color: '#4E8FA6', ink: '#3B7187' },
  pizza: { name: 'Speedy Slice', sign: 'Speedy Slice', color: '#E07A5F', ink: '#C8553D' },
};
export const SHOP_ORDER: ShopType[] = ['grocery', 'cafe', 'pizza'];
