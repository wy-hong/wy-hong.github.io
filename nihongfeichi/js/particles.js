/* 粒子系统：引擎尾流 + 爆发粒子 */
import { PLAYER_Y, PLAYER_Z, rand } from './config.js';
import { dotTex } from './textures.js';
import { scene } from './world.js';

/* ---------- 尾流 ---------- */
const TRAIL_N = 130;
const trailPos = new Float32Array(TRAIL_N * 3);
const trailLife = new Float32Array(TRAIL_N);
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({
  size: 0.55, map: dotTex, color: 0x5ee7ff, transparent: true, opacity: 0.85,
  depthWrite: false, blending: THREE.AdditiveBlending }));
trail.frustumCulled = false;
scene.add(trail);
let trailIdx = 0;
for (let i = 0; i < TRAIL_N; i++) trailPos[i*3+1] = -999;

export function emitTrail(shipX) {
  for (let k = 0; k < 3; k++) {
    const j = trailIdx = (trailIdx + 1) % TRAIL_N;
    trailPos[j*3]   = shipX + rand(-0.4, 0.4);
    trailPos[j*3+1] = PLAYER_Y + rand(-0.25, 0.25);
    trailPos[j*3+2] = PLAYER_Z + 2.1;
    trailLife[j] = 1;
  }
}

export function updateTrail(dt, speed) {
  for (let j = 0; j < TRAIL_N; j++) {
    if (trailLife[j] <= 0) { trailPos[j*3+1] = -999; continue; }
    trailLife[j] -= dt * 2.2;
    trailPos[j*3+2] += speed * dt * 0.9;
  }
  trailGeo.attributes.position.needsUpdate = true;
}

/* ---------- 爆发粒子 ---------- */
const BURST_N = 420;
const bPos = new Float32Array(BURST_N * 3);
const bVel = new Float32Array(BURST_N * 3);
const bLife = new Float32Array(BURST_N);
const bGeo = new THREE.BufferGeometry();
bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
const bMat = new THREE.PointsMaterial({ size: 0.5, map: dotTex, color: 0xffffff,
  transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
const burst = new THREE.Points(bGeo, bMat);
burst.frustumCulled = false;
scene.add(burst);
let bIdx = 0;
for (let i = 0; i < BURST_N; i++) bPos[i*3+1] = -999;

export function explode(p, color, count, power, speed) {
  bMat.color.setHex(color);
  for (let i = 0; i < count; i++) {
    const j = bIdx = (bIdx + 1) % BURST_N;
    bPos[j*3] = p.x; bPos[j*3+1] = p.y; bPos[j*3+2] = p.z;
    const th = Math.random() * Math.PI * 2, ph = Math.acos(rand(-1, 1));
    const v = rand(0.3, 1) * power;
    bVel[j*3] = Math.sin(ph) * Math.cos(th) * v;
    bVel[j*3+1] = Math.cos(ph) * v;
    bVel[j*3+2] = Math.sin(ph) * Math.sin(th) * v + speed * 0.15;
    bLife[j] = 1;
  }
}

export function updateBurst(dt) {
  let any = false;
  for (let j = 0; j < BURST_N; j++) {
    if (bLife[j] <= 0) { bPos[j*3+1] = -999; continue; }
    any = true;
    bLife[j] -= dt * 1.4;
    bPos[j*3] += bVel[j*3] * dt; bPos[j*3+1] += bVel[j*3+1] * dt; bPos[j*3+2] += bVel[j*3+2] * dt;
    bVel[j*3+1] -= 6 * dt;
  }
  if (any) bGeo.attributes.position.needsUpdate = true;
}

/* 清空全部粒子（修复跨局残留） */
export function clearParticles() {
  for (let i = 0; i < BURST_N; i++) { bLife[i] = 0; bPos[i*3+1] = -999; }
  bGeo.attributes.position.needsUpdate = true;
  for (let j = 0; j < TRAIL_N; j++) { trailLife[j] = 0; trailPos[j*3+1] = -999; }
  trailGeo.attributes.position.needsUpdate = true;
}
