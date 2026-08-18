/**
 * Play mode — Three.js immersive world driven by server events.
 */
import { state, setCameraTarget, toggleAutoOrbit, subscribe } from './state.js';
import { bindScene, spawnStructure, restoreWorld, getCrystals, getIslands } from './structures.js';
import { on } from './net.js';

let scene, camera, renderer, clock;
let lights = [];
let particles;
let controlsLike = { isDragging: false, prevX: 0, prevY: 0 };
let animId = null;

export function initPlay() {
  const canvas = document.getElementById('c');
  if (!canvas || renderer) return;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x050510, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050510, 0.018);
  bindScene(scene);

  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(28, 18, 32);
  camera.lookAt(0, 6, 0);

  const amb = new THREE.AmbientLight(0x334466, 0.45);
  scene.add(amb);
  const dir = new THREE.DirectionalLight(0xa5b4fc, 1.1);
  dir.position.set(20, 40, 10);
  scene.add(dir);
  const point = new THREE.PointLight(0x22d3ee, 2.2, 80);
  point.position.set(0, 12, 0);
  scene.add(point);
  lights.push(point);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(60, 64),
    new THREE.MeshStandardMaterial({ color: 0x0a0a1a, roughness: 0.9, metalness: 0.1, transparent: true, opacity: 0.7 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  scene.add(ground);

  const gridHelper = new THREE.GridHelper(80, 40, 0x1e1b4b, 0x0f0a1f);
  gridHelper.position.y = -0.4;
  gridHelper.material.opacity = 0.35;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);

  const starGeo = new THREE.BufferGeometry();
  const starCount = 1800;
  const pos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i++) pos[i] = (Math.random() - 0.5) * 300;
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xa5b4fc, size: 0.35, transparent: true, opacity: 0.8 })));

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6.5, 0.4, 48),
    new THREE.MeshStandardMaterial({ color: 0x1e1b4b, emissive: 0x4c1d95, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.7 })
  );
  platform.position.y = 0.1;
  scene.add(platform);

  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(400 * 3);
  for (let i = 0; i < 400 * 3; i++) pPos[i] = (Math.random() - 0.5) * 80;
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x67e8f9, size: 0.18, transparent: true, opacity: 0.55 }));
  scene.add(particles);

  if (state.objectMeta.length) {
    restoreWorld(state.objectMeta);
  }

  canvas.addEventListener('pointerdown', e => {
    controlsLike.isDragging = true;
    controlsLike.prevX = e.clientX;
    controlsLike.prevY = e.clientY;
    state.autoOrbit = false;
  });
  window.addEventListener('pointerup', () => { controlsLike.isDragging = false; });
  window.addEventListener('pointermove', e => {
    if (!controlsLike.isDragging) return;
    const dx = e.clientX - controlsLike.prevX;
    const dy = e.clientY - controlsLike.prevY;
    controlsLike.prevX = e.clientX;
    controlsLike.prevY = e.clientY;
    const target = new THREE.Vector3(state.cameraTarget.x, state.cameraTarget.y, state.cameraTarget.z);
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
    spherical.theta -= dx * 0.005;
    spherical.phi = Math.max(0.2, Math.min(Math.PI - 0.2, spherical.phi + dy * 0.005));
    camera.position.setFromSpherical(spherical).add(target);
    camera.lookAt(target);
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const target = new THREE.Vector3(state.cameraTarget.x, state.cameraTarget.y, state.cameraTarget.z);
    const dir = new THREE.Vector3().subVectors(camera.position, target).normalize();
    camera.position.addScaledVector(dir, e.deltaY * 0.03);
    state.autoOrbit = false;
  }, { passive: false });

  document.getElementById('btn-orbit').addEventListener('click', () => {
    toggleAutoOrbit();
    document.getElementById('btn-orbit').classList.toggle('active', state.autoOrbit);
  });
  document.getElementById('btn-focus').addEventListener('click', () => {
    if (state.objects.length) {
      const last = state.objects[state.objects.length - 1];
      setCameraTarget(last.position.x, last.position.y + 2, last.position.z);
      state.autoOrbit = false;
    }
  });
  document.getElementById('btn-reset').addEventListener('click', () => {
    setCameraTarget(0, 6, 0);
    camera.position.set(28, 18, 32);
    camera.lookAt(0, 6, 0);
    state.autoOrbit = true;
    document.getElementById('btn-orbit').classList.add('active');
  });

  updateHUD();
  document.getElementById('btn-orbit').classList.toggle('active', state.autoOrbit);

  clock = new THREE.Clock();
  animate();
  window.addEventListener('resize', onResize);
  onResize();

  on('world:structure', (structure) => {
    spawnStructure(structure, { animate: true, focus: true });
  });

  on('world:state', (world) => {
    if (world?.structures) restoreWorld(world.structures);
  });

  subscribe((s) => {
    if (s) updateHUD();
  });
}

function updateHUD() {
  const energyVal = document.getElementById('energy-val');
  const energyFill = document.getElementById('energy-fill');
  const structCount = document.getElementById('struct-count');
  if (energyVal) energyVal.textContent = Math.round(state.energy) + '%';
  if (energyFill) energyFill.style.width = state.energy + '%';
  if (structCount) structCount.textContent = state.structures;
}

function animate() {
  animId = requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  if (state.autoOrbit && state.mode === 'play') {
    const target = new THREE.Vector3(state.cameraTarget.x, state.cameraTarget.y, state.cameraTarget.z);
    const r = camera.position.distanceTo(target);
    const theta = Math.atan2(camera.position.x - target.x, camera.position.z - target.z) + 0.0025;
    camera.position.x = target.x + Math.sin(theta) * r;
    camera.position.z = target.z + Math.cos(theta) * r;
    camera.lookAt(target);
  }

  getCrystals().forEach((c, i) => {
    c.rotation.y = t * 0.3 + i;
    c.rotation.x = Math.sin(t * 0.4 + i) * 0.1;
    if (c.material?.emissiveIntensity !== undefined) {
      c.material.emissiveIntensity = 0.7 + Math.sin(t * 2 + i) * 0.25;
    }
  });

  getIslands().forEach(isl => {
    if (isl.userData.baseY !== undefined) {
      isl.position.y = isl.userData.baseY + Math.sin(t * 0.6 + isl.userData.phase) * 0.6;
      isl.rotation.y = t * 0.05;
    }
  });

  if (particles) {
    particles.rotation.y = t * 0.02;
    const arr = particles.geometry.attributes.position.array;
    for (let i = 1; i < arr.length; i += 3) arr[i] += Math.sin(t + i) * 0.002;
    particles.geometry.attributes.position.needsUpdate = true;
  }

  lights.forEach(l => { l.intensity = 1.8 + Math.sin(t * 1.5) * 0.6; });
  renderer.render(scene, camera);
}

function onResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

export function showTip() {
  const tip = document.getElementById('tip');
  if (!tip) return;
  tip.classList.add('show');
  setTimeout(() => tip.classList.remove('show'), 3200);
}

export function isReady() {
  return !!renderer;
}
