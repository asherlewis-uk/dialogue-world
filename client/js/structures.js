/**
 * World-building geometry. Called when server broadcasts a new structure.
 */
import { state, registerObject, setCameraTarget } from './state.js';

let scene = null;
let crystals = [];
let islands = [];

export function bindScene(s) {
  scene = s;
  crystals = [];
  islands = [];
}

export function getCrystals() { return crystals; }
export function getIslands() { return islands; }

export function clearSceneObjects() {
  if (!scene) return;
  state.objects.forEach(o => { if (o) scene.remove(o); });
  state.objects.length = 0;
  crystals.length = 0;
  islands.length = 0;
}

export function spawnStructure(meta, { animate = true, focus = true } = {}) {
  if (!scene || !meta) return null;

  const type = meta.type || 'generic';
  const group = new THREE.Group();
  const pos = meta.pos || { x: 0, y: 0, z: 0 };

  if (type === 'tower') {
    for (let i = 0; i < 7; i++) {
      const h = 4 + Math.random() * 10;
      const geo = new THREE.OctahedronGeometry(0.7 + Math.random() * 0.9, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xc4b5fd, emissive: 0x7c3aed, emissiveIntensity: 0.9,
        roughness: 0.15, metalness: 0.85, transparent: true, opacity: 0.92
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((Math.random() - 0.5) * 3, h / 2 + 1, (Math.random() - 0.5) * 3);
      mesh.scale.y = h / 2;
      mesh.rotation.y = Math.random() * Math.PI;
      group.add(mesh);
      crystals.push(mesh);
    }
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.5, 0.08, 12, 64),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.6 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.3;
    group.add(ring);
  } else if (type === 'island') {
    const islandGeo = new THREE.CylinderGeometry(3.5 + Math.random(), 4 + Math.random(), 1.2, 8);
    const islandMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.7, metalness: 0.1 });
    group.add(new THREE.Mesh(islandGeo, islandMat));
    for (let t = 0; t < 5; t++) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.18, 1.4, 6),
        new THREE.MeshStandardMaterial({ color: 0x3f2a1a })
      );
      trunk.position.set((Math.random()-0.5)*4, 1.4, (Math.random()-0.5)*4);
      group.add(trunk);
      const foliage = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.9 + Math.random()*0.5, 0),
        new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x14532d, emissiveIntensity: 0.3 })
      );
      foliage.position.copy(trunk.position);
      foliage.position.y += 1.3;
      group.add(foliage);
    }
    const fall = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.3, 6, 8),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.35 })
    );
    fall.position.set(3.2, -2, 0);
    group.add(fall);
    islands.push(group);
  } else if (type === 'market') {
    for (let s = 0; s < 6; s++) {
      const stall = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.2, 1.4),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.25 })
      );
      const a = (s / 6) * Math.PI * 2;
      stall.position.set(Math.cos(a) * 5, 0.7, Math.sin(a) * 5);
      group.add(stall);
      const can = new THREE.Mesh(
        new THREE.ConeGeometry(1.3, 0.6, 6),
        new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0x9d174d, emissiveIntensity: 0.4 })
      );
      can.position.copy(stall.position);
      can.position.y = 1.6;
      group.add(can);
    }
  } else if (type === 'avatars') {
    for (let a = 0; a < 8; a++) {
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.35, 0.7, 4, 8),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(a / 8, 0.6, 0.55),
          emissive: new THREE.Color().setHSL(a / 8, 0.5, 0.2),
          emissiveIntensity: 0.4
        })
      );
      const ang = (a / 8) * Math.PI * 2;
      body.position.set(Math.cos(ang) * 3.2, 0.9, Math.sin(ang) * 3.2);
      body.lookAt(0, 0.9, 0);
      group.add(body);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x67e8f9 })
      );
      head.position.copy(body.position);
      head.position.y += 0.85;
      group.add(head);
    }
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.8, 0.05, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.5 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    group.add(ring);
  } else if (type === 'city') {
    for (let i = 0; i < 9; i++) {
      const h = 1.5 + Math.random() * 3;
      const house = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, h, 1.4),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.65 + Math.random() * 0.1, 0.5, 0.35),
          emissive: 0x312e81, emissiveIntensity: 0.3
        })
      );
      house.position.set((i % 3 - 1) * 2.2, h / 2, (Math.floor(i / 3) - 1) * 2.2);
      group.add(house);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(1.1, 0.7, 4),
        new THREE.MeshStandardMaterial({ color: 0xa78bfa, emissive: 0x5b21b6, emissiveIntensity: 0.5 })
      );
      roof.position.copy(house.position);
      roof.position.y = h + 0.3;
      roof.rotation.y = Math.PI / 4;
      group.add(roof);
    }
  } else {
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.4, 0),
      new THREE.MeshStandardMaterial({
        color: 0x67e8f9, emissive: 0x0891b2, emissiveIntensity: 0.7,
        roughness: 0.2, metalness: 0.8
      })
    );
    mesh.position.y = 4;
    group.add(mesh);
    crystals.push(mesh);
  }

  group.position.set(pos.x, pos.y, pos.z);
  group.userData.id = meta.id;
  group.userData.type = type;

  if (animate) group.scale.set(0.01, 0.01, 0.01);
  else group.scale.set(1, 1, 1);

  scene.add(group);
  registerObject(group, meta);

  if (animate) {
    const start = performance.now();
    function grow() {
      const t = Math.min(1, (performance.now() - start) / 900);
      group.scale.setScalar(1 - Math.pow(1 - t, 3));
      if (t < 1) requestAnimationFrame(grow);
      else if (type === 'island') {
        group.userData.baseY = group.position.y;
        group.userData.phase = Math.random() * Math.PI * 2;
      }
    }
    grow();
  } else if (type === 'island') {
    group.userData.baseY = group.position.y;
    group.userData.phase = Math.random() * Math.PI * 2;
  }

  if (focus && animate) {
    setCameraTarget(pos.x, pos.y + 2, pos.z);
  }

  return group;
}

export function restoreWorld(structures) {
  clearSceneObjects();
  (structures || []).forEach(meta => {
    spawnStructure(meta, { animate: false, focus: false });
  });
}
