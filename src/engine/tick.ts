/** Per-frame callbacks (flag waving, blinking beacons...). The game loop calls each with time in seconds. */
export type Tick = (t: number) => void;
export const TICK: Tick[] = [];

export function runTicks(t: number): void {
  for (const fn of TICK) fn(t);
}
