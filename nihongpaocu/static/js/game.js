/* ===== 主逻辑：玩家控制 / 道具系统 / 碰撞 / UI / 主循环 ===== */
(function () {
  const C = NR.CONF;

  // ---------- 渲染核心 ----------
  let scene, camera, renderer, composer, clock;

  // ---------- 玩家 ----------
  let player, legL, legR, armL, armR, torso, head, shieldMesh;
  let bodyMat, visorMat;
  let lane = 0, playerY = 0, vy = 0, onGround = true;
  let sliding = false, slideT = 0, squashT = 0;
  let jumpsUsed = 0, flipping = false, flipProg = 0; // 二段跳与前空翻

  // ---------- 游戏状态 ----------
  let speed = C.BASE_SPEED, score = 0, dist = 0, coinCount = 0, best = 0;
  let state = 'start'; // start | countdown | playing | paused | over
  let distSinceSpawn = 0, spawnInterval = 26;
  let shakeT = 0, runTime = 0, dustT = 0;
  let streak = 0, streakT = 0;
  let nextMilestone = C.MILESTONE;
  const SCENE_AT = [2000, 5000, 8000]; // 场景切换分数点
  let sceneIdx = 0;
  let cdT = 0, cdStep = 0;
  let warpT = 0;              // 场景跃迁过渡计时
  let hitStopT = 0;           // 击中停顿（慢动作）
  let maxSpeedReached = false;

  // ---------- 道具状态 ----------
  let hasShield = false, magnetT = 0, rageT = 0; // 护盾为持有型：必定抵挡一次死亡

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const scoreEl = $('score'), coinsEl = $('coins'), distEl = $('dist'), speedEl = $('speed-val');
  const comboEl = $('combo'), bannerEl = $('banner'), cdEl = $('countdown'), fxEl = $('fx');
  const puShield = $('pu-shield'), puMagnet = $('pu-magnet'), puRage = $('pu-rage');

  best = NR.store.get('best', 0);
  let currentSkin = NR.store.get('skin', 'cyan');

  // ================= 初始化 =================
  function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 400);
    camera.position.set(0, 3.4, 6.8);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    $('game-container').appendChild(renderer.domElement);

    // 辉光后期（失败自动降级）
    try {
      if (THREE.EffectComposer && THREE.UnrealBloomPass) {
        composer = new THREE.EffectComposer(renderer);
        composer.addPass(new THREE.RenderPass(scene, camera));
        composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.55, 0.3));
      }
    } catch (e) { composer = null; }

    NR.world.build(scene);
    NR.particles.init(scene);
    NR.spawner.init(scene);
    buildPlayer();
    applySkin(currentSkin);
    bindInput();
    bindMenus();
    updateMuteBtn();

    clock = new THREE.Clock();
    animate();
  }

  // ================= 玩家 =================
  function buildPlayer() {
    player = new THREE.Group();
    bodyMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.3 });
    visorMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x0f172a, emissiveIntensity: 0.4, roughness: 0.6 });

    const legGeo = new THREE.BoxGeometry(0.2, 0.52, 0.26);
    legGeo.translate(0, -0.26, 0);
    legL = new THREE.Mesh(legGeo, darkMat); legL.position.set(-0.17, 0.52, 0);
    legR = new THREE.Mesh(legGeo, darkMat); legR.position.set(0.17, 0.52, 0);

    const armGeo = new THREE.BoxGeometry(0.15, 0.48, 0.2);
    armGeo.translate(0, -0.24, 0);
    armL = new THREE.Mesh(armGeo, darkMat); armL.position.set(-0.44, 1.1, 0);
    armR = new THREE.Mesh(armGeo, darkMat); armR.position.set(0.44, 1.1, 0);

    torso = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.64, 0.42), bodyMat);
    torso.position.y = 0.84;
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), visorMat);
    core.position.set(0, 0.06, 0.215);
    torso.add(core);

    head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.42, 0.42), bodyMat);
    head.position.y = 1.4;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.05), visorMat);
    visor.position.set(0, 0.02, 0.22);
    head.add(visor);

    // 护盾外壳（默认隐藏）
    shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    shieldMesh.position.y = 0.85;
    shieldMesh.visible = false;
    player.add(shieldMesh);

    [legL, legR, armL, armR, torso, head].forEach(m => { m.castShadow = true; player.add(m); });
    scene.add(player);
  }

  function applySkin(id) {
    const s = NR.SKINS.find(k => k.id === id) || NR.SKINS[0];
    currentSkin = s.id;
    bodyMat.color.setHex(s.body);
    bodyMat.emissive.setHex(s.emissive);
    visorMat.color.setHex(s.visor);
    NR.store.set('skin', s.id);
  }

  // ================= UI 反馈 =================
  function popText(text, cls) {
    const el = document.createElement('div');
    el.className = 'pop-text ' + cls;
    el.textContent = text;
    el.style.left = (44 + Math.random() * 12) + '%';
    el.style.top = (42 + Math.random() * 10) + '%';
    fxEl.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
  function showBanner(text) {
    bannerEl.textContent = text;
    bannerEl.classList.remove('show');
    void bannerEl.offsetWidth;
    bannerEl.classList.add('show');
  }
  function showCd(text) {
    cdEl.textContent = text;
    cdEl.classList.remove('pop');
    void cdEl.offsetWidth;
    cdEl.classList.add('pop');
  }
  function switchScene() {
    // 跃迁转场：光带加速 + FOV 拉伸 → 雾色遮盖峰值时切换 → 淡出揭示
    const peek = NR.world.peekNext();
    const el = $('scene-flash');
    el.style.background = 'radial-gradient(ellipse at center, rgba(255,255,255,.22) 0%, ' + peek.css + ' 75%)';
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
    const wl = $('warp-lines');
    wl.classList.remove('go');
    void wl.offsetWidth;
    wl.classList.add('go');
    warpT = 1.6;
    NR.audio.warp();
    setTimeout(() => {
      const name = NR.world.nextTheme();
      NR.spawner.setTheme(NR.world.currentName());
      $('scene-name').textContent = name;
      showBanner('进入 · ' + name);
      NR.achieve.bump('scene');
      shakeT = Math.max(shakeT, 0.15);
    }, 720); // 不透明度峰值时刻切换
  }
  function pulseHud(id) {
    const el = $(id);
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  }
  function updateCombo() {
    if (streak >= 3) {
      comboEl.textContent = 'COMBO ×' + Math.min(5, 1 + Math.floor(streak / 5)) + ' · ' + streak;
      comboEl.classList.remove('show');
      void comboEl.offsetWidth;
      comboEl.classList.add('show');
    } else {
      comboEl.classList.remove('show');
    }
  }
  function updateHUD() {
    scoreEl.textContent = Math.floor(score);
    coinsEl.textContent = coinCount;
    distEl.textContent = Math.floor(dist);
    speedEl.textContent = speed.toFixed(0);
    $('speed-max').style.display = speed >= C.MAX_SPEED - 0.01 ? 'inline-block' : 'none';
  }
  function updatePowerupUI() {
    const mOn = magnetT > 0, rOn = rageT > 0;
    puShield.classList.toggle('active', hasShield);
    puMagnet.classList.toggle('active', mOn);
    puRage.classList.toggle('active', rOn);
    if (hasShield) {
      puShield.querySelector('.pu-time').textContent = '×1'; // 持有型护盾，无倒计时
      puShield.classList.remove('low');
    }
    if (mOn) {
      puMagnet.querySelector('.pu-time').textContent = Math.ceil(magnetT);
      puMagnet.classList.toggle('low', magnetT < 2);
    }
    if (rOn) {
      puRage.querySelector('.pu-time').textContent = Math.ceil(rageT);
      puRage.classList.toggle('low', rageT < 5);
    }
  }
  function updateMuteBtn() {
    $('btn-mute').textContent = NR.audio.isMuted() ? 'SOUND · OFF' : 'SOUND · ON';
  }

  // ================= 排行榜 & 皮肤界面 =================
  function renderRank() {
    const list = NR.rank.list();
    const box = $('rank-list');
    if (!list.length) {
      box.innerHTML = '<div class="rank-empty">暂无记录，快来跑一局吧！</div>';
      return;
    }
    box.innerHTML = list.map((r, i) =>
      '<div class="rank-row' + (i === 0 ? ' first' : '') + '">' +
      '<span class="no">' + (i + 1) + '</span>' +
      '<span class="sc">' + r.score + '</span>' +
      '<span>' + r.coins + ' 币 · ' + r.dist + ' m</span>' +
      '<span class="dt">' + r.date + '</span></div>'
    ).join('');
  }
  function renderSkins() {
    $('skin-list').innerHTML = NR.SKINS.map(s =>
      '<div class="skin-card' + (s.id === currentSkin ? ' selected' : '') + '" data-skin="' + s.id + '">' +
      '<div class="skin-ball" style="background: radial-gradient(circle at 32% 30%, #ffffff88, ' + s.css + ' 55%); box-shadow: 0 0 18px ' + s.css + '88;"></div>' +
      '<div class="skin-name">' + s.name + '</div>' +
      '<div class="skin-tag">使用中</div></div>'
    ).join('');
    document.querySelectorAll('.skin-card').forEach(card => {
      card.addEventListener('click', () => {
        applySkin(card.dataset.skin);
        renderSkins();
        NR.audio.powerup();
      });
    });
  }

  // ================= 成就界面与提示 =================
  function renderAch() {
    $('ach-list').innerHTML = NR.achieve.list().map(a =>
      '<div class="ach-card' + (a.times === 0 ? ' locked' : '') + '">' +
      '<div class="ach-icon">' + a.icon + '</div>' +
      '<div class="ach-name">' + a.name + '</div>' +
      '<div class="ach-desc">' + a.desc + '</div>' +
      '<div class="ach-times">达成 ×' + a.times + ' <span>(' + a.count + '/' + a.target + ')</span></div>' +
      '<div class="ach-prog"><i style="width:' + Math.round(a.prog * 100) + '%"></i></div></div>'
    ).join('');
  }
  function showAchToast(def, times) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = def.icon + ' 成就达成 · <b>' + def.name + '</b> ×' + times;
    $('ach-toast').appendChild(el);
    setTimeout(() => el.remove(), 2900);
    NR.audio.milestone();
  }
  NR.achieve.onToast(showAchToast);

  // ================= 排行榜清空 =================
  let rankArmed = false, rankArmT = null;
  function disarmRankBtn() {
    rankArmed = false;
    clearTimeout(rankArmT);
    const b = $('btn-rank-clear');
    b.textContent = '清空排行榜';
    b.classList.remove('armed');
  }

  function bindMenus() {
    $('btn-start').addEventListener('click', startGame);
    $('btn-restart').addEventListener('click', startGame);
    $('btn-menu').addEventListener('click', () => {
      $('overlay-over').classList.add('hidden');
      $('overlay-start').classList.remove('hidden');
      state = 'start';
      NR.audio.setState('start');
    });
    const openRank = () => { renderRank(); disarmRankBtn(); $('overlay-rank').classList.remove('hidden'); };
    $('btn-rank').addEventListener('click', openRank);
    $('btn-rank2').addEventListener('click', openRank);
    $('btn-rank-close').addEventListener('click', () => $('overlay-rank').classList.add('hidden'));
    $('btn-rank-clear').addEventListener('click', () => {
      if (!rankArmed) {
        rankArmed = true;
        const b = $('btn-rank-clear');
        b.textContent = '确认清空？';
        b.classList.add('armed');
        rankArmT = setTimeout(disarmRankBtn, 2500);
      } else {
        NR.rank.clear();
        renderRank();
        disarmRankBtn();
      }
    });
    const openAch = () => { renderAch(); $('overlay-ach').classList.remove('hidden'); };
    $('btn-ach').addEventListener('click', openAch);
    $('btn-ach-close').addEventListener('click', () => $('overlay-ach').classList.add('hidden'));
    $('btn-skin').addEventListener('click', () => { renderSkins(); $('overlay-skin').classList.remove('hidden'); });
    $('btn-skin-close').addEventListener('click', () => $('overlay-skin').classList.add('hidden'));
    $('btn-mute').addEventListener('click', () => { NR.audio.toggleMute(); updateMuteBtn(); });
  }

  // ================= 输入 =================
  function canControl() { return state === 'playing' || state === 'countdown'; }
  function moveLane(dir) {
    if (!canControl()) return;
    const nl = Math.max(-1, Math.min(1, lane + dir));
    if (nl !== lane) { lane = nl; NR.audio.lane(); }
  }
  function jump() {
    if (!canControl()) return;
    if (onGround) performJump(false);
    else if (jumpsUsed < 2) performJump(true); // 二段跳
  }
  function performJump(isDouble) {
    jumpsUsed++;
    vy = isDouble ? C.JUMP_V * 0.92 : C.JUMP_V;
    onGround = false;
    sliding = false;
    if (isDouble) {
      flipping = true; flipProg = 0;
      NR.particles.burst(player.position.x, playerY + 0.6, 0.3, 0xe879f9, 10, 3);
      NR.audio.jump2();
      NR.achieve.bump('djump');
    } else {
      NR.particles.burst(player.position.x, playerY + 0.2, 0.3, 0x67e8f9, 6, 2.5);
      NR.audio.jump();
    }
  }
  function slide() {
    if (!canControl()) return;
    if (!onGround) { vy = Math.min(vy, -20); return; }
    if (!sliding) { sliding = true; slideT = 0.62; NR.audio.slide(); }
  }
  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      NR.audio.setState('paused');
      $('overlay-pause').classList.remove('hidden');
    } else if (state === 'paused') {
      state = 'playing';
      NR.audio.setState('playing');
      $('overlay-pause').classList.add('hidden');
      clock.getDelta();
    }
  }

  function bindInput() {
    addEventListener('keydown', e => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
      if (e.code === 'KeyM') { NR.audio.toggleMute(); updateMuteBtn(); return; }
      if (e.code === 'KeyP' || e.code === 'Escape') return togglePause();
      if ((state === 'start' || state === 'over') && (e.code === 'Space' || e.code === 'Enter')) return startGame();
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': moveLane(-1); break;
        case 'ArrowRight': case 'KeyD': moveLane(1); break;
        case 'ArrowUp': case 'KeyW': case 'Space': jump(); break;
        case 'ArrowDown': case 'KeyS': slide(); break;
      }
    });

    let tsX = 0, tsY = 0;
    addEventListener('touchstart', e => {
      tsX = e.touches[0].clientX; tsY = e.touches[0].clientY;
    }, { passive: true });
    addEventListener('touchend', e => {
      if (!canControl()) return;
      const dx = e.changedTouches[0].clientX - tsX;
      const dy = e.changedTouches[0].clientY - tsY;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) { jump(); return; }
      if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1);
      else dy < 0 ? jump() : slide();
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state === 'playing') togglePause();
    });

    addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
      if (composer) composer.setSize(innerWidth, innerHeight);
    });
  }

  // ================= 游戏流程 =================
  function startGame() {
    NR.audio.unlock();
    NR.spawner.clearAll();

    lane = 0; playerY = 0; vy = 0; onGround = true;
    sliding = false; squashT = 0;
    jumpsUsed = 0; flipping = false; flipProg = 0;
    player.scale.set(1, 1, 1); player.rotation.set(0, 0, 0);
    player.position.set(0, 0, 0);
    speed = C.BASE_SPEED; score = 0; dist = 0; coinCount = 0; runTime = 0;
    streak = 0; streakT = 0; nextMilestone = C.MILESTONE;
    sceneIdx = 0;
    distSinceSpawn = 0; spawnInterval = 26; shakeT = 0;
    maxSpeedReached = false; warpT = 0; hitStopT = 0;
    hasShield = false; magnetT = 0; rageT = 0;
    shieldMesh.visible = false;
    NR.world.setTheme('city');
    NR.spawner.setTheme('city');
    $('scene-name').textContent = NR.world.label();

    $('overlay-start').classList.add('hidden');
    $('overlay-over').classList.add('hidden');
    $('overlay-pause').classList.add('hidden');
    $('overlay-rank').classList.add('hidden');
    $('overlay-skin').classList.add('hidden');
    $('overlay-ach').classList.add('hidden');
    comboEl.classList.remove('show');
    updateHUD();
    updatePowerupUI();

    state = 'countdown';
    NR.audio.setState('countdown');
    cdT = 0; cdStep = 0;
    showCd('3');
    NR.audio.count();
    NR.audio.startMusic();
  }

  function gameOver() {
    state = 'over';
    NR.audio.setState('over');
    NR.audio.crash();
    shakeT = 0.8;
    hitStopT = 0.15;
    NR.particles.debris(player.position.x, 1, 0, 0x22d3ee, 10, 5);
    NR.particles.ring(player.position.x, 1, 0, 0xfb7185, true);
    for (let i = 0; i < 3; i++) {
      NR.particles.spawn(player.position.x, 1, 0, 0xffffff, 1.6 + Math.random(), 0.35, 0, 0, 0, 0);
    }
    NR.particles.burst(player.position.x, 1, 0, 0xfb7185, 30, 6.5);
    NR.particles.burst(player.position.x, 1, 0, 0xfde047, 18, 5);

    const finalScore = Math.floor(score);
    const isRecord = finalScore > best;
    if (isRecord) { best = finalScore; NR.store.set('best', best); }
    NR.rank.add(finalScore, Math.floor(dist), coinCount);
    if (isRecord) NR.achieve.bump('record');
    if (dist >= 1000) NR.achieve.bump('marathon');
    if (maxSpeedReached) NR.achieve.bump('maxspeed');

    $('final-score').textContent = finalScore;
    $('final-dist').textContent = Math.floor(dist);
    $('final-coins').textContent = coinCount;
    $('best-score').textContent = best;
    $('new-record').style.display = isRecord ? 'block' : 'none';
    setTimeout(() => $('overlay-over').classList.remove('hidden'), 700);
  }

  // ================= 道具逻辑 =================
  function activatePowerup(kind) {
    NR.audio.powerup();
    NR.achieve.bump('power');
    if (kind === 'shield') {
      hasShield = true;
      popText('护盾 · 抵挡一次!', 'cyan');
      showBanner('SHIELD ON');
    } else if (kind === 'rage') {
      rageT = C.RAGE_TIME;
      popText('无敌 30 秒!', 'pink');
      showBanner('INVINCIBLE!');
      shakeT = Math.max(shakeT, 0.2);
    } else {
      magnetT = C.MAGNET_TIME;
      popText('磁铁激活!', 'pink');
      showBanner('COIN MAGNET');
    }
    updatePowerupUI();
  }

  /* 撞碎障碍：本体 3D 碎块 + 冲击波双环 + 闪光 + 三层粒子 + 击中停顿 + 强震屏 */
  function explodeObstacle(o, color, bonus) {
    const p = o.mesh.position;
    const midY = (o.bottom + o.top) / 2;
    // 障碍本体颜色的 3D 碎块飞溅
    let baseColor = color;
    try { baseColor = (o.body || o.mesh).material.color.getHex(); } catch (e) {}
    NR.particles.debris(p.x, midY, p.z, baseColor, 12, 6);
    // 冲击波双环
    NR.particles.ring(p.x, midY, p.z, color, true);
    NR.particles.ring(p.x, midY, p.z, 0xffffff, false);
    // 中心白色闪光
    for (let i = 0; i < 4; i++) {
      NR.particles.spawn(p.x, midY, p.z, 0xffffff, 1.6 + Math.random() * 1.2, 0.35, 0, 0, 0, 0);
    }
    // 三层爆炸碎片
    NR.particles.burst(p.x, midY, p.z, color, 34, 7.5);
    NR.particles.burst(p.x, midY, p.z, 0xfde047, 18, 5.5);
    NR.particles.burst(p.x, midY, p.z, 0xffffff, 10, 3);
    NR.audio.boom();
    hitStopT = 0.09; // 击中停顿
    shakeT = Math.max(shakeT, 0.65);
    score += bonus;
    popText('粉碎 +' + bonus, 'gold');
    NR.spawner.removeObstacle(o);
  }

  function breakShield() {
    hasShield = false;
    NR.audio.shieldBreak();
    NR.achieve.bump('shield');
    NR.particles.burst(player.position.x, 1, 0, 0x67e8f9, 18, 4);
    popText('护盾抵挡!', 'cyan');
    shakeT = Math.max(shakeT, 0.45);
    updatePowerupUI();
  }

  // ================= 主循环 =================
  function animate() {
    requestAnimationFrame(animate);
    const rawDt = Math.min(clock.getDelta(), 0.05);
    if (hitStopT > 0) hitStopT -= rawDt;
    const dt = hitStopT > 0 ? rawDt * 0.1 : rawDt; // 击中瞬间时间近乎冻结

    // ---------- 倒计时 ----------
    if (state === 'countdown') {
      cdT += dt;
      if (cdT >= 0.75) {
        cdT = 0; cdStep++;
        if (cdStep === 1) { showCd('2'); NR.audio.count(); }
        else if (cdStep === 2) { showCd('1'); NR.audio.count(); }
        else if (cdStep === 3) { showCd('GO!'); NR.audio.go(); }
        else { cdEl.classList.remove('pop'); state = 'playing'; NR.audio.setState('playing'); }
      }
    }

    // ---------- 游玩逻辑 ----------
    if (state === 'playing') {
      runTime += dt;
      speed = Math.min(C.MAX_SPEED, speed + dt * C.SPEED_RAMP);
      score += speed * dt;
      dist += speed * dt;
      NR.audio.setSpeed(speed); // BGM 随速度自适应
      if (speed >= C.MAX_SPEED) maxSpeedReached = true;

      // 道具计时（护盾为持有型不计时；无敌红色 15s）
      if (magnetT > 0) { magnetT -= dt; updatePowerupUI(); }
      if (rageT > 0) { rageT -= dt; updatePowerupUI(); }
      if (hasShield || rageT > 0) {
        shieldMesh.visible = true;
        shieldMesh.material.color.setHex(rageT > 0 ? 0xef4444 : 0x67e8f9);
        shieldMesh.material.opacity = 0.14 + Math.sin(runTime * 6) * 0.06;
        shieldMesh.rotation.y += dt * 1.5;
      } else {
        shieldMesh.visible = false;
      }

      // 连击窗口
      if (streakT > 0) {
        streakT -= dt;
        if (streakT <= 0) { streak = 0; updateCombo(); }
      }

      // 里程碑
      if (score >= nextMilestone) {
        nextMilestone += C.MILESTONE;
        showBanner('SPEED UP!');
        NR.audio.milestone();
      }

      // 固定分数点切换场景（2000 / 5000 / 8000）
      if (sceneIdx < SCENE_AT.length && score >= SCENE_AT[sceneIdx]) {
        sceneIdx++;
        switchScene();
      }

      // --- 玩家水平 ---
      const targetX = C.LANES[lane + 1];
      const px = player.position.x;
      player.position.x += (targetX - px) * Math.min(1, dt * 11);
      player.rotation.z = (targetX - px) * -0.14;

      // --- 地面支撑高度（高台） ---
      const groundY = NR.spawner.groundHeightAt(player.position.x);

      // --- 跳跃/重力/二段跳 ---
      if (!onGround) {
        vy += C.GRAV * dt;
        playerY += vy * dt;
        if (flipping) {
          // 二段跳前空翻
          flipProg += dt / 0.55;
          player.rotation.x = -Math.min(flipProg, 1) * Math.PI * 2;
          if (flipProg >= 1) { flipping = false; player.rotation.x = 0; }
          legL.rotation.x = -0.9; legR.rotation.x = 0.6;
        } else {
          player.rotation.x = THREE.MathUtils.lerp(player.rotation.x, vy > 0 ? -0.25 : 0.18, dt * 8);
          legL.rotation.x = -0.5; legR.rotation.x = 0.35;
        }
        if (vy > 0) NR.particles.spawn(player.position.x, playerY + 0.3, 0.4, 0x67e8f9, 0.22, 0.3, 0, -1, 1.5, 0);
        if (vy <= 0 && playerY <= groundY) {
          // 落地（地面或高台台面）
          playerY = groundY; vy = 0; onGround = true; jumpsUsed = 0;
          flipping = false; player.rotation.x = 0;
          squashT = 0.12;
          NR.particles.burst(player.position.x, playerY + 0.1, 0.3, 0x9fb3e8, 8, 2);
        }
      } else if (playerY > groundY + 0.01) {
        // 走出高台边缘，开始下落（保留一次空中跳）
        onGround = false; vy = 0;
        jumpsUsed = Math.max(jumpsUsed, 1);
      } else {
        playerY = groundY;
        const sw = Math.sin(runTime * 13);
        legL.rotation.x = sw * 0.85;
        legR.rotation.x = -sw * 0.85;
        armL.rotation.x = -sw * 0.7;
        armR.rotation.x = sw * 0.7;
        torso.position.y = 0.84 + Math.abs(Math.cos(runTime * 13)) * 0.045;
        head.position.y = 1.4 + Math.abs(Math.cos(runTime * 13)) * 0.05;
        dustT += dt;
        if (dustT > 0.09) {
          dustT = 0;
          NR.particles.spawn(player.position.x + (Math.random() - 0.5) * 0.3, playerY + 0.08, 0.45,
            sliding ? 0xe879f9 : 0x4c5f9e, 0.28, 0.5,
            (Math.random() - 0.5) * 0.8, 0.6 + Math.random(), 1.5, -1.5);
        }
      }
      player.position.y = playerY;

      // --- 滑铲 & 落地压缩 ---
      let targetScaleY = 1;
      if (sliding) {
        slideT -= dt;
        targetScaleY = C.SLIDE_H / C.STAND_H;
        if (slideT <= 0) sliding = false;
      } else if (squashT > 0) {
        squashT -= dt;
        targetScaleY = 0.78;
      }
      player.scale.y = THREE.MathUtils.lerp(player.scale.y, targetScaleY, dt * 16);
      const curH = C.STAND_H * player.scale.y;

      // --- 生成 ---
      distSinceSpawn += speed * dt;
      if (distSinceSpawn >= spawnInterval) {
        distSinceSpawn = 0;
        const extra = NR.spawner.spawnRow(speed) || 0;
        spawnInterval = Math.max(13, 24 - speed * 0.28) + Math.random() * 5 + extra;
      }

      // --- 障碍 ---
      const obs = NR.spawner.obstacles;
      for (let i = obs.length - 1; i >= 0; i--) {
        const o = obs[i];
        const prevZ = o.mesh.position.z;
        o.mesh.position.z += speed * dt;
        const oz = o.mesh.position.z;

        if (o.pulse) o.mesh.material.emissiveIntensity = 0.55 + Math.sin(runTime * 9 + i) * 0.3;
        if (o.mesh.userData.sign) o.mesh.userData.sign.position.y = 2.1 + Math.sin(runTime * 6 + i) * 0.12;
        // 移动高墙左右滑动
        if (o.type === 'mover') {
          o.mesh.position.x = o.baseX + Math.sin(runTime * o.freq + o.phase) * o.amp;
        }

        if (oz - o.halfD > 9) { NR.spawner.removeObstacle(o); obs.splice(i, 1); continue; }

        // 擦身而过（高台不参与）
        if (!o.walkable && !o.passed && prevZ < 1.2 && oz >= 1.2) {
          o.passed = true;
          const lat = Math.abs(o.mesh.position.x - player.position.x);
          const pB = playerY, pT = playerY + curH;
          if (lat > o.halfW + C.PLAYER_HW && lat < o.halfW + 1.4 && pB < o.top && pT > o.bottom) {
            score += 5; NR.audio.near();
            popText('擦身而过 +5', 'cyan');
            NR.achieve.bump('near');
          }
        }

        // 碰撞（护盾可抵挡一次；站在高台台面上安全）
        if (Math.abs(oz) < o.halfD + C.PLAYER_HD &&
            Math.abs(o.mesh.position.x - player.position.x) < o.halfW + C.PLAYER_HW) {
          const pBottom = playerY, pTop = playerY + curH;
          const onTop = o.walkable && pBottom >= o.top - 0.2;
          if (!onTop && pBottom < o.top && pTop > o.bottom) {
            // 开发者无敌模式（NR.dev 不存在时自动跳过，发布版不受影响）
            if (typeof NR.dev !== 'undefined' && NR.dev.invincible) {
              NR.particles.burst(player.position.x, 1, 0, 0x67e8f9, 10, 3.5);
              NR.audio.shieldBreak();
              shakeT = Math.max(shakeT, 0.15);
              NR.spawner.removeObstacle(o);
              obs.splice(i, 1);
              continue;
            }
            if (rageT > 0) {
              // 红色无敌：粉碎障碍 +30
              explodeObstacle(o, 0xef4444, C.RAGE_BONUS);
              obs.splice(i, 1);
              continue;
            }
            if (hasShield) {
              // 蓝色护盾：必定抵挡一次死亡并粉碎 +15
              breakShield();
              explodeObstacle(o, 0x67e8f9, C.SHIELD_BONUS);
              obs.splice(i, 1);
              continue;
            }
            gameOver(); break;
          }
        }
      }

      // --- 金币（磁铁吸附） ---
      const cns = NR.spawner.coins;
      for (let i = cns.length - 1; i >= 0; i--) {
        const c = cns[i];
        c.mesh.position.z += speed * dt;
        c.mesh.rotation.y += dt * 4.5;

        // 磁铁吸引（拉力随速度缩放，高速也能追上角色）
        if (magnetT > 0) {
          const dx = player.position.x - c.mesh.position.x;
          const dy = (playerY + 0.9) - c.mesh.position.y;
          const dz = 0 - c.mesh.position.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < C.MAGNET_RANGE && d > 0.01) {
            const pull = (1 - d / C.MAGNET_RANGE) * (speed * 1.5 + 12) * dt;
            c.mesh.position.x += dx / d * pull;
            c.mesh.position.y += dy / d * pull;
            c.mesh.position.z += dz / d * pull;
          }
        }

        const cz = c.mesh.position.z;
        if (cz > 9) { scene.remove(c.mesh); cns.splice(i, 1); continue; }
        const catchZ = magnetT > 0 ? 1.0 : 0.7;
        const catchX = magnetT > 0 ? 0.95 : 0.75;
        if (Math.abs(cz) < catchZ &&
            Math.abs(c.mesh.position.x - player.position.x) < catchX &&
            c.mesh.position.y > playerY - 0.4 && c.mesh.position.y < playerY + curH + 0.45) {
          const cm = c.mesh;
          NR.particles.burst(cm.position.x, cm.position.y, cm.position.z, 0xfde047, 8, 2.5);
          scene.remove(cm); cns.splice(i, 1);
          coinCount++;
          NR.achieve.bump('coins');
          streak++; streakT = C.STREAK_WINDOW;
          const mult = Math.min(5, 1 + Math.floor(streak / 5));
          score += 10 * mult;
          NR.audio.coin();
          pulseHud('coin-box');
          updateCombo();
          if (mult > 1) popText('+' + (10 * mult), 'gold');
        }
      }

      // --- 道具拾取 ---
      const pus = NR.spawner.powerups;
      for (let i = pus.length - 1; i >= 0; i--) {
        const p = pus[i];
        p.mesh.position.z += speed * dt;
        p.mesh.rotation.y += dt * 2.5;
        p.mesh.position.y = p.baseY + Math.sin(runTime * 4 + i) * 0.15;
        const pz = p.mesh.position.z;
        if (pz > 9) { scene.remove(p.mesh); pus.splice(i, 1); continue; }
        if (Math.abs(pz) < 0.9 &&
            Math.abs(p.mesh.position.x - player.position.x) < 0.9 &&
            p.mesh.position.y > playerY - 0.5 && p.mesh.position.y < playerY + curH + 0.6) {
          NR.particles.burst(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z,
            p.kind === 'shield' ? 0x67e8f9 : 0xf472b6, 12, 3);
          activatePowerup(p.kind);
          scene.remove(p.mesh); pus.splice(i, 1);
        }
      }

      updateHUD();
    } else if (state === 'over') {
      player.rotation.x += dt * 6;
      player.position.y = Math.max(-0.4, player.position.y - dt * 2);
    } else if (state === 'countdown') {
      runTime += dt;
      const sw = Math.sin(runTime * 13);
      legL.rotation.x = sw * 0.85;
      legR.rotation.x = -sw * 0.85;
      armL.rotation.x = -sw * 0.7;
      armR.rotation.x = sw * 0.7;
      const targetX = C.LANES[lane + 1];
      player.position.x += (targetX - player.position.x) * Math.min(1, dt * 11);
      if (!onGround) {
        vy += C.GRAV * dt; playerY += vy * dt;
        if (playerY <= 0) { playerY = 0; vy = 0; onGround = true; }
        player.position.y = playerY;
      }
    }

    // ---------- 环境滚动 ----------
    const envSpeed = (state === 'playing') ? speed
      : (state === 'countdown') ? C.BASE_SPEED
      : (state === 'start') ? 4
      : (state === 'paused') ? 0 : speed * 0.25;

    if (state !== 'paused') {
      NR.world.scroll(dt, envSpeed, (state === 'playing' && speed > 19) || warpT > 0);
      NR.particles.update(dt, envSpeed);
    }

    // ---------- 相机 ----------
    const shakeX = shakeT > 0 ? (Math.random() - 0.5) * shakeT * 1.7 : 0;
    const shakeY = shakeT > 0 ? (Math.random() - 0.5) * shakeT * 1.7 : 0;
    if (shakeT > 0) shakeT -= dt;

    if (state === 'start') {
      const t = performance.now() * 0.0004;
      camera.position.x = Math.sin(t) * 1.6;
      camera.position.y = 3.6 + Math.sin(t * 1.7) * 0.25;
      camera.lookAt(0, 1.4, -12);
    } else {
      camera.position.x = player.position.x * 0.35 + shakeX;
      camera.position.y = 3.4 + playerY * 0.18 + shakeY;
      camera.lookAt(player.position.x * 0.5, 1.3 + playerY * 0.3, -10);
    }
    // 跃迁期间 FOV 冲击拉伸
    let warpBoost = 0;
    if (warpT > 0) {
      warpT -= dt;
      warpBoost = Math.sin(Math.max(0, warpT) / 1.6 * Math.PI) * 22;
    }
    const targetFov = 68 + Math.max(0, speed - C.BASE_SPEED) * 0.55 * (state === 'playing' ? 1 : 0) + warpBoost;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
    camera.updateProjectionMatrix();

    if (composer) composer.render();
    else renderer.render(scene, camera);
  }

  init();
})();
