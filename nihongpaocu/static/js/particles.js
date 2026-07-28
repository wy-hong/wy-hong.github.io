/* ===== 粒子系统 =====
   三层效果合一：发光精灵粒子 + 3D 立体碎块（障碍本体粉碎）+ 冲击波环
   全部对象池复用，零 GC 压力
*/
window.NR = window.NR || {};

NR.particles = (function () {
  const POOL_SIZE = 130;
  const pool = [];
  const debris = [];
  const rings = [];
  let sceneRef = null;

  function init(scene) {
    sceneRef = scene;
    const tex = NR.textures.glow();

    // ---- 精灵粒子池 ----
    for (let i = 0; i < POOL_SIZE; i++) {
      const m = new THREE.SpriteMaterial({
        map: tex, color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const s = new THREE.Sprite(m);
      s.visible = false;
      scene.add(s);
      pool.push({ s, life: 0, maxLife: 1, vel: new THREE.Vector3(), grav: 0, size: 0.3 });
    }

    // ---- 3D 碎块池（障碍粉碎） ----
    const dGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(dGeo, new THREE.MeshStandardMaterial({
        color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.5
      }));
      m.visible = false;
      scene.add(m);
      debris.push({ m, life: 0, maxLife: 1, vel: new THREE.Vector3(), rot: new THREE.Vector3(), size: 1 });
    }

    // ---- 冲击波环池 ----
    const rGeo = new THREE.RingGeometry(0.32, 0.5, 40);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      }));
      m.visible = false;
      scene.add(m);
      rings.push({ m, life: 0, maxLife: 1 });
    }
  }

  // ================= 精灵粒子 =================
  function spawn(x, y, z, color, size, life, vx, vy, vz, grav) {
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (p.life <= 0) {
        p.life = p.maxLife = life;
        p.size = size; p.grav = grav || 0;
        p.vel.set(vx, vy, vz);
        p.s.position.set(x, y, z);
        p.s.material.color.setHex(color);
        p.s.visible = true;
        return;
      }
    }
  }
  function burst(x, y, z, color, n, spd) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = (0.4 + Math.random() * 0.6) * spd;
      spawn(x, y, z, color, 0.25 + Math.random() * 0.2, 0.45 + Math.random() * 0.3,
        Math.cos(a) * r, Math.random() * spd * 0.9, Math.sin(a) * r * 0.5, -6);
    }
  }

  // ================= 3D 碎块 =================
  function debrisBurst(x, y, z, color, n, spd) {
    let count = 0;
    for (let i = 0; i < debris.length && count < n; i++) {
      const d = debris[i];
      if (d.life > 0) continue;
      d.life = d.maxLife = 0.9 + Math.random() * 0.4;
      d.size = 0.7 + Math.random() * 1.4;
      d.m.visible = true;
      d.m.material.color.setHex(color);
      d.m.material.emissive.setHex(color);
      d.m.position.set(x + (Math.random() - 0.5) * 0.7, y + (Math.random() - 0.5) * 0.7, z);
      d.m.scale.setScalar(d.size);
      const a = Math.random() * Math.PI * 2;
      d.vel.set(Math.cos(a) * spd * (0.4 + Math.random() * 0.6),
        Math.random() * spd * 0.95,
        Math.sin(a) * spd * 0.5);
      d.rot.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      count++;
    }
  }

  // ================= 冲击波环 =================
  function ring(x, y, z, color, big) {
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      if (r.life <= 0) {
        r.life = r.maxLife = 0.45;
        r.m.visible = true;
        r.m.material.color.setHex(color);
        r.m.material.opacity = 0.9;
        r.m.position.set(x, y, z + 0.2);
        r.m.scale.setScalar(big ? 1.4 : 0.7);
        return;
      }
    }
  }

  // ================= 更新 =================
  function update(dt, worldSpd) {
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; p.s.material.opacity = 0; continue; }
      p.vel.y += p.grav * dt;
      p.s.position.x += p.vel.x * dt;
      p.s.position.y += p.vel.y * dt;
      p.s.position.z += (p.vel.z + worldSpd) * dt;
      const k = p.life / p.maxLife;
      p.s.material.opacity = k * 0.85;
      const sc = p.size * (0.6 + (1 - k) * 0.9);
      p.s.scale.set(sc, sc, 1);
    }

    for (let i = 0; i < debris.length; i++) {
      const d = debris[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) { d.m.visible = false; continue; }
      d.vel.y -= 22 * dt;
      d.m.position.x += d.vel.x * dt;
      d.m.position.y += d.vel.y * dt;
      d.m.position.z += (d.vel.z + worldSpd) * dt;
      if (d.m.position.y < 0.08) { // 落地反弹
        d.m.position.y = 0.08;
        d.vel.y *= -0.4;
        d.vel.x *= 0.7; d.vel.z *= 0.7;
      }
      d.m.rotation.x += d.rot.x * dt;
      d.m.rotation.y += d.rot.y * dt;
      d.m.rotation.z += d.rot.z * dt;
      const k = Math.min(1, d.life / (d.maxLife * 0.4));
      d.m.scale.setScalar(d.size * k);
    }

    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      if (r.life <= 0) continue;
      r.life -= dt;
      if (r.life <= 0) { r.m.visible = false; r.m.material.opacity = 0; continue; }
      const k = 1 - r.life / r.maxLife;
      r.m.scale.multiplyScalar(1 + dt * 14);
      r.m.material.opacity = 0.9 * (1 - k);
      r.m.position.z += worldSpd * dt;
    }
  }

  return { init, spawn, burst, debris: debrisBurst, ring, update };
})();
