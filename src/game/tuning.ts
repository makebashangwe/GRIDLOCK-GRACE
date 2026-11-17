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

  /** Crashes: chance that a near miss at a crossing with no control becomes a crash, and how long a crash
      blocks the road (game minutes) when no tow truck can reach it. */
  crashChance: 0.14,
  crashSelfClear: 150,

  /** Shop stock: each customer uses some; below restockAt a delivery truck comes from the highway.
      An empty shop turns customers away (their trip counts as late). */
  stockMax: 100,
  stockPerTrip: 6,
  restockAt: 40,
  truckSpeed: 9,

  /** Road wear: a tile cracks into a pothole after this many car passes (trucks count 3). Cars crawl over
      potholes. A connected City Depot sends a crew that patches one in fixTime game minutes. */
  potholeAt: 220,
  potholeSpeed: 4,
  fixTime: 30,

  /** Bridge pieces to start with (a crossing of the 2-wide river takes 2). More come from Sunday picks. */
  startBridges: 4,

  /** Avenues: 4 lanes on one tile. Cost in road tiles (a new avenue, or upgrading a street costs the difference),
      speed, and the two lane centers measured from the middle of the road. */
  avenueCost: 2,
  avenueSpeed: 14,
  avenueLanes: [1.7, 4.3] as [number, number],

  /** Road colors: cars on one tile at once before it shows as slow (amber) and jammed (red). */
  slowAt: 3,
  jamAt: 5,
};

export type ShopType = 'grocery' | 'cafe' | 'pizza' | 'tow' | 'depot';
export const SHOP_INFO: Record<ShopType, { name: string; sign: string; color: string; ink: string }> = {
  grocery: { name: 'Fresh Market', sign: 'Fresh Market', color: '#81B29A', ink: '#4E8F6A' },
  cafe: { name: 'Corner Café', sign: 'Corner Café', color: '#4E8FA6', ink: '#3B7187' },
  pizza: { name: 'Speedy Slice', sign: 'Speedy Slice', color: '#E07A5F', ink: '#C8553D' },
  tow: { name: 'Hook & Haul', sign: 'Hook & Haul', color: '#F4B860', ink: '#B57B12' },
  depot: { name: 'City Depot', sign: 'Public Works', color: '#6D597A', ink: '#4F3F5C' },
};
/** Shops homes make trips to, in the order new ones are dealt. Hook & Haul is dealt when the first crash happens. */
export const SHOP_ORDER: ShopType[] = ['grocery', 'cafe', 'pizza'];
