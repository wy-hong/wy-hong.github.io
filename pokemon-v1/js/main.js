// ============================================================
// 主循环 main.js
// 相机仅水平跟随，垂直固定全高 ｜ Canvas 适配地图高度
// ============================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ---- 精灵图片 ----

// stand 和 run 图片均已是透明底，直接使用 Image 对象
const sprStand = new Image();
let sprStandWhite = null; // 白色剪影（无敌闪烁用）
sprStand.onload = () => { sprStandWhite = makeSilhouette(sprStand, '#ffffff'); };
sprStand.src = 'images/stand.png';

// 跑动动画：run1.png ~ run4.png 四帧独立透明图
const sprRunFrames = [];
const sprRunWhites = [];
let _runFrameCount = 0;
for (let i = 0; i < 4; i++) {
  const img = new Image();
  img.onload = (function (idx, im) {
    return function () {
      sprRunFrames[idx] = im;
      sprRunWhites[idx] = makeSilhouette(im, '#ffffff');
      _runFrameCount++;
    };
  })(i, img);
  img.src = 'images/run' + (i + 1) + '.png';
}

// 跑步帧计时器
let _runFrameIdx = 0;

// ====== 游戏设置 ======
const SETTINGS = {
  mapScroll: true, // 默认水平滚动
};
// 从 localStorage 读取已有设置
try {
  const saved = localStorage.getItem('pokemon_settings');
  if (saved) Object.assign(SETTINGS, JSON.parse(saved));
} catch (_) {}

function saveSettings() {
  try { localStorage.setItem('pokemon_settings', JSON.stringify(SETTINGS)); } catch (_) {}
}

// ====== 关键状态变量（必须提前声明，避免 drawSplashParticles 等函数在 TDZ 中访问）======
let gameStarted = false;
let gameOver = false;
let paused = false;
let endlessMode = true;
let killCount = 0;
let _victoryTime = 0;
let _loopGen = 0;

// ====== 按键提示页逻辑 ======
const splashScreen = document.getElementById('splash-screen');
const splashCanvas = document.getElementById('splash-particles');
const splashCtx = splashCanvas.getContext('2d');
// ---- 粒子系统 ----
const splashParticles = [];
const SPLASH_PARTICLE_COUNT = 55;
for (let i = 0; i < SPLASH_PARTICLE_COUNT; i++) {
  splashParticles.push({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 2.2 + 0.6,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5 - 0.15,
    alpha: Math.random() * 0.5 + 0.2,
    twinkleSpeed: Math.random() * 0.02 + 0.008,
  });
}

function resizeSplashCanvas() {
  splashCanvas.width = window.innerWidth;
  splashCanvas.height = window.innerHeight;
}
resizeSplashCanvas();
window.addEventListener('resize', resizeSplashCanvas);

function drawSplashParticles() {
  if (gameStarted) return;
  splashCtx.clearRect(0, 0, splashCanvas.width, splashCanvas.height);

  for (const p of splashParticles) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x = splashCanvas.width;
    if (p.x > splashCanvas.width) p.x = 0;
    if (p.y < 0) p.y = splashCanvas.height;
    if (p.y > splashCanvas.height) p.y = 0;

    p.alpha += p.twinkleSpeed;
    if (p.alpha > 0.7 || p.alpha < 0.15) p.twinkleSpeed *= -1;

    splashCtx.beginPath();
    splashCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    splashCtx.fillStyle = `rgba(255, 217, 74, ${p.alpha})`;
    splashCtx.fill();
  }

  requestAnimationFrame(drawSplashParticles);
}
drawSplashParticles();

// 开始游戏
window._pendingLaunch = false;
window.launchGame = function () {
  if (gameStarted) return;
  splashScreen.classList.add('hidden');

  if (!mapReady) {
    window._pendingLaunch = true;
    return;
  }

  // 初始化音频并启动背景音乐
  if (typeof initAudio === 'function') initAudio();
  if (typeof startBGM === 'function') startBGM();

  applyCanvasSize();
  startGame();
};

// Canvas 尺寸根据设置决定
function applyCanvasSize() {
  if (SETTINGS.mapScroll) {
    canvas.width = Math.round(MAP_W * 0.455);
  } else {
    canvas.width = MAP_W;
  }
  canvas.height = MAP_H;
  CONFIG.VIEW_WIDTH = canvas.width;
  CONFIG.VIEW_HEIGHT = canvas.height;
}

// 键盘监听
const keys = {};

// 暂停切换（P 键和右上角按钮共用）
function togglePause() {
  if (!gameStarted || gameOver) return;
  paused = !paused;
  if (!paused) {
    hideEndButtons();
  }
  updatePauseBtnUI();
}

function updatePauseBtnUI() {
  const btn = document.getElementById('pause-btn');
  btn.classList.toggle('paused', paused);
  btn.innerHTML = paused ? '&#9654;' : '&#10074;&#10074;';
}

document.getElementById('pause-btn').addEventListener('click', togglePause);

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  // P 键暂停/继续（仅在游戏运行且未结束时）
  if (k === 'p' && gameStarted && !gameOver) {
    e.preventDefault();
    togglePause();
    return;
  }
  keys[k] = true;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

const WIN_KILLS = CONFIG.TOTAL_MONSTERS;  // 击杀全部 3 只胜利

function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  gameOver = false;

  // 递增循环版本号，防止旧循环残留
  _loopGen++;
  _currentLoopGen = _loopGen;

  // Canvas 尺寸由 applyCanvasSize 在 launchGame 中已设置
  // 这里做兜底
  if (canvas.width === 0) applyCanvasSize();

  initPlayer();
  resetSpawner();
  resetBattleState();

  // 显示右上角暂停按钮
  document.getElementById('pause-btn').classList.add('visible');
  updatePauseBtnUI();

  scheduleNextFrame();
}

function restartGame() {
  // 递增循环版本号，使所有旧 gameLoop 实例立即退出
  _loopGen++;
  _currentLoopGen = _loopGen;

  // 重置暂停状态
  paused = false;
  updatePauseBtnUI();
  // 隐藏结束按钮
  hideEndButtons();
  // 清空怪物数组
  monsters.length = 0;
  // 重置击杀计数
  killCount = 0;
  _victoryTime = 0;
  // 重新计算 canvas 尺寸（可能设置已变更）
  applyCanvasSize();
  // 重置玩家
  initPlayer();
  // 重置刷怪系统
  resetSpawner();
  // 重置战斗状态
  resetBattleState();
  // 重新开始
  gameOver = false;
  gameStarted = true;

  // 重新显示右上角暂停按钮
  document.getElementById('pause-btn').classList.add('visible');
  updatePauseBtnUI();

  // 确保 BGM 在播放（可能在暂停/结束画面被停止）
  if (typeof startBGM === 'function') startBGM();

  scheduleNextFrame();
}

function resetBattleState() {
  lastUsed.j = 0; lastUsed.k = 0; lastUsed.l = 0; lastUsed.i = 0;
  _hitThisCast.j = false; _hitThisCast.k = false; _hitThisCast.l = false; _hitThisCast.i = false;
  effects.length = 0;
  fxScreen.length = 0;
  xpOrbs.length = 0;
  hpOrbs.length = 0;
  monsterProjectiles.length = 0;
  Object.keys(_frozenCollisionFlag).forEach(k => delete _frozenCollisionFlag[k]);
  _victoryTime = 0;
}

// ---------- 相机（仅水平跟随）----------

function updateCamera() {
  // 全图模式：不滚动，始终看全图
  if (!SETTINGS.mapScroll) {
    cameraX = 0;
    cameraY = 0;
    return;
  }
  // 滚动模式：水平跟随玩家
  const targetX = player.x + player.size / 2 - canvas.width * 0.35;
  cameraX += (targetX - cameraX) * 0.18;
  cameraX = Math.max(0, Math.min(MAP_W - canvas.width, cameraX));
  cameraY = 0; // 垂直不滚动
}

// ---------- 绘制（上下文已平移相机偏移，直接用世界坐标画）----------

function drawMapOnScreen(ctx) {
  if (mapReady) {
    const origW = mapImg.naturalWidth;
    ctx.drawImage(mapImg, 0, 0);
    ctx.drawImage(mapImg, origW, 0);
  } else {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, MAP_W, MAP_H);
  }
}

function drawPlayerOnScreen(ctx) {
  if (player.hp <= 0) return;
  const s = player.size;
  const x = player.x;
  const y = player.y;

  // 选择图片：移动中切换 run 帧，否则 stand
  const moving = keys['a'] || keys['d'] || keys['arrowleft'] || keys['arrowright'];
  let img = null, whiteImg = null;
  if (moving && _runFrameCount === 4) {
    // 每 100ms 切换一帧，循环 0→1→2→3→0...
    _runFrameIdx = Math.floor(Date.now() / 100) % 4;
    img = sprRunFrames[_runFrameIdx];
    whiteImg = sprRunWhites[_runFrameIdx];
  } else if (sprStand.complete && sprStand.naturalWidth > 0) {
    img = sprStand;
    whiteImg = sprStandWhite;
  }
  if (!img) {
    // 图片未加载完成时的后备绘制（简单色块）
    ctx.fillStyle = '#ffcb05';
    ctx.fillRect(x, y, s, s);
    return;
  }

  const invincible = Date.now() < player.invincibleUntil;
  ctx.save();
  // 统一以精灵中心为原点；朝右时镜像（原图朝左）
  ctx.translate(x + s / 2, y + s / 2);
  if (player.facingRight) ctx.scale(-1, 1);

  ctx.drawImage(img, -s / 2, -s / 2, s, s);

  // 无敌闪烁：叠加白色剪影（只覆盖精灵形状，无白底）
  if (invincible && whiteImg) {
    ctx.globalAlpha = 0.45 + 0.3 * Math.sin(Date.now() / 50);
    ctx.drawImage(whiteImg, -s / 2, -s / 2, s, s);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // 升级发光（在图片上层）
  const lvlUp = Date.now() < player._levelUpUntil;
  if (lvlUp) {
    const alpha = (player._levelUpUntil - Date.now()) / 1500;
    ctx.fillStyle = `rgba(255, 217, 74, ${alpha * 0.4})`;
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s * 0.9 + (1 - alpha) * 20, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- 主循环 ----------

// 当前循环的版本号，由 startGame/restartGame 传入
let _currentLoopGen = 0;

function scheduleNextFrame() {
  const gen = _currentLoopGen;
  const loop = () => {
    if (_loopGen !== gen) return;
    gameLoop();
  };
  requestAnimationFrame(loop);
}

function gameLoop() {
  // 暂停状态：绘制暂停画面，保持循环但不更新游戏逻辑
  if (paused) {
    drawPauseScreen();
    document.getElementById('restart-btn').classList.add('visible');
    scheduleNextFrame();
    return;
  }

  updateCamera();

  // 更新（世界坐标）
  updatePlayer(keys);

  // 刷怪调度
  trySpawnWave(player);

  // 处理玩家攻击（动画+冷却，每帧一次）
  processPlayerAttacks(keys, player);

  // 更新所有怪物 AI + 命中判定
  updateMonsterAI(player);
  for (const m of monsters) {
    handleBattle(keys, player, m);
  }

  // 检查怪物死亡
  for (const m of monsters) {
    if (checkMonsterDeath(m)) {
      killCount++;
    }
  }

  // 清理死亡怪物（尸体动画播完后才移除）
  for (let i = monsters.length - 1; i >= 0; i--) {
    const m = monsters[i];
    if (!m.alive && m.deathTime && Date.now() - m.deathTime > 1000) {
      monsters.splice(i, 1);
    }
  }

  // 更新怪物弹道 + 碰撞玩家
  updateMonsterProjectiles();
  checkProjectilePlayerCollision(player);

  // 冰冻碰撞爆炸检测
  checkFrozenCollision();

  // 更新经验球 + 拾取
  updateXpOrbs();
  checkXpPickup(player);

  // 更新血包 + 拾取
  updateHpOrbs();
  checkHpPickup(player);

  const lose = !isPlayerAlive();

  // 绘制
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 相机平移：世界坐标 → 屏幕坐标
  ctx.save();
  ctx.translate(-cameraX, -cameraY);

  drawMapOnScreen(ctx);
  drawMonster(ctx);
  drawPlayerOnScreen(ctx);
  drawEffects(ctx);
  drawXpOrbs(ctx);
  drawHpOrbs(ctx);
  drawMonsterProjectiles(ctx);
  drawUI(ctx);

  ctx.restore();

  // 屏幕固定 UI
  drawPlayerUI(ctx);
  drawSkillBar(ctx);

  // 右上角暂停按钮
  const pauseBtnX = CONFIG.VIEW_WIDTH - 48;
  const pauseBtnY = 8;
  const pauseBtnW = 38;
  const pauseBtnH = 22;
  ctx.fillStyle = paused ? 'rgba(74,201,255,0.85)' : 'rgba(255,255,255,0.12)';
  ctx.strokeStyle = paused ? '#4ac9ff' : 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(pauseBtnX, pauseBtnY, pauseBtnW, pauseBtnH, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = paused ? '#000' : '#fff';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(paused ? '▶' : '⏸', pauseBtnX + pauseBtnW / 2, pauseBtnY + pauseBtnH / 2 + 4);
  ctx.textAlign = 'start';
  // 存下来给 click 用
  canvas._pauseBtnRect = { x: pauseBtnX, y: pauseBtnY, w: pauseBtnW, h: pauseBtnH };


  // 经验球调试（非无尽模式）
  if (!endlessMode) {
    ctx.fillStyle = '#ffd94a';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('经验球: ' + xpOrbs.length, CONFIG.VIEW_WIDTH - 12, pauseBtnY + pauseBtnH + 38);
  }
  ctx.textAlign = 'start';

  // 下一波倒计时提示
  if (endlessMode) {
    // 动态间隔（与 monster.js 保持同步）
    let interval = CONFIG.ENDLESS_SPAWN_INTERVAL;
    if (killCount >= 8) interval = 5000;
    else if (killCount >= 4) interval = 4000;

    const aliveCount = monsters.filter(m => m.alive).length;
    if (aliveCount > 0) {
      const nextSpawn = _spawnTimer + interval;
      const remain = Math.ceil((nextSpawn - Date.now()) / 1000);
      if (remain > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('下一只 ' + remain + ' 秒后出现', CONFIG.VIEW_WIDTH / 2, CONFIG.VIEW_HEIGHT - 30);
        ctx.textAlign = 'start';
      }
    } else {
      // 怪全打完了，提前刷怪
      ctx.fillStyle = 'rgba(255, 107, 107, 0.7)';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('新的精灵即将出现！', CONFIG.VIEW_WIDTH / 2, CONFIG.VIEW_HEIGHT - 30);
      ctx.textAlign = 'start';
    }
  } else if (killCount < WIN_KILLS) {
    const aliveCount = monsters.filter(m => m.alive).length;
    if (aliveCount > 0) {
      const nextSpawn = _spawnTimer + CONFIG.SPAWN_INTERVAL;
      const remain = Math.ceil((nextSpawn - Date.now()) / 1000);
      if (remain > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('下一只 ' + remain + ' 秒后出现', CONFIG.VIEW_WIDTH / 2, CONFIG.VIEW_HEIGHT - 30);
        ctx.textAlign = 'start';
      }
    } else {
      // 怪全打完了，提示即将刷怪
      ctx.fillStyle = 'rgba(255, 200, 50, 0.7)';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('新的精灵即将出现！', CONFIG.VIEW_WIDTH / 2, CONFIG.VIEW_HEIGHT - 30);
      ctx.textAlign = 'start';
    }
  }

  if (!endlessMode && killCount >= WIN_KILLS) {
    // 延迟 1 秒弹出胜利画面（等尸体闪完）
    if (!_victoryTime) _victoryTime = Date.now();
    if (Date.now() - _victoryTime >= 1000) {
      showEndScreen('#ffd94a', '胜 利 ！', '你击败了 ' + WIN_KILLS + ' 只精灵！', '#4ac9ff');
      gameOver = true;
      return;
    }
    // 还没到时间，继续跑一帧
    scheduleNextFrame();
    return;
  }
  if (endlessMode) {
    // 无尽模式：只有死亡才会结束，否则永远继续
    if (lose) {
      showEndScreen('#e23b3b', '失 败 ！', '击杀: ' + killCount + ' 只', '#ff6b6b');
      gameOver = true;
      return;
    }
  } else if (lose) {
    showEndScreen('#e23b3b', '失 败 ！', '点击下方按钮重新挑战', '#aaaaaa');
    gameOver = true;
    return;
  }

  scheduleNextFrame();
}

function showEndScreen(titleColor, title, subtitle, subColor) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // 不显示标题（失败/胜利），只显示击杀数，字体更大
  ctx.fillStyle = subColor;
  ctx.font = 'bold 72px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 - 10);
  // 显示重新开始按钮
  document.getElementById('restart-btn').classList.add('visible');
  // 隐藏暂停按钮
  document.getElementById('pause-btn').classList.remove('visible');
}

function drawPauseScreen() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('暂  停', canvas.width / 2, canvas.height / 2 - 10);
  ctx.fillStyle = '#aaa';
  ctx.font = '16px monospace';
  ctx.fillText('按 P 键继续', canvas.width / 2, canvas.height / 2 + 50);
}

function hideEndButtons() {
  document.getElementById('restart-btn').classList.remove('visible');
}

// 重新开始按钮（游戏结束或暂停时可用）
document.getElementById('restart-btn').addEventListener('click', () => {
  if (gameOver || paused) {
    restartGame();
  }
});

// 图片加载完成时不自动启动，等待用户点击起始页按钮
if (mapImg.complete && mapImg.naturalWidth > 0) {
  initMapFromImage();
}

// Canvas 点击检测暂停按钮
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  const b = canvas._pauseBtnRect;
  if (b && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
    togglePause();
  }
});
