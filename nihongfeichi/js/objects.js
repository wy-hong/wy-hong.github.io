/* 游戏对象池与波次生成 */
import { TRACK_LEN, rand, laneX } from './config.js';
import { radialTex } from './textures.js';
import { scene } from './world.js';

const obsMatA = new THREE.MeshStandardMaterial({ color: 0x2b0a1e, roughness: 0.4, metalness: 0.3,
  emissive: 0xff2a6d, emissiveIntensity: 0.55, flatShading: true });
const obsMatB = new THREE.MeshStandardMaterial({ color: 0x1a0f38, roughness: 0.35, metalness: 0.5,
  emissive: 0xa855f7, emissiveIntensity: 0.6, flatShading: true });
const gemMat = new THREE.MeshStandardMaterial({ color: 0x3a2b00, roughness: 0.15, metalness: 0.7,
  emissive: 0xffd166, emissiveIntensity: 1.1 });
const ringMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 });
const shieldMat = new THREE.MeshStandardMaterial({ color: 0x006622, emissive: 0x34d399,
  emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.6 });

export const pool = [], active = [];
let spawnZ = 0, objId = 0;

export function getSpawnZ() { return spawnZ; }
export function addSpawnZ(d) { spawnZ += d; }
export function resetObjects() {
  active.forEach(o => o.visible = false);
  active.length = 0;
  spawnZ = 0;
}

function makeObj(type) {
  const g = new THREE.Group();
  g.userData = { type, id: objId++ };
  let m, wire;
  if (type === 'cube') {
    m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 0), obsMatA);
    m.castShadow = true; g.add(m);
    wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 0),
      new THREE.MeshBasicMaterial({ color: 0xff2a6d, wireframe: true, transparent: true, opacity: 0.35 }));
    g.add(wire);
    g.userData.spin = new THREE.Vector3(rand(0.5,1.5), rand(0.5,1.5), 0);
    g.userData.r = 1.9;
  } else if (type === 'pyramid') {
    m = new THREE.Mesh(new THREE.ConeGeometry(1.35, 2.4, 4), obsMatB);
    m.castShadow = true; g.add(m);
    wire = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.7, 4),
      new THREE.MeshBasicMaterial({ color: 0xa855f7, wireframe: true, transparent: true, opacity: 0.35 }));
    g.add(wire);
    g.userData.spin = new THREE.Vector3(0, rand(0.8, 1.6), 0);
    g.userData.r = 2.0;
  } else if (type === 'bar') {
    m = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.4, 1.2), obsMatA);
    m.castShadow = true; g.add(m);
    wire = new THREE.Mesh(new THREE.BoxGeometry(4.7, 1.65, 1.5),
      new THREE.MeshBasicMaterial({ color: 0xff2a6d, wireframe: true, transparent: true, opacity: 0.3 }));
    g.add(wire);
    g.userData.spin = null;
    g.userData.r = 2.4;
  } else if (type === 'gem') {
    m = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), gemMat);
    g.add(m);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTex('rgba(255,220,130,.9)', 'rgba(255,209,102,0)'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(3.2, 3.2, 1); g.add(halo);
    g.userData.spin = new THREE.Vector3(0, 2.6, 0);
    g.userData.r = 1.6; g.userData.good = true;
  } else if (type === 'ring') {
    m = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.16, 10, 42), ringMat);
    g.add(m);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.05, 8, 42),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
    g.add(inner);
    g.userData.spin = new THREE.Vector3(0, 0, 0.8);
    g.userData.r = 2.6; g.userData.good = true; g.userData.isRing = true;
  } else if (type === 'shield') {
    m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), shieldMat);
    g.add(m);
    wire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 1),
      new THREE.MeshBasicMaterial({ color: 0x34d399, wireframe: true }));
    g.add(wire);
    g.userData.spin = new THREE.Vector3(0.6, 1.8, 0);
    g.userData.r = 1.6; g.userData.good = true; g.userData.isShield = true;
  } else if (type === 'magnet') {
    m = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.28, 10, 20),
      new THREE.MeshStandardMaterial({ color: 0x33091f, emissive: 0xec4899,
        emissiveIntensity: 1.3, roughness: 0.25, metalness: 0.6 }));
    g.add(m);
    wire = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.06, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xec4899, wireframe: true }));
    g.add(wire);
    g.userData.spin = new THREE.Vector3(1.2, 1.8, 0);
    g.userData.r = 1.7; g.userData.good = true; g.userData.isMagnet = true;
  } else if (type === 'double') {
    m = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0),
      new THREE.MeshStandardMaterial({ color: 0x0a1f33, emissive: 0x38bdf8,
        emissiveIntensity: 1.3, roughness: 0.2, metalness: 0.6 }));
    m.scale.set(1, 1.5, 1); g.add(m);
    wire = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true }));
    wire.scale.set(1, 1.5, 1); g.add(wire);
    g.userData.spin = new THREE.Vector3(0, 2.2, 0);
    g.userData.r = 1.7; g.userData.good = true; g.userData.isDouble = true;
  } else if (type === 'slow') {
    m = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x0a2a1f, emissive: 0x2dd4bf,
        emissiveIntensity: 1.1, roughness: 0.15, metalness: 0.5 }));
    g.add(m);
    wire = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0x2dd4bf }));
    g.add(wire);
    g.userData.spin = new THREE.Vector3(0.8, 1.4, 0.6);
    g.userData.r = 1.7; g.userData.good = true; g.userData.isSlow = true;
  } else if (type === 'star') {
    m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.85, 0),
      new THREE.MeshStandardMaterial({ color: 0x332200, emissive: 0xfbbf24,
        emissiveIntensity: 1.4, roughness: 0.2, metalness: 0.7 }));
    g.add(m);
    const halo2 = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTex('rgba(255,220,130,.9)', 'rgba(255,180,60,0)'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo2.scale.set(3.6, 3.6, 1); g.add(halo2);
    g.userData.spin = new THREE.Vector3(1.4, 2.4, 0);
    g.userData.r = 1.7; g.userData.good = true; g.userData.isStar = true;
  }
  g.visible = false;
  scene.add(g);
  return g;
}

export function spawn(type, x, z, y) {
  let g = null;
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].userData.type === type && !pool[i].visible) { g = pool[i]; break; }
  }
  if (!g) { g = makeObj(type); pool.push(g); }
  g.position.set(x, y === undefined ? (type === 'bar' ? 0.9 : 1.4) : y, z);
  g.rotation.set(0, 0, 0);
  g.visible = true;
  g.userData.hit = false;
  g.userData.baseX = x;
  active.push(g);
  return g;
}

/* 生成波次（diff: 难度 0~1） */
export function spawnWave(diff) {
  const z = spawnZ - TRACK_LEN;
  const roll = Math.random();
  if (roll < 0.42 + diff * 0.2) {
    const n = 2 + Math.floor(Math.random() * (2 + diff * 2));
    const xs = [];
    for (let i = 0; i < n; i++) xs.push(laneX());
    const gap = laneX();
    xs.forEach(x => {
      if (Math.abs(x - gap) < 6) return;
      spawn(Math.random() < 0.5 ? 'cube' : 'pyramid', x, z + rand(-4, 4));
    });
  } else if (roll < 0.58) {
    spawn('bar', rand(-22 + 3, 22 - 3), z);
  } else if (roll < 0.74) {
    const gx = laneX(), gn = 4 + Math.floor(Math.random() * 3);
    for (let gi = 0; gi < gn; gi++) spawn('gem', gx + Math.sin(gi * 0.9) * 2.2, z - gi * 7, 1.4);
  } else if (roll < 0.89) {
    spawn('ring', laneX() * 0.5, z, 1.4);
  } else if (roll < 0.94) {
    spawn('shield', laneX(), z, 1.4);
  } else if (roll < 0.985) {
    const pk = Math.random();
    spawn(pk < 0.22 ? 'magnet' : pk < 0.42 ? 'double' : pk < 0.6 ? 'slow' : 'star', laneX(), z, 1.4);
  }
  spawnZ -= rand(26 - diff * 10, 46 - diff * 14);
}
