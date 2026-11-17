/* Gridlock & Grace — game entry point.
   v0.1 (the road puzzle) is built on top of this stage: a blank map on a road-tile grid. */
import * as THREE from 'three';
import { createStage } from './engine/stage';
import { runTicks } from './engine/tick';
import { C } from './assets/core';

/** Road tiles are 14 m: one 2-lane street (two 3.4 m lanes plus room for markings). */
export const TILE = 14;
export const MAP_TILES = 32;

const stage = createStage(document.getElementById('app')!);
const { scene, cam } = stage;

const size = TILE * MAP_TILES;
const land = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color: C.grass, roughness: 0.95 }));
land.rotation.x = -Math.PI / 2; land.receiveShadow = true; scene.add(land);
const grid = new THREE.GridHelper(size, MAP_TILES, '#8FAE80', '#8FAE80');
(grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.35;
grid.position.y = 0.02; scene.add(grid);

cam.target.set(0, 0, 0); cam.zoom = cam.goalZoom = 0.9;

(function loop() {
  runTicks(performance.now() / 1000);
  stage.render();
  requestAnimationFrame(loop);
})();
