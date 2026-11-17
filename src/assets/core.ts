/* Shared building blocks for every code-built model: the Warm Sunset palette,
   a material cache, and mesh / rounded-box helpers. Same API the Asset Test used. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Warm Sunset palette, in-game roles (see style/color-palette.md in the GRIDLOCK project). */
export const C = {
  street: '#5E5A6B',
  lane: '#F2E8D5',
  curbTop: '#E9D8B8',
  curbSide: '#CFC2AE',
  grass: '#9DBA8E',
  plaza: '#EFE0C6',
  white: '#FFFFFF',
  glass: '#A9CFDA',
  wood: '#B98B5E',
  dark: '#3F3A4A',
} as const;

const matCache = new Map<string, THREE.MeshStandardMaterial>();

/** Shared material per color + options. Never pass a texture here: give textured parts their own material. */
export function mat(color: string, opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const key = color + JSON.stringify(opts);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, ...opts });
    matCache.set(key, m);
  }
  return m;
}

export interface MeshOpts {
  cast?: boolean;
  receive?: boolean;
  opts?: THREE.MeshStandardMaterialParameters;
}

export function mesh(geo: THREE.BufferGeometry, color: string, { cast = true, receive = true, opts }: MeshOpts = {}): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color, opts));
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/** Rounded box (3 segments, about 588 triangles). Use plain boxes for tiny trim. */
export function rbox(w: number, h: number, d: number, r = 0.6, color = '#fff', o?: MeshOpts): THREE.Mesh {
  return mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), color, o);
}

/** Lighten (f > 0) or darken (f < 0) a hex color by shifting its HSL lightness. */
export function shade(hex: string, f: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + f)));
  return '#' + c.getHexString();
}

export function shadowAll<T extends THREE.Object3D>(g: T): T {
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}
