// ============================================================
// 怪物模块 monster.js
// 多只怪物数组 ｜ 波次刷怪 ｜ 平台 AI + 梯子
// ============================================================

const monsters = []; // 所有活着的怪物
const monsterProjectiles = []; // 怪物远攻弹道 { x, y, vx, vy, damage, radius, time }

// ---- 怪物精灵图片（已是透明底，直接使用）----
const sprMonster = new Image();
let sprMonsterReady = false;
let sprMonsterWhite = null;   // 白色剪影（受击闪白用）
let sprMonsterFrozen = null;  // 冰冻蓝化版（色相旋转，保留透明）
sprMonster.onload = () => {
  try {
    sprMonsterReady = true;
    sprMonsterWhite = makeSilhouette(sprMonster, '#ffffff');
    sprMonsterFrozen = makeFrozenVariant(sprMonster);
  } catch (_) {
    // 生成变体失败时，白影/冰冻状态降级使用原图
    sprMonsterWhite = sprMonster;
    sprMonsterFrozen = sprMonster;
  }
};
sprMonster.onerror = () => { sprMonsterReady = false; };
sprMonster.src = 'images/monster-mushroom.png';

// ---- 跑动动画帧（run1→run4 循环）----
const _monsterRunFrames = [];       // [Image, Image, Image, Image]
let _monsterRunLoaded = 0;
for (let i = 1; i <= 4; i++) {
  const img = new Image();
  img.onload = () => { _monsterRunLoaded++; };
  img.onerror = () => {};      // 静默忽略加载失败，动画降级使用站姿
  img.src = `images/mushroom/run${i}.png`;
  _monsterRunFrames.push(img);
}

/** 生成冰冻版精灵：色相转蓝 + 冷色罩染，保留透明底 */
function makeFrozenVariant(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const cc = c.getContext('2d');
  // 怪物主色调红/粉(hue~350°)，+220° → 蓝色(~210°)
  if ('filter' in cc) {
    cc.filter = 'hue-rotate(215deg) saturate(1.3) brightness(1.1)';
  }
  cc.drawImage(img, 0, 0);
  cc.filter = 'none';
  // 冷色罩染（只在精灵形状内）
  cc.globalCompositeOperation = 'source-atop';
  cc.fillStyle = 'rgba(120, 190, 255, 0.35)';
  cc.fillRect(0, 0, c.width, c.height);
  return c;
}

// ---- 刷怪系统 ----

let _totalSpawned = 0;       // 已刷总数
let _spawnTimer = 0;         // 上次刷怪时间
let _spawnInitialDone = false;

function resetSpawner() {
  _totalSpawned = 0;
  _spawnTimer = 0;
  _spawnInitialDone = false;
  monsterProjectiles.length = 0;
}

// 上次刷怪位置（避免连续刷同一角落）
let _lastSpawnX = null;
let _lastSpawnLevel = null;

// 找一个远离玩家的位置
function findSpawnPos(player) {
  const px = player.x + player.size / 2;
  const margin = 60;
  const maxX = MAP_W - CONFIG.MONSTER_SIZE - margin;
  const minX = margin;
  const inset = CONFIG.FOOT_INSET || 0;
  const minDist = 400; // 离玩家至少 400px

  const candidates = [];
  for (let attempt = 0; attempt < 25; attempt++) {
    const tx = minX + Math.random() * (maxX - minX);
    // 层级：如果上次刷了上层，这次更可能刷下层（避免连续同层刷在相同区域）
    let upperBias = 0.5;
    if (_lastSpawnLevel === 'upper') upperBias = 0.35;
    if (_lastSpawnLevel === 'lower') upperBias = 0.65;
    const upper = Math.random() < upperBias;
    const ty = upper
      ? CONFIG.UPPER_GROUND_Y - CONFIG.MONSTER_SIZE + inset
      : CONFIG.LOWER_GROUND_Y - CONFIG.MONSTER_SIZE + inset;
    const dist = Math.abs(tx - px);
    if (dist < minDist) continue; // 太近，跳过
    // 避免和上次刷怪点太近（200px 内）
    if (_lastSpawnX !== null && Math.abs(tx - _lastSpawnX) < 200) continue;
    candidates.push({ x: tx, y: ty, dist, upper });
  }

  // 如果所有候选都被过滤了（极少情况），放宽距离限制
  if (candidates.length === 0) {
    const tx = minX + Math.random() * (maxX - minX);
    const upper = Math.random() < 0.5;
    const ty = upper
      ? CONFIG.UPPER_GROUND_Y - CONFIG.MONSTER_SIZE + inset
      : CONFIG.LOWER_GROUND_Y - CONFIG.MONSTER_SIZE + inset;
    _lastSpawnX = tx;
    _lastSpawnLevel = upper ? 'upper' : 'lower';
    return { x: tx, y: ty };
  }

  // 从候选中随机选一个（不是选最远的，增加随机性）
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  _lastSpawnX = pick.x;
  _lastSpawnLevel = pick.upper ? 'upper' : 'lower';
  return { x: pick.x, y: pick.y };
}

function createMonster(x, y) {
  const hpBonus = (player.level - 1) * 40;
  return {
    x: x,
    y: y,
    size: CONFIG.MONSTER_SIZE,
    hp: CONFIG.MONSTER_MAX_HP + hpBonus,
    maxHp: CONFIG.MONSTER_MAX_HP + hpBonus,
    alive: true,
    vy: 0,
    isOnGround: false,
    facingRight: true, // 怪物原图朝右
    _hurtFlash: 0,
    _knockbackVx: 0,
    _knockbackTime: 0,
    onLadder: false,
    _climbing: false,
    _ladderTarget: null,
    _ladderTargetSetAt: 0,
    _lastBasic: 0,
    _lastSkill: 0,
    _lastUlt: 0,
    _casting: 0,
    _ultCasting: false,
    _ultExplodeAt: 0,
    _ultTargetX: 0,
    _ultTargetY: 0,
    // 跑动动画
    _prevX: x,
    _animFrame: 0,
    _animTimer: 0,
  };
}

function spawnInitialMonsters(player) {
  const initialCount = (typeof endlessMode !== 'undefined' && endlessMode)
    ? CONFIG.ENDLESS_INITIAL_MONSTERS
    : CONFIG.INITIAL_MONSTERS;
  for (let i = 0; i < initialCount; i++) {
    if (!endlessMode && _totalSpawned >= CONFIG.TOTAL_MONSTERS) break;
    const pos = findSpawnPos(player);
    monsters.push(createMonster(pos.x, pos.y));
    _totalSpawned++;
  }
  _spawnInitialDone = true;
  _spawnTimer = Date.now();
}

function trySpawnWave(player) {
  if (!_spawnInitialDone) {
    spawnInitialMonsters(player);
    return;
  }

  // ---- 无尽模式：根据击杀数逐步加速刷怪 ----
  // 初始 10s；杀 4 只后 4s；杀 8 只后 5s 一次刷两只
  if (typeof endlessMode !== 'undefined' && endlessMode) {
    let interval = CONFIG.ENDLESS_SPAWN_INTERVAL; // 15000
    let spawnCount = 1;
    const k = (typeof killCount !== 'undefined') ? killCount : 0;
    if (k >= 8) { interval = 5000; spawnCount = 2; }
    else if (k >= 4) { interval = 4000; }

    const aliveCount = monsters.filter(m => m.alive).length;
    // 场上只剩 ≤1 只或时间到就刷
    if (aliveCount <= 1 || Date.now() - _spawnTimer >= interval) {
      for (let i = 0; i < spawnCount; i++) {
        const pos = findSpawnPos(player);
        monsters.push(createMonster(pos.x, pos.y));
        _totalSpawned++;
      }
      _spawnTimer = Date.now();
    }
    return;
  }

  if (_totalSpawned >= CONFIG.TOTAL_MONSTERS) return;

  // 场上还有多只活着的怪 → 等计时器；只剩 1 只时提前刷
  const aliveCount = monsters.filter(m => m.alive).length;
  if (aliveCount > 1 && Date.now() - _spawnTimer < CONFIG.SPAWN_INTERVAL) return;

  // 没有活着的怪（提前打完了）或计时已到 → 立刻刷
  const pos = findSpawnPos(player);
  monsters.push(createMonster(pos.x, pos.y));
  _totalSpawned++;
  _spawnTimer = Date.now();
}

// ---- 单只 AI ----

/** 按怪物所在层平台边缘钳制 x 坐标，防止走出可见平台 */
function clampMonsterToPlatform(m) {
  // 有梯子目标时不钳制，让怪物自由走到梯子位置
  if (m._ladderTarget) return;
  const level = getEntityLevel(m, m.size);
  const plat = PLATFORMS.find(p => p.level === level);
  if (!plat) {
    m.x = Math.max(0, Math.min(MAP_W - m.size, m.x));
    return;
  }
  const margin = CONFIG.PLATFORM_EDGE_MARGIN || 40;
  m.x = Math.max(plat.x + margin, Math.min(plat.x + plat.w - margin - m.size, m.x));
}

/** 钳制怪物 x 在地图范围内，防止被打出地图边界 */
function clampToViewport(m) {
  const margin = 0;
  const left = margin;
  const right = MAP_W - margin - m.size;
  m.x = Math.max(left, Math.min(right, m.x));
}

function updateSingleMonsterAI(m, player) {
  if (!m.alive || player.hp <= 0) return;

  // 记录本帧开始时的位置，供 drawMonster 判断跑动动画
  m._prevX = m.x;

  const now = Date.now();

  // ---- 冰冻检查（冰锥效果，冻结期间不能动也不能攻击，但可以被击退） ----
  if (now < (m._frozenUntil || 0)) {
    // 击退处理（冰冻中仍可被普攻打飞）
    if (now < m._knockbackTime) {
      m.x += m._knockbackVx;
      m._knockbackVx *= 0.82;
      clampMonsterToPlatform(m);
      clampToViewport(m);
    }
    // 重力
    if (!m.onLadder) {
      m.vy += CONFIG.GRAVITY;
      if (m.vy > 20) m.vy = 20;
      m.y += m.vy;
      m.isOnGround = false;
      const landed = tryLandOnPlatform(m, m.size);
      if (landed) { m.isOnGround = true; }
    }
    if (m.y > MAP_H + 20) {
      m.y = CONFIG.LOWER_GROUND_Y - m.size + (CONFIG.FOOT_INSET || 0);
      m.vy = 0;
    }
    // 硬地板：下层地面不可穿透
    if (m.y + m.size >= CONFIG.LOWER_GROUND_Y && m.vy >= 0) {
      m.y = CONFIG.LOWER_GROUND_Y - m.size + (CONFIG.FOOT_INSET || 0);
      m.vy = 0;
      m.isOnGround = true;
    }
    return;
  }

  // ---- 击退处理 ----
  if (now < m._knockbackTime) {
    m.x += m._knockbackVx;
    m._knockbackVx *= 0.82;
    clampMonsterToPlatform(m);
    clampToViewport(m);
    m.onLadder = false;
    m._ladderTarget = null;
    m._ladderTargetSetAt = 0;

    m.vy += CONFIG.GRAVITY;
    if (m.vy > 20) m.vy = 20;
    m.y += m.vy;
    m.isOnGround = false;
    const landed = tryLandOnPlatform(m, m.size);
    if (landed) { m.isOnGround = true; }
    if (m.y > MAP_H + 20) {
      m.y = CONFIG.LOWER_GROUND_Y - m.size + (CONFIG.FOOT_INSET || 0);
      m.vy = 0;
    }
    // 硬地板：下层地面不可穿透
    if (m.y + m.size >= CONFIG.LOWER_GROUND_Y && m.vy >= 0) {
      m.y = CONFIG.LOWER_GROUND_Y - m.size + (CONFIG.FOOT_INSET || 0);
      m.vy = 0;
      m.isOnGround = true;
    }
    return;
  } else {
    m._knockbackVx = 0;
  }

  const px = player.x + player.size / 2;
  const py = player.y + player.size / 2;
  const mx = m.x + m.size / 2;
  const my = m.y + m.size / 2;
  const dx = px - mx;
  const dy = py - my;

  // ---- 蓄力发射处理（暗影弹）----
  if (m._skillCharging && now - m._skillChargeStart >= 800) {
    m._skillCharging = false;
    const d = Math.hypot(m._skillTargetX - mx, m._skillTargetY - my) || 1;
    monsterProjectiles.push({
      x: mx, y: my,
      vx: (m._skillTargetX - mx) / d * 1.5,
      vy: (m._skillTargetY - my) / d * 1.5,
      damage: MONSTER_SKILLS.skill.damage,
      radius: 14,
      time: now,
    });
    fxScreen.push({
      skill: 'ms', frame: 0, totalFrames: 1,
      worldX: mx, worldY: my,
      w: 36, h: 36,
      time: now, duration: 400, dir: 0,
    });
  }


  const playerLevel = getEntityLevel(player, player.size);
  const monsterLevel = getEntityLevel(m, m.size);
  const ladder = isOnLadder(m, m.size);

  // ---- 梯子逻辑 ----
  // 梯子冷却：刚下梯子 1 秒内不再爬梯，但可以正常移动
  const inLadderCooldown = now < (m._ladderCooldown || 0);
  if (inLadderCooldown) {
    m._ladderTarget = null;
    m._ladderTargetSetAt = 0;
    m.onLadder = false;
    m._climbing = false;
  }

  // 跟主控不同层就无脑爬梯子追过去（已在爬梯子时不重新判断层级，防止中途"换层"导致放弃攀爬）
  const needClimb = !inLadderCooldown && (playerLevel !== monsterLevel || m._climbing);
  if (needClimb) {
    const inset = CONFIG.FOOT_INSET || 0;
    if (playerLevel === 'upper') {
      const targetY = CONFIG.UPPER_GROUND_Y - m.size + inset;
      if (ladder) {
        // 在梯子上 → 往上爬，不需要任何条件判断
        m._ladderTarget = ladder;
        m._ladderTargetSetAt = now;
        m.y -= CONFIG.CLIMB_SPEED;
        m.vy = 0;
        m.onLadder = true;
        m._climbing = true;
        // 吸附到梯子中心
        const tx = ladder.x + ladder.w / 2;
        if (Math.abs(mx - tx) > 2) {
          m.x += (tx > mx ? 1 : -1) * Math.min(CONFIG.MONSTER_SPEED, Math.abs(mx - tx));
        }
        if (m.y <= targetY) {
          m.y = targetY;
          m.onLadder = false;
          m._climbing = false;
          m.isOnGround = true;
          m._ladderTarget = null;
          m._ladderTargetSetAt = 0;
          m._ladderCooldown = now + 1000;
        }
      } else {
        // 不在梯子上 → 走向最近梯子
        m.onLadder = false;
        m._climbing = false;
        const nearest = getNearestLadder(mx);
        if (nearest) {
          const tx = nearest.x + nearest.w / 2;
          const dist = Math.abs(mx - tx);
          if (dist > 8) {
            const dir = tx > mx ? 1 : -1;
            m.x += dir * CONFIG.MONSTER_SPEED;
            m.facingRight = dir > 0;
          }
          m._ladderTarget = nearest;
          m._ladderTargetSetAt = now;
        }
      }
    } else {
      // playerLevel === 'lower'
      const targetY = CONFIG.LOWER_GROUND_Y - m.size + inset;
      if (ladder) {
        // 在梯子上 → 往下爬
        m._ladderTarget = ladder;
        m._ladderTargetSetAt = now;
        m.y += CONFIG.CLIMB_SPEED;
        m.vy = 0;
        m.onLadder = true;
        m._climbing = true;
        const tx = ladder.x + ladder.w / 2;
        if (Math.abs(mx - tx) > 2) {
          m.x += (tx > mx ? 1 : -1) * Math.min(CONFIG.MONSTER_SPEED, Math.abs(mx - tx));
        }
        if (m.y >= targetY) {
          m.y = targetY;
          m.onLadder = false;
          m._climbing = false;
          m.isOnGround = true;
          m._ladderTarget = null;
          m._ladderTargetSetAt = 0;
          m._ladderCooldown = now + 1000;
        }
      } else {
        // 不在梯子上 → 走向最近梯子
        m.onLadder = false;
        m._climbing = false;
        const nearest = getNearestLadder(mx);
        if (nearest) {
          const tx = nearest.x + nearest.w / 2;
          const dist = Math.abs(mx - tx);
          if (dist > 8) {
            const dir = tx > mx ? 1 : -1;
            m.x += dir * CONFIG.MONSTER_SPEED;
            m.facingRight = dir > 0;
          }
          m._ladderTarget = nearest;
          m._ladderTargetSetAt = now;
        }
      }
    }
    // 梯子超时保护
    if (m._ladderTargetSetAt && now - m._ladderTargetSetAt > 8000) {
      m._ladderTarget = null;
      m._ladderTargetSetAt = 0;
      m.onLadder = false;
      m._climbing = false;
      m._ladderCooldown = now + 4000;
    }
  } else {
    m._ladderTarget = null;
    m._ladderTargetSetAt = 0;
    m.onLadder = false;
    m._climbing = false;

    // 同层直接追主控
    let vx = 0;
    if (Math.abs(dx) > 6) {
      vx = (dx > 0 ? 1 : -1) * CONFIG.MONSTER_SPEED;
      m.facingRight = dx > 0;
    }
    m.x += vx;
  }

  clampMonsterToPlatform(m);

  // ---- 重力 ----
  if (!m.onLadder) {
    m.vy += CONFIG.GRAVITY;
    if (m.vy > 20) m.vy = 20;
    m.y += m.vy;
    m.isOnGround = false;
    const landed = tryLandOnPlatform(m, m.size);
    if (landed) { m.isOnGround = true; }
  }

  if (m.y > MAP_H + 20) {
    m.y = CONFIG.LOWER_GROUND_Y - m.size + (CONFIG.FOOT_INSET || 0);
    m.vy = 0;
  }
  // 硬地板：下层地面不可穿透（防止梯子退出后掉落）
  if (m.y + m.size >= CONFIG.LOWER_GROUND_Y && m.vy >= 0) {
    m.y = CONFIG.LOWER_GROUND_Y - m.size + (CONFIG.FOOT_INSET || 0);
    m.vy = 0;
    m.isOnGround = true;
  }

    // ---- 攻击（同一层，且玩家不是从怪物头顶越过） ----
  // 玩家脚底高于怪物 40% 身体高度 → 视为跳跃越过，不受攻击
  const playerBottom = player.y + player.size;
  const playerJumpingOver = playerBottom < m.y + m.size * 0.4;
  if (playerLevel === monsterLevel && now >= m._knockbackTime && !playerJumpingOver) {
    const dist = Math.hypot(dx, dy);

    if (dist <= MONSTER_SKILLS.skill.range && now - m._lastSkill >= MONSTER_SKILLS.skill.cooldown && !m._skillCharging) {
      // 开始蓄力：0.8 秒后发射暗影弹
      m._lastSkill = now;
      m._skillCharging = true;
      m._skillChargeStart = now;
      m._skillTargetX = px;
      m._skillTargetY = py;
      // 蓄力起始闪光
      fxScreen.push({
        skill: 'ms', frame: 0, totalFrames: 1,
        worldX: mx, worldY: my,
        w: 30, h: 30,
        time: now, duration: 400, dir: 0,
      });
      effects.push({ type: 'text', x: mx, y: my - 50, text: '蓄力中!', color: '#9b59b6', time: now, duration: 600 });
    } else if (dist <= MONSTER_SKILLS.basic.range && now - m._lastBasic >= MONSTER_SKILLS.basic.cooldown) {
      m._lastBasic = now;
      spawnMonsterBasic(m);
      if (dist <= MONSTER_SKILLS.basic.range) {
        takePlayerDamage(MONSTER_SKILLS.basic.damage);
      }
    }
  }
}

// ---- 全体更新 ----

function updateMonsterAI(player) {
  for (const m of monsters) {
    updateSingleMonsterAI(m, player);
  }
}

// ---- 检查某只怪死亡 ----

function checkMonsterDeath(m) {
  if (m.hp <= 0 && m.alive) {
    m.alive = false;
    m.deathTime = Date.now();
    const mx = m.x + m.size / 2;
    const my = m.y + m.size / 2;
    spawnXP(mx, my); // 击杀额外掉落
    // 20% 概率掉落血包
    if (Math.random() < 0.20) {
      spawnHP(mx, my);
    }
    return true;
  }
  return false;
}

// ---- 绘制 ----

function drawMonster(ctx) {
  const imgReady = sprMonsterReady;

  for (const m of monsters) {
    if (!m.alive) continue;
    const s = m.size;
    const x = m.x;
    const y = m.y;

    const frozen = Date.now() < (m._frozenUntil || 0);
    const flashing = Date.now() < m._hurtFlash;

    ctx.save();
    // 统一以精灵中心为原点；朝左时镜像（避免 translate 后再用世界 y 导致画到 2y）
    ctx.translate(x + s / 2, y + s / 2);
    if (!m.facingRight) ctx.scale(-1, 1);

    if (imgReady) {
      // 判断是否在水平跑动（与上一帧 x 比较），爬梯时不播跑动动画
      const now = Date.now();
      const isMoving = !m.onLadder && Math.abs(m.x - m._prevX) > 0.5;

      // 更新动画帧：跑动时切换，run4（帧3）多停留一帧（200ms）
      if (isMoving) {
        m._animTimer += 16;
        const threshold = m._animFrame === 3 ? 200 : 100;
        if (m._animTimer >= threshold) { m._animTimer = 0; m._animFrame = (m._animFrame + 1) % 4; }
      } else {
        m._animTimer = 0;
        m._animFrame = 0;
      }

      // 选择图像：跑动且帧加载完毕 → run 帧；冰冻 → 蓝化版；否则 → 站姿
      let baseImg;
      const runReady = _monsterRunLoaded >= 4 && _monsterRunFrames[m._animFrame].complete;
      if (isMoving && !frozen && runReady) {
        baseImg = _monsterRunFrames[m._animFrame];
      } else if (frozen && sprMonsterFrozen) {
        baseImg = sprMonsterFrozen;
      } else {
        baseImg = sprMonster;
      }
      ctx.drawImage(baseImg, -s / 2, -s / 2, s, s);

      // 受击闪白：叠白色剪影（只覆盖精灵形状，无白底）
      if (flashing && sprMonsterWhite) {
        ctx.globalAlpha = 0.5 + 0.25 * Math.sin(Date.now() / 40);
        ctx.drawImage(sprMonsterWhite, -s / 2, -s / 2, s, s);
        ctx.globalAlpha = 1;
      }

      // 冰冻装饰：冰晶 + 边框（相对中心坐标，翻转时自动跟随）
      if (frozen) {
        const shimmer = 0.5 + 0.3 * Math.sin(Date.now() / 120);
        ctx.fillStyle = `rgba(210, 240, 255, ${shimmer})`;
        ctx.fillRect(-s * 0.32, -s * 0.42, s * 0.09, s * 0.11);
        ctx.fillRect(s * 0.22, -s * 0.38, s * 0.07, s * 0.09);
        ctx.strokeStyle = `rgba(160, 215, 255, ${0.5 + 0.3 * Math.sin(Date.now() / 150)})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(-s / 2, -s / 2, s, s);
      }
    } else {
      // 图片未加载时的后备绘制
      ctx.fillStyle = flashing ? '#ffffff' : (frozen ? '#88ccff' : '#5a2d8e');
      ctx.fillRect(-s / 2, -s / 2, s, s);
    }

    // ---- 蓄力特效（暗影弹）：更大紫色脉冲环 + 粒子 ----
    if (m._skillCharging) {
      const chargeProgress = (Date.now() - m._skillChargeStart) / 800;
      const pulse = 1 + 0.25 * Math.sin(Date.now() / 60);
      // 外层大光环
      ctx.strokeStyle = '#9b59b6';
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.5 + 0.25 * Math.sin(Date.now() / 80);
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.8 * pulse * Math.min(1, chargeProgress * 2), 0, Math.PI * 2);
      ctx.stroke();
      // 内层亮环
      ctx.strokeStyle = '#d4a0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.55 * pulse * Math.min(1, chargeProgress * 1.5), 0, Math.PI * 2);
      ctx.stroke();
      // 核心光点
      ctx.fillStyle = '#e8d0ff';
      ctx.beginPath();
      ctx.arc(0, -s * 0.35, 7 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -s * 0.35, 3 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // ---- 绘制尸体（旋转倒地 + 闪两下消失）----
  for (const m of monsters) {
    if (m.alive || !m.deathTime) continue;
    const age = Date.now() - m.deathTime;
    if (age > 1000) continue;

    const flashOn = (age < 600) || (age >= 700 && age < 800) || (age >= 900);
    if (!flashOn) continue;

    const s = m.size;
    const groundY = Math.abs((m.y + m.size) - CONFIG.UPPER_GROUND_Y) < 30
      ? CONFIG.UPPER_GROUND_Y
      : CONFIG.LOWER_GROUND_Y;

    ctx.save();
    ctx.translate(m.x + s * 0.25, groundY - s * 0.15);
    ctx.rotate(Math.PI / 2);
    ctx.globalAlpha = 0.6;

    if (imgReady) {
      ctx.drawImage(sprMonster, -s / 2, -s / 2, s, s);
    } else {
      const o = -s / 2;
      ctx.fillStyle = '#555555';
      ctx.fillRect(o + s * 0.12, o + s * 0.00, s * 0.76, s * 0.52);
    }

    // X 眼（死亡标记）
    const cx = 0, cy = 0;
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 3;
    const drawX = (ex, ey, l) => {
      ctx.beginPath();
      ctx.moveTo(ex - l, ey - l);
      ctx.lineTo(ex + l, ey + l);
      ctx.moveTo(ex + l, ey - l);
      ctx.lineTo(ex - l, ey + l);
      ctx.stroke();
    };
    drawX(cx - s * 0.20, cy - s * 0.15, s * 0.10);
    drawX(cx + s * 0.20, cy - s * 0.15, s * 0.10);

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function drawUI(ctx) {
  for (const m of monsters) {
    if (!m.alive) continue;
    const barW = m.size;
    const barH = 6;
    const barX = m.x;
    const barY = m.y - 14;

    // 血条
    ctx.fillStyle = '#333333';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#e23b3b';
    ctx.fillRect(barX, barY, barW * (m.hp / m.maxHp), barH);

    // 冻结状态标签
    if (Date.now() < (m._frozenUntil || 0)) {
      const remain = ((m._frozenUntil - Date.now()) / 1000).toFixed(1);
      ctx.fillStyle = '#88ccff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('❄冻结 ' + remain + 's', barX + barW / 2, barY - 6);
      ctx.textAlign = 'start';
    }
  }
}

// ---- 怪物弹道系统 ----

function updateMonsterProjectiles() {
  const now = Date.now();
  for (let i = monsterProjectiles.length - 1; i >= 0; i--) {
    const p = monsterProjectiles[i];
    p.x += p.vx;
    p.y += p.vy;

    // 超出世界边界
    if (p.x < -40 || p.x > MAP_W + 40 || p.y < -40 || p.y > MAP_H + 40) {
      monsterProjectiles.splice(i, 1);
      continue;
    }
    // 超时（4 秒）
    if (now - p.time > 4000) {
      monsterProjectiles.splice(i, 1);
    }
  }
}

function drawMonsterProjectiles(ctx) {
  const now = Date.now();
  for (const p of monsterProjectiles) {
    const age = now - p.time;

    // 紫色拖尾（更长更粗）
    for (let t = 1; t <= 6; t++) {
      const tx = p.x - p.vx * t * 8;
      const ty = p.y - p.vy * t * 8;
      ctx.fillStyle = `rgba(155, 89, 182, ${0.38 - t * 0.055})`;
      ctx.beginPath();
      ctx.arc(tx, ty, p.radius * (1 - t * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }

    // 外层辉光（更宽广、更明显）
    ctx.fillStyle = 'rgba(155, 89, 182, 0.38)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(180, 100, 200, 0.22)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 主体：更大光球 + 脉冲
    const pulse = 1 + 0.12 * Math.sin(now / 50 + p.x);
    const mainR = p.radius * 1.4 * pulse;
    const gradient = ctx.createRadialGradient(p.x - 2, p.y - 2, mainR * 0.1, p.x, p.y, mainR);
    gradient.addColorStop(0, '#f0e0ff');
    gradient.addColorStop(0.25, '#c39bde');
    gradient.addColorStop(0.55, '#9b59b6');
    gradient.addColorStop(0.8, '#5b2080');
    gradient.addColorStop(1, 'rgba(30, 0, 60, 0.2)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, mainR, 0, Math.PI * 2);
    ctx.fill();

    // 暗紫色描边（更显眼）
    ctx.strokeStyle = 'rgba(80, 20, 120, 0.7)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, mainR, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function checkProjectilePlayerCollision(player) {
  if (player.hp <= 0) return;
  const px = player.x + player.size / 2;
  const py = player.y + player.size / 2;

  for (let i = monsterProjectiles.length - 1; i >= 0; i--) {
    const p = monsterProjectiles[i];
    const dist = Math.hypot(px - p.x, py - p.y);
    if (dist < player.size * 0.5 + p.radius) {
      takePlayerDamage(p.damage);
      effects.push({ type: 'flash', time: Date.now(), duration: 100, color: '#9b59b6' });
      // 命中爆炸粒子
      for (let j = 0; j < 6; j++) {
        const angle = Math.random() * Math.PI * 2;
        fxScreen.push({
          skill: 'mb', frame: j, totalFrames: 6,
          worldX: p.x + Math.cos(angle) * 10,
          worldY: p.y + Math.sin(angle) * 10,
          w: 6, h: 6,
          time: Date.now() + j * 20, duration: 200, dir: angle,
        });
      }
      monsterProjectiles.splice(i, 1);
    }
  }
}
