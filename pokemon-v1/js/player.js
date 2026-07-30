// ============================================================
// 玩家模块 player.js
// A/D 移动 ｜ 空格/W 跳跃 ｜ W/S 爬梯子 ｜ 重力 + 平台
// ============================================================

const player = {
  x: 60,
  y: 0,
  size: CONFIG.PLAYER_SIZE,
  speed: CONFIG.PLAYER_SPEED,
  hp: CONFIG.PLAYER_MAX_HP,
  maxHp: CONFIG.PLAYER_MAX_HP,
  invincibleUntil: 0,
  vy: 0,
  isOnGround: false,
  facingRight: true,
  onLadder: false,
  // 等级系统
  level: 1,
  xp: 0,
  _levelUpUntil: 0, // 升级动画结束时间戳
};

function initPlayer() {
  player.x = Math.round(MAP_W * 0.08);
  player.y = CONFIG.LOWER_GROUND_Y - player.size + (CONFIG.FOOT_INSET || 0);
  player.hp = CONFIG.PLAYER_MAX_HP;
  player.maxHp = CONFIG.PLAYER_MAX_HP;
  player.invincibleUntil = 0;
  player.vy = 0;
  player.onLadder = false;
  player.facingRight = true;
  player.level = 1;
  player.xp = 0;
  player._levelUpUntil = 0;
}

// ---------- 等级属性加成（移速不变） ----------

function getDamageMult() {
  // 等级 1: 1.0, 等级 2: 1.56, 之后每级 +10%
  const base = [0, 1.0, 1.56];
  if (player.level <= 2) return base[player.level];
  let mult = base[2];
  for (let lv = 3; lv <= player.level; lv++) {
    mult *= 1.10;
  }
  return Math.round(mult * 100) / 100;
}

function getPlayerMaxHp() {
  // HP 上限固定，不随等级增长
  return CONFIG.PLAYER_MAX_HP;
}

// ---------- 经验拾取 ----------

function collectXP(amount) {
  if (player.level >= CONFIG.MAX_LEVEL) return;
  player.xp += amount;

  // 检查升级
  while (player.level < CONFIG.MAX_LEVEL && player.xp >= CONFIG.XP_LEVELS[player.level]) {
    player.level++;
    player._levelUpUntil = Date.now() + 1500; // 1.5 秒升级动画
    // 升级回血（只回缺失血量的一半，上限不变）
    player.maxHp = getPlayerMaxHp();
    const missing = player.maxHp - player.hp;
    player.hp = Math.min(player.maxHp, player.hp + Math.floor(missing / 2));
    // 全屏闪光
    effects.push({ type: 'flash', time: Date.now(), duration: 400, color: '#ffd94a' });
    // 升级粒子
    const cx = player.x + player.size / 2;
    const cy = player.y + player.size / 2;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      fxScreen.push({
        skill: 'levelup',
        worldX: cx + Math.cos(angle) * 4,
        worldY: cy + Math.sin(angle) * 4,
        w: 6, h: 6,
        time: Date.now() + i * 40,
        duration: 800,
        dir: angle,
      });
    }
  }
}

// ---------- 更新 ----------

function updatePlayer(keys) {
  if (player.hp <= 0) return;

  // 缓慢回血：每 3 秒回 1 HP
  const now = Date.now();
  if (!player._lastRegen) player._lastRegen = now;
  if (now - player._lastRegen >= 3000 && player.hp < player.maxHp) {
    player.hp = Math.min(player.maxHp, player.hp + 1);
    player._lastRegen = now;
  }

  const ladder = isOnLadder(player, player.size);
  const wantUp = keys['w'] || keys['arrowup'];
  const wantDown = keys['s'] || keys['arrowdown'];

  // ---- 梯子逻辑（最高优先级） ----
  // 进入梯子：在梯子范围内 + 按了上或下 + 不处于跳跃上升中（站在地上或下落时才能抓梯）
  if (ladder && (wantUp || wantDown) && (player.isOnGround || player.vy > 0)) {
    player.onLadder = true;
    player.vy = 0;
  }

  // 已经在爬梯状态
  if (player.onLadder) {
    // 离开梯子范围就掉下来
    if (!ladder) {
      player.onLadder = false;
    } else {
      // 上下爬
      if (wantUp) player.y -= CONFIG.CLIMB_SPEED;
      if (wantDown) player.y += CONFIG.CLIMB_SPEED;

      // 梯子上可以左右微调
      let dx = 0;
      if (keys['a']) { dx -= player.speed * 0.5; player.facingRight = false; }
      if (keys['d']) { dx += player.speed * 0.5; player.facingRight = true; }
      player.x += dx;
      player.x = Math.max(0, Math.min(MAP_W - player.size, player.x));

      // 梯子上按空格跳离（W 不跳离，因为 W 是用来爬的）
      if (keys[' ']) {
        player.onLadder = false;
        player.vy = CONFIG.JUMP_SPEED;
      }

      // 向下爬时：脚底到达下层平台就精准落地，不放梯子掉落
      if (wantDown) {
        const inset = CONFIG.FOOT_INSET || 0;
        const targetY = CONFIG.LOWER_GROUND_Y - player.size + inset;
        if (player.y >= targetY) {
          player.y = targetY;
          player.vy = 0;
          player.onLadder = false;
          player.isOnGround = true;
          return;
        }
      }

      // 向上爬时：头顶到达上层平台就停止
      if (wantUp) {
        const inset = CONFIG.FOOT_INSET || 0;
        const targetY = CONFIG.UPPER_GROUND_Y - player.size + inset;
        if (player.y <= targetY) {
          player.y = targetY;
          player.vy = 0;
          player.onLadder = false;
          player.isOnGround = true;
          return;
        }
      }

      return; // 梯子上不处理重力和普通跳跃
    }
  }

  // ---- 不在梯子上：水平移动 ----
  let dx = 0;
  if (keys['a']) { dx -= player.speed; player.facingRight = false; }
  if (keys['d']) { dx += player.speed; player.facingRight = true; }
  player.x += dx;
  player.x = Math.max(0, Math.min(MAP_W - player.size, player.x));

  // ---- 跳跃 ----
  const canJump = keys[' '] || keys['w'] || keys['arrowup'];

  // ---- 重力 ----
  player.vy += CONFIG.GRAVITY;
  if (player.vy > 20) player.vy = 20;
  player.y += player.vy;

  // ---- 平台落地 ----
  player.isOnGround = false;
  // 始终站在平台上，按 S 不会穿透掉落
  const landed = tryLandOnPlatform(player, player.size);
  if (landed) {
    player.isOnGround = true;
  }

  // 下层地面是硬地板，无法穿透（防止从层间掉落时漏检）
  if (player.y + player.size >= CONFIG.LOWER_GROUND_Y && player.vy >= 0) {
    player.y = CONFIG.LOWER_GROUND_Y - player.size + (CONFIG.FOOT_INSET || 0);
    player.vy = 0;
    player.isOnGround = true;
  }

  // ---- 跳跃触发 ----
  if (canJump && player.isOnGround && player.vy >= 0) {
    player.vy = CONFIG.JUMP_SPEED;
    player.isOnGround = false;
  }

  // 掉出屏幕保护（传回下层地面）
  if (player.y > MAP_H + 20) {
    player.y = CONFIG.LOWER_GROUND_Y - player.size + (CONFIG.FOOT_INSET || 0);
    player.vy = 0;
    takePlayerDamage(15);
  }
}

// ---------- 受伤 ----------

function takePlayerDamage(amount) {
  if (Date.now() < player.invincibleUntil) return;
  player.hp = Math.max(0, player.hp - amount);
  player.invincibleUntil = Date.now() + CONFIG.INVINCIBLE_DURATION;

  // 玩家受击音效
  if (typeof playPlayerHitSound === 'function') playPlayerHitSound();
}

function isPlayerAlive() {
  return player.hp > 0;
}

// ---------- 绘制 ----------

function drawPlayer(ctx) {
  if (player.hp <= 0) return;

  const s = player.size;
  const x = player.x;
  const y = player.y;

  // 升级发光
  const lvlUp = Date.now() < player._levelUpUntil;
  if (lvlUp) {
    const alpha = (player._levelUpUntil - Date.now()) / 1000;
    ctx.fillStyle = `rgba(255, 217, 74, ${alpha * 0.4})`;
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s * 0.9 + (1 - alpha) * 20, 0, Math.PI * 2);
    ctx.fill();
  }

  const invincible = Date.now() < player.invincibleUntil;
  if (invincible) {
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(Date.now() / 50);
  }

  ctx.save();
  ctx.translate(x + s / 2, y + s / 2);
  if (!player.facingRight) ctx.scale(-1, 1);
  const offset = -s / 2;

  // 红帽子
  ctx.fillStyle = '#e23b3b';
  ctx.fillRect(offset, -s * 0.5, s, s * 0.3);

  // 脸
  ctx.fillStyle = '#ffd9a0';
  ctx.fillRect(offset + s * 0.15, -s * 0.2, s * 0.7, s * 0.35);

  // 眼睛
  ctx.fillStyle = '#222222';
  ctx.fillRect(offset + s * 0.28, -s * 0.1, 3, 3);
  ctx.fillRect(offset + s * 0.65, -s * 0.1, 3, 3);

  // 蓝衣服
  ctx.fillStyle = '#3b6de2';
  ctx.fillRect(offset + s * 0.1, s * 0.15, s * 0.8, s * 0.35);

  ctx.restore();
  ctx.globalAlpha = 1;

  // 等级标签（头上）
  const lvlColors = ['', '#ffffff', '#4ac9ff', '#ff5ce1', '#ffd94a', '#00ff88'];
  ctx.fillStyle = lvlColors[player.level] || '#ffffff';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Lv.' + player.level, x + s / 2, y - 6);
  ctx.textAlign = 'start';
}

function drawPlayerUI(ctx) {
  const barW = 480, barH = 42, barX = 24, barY = 24;
  const padding = 18;
  const panelW = barW + padding * 2;
  // 始终显示击杀数，面板加高
  const isEndless = (typeof endlessMode !== 'undefined' && endlessMode);
  const panelH = barH + 12 + 24 + 18 + 64 + padding * 2;

  // ---- 背景面板 ----
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(barX, barY, panelW, panelH, 18);
  ctx.fill();
  ctx.stroke();

  const innerX = barX + padding;
  const innerY = barY + padding;

  // HP 条
  const hpBarX = innerX, hpBarY = innerY;
  ctx.fillStyle = '#111111';
  ctx.fillRect(hpBarX, hpBarY, barW, barH);
  ctx.strokeStyle = '#555555';
  ctx.lineWidth = 3;
  ctx.strokeRect(hpBarX, hpBarY, barW, barH);

  const pct = player.hp / player.maxHp;
  const r = Math.floor(100 + (1 - pct) * 155);
  const g = Math.floor(180 + pct * 75);
  ctx.fillStyle = `rgb(${r},${g},40)`;
  ctx.fillRect(hpBarX + 3, hpBarY + 3, (barW - 6) * pct, barH - 6);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 33px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('HP ' + Math.ceil(player.hp) + '/' + player.maxHp, hpBarX + barW / 2, hpBarY + barH - 9);
  ctx.textAlign = 'start';

  // ---- 等级与经验条 ----
  const xpBarY = hpBarY + barH + 12;
  const xpBarH = 24;

  ctx.fillStyle = '#111111';
  ctx.fillRect(hpBarX, xpBarY, barW, xpBarH);
  ctx.strokeStyle = '#444444';
  ctx.lineWidth = 3;
  ctx.strokeRect(hpBarX, xpBarY, barW, xpBarH);

  if (player.level < CONFIG.MAX_LEVEL) {
    const xpNeeded = CONFIG.XP_LEVELS[player.level];
    const prevNeeded = player.level > 1 ? CONFIG.XP_LEVELS[player.level - 1] : 0;
    const lvlXp = player.xp - prevNeeded;
    const lvlNeed = xpNeeded - prevNeeded;
    const xpPct = Math.min(1, lvlXp / lvlNeed);
    ctx.fillStyle = '#ffd94a';
    ctx.fillRect(hpBarX + 3, xpBarY + 3, (barW - 6) * xpPct, xpBarH - 6);
  } else {
    ctx.fillStyle = '#ffd94a';
    ctx.fillRect(hpBarX + 3, xpBarY + 3, barW - 6, xpBarH - 6);
  }

  // 等级标签
  const lvlColors = ['', '#ffffff', '#4ac9ff', '#ff5ce1', '#ffd94a', '#00ff88'];
  ctx.fillStyle = lvlColors[player.level] || '#ffffff';
  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('Lv.' + player.level, hpBarX + barW, xpBarY - 3);
  ctx.textAlign = 'start';

  // ---- 击杀数（始终显示在左上角面板中） ----
  const killY = xpBarY + xpBarH + 24;
  ctx.fillStyle = '#ff6b6b';
  ctx.font = 'bold 50px monospace';
  ctx.textAlign = 'left';
  const kc = typeof killCount !== 'undefined' ? killCount : 0;
  const killText = isEndless ? ('击杀: ' + kc) : ('击杀: ' + kc + '/' + CONFIG.TOTAL_MONSTERS);
  ctx.fillText(killText, innerX, killY + 48);
  ctx.textAlign = 'start';

  // ---- 升级动画 ----
  if (Date.now() < player._levelUpUntil) {
    const age = player._levelUpUntil - Date.now();
    const alpha = age / 1500;
    const scale = 1 + (1 - alpha) * 0.3;
    ctx.save();
    ctx.translate(CONFIG.VIEW_WIDTH / 2, CONFIG.VIEW_HEIGHT / 2 - 20);
    ctx.scale(scale, scale);
    // 文字
    ctx.fillStyle = `rgba(255, 217, 74, ${alpha * 0.9})`;
    ctx.font = `bold ${Math.round(36 + alpha * 20)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL UP!', 0, 0);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
    ctx.font = `bold ${Math.round(26 + alpha * 14)}px monospace`;
    ctx.fillText('Lv.' + player.level, 0, 30);
    ctx.restore();
    ctx.textAlign = 'start';
  }
}
