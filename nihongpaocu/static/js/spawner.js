/* ===== 生成器：多样化障碍物 / 金币 / 道具 / 高台 =====
   障碍类型：barrier 矮栏 | overhead 悬空板 | block 高墙
             wide 双宽 | mover 移动高墙 | platform 高台
   障碍外观随场景主题切换（都市/雨林/雪原/沙漠）
*/
window.NR = window.NR || {};

NR.spawner = (function () {
  const C = NR.CONF;

  // ---- 共享几何体 ----
  const geoBarrier = new THREE.BoxGeometry(1.7, 0.55, 0.4);
  const geoWideBarrier = new THREE.BoxGeometry(3.9, 0.55, 0.4);
  const geoOverhead = new THREE.BoxGeometry(1.9, 0.7, 0.55);
  const geoWideOverhead = new THREE.BoxGeometry(3.9, 0.7, 0.55);
  const geoBlock = new THREE.BoxGeometry(1.9, 2.4, 0.9);
  const geoPlatform = new THREE.BoxGeometry(1.9, 1.15, 1);
  const geoTrim = new THREE.BoxGeometry(0.12, 0.08, 1);
  const geoChev = new THREE.PlaneGeometry(1.5, 2.2);
  const geoCoin = new THREE.TorusGeometry(0.3, 0.12, 10, 20);
  const geoPowerup = new THREE.OctahedronGeometry(0.42, 0);

  const postGeo = new THREE.BoxGeometry(0.09, 0.55, 0.09);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
  const geoBlockEdges = new THREE.EdgesGeometry(geoBlock);
  const edgeLineMat = new THREE.LineBasicMaterial({ color: 0xff9a9a });
  const moverEdgeMat = new THREE.LineBasicMaterial({ color: 0xc7d2fe });
  const warnMat = new THREE.SpriteMaterial({ map: NR.textures.warn(), transparent: true, depthWrite: false });
  const shieldIconMat = new THREE.SpriteMaterial({ map: NR.textures.shieldIcon(), transparent: true, depthWrite: false });
  const magnetIconMat = new THREE.SpriteMaterial({ map: NR.textures.magnetIcon(), transparent: true, depthWrite: false });
  const rageIconMat = new THREE.SpriteMaterial({ map: NR.textures.rageIcon(), transparent: true, depthWrite: false });
  const chevMat = new THREE.MeshBasicMaterial({ map: NR.textures.chevron(), transparent: true, opacity: 0.9 });
  const matCoin = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xa16207, emissiveIntensity: 0.8, metalness: 0.8, roughness: 0.25 });
  const matShield = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x0e7490, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.5 });
  const matMagnet = new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0x9d174d, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.5 });
  const matRage = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 1.4, roughness: 0.3, metalness: 0.5 });

  // ---- 主题化障碍材质 ----
  const std = o => new THREE.MeshStandardMaterial(o);
  const basic = c => new THREE.MeshBasicMaterial({ color: c });
  const MAT_SETS = {
    city: {
      barrier: std({ map: NR.textures.hazard(), emissive: 0xc2410c, emissiveIntensity: 0.55, roughness: 0.4 }),
      overhead: std({ color: 0xa855f7, emissive: 0x7e22ce, emissiveIntensity: 0.6, roughness: 0.4 }),
      block: std({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.55, roughness: 0.4 }),
      mover: std({ color: 0x818cf8, emissive: 0x4338ca, emissiveIntensity: 0.75, roughness: 0.4 }),
      platform: std({ color: 0x18234d, emissive: 0x0e2a6e, emissiveIntensity: 0.5, roughness: 0.5, metalness: 0.4 }),
      trim: basic(0x22d3ee),
      edgeLine: 0xff9a9a, moverEdge: 0xc7d2fe
    },
    rainforest: {
      barrier: std({ map: NR.textures.wood(), emissive: 0x3f2d1e, emissiveIntensity: 0.25, roughness: 0.7 }),
      overhead: std({ map: NR.textures.vine(), emissive: 0x14532d, emissiveIntensity: 0.4, roughness: 0.6 }),
      block: std({ map: NR.textures.wood(), color: 0xd6b08a, emissive: 0x2a1c0e, emissiveIntensity: 0.3, roughness: 0.8 }),
      mover: std({ color: 0x65a30d, emissive: 0x365314, emissiveIntensity: 0.5, roughness: 0.6 }),
      platform: std({ map: NR.textures.wood(), emissive: 0x2a1c0e, emissiveIntensity: 0.3, roughness: 0.7 }),
      trim: basic(0xfacc15),
      edgeLine: 0xfde68a, moverEdge: 0xd9f99d
    },
    snow: {
      barrier: std({ color: 0xdbeafe, emissive: 0x3b82f6, emissiveIntensity: 0.3, roughness: 0.2, metalness: 0.1 }),
      overhead: std({ color: 0x93c5fd, transparent: true, opacity: 0.85, emissive: 0x1d4ed8, emissiveIntensity: 0.35, roughness: 0.2 }),
      block: std({ color: 0xe2e8f0, emissive: 0x64748b, emissiveIntensity: 0.22, roughness: 0.6 }),
      mover: std({ color: 0x7dd3fc, emissive: 0x0e7490, emissiveIntensity: 0.5, roughness: 0.3 }),
      platform: std({ color: 0x2c3f6e, emissive: 0x1e3a8a, emissiveIntensity: 0.4, roughness: 0.4 }),
      trim: basic(0xbfdbfe),
      edgeLine: 0x60a5fa, moverEdge: 0xe0f2fe
    },
    desert: {
      barrier: std({ map: NR.textures.sandstone(), emissive: 0x7c2d12, emissiveIntensity: 0.4, roughness: 0.7 }),
      overhead: std({ color: 0xd6a05a, emissive: 0x92400e, emissiveIntensity: 0.5, roughness: 0.6 }),
      block: std({ color: 0xb45309, emissive: 0x7c2d12, emissiveIntensity: 0.5, roughness: 0.7 }),
      mover: std({ color: 0xf59e0b, emissive: 0xb45309, emissiveIntensity: 0.7, roughness: 0.5 }),
      platform: std({ map: NR.textures.sandstone(), emissive: 0x7c2d12, emissiveIntensity: 0.45, roughness: 0.7 }),
      trim: basic(0xfbbf24),
      edgeLine: 0xfcd34d, moverEdge: 0xfef3c7
    }
  };
  let mats = MAT_SETS.city;

  let sceneRef = null;
  const obstacles = [], coins = [], powerups = [];

  function init(scene) { sceneRef = scene; }

  /* 主题切换：后续生成用新材质，场上现存障碍同步换装 */
  function setTheme(name) {
    mats = MAT_SETS[name] || MAT_SETS.city;
    edgeLineMat.color.setHex(mats.edgeLine);
    moverEdgeMat.color.setHex(mats.moverEdge);
    obstacles.forEach(o => {
      const isBarrier = o.type === 'barrier' || (o.type === 'wide' && o.kind === 'barrier');
      const isOverhead = o.type === 'overhead' || (o.type === 'wide' && o.kind === 'overhead');
      if (isBarrier) o.mesh.material = mats.barrier;
      else if (isOverhead) { o.mesh.material.dispose(); o.mesh.material = mats.overhead.clone(); }
      else if (o.type === 'block') o.mesh.material = mats.block;
      else if (o.type === 'mover') o.mesh.material = mats.mover;
      else if (o.type === 'platform') {
        o.body.material = mats.platform;
        o.trims.forEach(t => { t.material = mats.trim; });
      }
    });
  }

  // ---- 基础三型 ----
  function addObstacle(type, laneIdx, z) {
    let mesh, halfW, halfD, bottom, top, pulse = false;
    if (type === 'barrier') {
      mesh = new THREE.Mesh(geoBarrier, mats.barrier);
      mesh.position.set(C.LANES[laneIdx], 0.275, z);
      halfW = 0.85; halfD = 0.2; bottom = 0; top = 0.55;
      [-0.75, 0.75].forEach(px => {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(px, 0, 0);
        mesh.add(post);
      });
    } else if (type === 'overhead') {
      mesh = new THREE.Mesh(geoOverhead, mats.overhead.clone());
      mesh.position.set(C.LANES[laneIdx], 1.35, z);
      halfW = 0.95; halfD = 0.275; bottom = 1.0; top = 1.7; pulse = true;
    } else {
      mesh = new THREE.Mesh(geoBlock, mats.block);
      mesh.position.set(C.LANES[laneIdx], 1.2, z);
      halfW = 0.95; halfD = 0.45; bottom = 0; top = 2.4;
      mesh.add(new THREE.LineSegments(geoBlockEdges, edgeLineMat));
      const sign = new THREE.Sprite(warnMat);
      sign.scale.set(0.7, 0.7, 1);
      sign.position.set(0, 2.1, 0);
      mesh.add(sign);
      mesh.userData.sign = sign;
    }
    mesh.castShadow = true;
    sceneRef.add(mesh);
    obstacles.push({ mesh, halfW, halfD, bottom, top, passed: false, type, kind: type, pulse, walkable: false });
  }

  // ---- 双宽障碍（占两车道） ----
  function addWide(kind, pairIdx, z) {
    const cx = pairIdx === 0 ? -1.1 : 1.1;
    let mesh, bottom, top, pulse = false;
    if (kind === 'barrier') {
      mesh = new THREE.Mesh(geoWideBarrier, mats.barrier);
      mesh.position.set(cx, 0.275, z);
      bottom = 0; top = 0.55;
      [-1.8, 0, 1.8].forEach(px => {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(px, 0, 0);
        mesh.add(post);
      });
    } else {
      mesh = new THREE.Mesh(geoWideOverhead, mats.overhead.clone());
      mesh.position.set(cx, 1.35, z);
      bottom = 1.0; top = 1.7; pulse = true;
    }
    mesh.castShadow = true;
    sceneRef.add(mesh);
    obstacles.push({
      mesh, halfW: 1.95, halfD: kind === 'barrier' ? 0.2 : 0.275,
      bottom, top, passed: false, type: 'wide', kind, pulse, walkable: false
    });
  }

  // ---- 移动高墙 ----
  function addMover(z, speed) {
    const mesh = new THREE.Mesh(geoBlock, mats.mover);
    mesh.position.set(0, 1.2, z);
    mesh.add(new THREE.LineSegments(geoBlockEdges, moverEdgeMat));
    const sign = new THREE.Sprite(warnMat);
    sign.scale.set(0.7, 0.7, 1);
    sign.position.set(0, 2.1, 0);
    mesh.add(sign);
    mesh.userData.sign = sign;
    mesh.castShadow = true;
    sceneRef.add(mesh);
    obstacles.push({
      mesh, halfW: 0.95, halfD: 0.45, bottom: 0, top: 2.4,
      passed: false, type: 'mover', kind: 'mover', pulse: false, walkable: false,
      baseX: 0, amp: 2.2, phase: Math.random() * Math.PI * 2,
      freq: 1.1 + (speed || 13) * 0.035
    });
  }

  // ---- 高台 ----
  function addPlatform(laneIdx, z, len) {
    const halfD = len / 2;
    const group = new THREE.Group();
    group.position.set(C.LANES[laneIdx], 0, z - halfD);

    const body = new THREE.Mesh(geoPlatform, mats.platform);
    body.scale.z = len;
    body.position.y = 0.575;
    body.castShadow = true;
    group.add(body);

    const trims = [];
    [-0.96, 0.96].forEach(ox => {
      const trim = new THREE.Mesh(geoTrim, mats.trim);
      trim.scale.z = len;
      trim.position.set(ox, 1.17, 0);
      group.add(trim);
      trims.push(trim);
    });

    const n = Math.max(2, Math.floor(len / 2.8));
    for (let i = 0; i < n; i++) {
      const chev = new THREE.Mesh(geoChev, chevMat);
      chev.rotation.x = -Math.PI / 2;
      chev.position.set(0, 1.158, -halfD + 1.6 + i * 2.8);
      group.add(chev);
    }

    sceneRef.add(group);
    obstacles.push({
      mesh: group, body, trims, halfW: 0.95, halfD, bottom: 0, top: 1.15,
      passed: false, type: 'platform', kind: 'platform', pulse: false, walkable: true
    });

    const cx = C.LANES[laneIdx];
    const cn = Math.max(2, Math.floor(len / 2.6));
    for (let i = 0; i < cn; i++) {
      addCoin(cx, 1.75, (z - halfD) - halfD + 1.4 + i * 2.6);
    }
  }

  // ---- 金币 ----
  function addCoin(x, y, z) {
    const mesh = new THREE.Mesh(geoCoin, matCoin);
    mesh.position.set(x, y, z);
    sceneRef.add(mesh);
    coins.push({ mesh });
  }
  function coinArc(laneIdx, z) {
    for (let i = 0; i < 4; i++) {
      const dz = (i - 1.5) * 1.1;
      addCoin(C.LANES[laneIdx], 1.5 + Math.sin((i / 3) * Math.PI) * 0.55, z + dz);
    }
  }
  function coinTrail(laneIdx, z, n) {
    for (let i = 0; i < n; i++) addCoin(C.LANES[laneIdx], 0.95, z - i * 2.4);
  }

  // ---- 道具（护盾/磁铁/红色无敌） ----
  const PU_MATS = { shield: matShield, magnet: matMagnet, rage: matRage };
  const PU_ICONS = { shield: shieldIconMat, magnet: magnetIconMat, rage: rageIconMat };
  function addPowerup(kind, laneIdx, z) {
    const mesh = new THREE.Mesh(geoPowerup, PU_MATS[kind] || matShield);
    mesh.position.set(C.LANES[laneIdx], 1.0, z);
    const icon = new THREE.Sprite(PU_ICONS[kind] || shieldIconMat);
    icon.scale.set(0.55, 0.55, 1);
    icon.position.y = 0.85;
    mesh.add(icon);
    sceneRef.add(mesh);
    powerups.push({ mesh, kind, baseY: 1.0 });
  }
  function maybePowerup(z) {
    if (Math.random() < C.POWERUP_CHANCE) {
      const r = Math.random();
      // 红色无敌为稀有道具，刷新率显著更低
      const kind = r < 0.12 ? 'rage' : (r < 0.56 ? 'shield' : 'magnet');
      addPowerup(kind, (Math.random() * 3) | 0, z);
    }
  }

  // ---- 行生成分派 ----
  function spawnRow(speed) {
    const z = -150;
    const r = Math.random();

    if (r < 0.13) {
      coinTrail((Math.random() * 3) | 0, z, 5);
      maybePowerup(z - 14);
      return 0;
    }
    if (r < 0.27) {
      const len = 12 + Math.random() * 10;
      addPlatform((Math.random() * 3) | 0, z, len);
      maybePowerup(z - 6);
      return len + 8;
    }
    if (r < 0.38) {
      addMover(z, speed);
      coinTrail((Math.random() * 3) | 0, z - 3, 4);
      return 4;
    }
    if (r < 0.50) {
      const pair = (Math.random() * 2) | 0;
      addWide(Math.random() < 0.5 ? 'barrier' : 'overhead', pair, z);
      coinTrail(pair === 0 ? 2 : 0, z - 2, 4);
      return 2;
    }
    if (r < 0.60) {
      const li = (Math.random() * 3) | 0;
      addObstacle('barrier', li, z);
      addObstacle('barrier', li, z - 5.5);
      coinArc(li, z); coinArc(li, z - 5.5);
      return 8;
    }

    const types = ['barrier', 'overhead', 'block'];
    const pick = () => types[(Math.random() * 3) | 0];
    const laneIdxs = [0, 1, 2].sort(() => Math.random() - 0.5);
    const fillCount = Math.random() < 0.55 ? 1 : 2;
    const used = laneIdxs.slice(0, fillCount);

    let hasBarrier = false;
    used.forEach(li => {
      const t = pick();
      addObstacle(t, li, z);
      if (t === 'barrier') { hasBarrier = true; coinArc(li, z); }
    });
    if (!hasBarrier && Math.random() < 0.5) {
      const free = [0, 1, 2].filter(i => !used.includes(i));
      coinTrail(free[(Math.random() * free.length) | 0], z - 2, 4);
    }
    maybePowerup(z - 6);
    return 0;
  }

  // ---- 高台支撑高度 ----
  function groundHeightAt(x) {
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (!o.walkable) continue;
      if (Math.abs(o.mesh.position.z) <= o.halfD + 0.05 &&
          Math.abs(o.mesh.position.x - x) <= 0.85) {
        return o.top;
      }
    }
    return 0;
  }

  // ---- 清理 ----
  function removeObstacle(o) {
    if (o.pulse) o.mesh.material.dispose();
    sceneRef.remove(o.mesh);
  }
  function clearAll() {
    obstacles.forEach(o => removeObstacle(o));
    coins.forEach(c => sceneRef.remove(c.mesh));
    powerups.forEach(p => sceneRef.remove(p.mesh));
    obstacles.length = 0; coins.length = 0; powerups.length = 0;
  }

  return {
    init, spawnRow, clearAll, removeObstacle, groundHeightAt, setTheme,
    obstacles, coins, powerups
  };
})();
