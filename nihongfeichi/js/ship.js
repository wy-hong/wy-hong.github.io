/* 玩家飞船建模 */
import { PLAYER_Y, PLAYER_Z } from './config.js';
import { radialTex } from './textures.js';
import { scene } from './world.js';

export const ship = new THREE.Group();

const bodyMat = new THREE.MeshStandardMaterial({ color: 0x181c3f, metalness: 0.9, roughness: 0.25 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x0a2a3a, metalness: 0.4, roughness: 0.1,
  emissive: 0x22d3ee, emissiveIntensity: 0.7 });

const body = new THREE.Mesh(new THREE.ConeGeometry(1.05, 3.4, 6), bodyMat);
body.rotation.x = -Math.PI / 2; body.castShadow = true; ship.add(body);

const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), glassMat);
canopy.scale.set(1, 0.75, 1.7); canopy.position.set(0, 0.5, 0.3); ship.add(canopy);

function wingGeo(sign) {
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    0, 0, 0.9,   sign * 2.7, 0, 1.7,   sign * 0.4, 0, -1.1,
    0, 0, 0.9,   sign * 0.4, 0, -1.1,  0, 0, -1.2 ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}
const wingMat = new THREE.MeshStandardMaterial({ color: 0x222a5e, metalness: 0.85, roughness: 0.3,
  emissive: 0x3b2a86, emissiveIntensity: 0.5, side: THREE.DoubleSide });
const wingL = new THREE.Mesh(wingGeo(-1), wingMat); wingL.castShadow = true; ship.add(wingL);
const wingR = new THREE.Mesh(wingGeo( 1), wingMat); wingR.castShadow = true; ship.add(wingR);

[-2.62, 2.62].forEach(x => {
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 1.1),
    new THREE.MeshBasicMaterial({ color: x < 0 ? 0xff2a6d : 0x22d3ee }));
  strip.position.set(x, 0.02, 1.3); ship.add(strip);
});

const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 1.1), wingMat);
fin.position.set(0, 0.5, 1.1); fin.rotation.x = 0.25; ship.add(fin);

/* 引擎喷口 + 光晕 */
export const exhausts = [];
[[-0.55], [0.55]].forEach(e => {
  const x = e[0];
  const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x111431, metalness: 0.9, roughness: 0.3 }));
  noz.rotation.x = Math.PI / 2; noz.position.set(x, 0, 1.75); ship.add(noz);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTex('rgba(140,240,255,1)', 'rgba(34,120,238,0)'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  flame.position.set(x, 0, 2.15); flame.scale.set(1, 1, 1);
  ship.add(flame); exhausts.push(flame);
});

/* 护盾 */
export const shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 14),
  new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.18,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
shieldMesh.visible = false; ship.add(shieldMesh);

ship.position.set(0, PLAYER_Y, PLAYER_Z);
scene.add(ship);
