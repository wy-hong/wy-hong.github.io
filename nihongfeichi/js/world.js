/* 世界构建：渲染器 / 场景 / 灯光 / 天空 / 赛道环境 */
import { TRACK_W, TRACK_LEN, PLAYER_Z, BASE_FOV } from './config.js';
import { dotTex, radialTex, sunTex, gridTex, mtnTex } from './textures.js';

/* ---------- 渲染器 / 场景 / 相机 ---------- */
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x05030f, 60, 300);

export const camera = new THREE.PerspectiveCamera(BASE_FOV, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(0, 5.2, 15);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ---------- 灯光 ---------- */
scene.add(new THREE.HemisphereLight(0x8a7dff, 0x140a2e, 0.75));
const dirLight = new THREE.DirectionalLight(0xff9ac8, 0.9);
dirLight.position.set(-30, 40, -60);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.left = -40; dirLight.shadow.camera.right = 40;
dirLight.shadow.camera.top = 40; dirLight.shadow.camera.bottom = -40;
scene.add(dirLight);
const cyanLight = new THREE.PointLight(0x22d3ee, 1.6, 60);
cyanLight.position.set(0, 8, 0); scene.add(cyanLight);
export const pinkLight = new THREE.PointLight(0xff2a6d, 1.2, 50);
pinkLight.position.set(0, 4, PLAYER_Z + 4); scene.add(pinkLight);

/* ---------- 天空 / 星空 / 星云 / 太阳 / 远山 ---------- */
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(900, 24, 16),
  new THREE.MeshBasicMaterial({ color: 0x070418, side: THREE.BackSide })
));

function makeStars(count, rMin, rMax, size, color, opacity) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    let vx = Math.random()*2-1, vy = Math.random()*2-1, vz = Math.random()*2-1;
    const len = Math.sqrt(vx*vx+vy*vy+vz*vz) || 1;
    const r = rMin + Math.random() * (rMax - rMin);
    pos[i*3] = vx/len * r; pos[i*3+1] = Math.abs(vy/len) * r * 0.6 + 4; pos[i*3+2] = vz/len * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: dotTex, color,
    transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(p); return p;
}
export const stars1 = makeStars(900, 350, 800, 2.2, 0xffffff, 0.9);
export const stars2 = makeStars(500, 300, 700, 3.4, 0x9fd8ff, 0.6);

export const nebulae = [];
[[-180, 90, -420, 260, 'rgba(168,85,247,.5)'],
 [220, 120, -380, 300, 'rgba(255,42,109,.5)'],
 [0, 160, -520, 340, 'rgba(34,211,238,.55)']].forEach(n => {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTex(n[4], 'rgba(0,0,0,0)'),
    transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.position.set(n[0], n[1], n[2]); m.scale.set(n[3], n[3] * 0.7, 1);
  scene.add(m); nebulae.push(m);
});

export const sun = new THREE.Mesh(new THREE.PlaneGeometry(220, 220),
  new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, depthWrite: false }));
sun.position.set(0, 60, -460); scene.add(sun);
const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: radialTex('rgba(255,120,80,.8)', 'rgba(255,42,109,0)'),
  transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
sunGlow.position.copy(sun.position); sunGlow.scale.set(560, 560, 1); scene.add(sunGlow);

const mtn = new THREE.Mesh(new THREE.PlaneGeometry(1200, 180),
  new THREE.MeshBasicMaterial({ map: mtnTex, transparent: true, depthWrite: false }));
mtn.position.set(0, 40, -440); scene.add(mtn);

/* ---------- 赛道（roadGroup 绕玩家位置偏航以表现弯道） ---------- */
const trackMat = new THREE.MeshStandardMaterial({
  color: 0x0a0620, roughness: 0.55, metalness: 0.4,
  emissive: 0x22d3ee, emissiveMap: gridTex, emissiveIntensity: 0.5 });

export const roadGroup = new THREE.Group();
roadGroup.position.z = PLAYER_Z;
scene.add(roadGroup);

const track = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_W, TRACK_LEN), trackMat);
track.rotation.x = -Math.PI / 2; track.receiveShadow = true;
track.position.z = -PLAYER_Z; roadGroup.add(track);

export { gridTex };

export const floorGrid = new THREE.GridHelper(1400, 120, 0xff2a6d, 0x3b2a86);
floorGrid.material.transparent = true; floorGrid.material.opacity = 0.22;
floorGrid.position.y = -0.08; scene.add(floorGrid);

[-TRACK_W/2, TRACK_W/2].forEach(x => {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, TRACK_LEN),
    new THREE.MeshBasicMaterial({ color: 0xff2a6d }));
  rail.position.set(x, 0.18, -PLAYER_Z); roadGroup.add(rail);
});

/* 两侧掠过的灯光柱 */
export const pillars = [];
const pillarGeo = new THREE.BoxGeometry(0.5, 7, 0.5);
const pillarMatC = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
const pillarMatP = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
for (let i = 0; i < 24; i++) {
  const left = i % 2 === 0;
  const pm = new THREE.Mesh(pillarGeo, left ? pillarMatC : pillarMatP);
  pm.userData.bx = left ? -TRACK_W/2 - 2.5 : TRACK_W/2 + 2.5;
  pm.position.set(pm.userData.bx, 3.5, -TRACK_LEN/2 + i * (TRACK_LEN/24));
  scene.add(pm); pillars.push(pm);
}

/* 漂浮的远景晶体岛屿 */
export const floaters = [];
for (let i = 0; i < 26; i++) {
  const kind = Math.random();
  let fm;
  if (kind < 0.4) fm = new THREE.Mesh(new THREE.TetrahedronGeometry(2 + Math.random()*4),
    new THREE.MeshStandardMaterial({ color: 0x2a1a5e, emissive: 0x6d28d9, emissiveIntensity: 0.5, flatShading: true }));
  else if (kind < 0.75) fm = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 + Math.random()*2.5, 0),
    new THREE.MeshStandardMaterial({ color: 0x0e2a3a, emissive: 0x22d3ee, emissiveIntensity: 0.45, flatShading: true, wireframe: Math.random() < 0.5 }));
  else fm = new THREE.Mesh(new THREE.TorusGeometry(2 + Math.random()*3, 0.25, 8, 24),
    new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0xff2a6d : 0x22d3ee, wireframe: true }));
  const side = Math.random() < 0.5 ? -1 : 1;
  fm.position.set(side * (26 + Math.random() * 90), 4 + Math.random() * 40, -Math.random() * TRACK_LEN);
  fm.userData.rs = (Math.random() - 0.5) * 0.8;
  scene.add(fm); floaters.push(fm);
}
