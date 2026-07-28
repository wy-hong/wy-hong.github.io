/* ===== 多主题场景系统 =====
   四大场景：霓虹都市 → 荧光雨林 → 极光雪原 → 落日沙海
   每主题独立：天空渐变 / 雾色 / 地面网格 / 车道霓虹 / 两侧装饰 / 天体 / 氛围粒子
*/
window.NR = window.NR || {};

NR.world = (function () {
  // ================= 主题定义 =================
  const THEMES = {
    city: {
      label: '霓虹都市',
      skyStops: [[0, '#070a24'], [0.4, '#1b1040'], [0.72, '#3b1663'], [1, '#0a0618']],
      fog: 0x14082e, fogNear: 32, fogFar: 150,
      ground: ['#0d1030', 'rgba(56,189,248,.28)', 'rgba(56,189,248,.08)'],
      lane: 0x22d3ee, edge: 0xe879f9, stripe: 0x2b4a8e, stripeOp: 0.55,
      hemi: [0x8a7bff, 0x120a2a, 0.75], dir: [0xbfe9ff, 1.0],
      mountains: 0x12082b, stars: true,
      ambient: { n: 25, color: 0x67e8f9, size: 0.18, mode: 'rise', op: 0.45 }
    },
    rainforest: {
      label: '荧光雨林',
      skyStops: [[0, '#04150d'], [0.4, '#0a2e1c'], [0.72, '#134e2e'], [1, '#071a10']],
      fog: 0x0d2b1a, fogNear: 24, fogFar: 115,
      ground: ['#0a1f14', 'rgba(74,222,128,.25)', 'rgba(74,222,128,.08)'],
      lane: 0x4ade80, edge: 0xfacc15, stripe: 0x14532d, stripeOp: 0.5,
      hemi: [0x86efac, 0x052e14, 0.45], dir: [0xd9f99d, 0.5],
      mountains: 0x0a2417, stars: false,
      ambient: { n: 28, color: 0xd9f99d, size: 0.22, mode: 'firefly', op: 0.55 }
    },
    snow: {
      label: '极光雪原',
      skyStops: [[0, '#060b1f'], [0.4, '#122246'], [0.72, '#1e3a6e'], [1, '#0a1230']],
      fog: 0x101c33, fogNear: 30, fogFar: 140,
      ground: ['#1b2a4a', 'rgba(147,197,253,.32)', 'rgba(147,197,253,.1)'],
      lane: 0x7dd3fc, edge: 0xc4b5fd, stripe: 0x2c3f6e, stripeOp: 0.5,
      hemi: [0x93c5fd, 0x0a1230, 0.45], dir: [0xbfdbfe, 0.55],
      mountains: 0x0e1a33, stars: true,
      ambient: { n: 45, color: 0xffffff, size: 0.2, mode: 'snow', op: 0.6 }
    },
    desert: {
      label: '落日沙海',
      skyStops: [[0, '#1e1040'], [0.45, '#7c2d12'], [0.75, '#ea580c'], [1, '#2a0f08']],
      fog: 0x3a1c10, fogNear: 34, fogFar: 150,
      ground: ['#4a2c12', 'rgba(251,146,60,.3)', 'rgba(251,146,60,.1)'],
      lane: 0xfbbf24, edge: 0xfb923c, stripe: 0x7c4a1e, stripeOp: 0.5,
      hemi: [0xfdba74, 0x2a1005, 0.65], dir: [0xffd0a0, 0.95],
      mountains: 0x2a1308, stars: false,
      ambient: { n: 25, color: 0xfbbf24, size: 0.18, mode: 'sand', op: 0.5 }
    }
  };
  const ORDER = ['city', 'rainforest', 'snow', 'desert'];

  // ================= 模块状态 =================
  let sceneRef = null;
  let current = 'city';
  let hemi, dir, ground, laneMat, edgeMat, stripeMat, mountainMat, stars;
  let auroraTex = null, auroraMat = null;
  const groundTexs = {}, skyTexs = {};
  const themeGroups = {}, themeProps = {};
  const stripes = [], speedLines = [];
  const ambientSprites = [];

  // ================= 共享几何体/材质 =================
  const pillarGeo = new THREE.BoxGeometry(0.45, 1, 0.45);
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 4, 6);
  const canopyGeo = new THREE.ConeGeometry(2.1, 3.6, 7);
  const stemGeo = new THREE.CylinderGeometry(0.09, 0.13, 0.8, 6);
  const capGeo = new THREE.SphereGeometry(0.55, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const iceGeo = new THREE.OctahedronGeometry(0.7, 0);
  const cactusGeo = new THREE.CylinderGeometry(0.3, 0.36, 2.4, 7);
  const cactusArmGeo = new THREE.CylinderGeometry(0.14, 0.14, 1.0, 6);
  const rockGeo = new THREE.DodecahedronGeometry(1.8, 0);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 1 });
  const canopyMatA = new THREE.MeshStandardMaterial({ color: 0x1e7a44, roughness: 0.9, emissive: 0x0d4a26, emissiveIntensity: 0.55 });
  const canopyMatB = new THREE.MeshStandardMaterial({ color: 0x2aa35a, roughness: 0.9, emissive: 0x0d4a26, emissiveIntensity: 0.55 });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0xd9f99d, emissive: 0x3f6212, emissiveIntensity: 0.3, roughness: 0.8 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x0e7490, emissiveIntensity: 0.3, roughness: 0.4 });
  const iceMat = new THREE.MeshStandardMaterial({ color: 0xbfdbfe, transparent: true, opacity: 0.62, emissive: 0x3b82f6, emissiveIntensity: 0.3, roughness: 0.15, metalness: 0.1 });
  const pineMatA = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.9 });
  const pineMatB = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.9 });
  const cactusMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, emissive: 0x052e16, emissiveIntensity: 0.5, roughness: 0.8 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 1 });
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xf1fbe0, fog: false });

  // ================= 装饰工厂 =================
  function makeMushroom() {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(stemGeo, stemMat); stem.position.y = 0.4;
    const cap = new THREE.Mesh(capGeo, capMat); cap.position.y = 0.8; cap.scale.set(1, 0.7, 1);
    const stem2 = new THREE.Mesh(stemGeo, stemMat); stem2.position.set(0.55, 0.26, 0.2); stem2.scale.setScalar(0.65);
    const cap2 = new THREE.Mesh(capGeo, capMat); cap2.position.set(0.55, 0.52, 0.2); cap2.scale.set(0.65, 0.45, 0.65);
    g.add(stem, cap, stem2, cap2);
    return g;
  }
  function makeTree() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.position.y = 2;
    const c1 = new THREE.Mesh(canopyGeo, canopyMatA); c1.position.y = 5.2;
    const c2 = new THREE.Mesh(canopyGeo, canopyMatB); c2.position.y = 7.2; c2.scale.setScalar(0.72);
    g.add(trunk, c1, c2);
    return g;
  }
  function makeIce() {
    const g = new THREE.Group();
    const a = new THREE.Mesh(iceGeo, iceMat); a.position.y = 0.7;
    const b = new THREE.Mesh(iceGeo, iceMat); b.position.set(0.6, 0.42, 0.25); b.scale.setScalar(0.6); b.rotation.y = 0.8;
    const c = new THREE.Mesh(iceGeo, iceMat); c.position.set(-0.5, 0.35, -0.2); c.scale.setScalar(0.45); c.rotation.y = 1.9;
    g.add(a, b, c);
    return g;
  }
  function makePine() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.position.y = 0.8; trunk.scale.set(0.6, 0.4, 0.6);
    const c1 = new THREE.Mesh(canopyGeo, pineMatB); c1.position.y = 2.6;
    const c2 = new THREE.Mesh(canopyGeo, pineMatA); c2.position.y = 4.1; c2.scale.setScalar(0.76);
    const c3 = new THREE.Mesh(canopyGeo, pineMatA); c3.position.y = 5.3; c3.scale.setScalar(0.52);
    g.add(trunk, c1, c2, c3);
    return g;
  }
  function makeCactus() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(cactusGeo, cactusMat); body.position.y = 1.2;
    const arm1 = new THREE.Mesh(cactusArmGeo, cactusMat); arm1.position.set(0.42, 1.55, 0);
    const arm2 = new THREE.Mesh(cactusArmGeo, cactusMat); arm2.position.set(-0.4, 1.1, 0.1); arm2.scale.setScalar(0.75);
    g.add(body, arm1, arm2);
    return g;
  }
  function makeRock() {
    const g = new THREE.Group();
    const r = new THREE.Mesh(rockGeo, rockMat);
    r.scale.set(1.3, 0.6, 1);
    r.position.y = 0.5;
    g.add(r);
    return g;
  }

  // ================= 主题装饰搭建 =================
  function addProp(name, obj, side, far, z, styleFn) {
    obj.userData.side = side;
    obj.userData.far = far;
    obj.userData.restyle = styleFn;
    styleFn(obj);
    obj.position.z = z;
    themeGroups[name].add(obj);
    themeProps[name].push(obj);
  }

  function buildProps(name, g) {
    const rand = Math.random;
    if (name === 'city') {
      const pillarColors = [0x22d3ee, 0xe879f9, 0x8b5cf6, 0xf472b6];
      for (let z = 4; z > -204; z -= 13) {
        [-5.6, 5.6].forEach(x => {
          const mat = new THREE.MeshStandardMaterial({
            color: 0x11142e, emissive: pillarColors[(rand() * 4) | 0], emissiveIntensity: 0.9, roughness: 0.4
          });
          addProp(name, new THREE.Mesh(pillarGeo, mat), Math.sign(x), false, z, p => {
            const h = 2 + rand() * 5;
            p.scale.y = h; p.position.y = h / 2;
            p.position.x = p.userData.side * 5.6;
          });
        });
      }
      const winTexs = [NR.textures.windows(), NR.textures.windows(), NR.textures.windows()];
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 16; i++) {
          const mat = new THREE.MeshStandardMaterial({
            color: 0x05060f, roughness: 0.9,
            emissive: 0xffffff, emissiveMap: winTexs[i % 3], emissiveIntensity: 1.1
          });
          const far = i % 2 === 0;
          addProp(name, new THREE.Mesh(bGeo, mat), side, far, -210 + rand() * 210, p => {
            const w = 3 + rand() * 4, h = 7 + rand() * 16, d = 3 + rand() * 4;
            p.scale.set(w, h, d);
            const xBase = p.userData.far ? 15 + rand() * 8 : 9 + rand() * 4;
            p.position.set(p.userData.side * xBase, h / 2, p.position.z);
          });
        }
      }
    } else if (name === 'rainforest') {
      for (let i = 0; i < 13; i++) {
        [-1, 1].forEach(side => {
          addProp(name, makeMushroom(), side, false, 4 - i * 16 - rand() * 6, p => {
            p.scale.setScalar(1 + rand() * 1.2);
            p.rotation.y = rand() * Math.PI * 2;
            p.position.x = p.userData.side * (4.8 + rand() * 2.2);
          });
        });
      }
      for (let i = 0; i < 10; i++) {
        [-1, 1].forEach(side => {
          addProp(name, makeTree(), side, true, -i * 21 - rand() * 8, p => {
            p.scale.setScalar(1.1 + rand() * 1.5);
            p.rotation.y = rand() * Math.PI * 2;
            p.position.x = p.userData.side * (9 + rand() * 11);
          });
        });
      }
    } else if (name === 'snow') {
      for (let i = 0; i < 13; i++) {
        [-1, 1].forEach(side => {
          addProp(name, makeIce(), side, false, 4 - i * 16 - rand() * 6, p => {
            p.scale.setScalar(0.9 + rand() * 1.1);
            p.rotation.y = rand() * Math.PI * 2;
            p.position.x = p.userData.side * (4.8 + rand() * 2.2);
          });
        });
      }
      for (let i = 0; i < 10; i++) {
        [-1, 1].forEach(side => {
          addProp(name, makePine(), side, true, -i * 21 - rand() * 8, p => {
            p.scale.setScalar(1.1 + rand() * 1.5);
            p.rotation.y = rand() * Math.PI * 2;
            p.position.x = p.userData.side * (9 + rand() * 11);
          });
        });
      }
    } else if (name === 'desert') {
      for (let i = 0; i < 13; i++) {
        [-1, 1].forEach(side => {
          addProp(name, makeCactus(), side, false, 4 - i * 16 - rand() * 6, p => {
            p.scale.setScalar(0.8 + rand() * 1.0);
            p.rotation.y = rand() * Math.PI * 2;
            p.position.x = p.userData.side * (4.8 + rand() * 2.2);
          });
        });
      }
      for (let i = 0; i < 10; i++) {
        [-1, 1].forEach(side => {
          addProp(name, makeRock(), side, true, -i * 21 - rand() * 8, p => {
            p.scale.set(1.4 + rand() * 2, 0.6 + rand() * 0.5, 1 + rand() * 1.2);
            p.rotation.y = rand() * Math.PI * 2;
            p.position.x = p.userData.side * (9 + rand() * 13);
          });
        });
      }
    }
  }

  // ================= 天体 =================
  function buildCelestial(name, g) {
    const glowTex = NR.textures.glow();
    if (name === 'city') {
      const sun = new THREE.Mesh(new THREE.PlaneGeometry(44, 44),
        new THREE.MeshBasicMaterial({ map: NR.textures.sun(), transparent: true, fog: false }));
      sun.position.set(0, 17, -192);
      g.add(sun);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xff5e8a, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, fog: false, depthWrite: false }));
      glow.scale.set(95, 95, 1); glow.position.copy(sun.position);
      g.add(glow);
    } else if (name === 'rainforest') {
      const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 40), moonMat);
      moon.position.set(0, 30, -190);
      g.add(moon);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xa3e635, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, fog: false, depthWrite: false }));
      glow.scale.set(55, 55, 1); glow.position.copy(moon.position);
      g.add(glow);
    } else if (name === 'snow') {
      auroraTex = NR.textures.aurora();
      auroraMat = new THREE.MeshBasicMaterial({
        map: auroraTex, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide, depthWrite: false });
      const aurora = new THREE.Mesh(new THREE.PlaneGeometry(170, 42), auroraMat);
      aurora.position.set(0, 58, -185);
      aurora.rotation.x = -0.15;
      g.add(aurora);
      const moon = new THREE.Mesh(new THREE.CircleGeometry(6, 40), moonMat);
      moon.position.set(24, 34, -190);
      g.add(moon);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xbfdbfe, transparent: true, opacity: 0.4,
        blending: THREE.AdditiveBlending, fog: false, depthWrite: false }));
      glow.scale.set(32, 32, 1); glow.position.copy(moon.position);
      g.add(glow);
    } else if (name === 'desert') {
      const sun = new THREE.Mesh(new THREE.PlaneGeometry(60, 60),
        new THREE.MeshBasicMaterial({ map: NR.textures.sun('#fde68a', '#fb923c', '#dc2626'), transparent: true, fog: false }));
      sun.position.set(0, 12, -194);
      g.add(sun);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xfb923c, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, fog: false, depthWrite: false }));
      glow.scale.set(115, 115, 1); glow.position.copy(sun.position);
      g.add(glow);
    }
  }

  // ================= 氛围粒子 =================
  function initAmbient(scene) {
    const tex = NR.textures.glow();
    for (let i = 0; i < 45; i++) {
      const m = new THREE.SpriteMaterial({
        map: tex, color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const s = new THREE.Sprite(m);
      s.position.set((Math.random() - 0.5) * 28, Math.random() * 8, -45 + Math.random() * 49);
      s.visible = false;
      scene.add(s);
      ambientSprites.push({ s, phase: Math.random() * Math.PI * 2, speed: Math.random() });
    }
  }
  function updateAmbient(dt, envSpeed) {
    const cfg = THEMES[current].ambient;
    const t = performance.now() * 0.001;
    for (let i = 0; i < ambientSprites.length; i++) {
      const p = ambientSprites[i];
      if (i >= cfg.n) { p.s.visible = false; continue; }
      p.s.visible = true;
      const pos = p.s.position;
      if (cfg.mode === 'rise') {
        pos.y += 0.5 * dt;
        pos.x += Math.sin(t + p.phase) * 0.3 * dt;
        if (pos.y > 8) pos.y = 0.2;
      } else if (cfg.mode === 'firefly') {
        pos.x += Math.sin(t * 0.7 + p.phase) * 0.9 * dt;
        pos.y += Math.cos(t * 0.9 + p.phase * 1.3) * 0.6 * dt;
        pos.y = Math.max(0.4, Math.min(6, pos.y));
        p.s.material.opacity = cfg.op * (0.35 + 0.65 * Math.abs(Math.sin(t * 2.2 + p.phase)));
      } else if (cfg.mode === 'snow') {
        pos.y -= (1.0 + p.speed) * dt;
        pos.x += Math.sin(t * 1.4 + p.phase) * 0.6 * dt;
        if (pos.y < 0) { pos.y = 8 + Math.random() * 2; pos.x = (Math.random() - 0.5) * 28; }
      } else if (cfg.mode === 'sand') {
        pos.x += (5 + p.speed * 3) * dt;
        pos.y += Math.sin(t * 2 + p.phase) * 0.3 * dt;
        if (pos.x > 14) pos.x = -14;
      }
      pos.z += envSpeed * 0.55 * dt;
      if (pos.z > 5) pos.z -= 50;
    }
  }

  // ================= 主题应用 =================
  function applyTheme(name) {
    current = name;
    const t = THEMES[name];
    sceneRef.background = skyTexs[name];
    sceneRef.fog.color.setHex(t.fog);
    sceneRef.fog.near = t.fogNear;
    sceneRef.fog.far = t.fogFar;
    ground.material.map = groundTexs[name];
    ground.material.needsUpdate = true;
    laneMat.color.setHex(t.lane);
    edgeMat.color.setHex(t.edge);
    stripeMat.color.setHex(t.stripe);
    stripeMat.opacity = t.stripeOp;
    hemi.color.setHex(t.hemi[0]);
    hemi.groundColor.setHex(t.hemi[1]);
    hemi.intensity = t.hemi[2];
    dir.color.setHex(t.dir[0]);
    dir.intensity = t.dir[1];
    mountainMat.color.setHex(t.mountains);
    stars.visible = t.stars;
    ORDER.forEach(n => { themeGroups[n].visible = (n === name); });
    ambientSprites.forEach(p => {
      p.s.material.color.setHex(t.ambient.color);
      p.s.material.opacity = t.ambient.op;
      p.s.scale.set(t.ambient.size, t.ambient.size, 1);
    });
  }

  // ================= 搭建 =================
  function build(scene) {
    sceneRef = scene;

    ORDER.forEach(name => {
      skyTexs[name] = NR.textures.sky(THEMES[name].skyStops);
      groundTexs[name] = NR.textures.grid.apply(null, THEMES[name].ground);
    });
    scene.background = skyTexs.city;
    scene.fog = new THREE.Fog(THEMES.city.fog, THEMES.city.fogNear, THEMES.city.fogFar);

    // 灯光
    hemi = new THREE.HemisphereLight(0x8a7bff, 0x120a2a, 0.75);
    scene.add(hemi);
    dir = new THREE.DirectionalLight(0xbfe9ff, 1.0);
    dir.position.set(8, 16, 6);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -14; dir.shadow.camera.right = 14;
    dir.shadow.camera.top = 14; dir.shadow.camera.bottom = -30;
    dir.shadow.camera.far = 60;
    dir.target.position.set(0, 0, -10);
    scene.add(dir, dir.target);

    // 地面
    ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 320),
      new THREE.MeshStandardMaterial({ color: 0xffffff, map: groundTexs.city, roughness: 0.85, metalness: 0.15 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -120;
    ground.receiveShadow = true;
    scene.add(ground);

    // 车道分隔条 / 赛道边缘（共享材质，随主题变色）
    laneMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    [-1.1, 1.1].forEach(x => {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 320), laneMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(x, 0.01, -120);
      scene.add(strip);
    });
    edgeMat = new THREE.MeshBasicMaterial({ color: 0xe879f9 });
    [-3.35, 3.35].forEach(x => {
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 320), edgeMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(x, 0.012, -120);
      scene.add(edge);
    });

    // 移动横条纹
    stripeMat = new THREE.MeshBasicMaterial({ color: 0x2b4a8e, transparent: true, opacity: 0.55 });
    const stripeGeo = new THREE.PlaneGeometry(6.7, 0.1);
    for (let z = 6; z > -206; z -= 4) {
      const s = new THREE.Mesh(stripeGeo, stripeMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(0, 0.014, z);
      scene.add(s);
      stripes.push(s);
    }

    // 远山剪影
    mountainMat = new THREE.MeshBasicMaterial({ color: 0x12082b });
    const mGeo = new THREE.ConeGeometry(1, 1, 5);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(mGeo, mountainMat);
      const s = 18 + Math.random() * 22;
      m.scale.set(s, s * (0.5 + Math.random() * 0.5), s);
      m.position.set((Math.random() - 0.5) * 160, 0, -150 - Math.random() * 40);
      scene.add(m);
    }

    // 星星
    const starCount = 340;
    const pos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 320;
      pos[i * 3 + 1] = 14 + Math.random() * 95;
      pos[i * 3 + 2] = -40 - Math.random() * 170;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xcfe8ff, size: 0.55, sizeAttenuation: true, fog: false
    }));
    scene.add(stars);

    // 高速速度线
    const slGeo = new THREE.BoxGeometry(0.035, 0.035, 6);
    const slMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.35 });
    for (let i = 0; i < 16; i++) {
      const l = new THREE.Mesh(slGeo, slMat);
      resetSpeedLine(l);
      l.visible = false;
      scene.add(l);
      speedLines.push(l);
    }

    // 各主题组（天体 + 两侧装饰）
    ORDER.forEach(name => {
      const g = new THREE.Group();
      g.visible = name === 'city';
      scene.add(g);
      themeGroups[name] = g;
      themeProps[name] = [];
      buildCelestial(name, g);
      buildProps(name, g);
    });

    initAmbient(scene);
    applyTheme('city');
  }

  function resetSpeedLine(l) {
    l.position.set((Math.random() < 0.5 ? -1 : 1) * (2.5 + Math.random() * 6.5),
      0.5 + Math.random() * 5.5, -60 + Math.random() * 60);
  }

  // ================= 滚动更新 =================
  function scroll(dt, envSpeed, showSpeedLines) {
    groundTexs[current].offset.y += (envSpeed * dt / 320) * 52;
    stripes.forEach(s => { s.position.z += envSpeed * dt; if (s.position.z > 8) s.position.z -= 212; });

    const props = themeProps[current];
    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      p.position.z += envSpeed * dt;
      if (p.position.z > 12) {
        p.position.z -= 215;
        p.userData.restyle(p);
      }
    }

    speedLines.forEach(l => {
      l.visible = showSpeedLines;
      if (!showSpeedLines) return;
      l.position.z += envSpeed * 2.4 * dt;
      if (l.position.z > 9) resetSpeedLine(l);
    });

    updateAmbient(dt, envSpeed);

    if (current === 'snow' && auroraTex) {
      auroraTex.offset.x += dt * 0.02;
      auroraMat.opacity = 0.34 + Math.sin(performance.now() * 0.0011) * 0.1;
    }
  }

  // ================= 对外接口 =================
  return {
    build, scroll,
    setTheme: applyTheme,
    nextTheme() {
      const idx = (ORDER.indexOf(current) + 1) % ORDER.length;
      applyTheme(ORDER[idx]);
      return THEMES[ORDER[idx]].label;
    },
    /* 预告下一场景（用于转场渐变着色） */
    peekNext() {
      const idx = (ORDER.indexOf(current) + 1) % ORDER.length;
      const t = THEMES[ORDER[idx]];
      return { label: t.label, css: '#' + t.fog.toString(16).padStart(6, '0') };
    },
    currentName() { return current; },
    label() { return THEMES[current].label; }
  };
})();
