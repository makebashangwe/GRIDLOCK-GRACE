/* The 3D stage: renderer, warm lighting, and the angled toy-town camera.
   Camera matches the Living Block Test: orthographic, 45° turn, 0.62 rad tilt,
   drag to pan, scroll to zoom, Q / E to rotate in 90° steps. */
import * as THREE from 'three';

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  sun: THREE.DirectionalLight;
  cam: CameraRig;
  render(): void;
}

export interface CameraRig {
  target: THREE.Vector3;
  angle: number;
  goalAngle: number;
  tilt: number;
  zoom: number;
  goalZoom: number;
  /** Half the view height in meters at zoom 1. */
  view: number;
}

export function createStage(host: HTMLElement): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#EADBC4');
  scene.add(new THREE.HemisphereLight('#FFF1DC', '#B9A58F', 1.55));
  const sun = new THREE.DirectionalLight('#FFE2BC', 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -130, right: 130, top: 130, bottom: -130, near: 1, far: 420 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
  const cam: CameraRig = { target: new THREE.Vector3(), angle: Math.PI / 4, goalAngle: Math.PI / 4, tilt: 0.62, zoom: 1.4, goalZoom: 1.4, view: 60 };

  const place = () => {
    const a = renderer.domElement.clientWidth / renderer.domElement.clientHeight;
    const h = cam.view / cam.zoom;
    camera.left = -h * a; camera.right = h * a; camera.top = h; camera.bottom = -h;
    camera.updateProjectionMatrix();
    const d = 700;
    camera.position.set(
      cam.target.x + Math.sin(cam.angle) * Math.cos(cam.tilt) * d,
      cam.target.y + Math.sin(cam.tilt) * d,
      cam.target.z + Math.cos(cam.angle) * Math.cos(cam.tilt) * d,
    );
    camera.lookAt(cam.target);
    // the sun follows the camera so shadows exist wherever you look
    const tx = Math.round(cam.target.x / 4) * 4, tz = Math.round(cam.target.z / 4) * 4;
    sun.position.set(tx - 70, 160, tz + 60);
    sun.target.position.set(tx, 0, tz);
    sun.target.updateMatrixWorld();
  };

  // controls
  const el = renderer.domElement;
  let drag: { x: number; y: number } | null = null;
  el.addEventListener('pointerdown', (e) => { if (e.button === 2 || e.shiftKey || e.button === 1) drag = { x: e.clientX, y: e.clientY }; });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const k = (2 * cam.view) / cam.zoom / el.clientHeight;
    const dx = (e.clientX - drag.x) * k, dy = (e.clientY - drag.y) * k / Math.sin(cam.tilt);
    const ca = Math.cos(cam.angle), sa = Math.sin(cam.angle);
    cam.target.x -= dx * ca + dy * sa;
    cam.target.z -= -dx * sa + dy * ca;
    drag = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointerup', () => (drag = null));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('wheel', (e) => { e.preventDefault(); cam.goalZoom = THREE.MathUtils.clamp(cam.goalZoom * Math.exp(-e.deltaY * 0.0012), 0.15, 9); }, { passive: false });
  const held = new Set<string>();
  window.addEventListener('keydown', (e) => {
    if (e.key === 'q' || e.key === 'Q') cam.goalAngle += Math.PI / 2;
    if (e.key === 'e' || e.key === 'E') cam.goalAngle -= Math.PI / 2;
    held.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => held.clear());
  // arrow keys / WASD pan, in screen directions
  const keyPan = (dt: number) => {
    let rx = 0, dy = 0;
    if (held.has('arrowright') || held.has('d')) rx += 1;
    if (held.has('arrowleft') || held.has('a')) rx -= 1;
    if (held.has('arrowdown') || held.has('s')) dy += 1;
    if (held.has('arrowup') || held.has('w')) dy -= 1;
    if (!rx && !dy) return;
    const sp = (cam.view / cam.zoom) * 1.4 * dt, ca = Math.cos(cam.angle), sa = Math.sin(cam.angle);
    cam.target.x += (rx * ca + dy * sa / Math.sin(cam.tilt)) * sp;
    cam.target.z += (-rx * sa + dy * ca / Math.sin(cam.tilt)) * sp;
  };
  window.addEventListener('resize', () => renderer.setSize(host.clientWidth, host.clientHeight));

  let last = performance.now();
  return {
    renderer, scene, camera, sun, cam,
    render() {
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      cam.zoom += (cam.goalZoom - cam.zoom) * Math.min(1, dt * 8);
      cam.angle += (cam.goalAngle - cam.angle) * Math.min(1, dt * 8);
      keyPan(dt);
      place();
      renderer.render(scene, camera);
    },
  };
}
