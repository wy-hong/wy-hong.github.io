// ============================================================
// 战斗模块 battle.js
// J 普攻 / K 冰冻 / L 远攻(闪电弹) / I 大招 ｜ 动态帧动画 ｜ 右下冷却图标
// ============================================================

const SKILLS = {
  j: { name: '普攻', key: 'J', damage: 7,  range: 150, cooldown: 300,  color: '#ffeecc', iconBg: '#555555' },
  k: { name: '冰冻', key: 'K', damage: 11, range: 150, cooldown: 3000, color: '#4ac9ff', iconBg: '#1a4a6e' },
  l: { name: '远攻', key: 'L', damage: 14, range: 1000, cooldown: 2000, color: '#ffd94a', iconBg: '#6e5a1a' },
  i: { name: '大招', key: 'I', damage: 35, range: 250, cooldown: 8000, color: '#ff5ce1', iconBg: '#6e1a5a' },
};

const lastUsed = { j: 0, k: 0, l: 0, i: 0 };
const _hitThisCast = { j: false, k: false, l: false, i: false };
const effects = [];
const fxScreen = [];
const xpOrbs = [];
const hpOrbs = [];

const MONSTER_SKILLS = {
  basic: { name: '爪击', damage: 8, range: 55, cooldown: 450, color: '#ff6b6b' },
  skill: { name: '暗影弹', damage: 15, range: 130, cooldown: 3000, color: '#9b59b6' },
};

// ---- 冰冻碰撞爆炸 ----

const _frozenCollisionFlag = {};

function checkFrozenCollision() {
  const now = Date.now();

  for (let i = 0; i < monsters.length; i++) {
    const a = monsters[i];
    if (!a.alive) continue;

    for (let j = i + 1; j < monsters.length; j++) {
      const b = monsters[j];
      if (!b.alive) continue;

      // 至少有一只冰冻 + 被击退中
      const aFrozen = now < (a._frozenUntil || 0) && now < a._knockbackTime;
      const bFrozen = now < (b._frozenUntil || 0) && now < b._knockbackTime;
      if (!aFrozen && !bFrozen) continue;

      const key = i + '-' + j;
      if (_frozenCollisionFlag[key] && now - _frozenCollisionFlag[key] < 500) continue;

      const ax = a.x + a.size / 2, ay = a.y + a.size / 2;
      const bx = b.x + b.size / 2, by = b.y + b.size / 2;
      const dist = Math.hypot(ax - bx, ay - by);

      if (dist < a.size * 0.9) {
        // 确定哪个是冰冻方块，哪个是被撞的
        const frozen = aFrozen ? a : b;
        const other = aFrozen ? b : a;
        const frozenX = aFrozen ? ax : bx;
        const frozenY = aFrozen ? ay : by;
        const otherX = aFrozen ? bx : ax;
        const otherY = aFrozen ? by : ay;

        // 冰冻怪物炸死，另一只受到 30 伤害
        frozen.hp = 0;
        other.hp = Math.max(0, other.hp - 30);
        other._hurtFlash = now + 200;

        // 冰块碎裂音效
        if (typeof playSkillSound === 'function') playSkillSound('k');

        // 冰冻怪物爆炸特效
        for (let k = 0; k < 14; k++) {
          const angle = (k / 14) * Math.PI * 2;
          const rr = 16 + Math.random() * 28;
          fxScreen.push({
            skill: 'freeze', frame: k, totalFrames: 14,
            worldX: frozenX + Math.cos(angle) * rr,
            worldY: frozenY + Math.sin(angle) * rr,
            w: 8, h: 8,
            time: now + k * 10, duration: 350, dir: angle,
          });
        }
        effects.push({ type: 'flash', time: now, duration: 120, color: '#88ccff' });
        effects.push({ type: 'text', x: frozenX, y: frozenY, text: '💥击杀!', color: '#4ac9ff', time: now, duration: 900 });
        effects.push({ type: 'text', x: otherX, y: otherY, text: '-30', color: '#ff6b6b', time: now, duration: 600 });

        _frozenCollisionFlag[key] = now;

        const knockDir = otherX >= frozenX ? 1 : -1;
        other._knockbackVx = knockDir * 18;
        other._knockbackTime = now + 300;
      }
    }
  }
}

// ---------- 帧动画数据 ----------

// 普攻：拳风弧线
function spawnNormalAttack(player) {
  const px = player.x + player.size / 2;
  const py = player.y + player.size / 2;
  const dir = player.facingRight ? 1 : -1;
  for (let i = 0; i < 3; i++) {
    fxScreen.push({
      skill: 'j', frame: i, totalFrames: 3,
      worldX: px + dir * (12 + i * 28),
      worldY: py - 6 + (i % 2) * 4,
      w: 20 + i * 8, h: 14 + i * 4,
      time: Date.now() + i * 40, duration: 220, dir: dir,
    });
  }
}

// 冰锥
function spawnIceSpike(player, monster) {
  const px = player.x + player.size / 2;
  const py = player.y + player.size / 2;
  const mx = monster.x + monster.size / 2;
  const my = monster.y + monster.size / 2;
  for (let i = 0; i < 3; i++) {
    const t = i / 2;
    fxScreen.push({
      skill: 'k', frame: i, totalFrames: 3,
      worldX: px + (mx - px) * (0.2 + t * 0.3),
      worldY: py + (my - py) * (0.2 + t * 0.3) - 8 + Math.sin(t * 6) * 6,
      w: 8 + i * 2, h: 10 + i * 4,
      time: Date.now() + i * 50, duration: 250, dir: mx > px ? 1 : -1,
    });
  }
}

// 闪电弹
function spawnLightning(player, monster) {
  const px = player.x + player.size / 2;
  const py = player.y + player.size / 2;
  const mx = monster.x + monster.size / 2;
  const my = monster.y + monster.size / 2;
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const dist = Math.hypot(mx - px, my - py);
    const angle = Math.atan2(my - py, mx - px);
    fxScreen.push({
      skill: 'l', frame: i, totalFrames: 6,
      worldX: px + Math.cos(angle) * dist * t,
      worldY: py + Math.sin(angle) * dist * t,
      w: 8 + i * 2, h: 14 + i * 4,
      time: Date.now() + i * 25, duration: 200, dir: angle,
    });
  }
}

// 大招
function spawnUltimate(player) {
  const px = player.x + player.size / 2;
  const py = player.y + player.size / 2;
  // 大范围冲击波：多层扩散圆环
  for (let i = 0; i < 6; i++) {
    const r = 20 + i * 28;
    fxScreen.push({
      skill: 'i', frame: i, totalFrames: 6,
      worldX: px, worldY: py,
      w: r * 2, h: r * 2,
      time: Date.now() + i * 50, duration: 400, dir: 0,
    });
  }
  // 地板碎粒向四周飞散
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const dist = 30 + Math.random() * 60;
    fxScreen.push({
      skill: 'freeze', frame: i, totalFrames: 16,
      worldX: px + Math.cos(angle) * dist,
      worldY: py + Math.sin(angle) * dist,
      w: 5 + Math.random() * 4, h: 5 + Math.random() * 4,
      time: Date.now() + i * 20, duration: 350, dir: angle,
    });
  }
}

// ---------- 无目标 Dummy 动画 ----------

function spawnIceSpikeDummy(player, dir) {
  const px = player.x + player.size / 2;
  const py = player.y + player.size / 2;
  for (let i = 0; i < 3; i++) {
    const angle = (i - 1) * 0.25;
    fxScreen.push({
      skill: 'k', frame: i, totalFrames: 3,
      worldX: px + dir * (20 + i * 40),
      worldY: py - 8 + Math.sin(angle * 3) * 12,
      w: 8 + i * 2, h: 10 + i * 4,
      time: Date.now() + i * 50, duration: 250, dir: dir,
    });
  }
}

function spawnLightningDummy(player, dir) {
  const px = player.x + player.size / 2;
  const py = player.y + player.size / 2;
  for (let i = 0; i < 4; i++) {
    const t = (i + 1) / 4;
    fxScreen.push({
      skill: 'l', frame: i, totalFrames: 4,
      worldX: px + dir * 80 * t,
      worldY: py - 6,
      w: 8 + i * 2, h: 12 + i * 3,
      time: Date.now() + i * 25, duration: 200,
      dir: dir > 0 ? 0 : Math.PI,
    });
  }
}

function spawnUltimateDummy(player) {
  const px = player.x + player.size / 2;
  const py = player.y + player.size / 2;
  for (let i = 0; i < 5; i++) {
    const r = 10 + i * 8;
    fxScreen.push({
      skill: 'i', frame: i, totalFrames: 5,
      worldX: px, worldY: py,
      w: r * 2, h: r * 2,
      time: Date.now() + i * 40, duration: 300, dir: 0,
    });
  }
}

// ---------- 怪物攻击动效 ----------

function spawnMonsterBasic(monster) {
  const mx = monster.x + monster.size / 2;
  const my = monster.y + monster.size / 2;
  const dir = monster.facingRight ? 1 : -1;
  for (let i = 0; i < 3; i++) {
    fxScreen.push({
      skill: 'mb', frame: i, totalFrames: 3,
      worldX: mx + dir * (20 + i * 12),
      worldY: my - 8 + (i - 1) * 12,
      w: 14 + i * 2, h: 6 + i * 2,
      time: Date.now() + i * 40, duration: 200, dir: dir,
    });
  }
}

function spawnMonsterSkill(monster, player) {
  const mx = monster.x + monster.size / 2;
  const my = monster.y + monster.size / 2;
  const px = player.x + player.size / 2;
  const py = player.y + player.size / 2;
  for (let i = 0; i < 4; i++) {
    const t = (i + 1) / 4;
    fxScreen.push({
      skill: 'ms', frame: i, totalFrames: 4,
      worldX: mx + (px - mx) * t,
      worldY: my + (py - my) * t - 4,
      w: 10 + i * 3, h: 10 + i * 3,
      time: Date.now() + i * 40, duration: 280, dir: 0,
    });
  }
}

// ---------- 战斗处理 ----------

/** 两个轴对齐盒子之间的间距（贴在一起时为 0，含水平/垂直分量） */
function boxGap(a, b) {
  const gx = Math.max(0, Math.max(a.x - (b.x + b.size), b.x - (a.x + a.size)));
  const gy = Math.max(0, Math.max(a.y - (b.y + b.size), b.y - (a.y + a.size)));
  return Math.hypot(gx, gy);
}

function processPlayerAttacks(keys, player) {
  const now = Date.now();
  const alive = monsters.filter(m => m.alive);

  for (const key of ['j', 'k', 'l', 'i']) {
    if (!keys[key]) continue;
    if (now - lastUsed[key] < SKILLS[key].cooldown) continue;

    lastUsed[key] = now;
    _hitThisCast[key] = false;

    // 技能释放音效
    if (typeof playSkillSound === 'function') playSkillSound(key);

    const px = player.x + player.size / 2;
    const py = player.y + player.size / 2;
    const dir = player.facingRight ? 1 : -1;
    // 目标选择用盒子间距（与命中判定一致，冰冻成冰块也能选到）
    const range = SKILLS[key].range;
    let target = null, bestDist = Infinity;
    for (const m of alive) {
      const d = boxGap(player, m);
      if (d < bestDist && d <= range) { bestDist = d; target = m; }
    }

    switch (key) {
      case 'j': spawnNormalAttack(player); break;
      case 'k':
        if (target) {
          spawnIceSpike(player, target);
          // 冰锥直接对最近目标造成伤害，不依赖 handleBattle 的顺序
          applyDamage('k', player, target);
          _hitThisCast['k'] = true;
        } else {
          spawnIceSpikeDummy(player, dir);
        }
        break;
      case 'l':
        if (target) {
          spawnLightning(player, target);
          applyDamage('l', player, target);
          _hitThisCast['l'] = true;
        } else {
          spawnLightningDummy(player, dir);
        }
        break;
      case 'i':
        // 群攻：对范围内所有怪物造成伤害
        spawnUltimate(player);
        let hitCount = 0;
        for (const m of alive) {
          if (boxGap(player, m) <= SKILLS.i.range) {
            applyDamage('i', player, m);
            hitCount++;
          }
        }
        _hitThisCast['i'] = true;
        // 如果范围内没有怪物，放空
        if (hitCount === 0) {
          spawnUltimateDummy(player);
        }
        break;
    }
  }
}

function handleBattle(keys, player, monster) {
  if (!monster.alive) return;

  const now = Date.now();
  const px = player.x + player.size / 2;
  const py = player.y + player.size / 2;
  const mx = monster.x + monster.size / 2;
  const my = monster.y + monster.size / 2;

  for (const key of ['j', 'k', 'l', 'i']) {
    if (now - lastUsed[key] > 100) continue;
    if (lastUsed[key] === 0) continue;
    if (_hitThisCast[key]) continue;

    // 怪物处于击退/眩晕状态时，不允许再次被命中（防止无限连控）
    if (now < (monster._knockbackTime || 0)) continue;

    // 用盒子间距判定：两盒贴合时间距为 0，普攻贴脸必中，冰块也能打到
    const dist = boxGap(player, monster);
    if (dist > SKILLS[key].range) continue;

    _hitThisCast[key] = true;
    applyDamage(key, player, monster);
  }
}

function applyDamage(key, player, monster) {
  const skill = SKILLS[key];
  const px = player.x + player.size / 2;
  const py = player.y + player.size / 2;
  const mx = monster.x + monster.size / 2;
  const my = monster.y + monster.size / 2;

  const dmg = Math.round(skill.damage * getDamageMult());
  monster.hp = Math.max(0, monster.hp - dmg);
  monster._hurtFlash = Date.now() + 150;

  // 命中音效
  if (typeof playMonsterHitSound === 'function') playMonsterHitSound();

  // 冰锥：冻结怪物 2 秒
  if (key === 'k') {
    monster._frozenUntil = Date.now() + 2000;
    fxScreen.push({
      skill: 'freeze',
      worldX: monster.x + monster.size / 2,
      worldY: monster.y - 20,
      w: 30, h: 20,
      time: Date.now(), duration: 800, dir: 0,
    });
  }

  // 受击反应
  const now = Date.now();
  if (now >= (monster._casting || 0)) {
    const knockDir = (mx >= px ? 1 : -1);
    // 冰冻 + 普攻 → 强力击飞（保留原有机制）
    if (key === 'j' && now < (monster._frozenUntil || 0)) {
      if (typeof playSkillSound === 'function') playSkillSound('k'); // 冰块碎裂音效
      const knockPower = (12 + dmg * 0.6) * 3;
      monster._knockbackVx = knockDir * knockPower;
      monster._knockbackTime = now + 500;
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 8 + Math.random() * 16;
        fxScreen.push({
          skill: 'freeze', frame: i, totalFrames: 8,
          worldX: mx + Math.cos(angle) * dist,
          worldY: my + Math.sin(angle) * dist,
          w: 6, h: 6,
          time: now + i * 20, duration: 300, dir: angle,
        });
      }
    } else if (key === 'k' && now < (monster._frozenUntil || 0)) {
      // 冰冻 + 冰锥 → 击飞（冰冻碰撞爆炸需要击飞）
      if (typeof playSkillSound === 'function') playSkillSound('k'); // 冰块碎裂音效
      const knockPower = 12 + dmg * 0.6;
      monster._knockbackVx = knockDir * knockPower;
      monster._knockbackTime = now + 500;
    } else {
      // 普通受击：原地眩晕，时长为普攻冷却的 60%
      monster._knockbackVx = 0;
      monster._knockbackTime = now + Math.round(SKILLS.j.cooldown * 0.6);
    }
  }

  effects.push({
    type: 'text', x: mx, y: my,
    text: '-' + dmg, color: skill.color,
    time: Date.now(), duration: 800,
  });

  const xpFromHit = Math.round(dmg * CONFIG.XP_PER_DAMAGE);
  if (xpFromHit > 0) {
    spawnXP(mx, my, xpFromHit);
  }

  effects.push({
    type: 'flash', time: Date.now(), duration: 80, color: skill.color,
  });
}

// ---------- 绘制技能动效（世界坐标，已平移相机） ----------

function drawEffects(ctx) {
  const now = Date.now();

  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    const age = now - e.time;
    if (age > e.duration) { effects.splice(i, 1); continue; }

    if (e.type === 'text') {
      ctx.fillStyle = e.color;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(e.text, e.x, e.y - 20 - age / 20);
      ctx.textAlign = 'start';
    }
  }

  for (let i = fxScreen.length - 1; i >= 0; i--) {
    const fx = fxScreen[i];
    const age = now - fx.time;
    if (age > fx.duration) { fxScreen.splice(i, 1); continue; }

    const alpha = 1 - age / fx.duration;
    const skill = SKILLS[fx.skill];

    ctx.save();
    ctx.globalAlpha = alpha;

    switch (fx.skill) {
      case 'j':
        ctx.shadowColor = skill.color;
        ctx.shadowBlur = 6;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(fx.worldX, fx.worldY, fx.w * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(fx.worldX, fx.worldY, fx.w * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;

      case 'k':
        ctx.fillStyle = skill.color;
        ctx.beginPath();
        const kx = fx.worldX, ky = fx.worldY;
        ctx.moveTo(kx + fx.dir * fx.w, ky);
        ctx.lineTo(kx - fx.dir * fx.w * 0.5, ky - fx.h / 2);
        ctx.lineTo(kx - fx.dir * fx.w * 0.5, ky + fx.h / 2);
        ctx.closePath();
        ctx.fill();
        break;

      case 'l':
        {
          // 闪电弹：白色内核 + 金色辉光
          ctx.shadowColor = '#ffd94a';
          ctx.shadowBlur = 12 + alpha * 8;
          ctx.fillStyle = '#fffbe6';
          ctx.beginPath();
          ctx.arc(fx.worldX, fx.worldY, fx.w * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255, 217, 74, 0.3)';
          ctx.beginPath();
          ctx.arc(fx.worldX, fx.worldY, fx.w * 0.9, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          // 电光十字线
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(fx.worldX - fx.w * 0.5, fx.worldY);
          ctx.lineTo(fx.worldX + fx.w * 0.5, fx.worldY);
          ctx.moveTo(fx.worldX, fx.worldY - fx.h * 0.5);
          ctx.lineTo(fx.worldX, fx.worldY + fx.h * 0.5);
          ctx.stroke();
        }
        break;

      case 'i':
        ctx.strokeStyle = skill.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(fx.worldX, fx.worldY, fx.w / 2 * (1 - alpha * 0.3), 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(fx.worldX - fx.w / 2, fx.worldY);
        ctx.lineTo(fx.worldX + fx.w / 2, fx.worldY);
        ctx.moveTo(fx.worldX, fx.worldY - fx.h / 2);
        ctx.lineTo(fx.worldX, fx.worldY + fx.h / 2);
        ctx.stroke();
        break;

      case 'mb':
        ctx.fillStyle = MONSTER_SKILLS.basic.color;
        ctx.save();
        ctx.translate(fx.worldX, fx.worldY);
        ctx.rotate(fx.dir * 0.4);
        ctx.fillRect(-fx.w / 2, -fx.h / 2, fx.w, fx.h);
        ctx.fillRect(-fx.w * 0.3, -fx.h, fx.w * 0.4, fx.h * 2);
        ctx.restore();
        break;

      case 'ms':
        // 暗影弹发射/蓄力特效：粉色爆炸环
        {
          ctx.save();
          ctx.shadowColor = '#9b59b6';
          ctx.shadowBlur = 14;
          ctx.fillStyle = MONSTER_SKILLS.skill.color;
          ctx.beginPath();
          ctx.arc(fx.worldX, fx.worldY, fx.w / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(200, 140, 220, 0.35)';
          ctx.beginPath();
          ctx.arc(fx.worldX, fx.worldY, fx.w * 0.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.restore();
        }
        break;

      case 'freeze':
        ctx.fillStyle = '#88ccff';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('❄', fx.worldX, fx.worldY);
        ctx.textAlign = 'start';
        break;

      case 'levelup':
        {
          const dist = (1 - alpha) * 50;
          const lpx = fx.worldX + Math.cos(fx.dir) * dist;
          const lpy = fx.worldY + Math.sin(fx.dir) * dist;
          ctx.fillStyle = '#ffd94a';
          ctx.beginPath();
          ctx.arc(lpx, lpy, fx.w * (1 - alpha * 0.5), 0, Math.PI * 2);
          ctx.fill();
        }
        break;
    }

    ctx.restore();
  }

  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    if (e.type === 'flash') {
      const age = now - e.time;
      if (age > e.duration) { effects.splice(i, 1); continue; }
      ctx.fillStyle = e.color;
      ctx.globalAlpha = 0.15 * (1 - age / e.duration);
      ctx.fillRect(cameraX, cameraY, CONFIG.VIEW_WIDTH, CONFIG.VIEW_HEIGHT);
      ctx.globalAlpha = 1;
    }
  }
}

// ---------- 右下角技能冷却图标 ----------

/** 圆角矩形路径 */
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawSkillBar(ctx) {
  const now = Date.now();
  const iconSize = 120;
  const gap = 14;
  const radius = 18;
  const startX = CONFIG.VIEW_WIDTH - (iconSize * 4 + gap * 3) - 20;
  const startY = CONFIG.VIEW_HEIGHT - iconSize - 18;
  const keysArr = ['j', 'k', 'l', 'i'];

  for (let idx = 0; idx < keysArr.length; idx++) {
    const key = keysArr[idx];
    const skill = SKILLS[key];
    const x = startX + idx * (iconSize + gap);
    const y = startY;
    const cx = x + iconSize / 2;
    const cy = y + iconSize / 2;

    const elapsed = now - (lastUsed[key] || 0);
    const cdProgress = skill.cooldown > 0 ? Math.min(1, elapsed / skill.cooldown) : 1;
    const ready = cdProgress >= 1;

    ctx.save();

    // ---- 卡片底：深色渐变 + 圆角 ----
    const bgGrad = ctx.createLinearGradient(x, y, x, y + iconSize);
    if (ready) {
      bgGrad.addColorStop(0, skill.iconBg);
      bgGrad.addColorStop(1, '#14141f');
    } else {
      bgGrad.addColorStop(0, '#23232e');
      bgGrad.addColorStop(1, '#141419');
    }
    // 就绪时的外发光
    if (ready) {
      ctx.shadowColor = skill.color;
      ctx.shadowBlur = 14 + 6 * Math.sin(now / 300 + idx);
    }
    roundRectPath(ctx, x, y, iconSize, iconSize, radius);
    ctx.fillStyle = bgGrad;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 边框
    ctx.strokeStyle = ready ? skill.color : '#3a3a46';
    ctx.lineWidth = ready ? 3 : 2;
    roundRectPath(ctx, x + 1, y + 1, iconSize - 2, iconSize - 2, radius - 1);
    ctx.stroke();

    // 顶部高光条
    ctx.save();
    roundRectPath(ctx, x, y, iconSize, iconSize, radius);
    ctx.clip();
    const sheen = ctx.createLinearGradient(x, y, x, y + iconSize * 0.4);
    sheen.addColorStop(0, 'rgba(255,255,255,0.12)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(x, y, iconSize, iconSize * 0.4);
    ctx.restore();

    // ---- 技能图标 ----
    ctx.globalAlpha = ready ? 1 : 0.45;
    drawSkillIcon(ctx, key, cx, cy - 6, iconSize * 0.42);
    ctx.globalAlpha = 1;

    // ---- 冷却遮罩：扇形扫盘 ----
    if (!ready) {
      ctx.save();
      roundRectPath(ctx, x, y, iconSize, iconSize, radius);
      ctx.clip();
      // 剩余比例的扇形（从顶部开始顺时针消退）
      ctx.fillStyle = 'rgba(8, 8, 14, 0.72)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + (1 - cdProgress) * Math.PI * 2;
      ctx.arc(cx, cy, iconSize, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();
      // 扫盘边缘亮线
      ctx.strokeStyle = skill.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(endAngle) * iconSize, cy + Math.sin(endAngle) * iconSize);
      ctx.stroke();
      ctx.restore();

      // 剩余秒数
      const remain = Math.ceil((skill.cooldown - elapsed) / 1000);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.fillText(remain, cx, cy + 4);
      ctx.shadowBlur = 0;
      ctx.textBaseline = 'alphabetic';
    }

    // ---- 按键徽章：底部小胶囊 ----
    const badgeW = 44, badgeH = 24;
    const bx = cx - badgeW / 2;
    const by = y + iconSize - badgeH - 8;
    roundRectPath(ctx, bx, by, badgeW, badgeH, 12);
    ctx.fillStyle = ready ? skill.color : '#3a3a46';
    ctx.fill();
    ctx.fillStyle = ready ? '#14141f' : '#888';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(skill.key, cx, by + badgeH / 2 + 1);
    ctx.textBaseline = 'alphabetic';

    ctx.restore();
  }
  ctx.textAlign = 'start';
}

function drawSkillIcon(ctx, key, cx, cy, r) {
  const emojiMap = { j: '👊', k: '❄️', l: '⚡', i: '⚔️' };
  const emoji = emojiMap[key] || key;
  ctx.font = Math.round(r * 1.4) + 'px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, cx, cy + 1);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

// ---------- 经验球系统 ----------

function spawnXP(x, y, totalAmount) {
  if (totalAmount === undefined) totalAmount = CONFIG.XP_PER_KILL;
  if (totalAmount <= 0) return;

  const maxPerOrb = 8;
  const count = Math.max(1, Math.min(5, Math.ceil(totalAmount / maxPerOrb)));
  const base = Math.floor(totalAmount / count);
  let remainder = totalAmount - base * count;

  for (let i = 0; i < count; i++) {
    const orbAmount = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    xpOrbs.push({
      x: x + (Math.random() - 0.5) * 30,
      y: y + (Math.random() - 0.5) * 20,
      amount: orbAmount,
      time: Date.now(),
      vy: -(4 + Math.random() * 6),
      vx: (Math.random() - 0.5) * 3,
    });
  }
}

function updateXpOrbs() {
  const now = Date.now();
  const platforms = getPlatforms();

  for (let i = xpOrbs.length - 1; i >= 0; i--) {
    const orb = xpOrbs[i];
    const age = now - orb.time;

    // 磁吸：靠近玩家时被吸引过去（解决球落在尴尬位置捡不到）
    if (player.hp > 0 && age > 300) {
      const d = pointToBoxDist(orb.x, orb.y, player);
      if (d < 140) {
        const px = player.x + player.size / 2;
        const py = player.y + player.size / 2;
        const dd = Math.hypot(px - orb.x, py - orb.y) || 1;
        const pull = (10 * (1 - d / 140) + 3) * globalDT;
        orb.x += (px - orb.x) / dd * pull;
        orb.y += (py - orb.y) / dd * pull;
        continue; // 磁吸时跳过重力/弹跳
      }
    }

    orb.vy += 0.5 * globalDT;
    if (orb.vy > 14) orb.vy = 14;
    orb.y += orb.vy * globalDT;
    orb.x += (orb.vx || 0) * globalDT;

    for (const p of platforms) {
      if (orb.x > p.x + 4 && orb.x < p.x + p.w - 4) {
        const orbR = 14;
        if (orb.y + orbR >= p.y && orb.y - orbR < p.y && orb.vy >= 0) {
          orb.y = p.y - orbR;
          orb.vy *= -0.3;
          if (Math.abs(orb.vy) < 0.3) { orb.vy = 0; orb.vx = 0; }
          break;
        }
      }
    }

    if (orb.y > MAP_H + 40 || orb.x < -40 || orb.x > MAP_W + 40) {
      xpOrbs.splice(i, 1);
      continue;
    }
    if (age > 10000) { xpOrbs.splice(i, 1); continue; }
  }
}

/** 点到盒子（玩家）的最近距离，用于拾取判定 */
function pointToBoxDist(px, py, box) {
  const gx = Math.max(0, Math.max(box.x - px, px - (box.x + box.size)));
  const gy = Math.max(0, Math.max(box.y - py, py - (box.y + box.size)));
  return Math.hypot(gx, gy);
}

function checkXpPickup(player) {
  if (player.hp <= 0) return;

  for (let i = xpOrbs.length - 1; i >= 0; i--) {
    const orb = xpOrbs[i];
    // 球碰到玩家盒子边缘 30px 内即可拾取（修：球在地面时中心距过远捡不到）
    if (pointToBoxDist(orb.x, orb.y, player) < 30) {
      collectXP(orb.amount);
      xpOrbs.splice(i, 1);
    }
  }
}

function drawXpOrbs(ctx) {
  const now = Date.now();
  for (const orb of xpOrbs) {
    const age = now - orb.time;
    const pulse = 1 + 0.15 * Math.sin(now / 180 + orb.x);
    const r = 14 * pulse;

    ctx.fillStyle = 'rgba(255, 217, 74, 0.3)';
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, r * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 200, 50, 0.45)';
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, r * 1.4, 0, Math.PI * 2);
    ctx.fill();

    const gradient = ctx.createRadialGradient(orb.x, orb.y, r * 0.2, orb.x, orb.y, r);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.35, '#ffd94a');
    gradient.addColorStop(0.7, '#ff9900');
    gradient.addColorStop(1, '#cc6600');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('+' + orb.amount, orb.x, orb.y - 16);
    ctx.textAlign = 'start';
  }
}

// ---------- 血包系统 ----------

function spawnHP(x, y) {
  hpOrbs.push({
    x: x + (Math.random() - 0.5) * 20,
    y: y + (Math.random() - 0.5) * 10,
    time: Date.now(),
    vy: -(3 + Math.random() * 4),
    vx: (Math.random() - 0.5) * 2,
  });
}

function updateHpOrbs() {
  const now = Date.now();
  const platforms = getPlatforms();

  for (let i = hpOrbs.length - 1; i >= 0; i--) {
    const orb = hpOrbs[i];
    const age = now - orb.time;

    // 磁吸：靠近玩家时被吸引过去（解决血包落在尴尬位置捡不到）
    // 满血时也磁吸，拾取后转为少量 XP
    if (player.hp > 0 && age > 300) {
      const d = pointToBoxDist(orb.x, orb.y, player);
      if (d < 140) {
        const px = player.x + player.size / 2;
        const py = player.y + player.size / 2;
        const dd = Math.hypot(px - orb.x, py - orb.y) || 1;
        const pull = (10 * (1 - d / 140) + 3) * globalDT;
        orb.x += (px - orb.x) / dd * pull;
        orb.y += (py - orb.y) / dd * pull;
        continue; // 磁吸时跳过重力/弹跳
      }
    }

    orb.vy += 0.5 * globalDT;
    if (orb.vy > 12) orb.vy = 12;
    orb.y += orb.vy * globalDT;
    orb.x += (orb.vx || 0) * globalDT;

    for (const p of platforms) {
      if (orb.x > p.x + 4 && orb.x < p.x + p.w - 4) {
        const orbR = 14;
        if (orb.y + orbR >= p.y && orb.y - orbR < p.y && orb.vy >= 0) {
          orb.y = p.y - orbR;
          orb.vy *= -0.3;
          if (Math.abs(orb.vy) < 0.3) { orb.vy = 0; orb.vx = 0; }
          break;
        }
      }
    }

    if (orb.y > MAP_H + 40 || orb.x < -40 || orb.x > MAP_W + 40) {
      hpOrbs.splice(i, 1);
      continue;
    }
    if (age > 10000) { hpOrbs.splice(i, 1); continue; }
  }
}

function checkHpPickup(player) {
  if (player.hp <= 0) return;

  for (let i = hpOrbs.length - 1; i >= 0; i--) {
    const orb = hpOrbs[i];
    if (pointToBoxDist(orb.x, orb.y, player) < 30) {
      const needHeal = player.hp < player.maxHp;
      if (needHeal) {
        const heal = Math.round(player.maxHp * 0.21);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        effects.push({ type: 'flash', time: Date.now(), duration: 200, color: '#ff4444' });
        // Lv.2 及以上：拾取血包额外获得 30 XP
        if (player.level >= 2) {
          collectXP(30);
        }
      }
      // 满血时也能拾取，只是不增加血量
      hpOrbs.splice(i, 1);
    }
  }
}

function drawHpOrbs(ctx) {
  const now = Date.now();
  for (const orb of hpOrbs) {
    const pulse = 1 + 0.15 * Math.sin(now / 180 + orb.x);
    const r = 22 * pulse;

    ctx.fillStyle = 'rgba(255, 60, 60, 0.3)';
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    const gradient = ctx.createRadialGradient(orb.x - 2, orb.y - 2, r * 0.1, orb.x, orb.y, r);
    gradient.addColorStop(0, '#ff8888');
    gradient.addColorStop(0.5, '#e23b3b');
    gradient.addColorStop(1, '#8b0000');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, r, 0, Math.PI * 2);
    ctx.fill();

    // 十字标记（白色）
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(orb.x - 6, orb.y);
    ctx.lineTo(orb.x + 6, orb.y);
    ctx.moveTo(orb.x, orb.y - 6);
    ctx.lineTo(orb.x, orb.y + 6);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffcccc';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('+21%HP', orb.x, orb.y - 22);
    ctx.textAlign = 'start';
  }
}
