// ============================================================
// 地图模块 map.js
// 背景：images/map.png  ｜  两层平台  ｜  梯子上下
// ============================================================

const mapImg = new Image();
mapImg.src = 'images/map.png';

// 雪山地图预加载
const snowMapImg = new Image();
snowMapImg.src = 'images/snow/map.png';
window._snowMapReady = false;
let _snowMapW = 1280, _snowMapH = 360;
let _snowPlatforms = [], _snowLadders = [];
let _snowUpperY = 0, _snowLowerY = 0;

snowMapImg.onload = () => {
  const origW = snowMapImg.naturalWidth;
  _snowMapW = origW * 2;
  _snowMapH = snowMapImg.naturalHeight;

  _snowUpperY = Math.round(_snowMapH * 0.221);
  _snowLowerY = Math.round(_snowMapH * 0.702);
  const thick = 18;

  _snowPlatforms = [
    { x: 0, y: _snowUpperY, w: _snowMapW, h: thick, level: 'upper' },
    { x: 0, y: _snowLowerY, w: _snowMapW, h: thick, level: 'lower' },
  ];

  const ladderW = 80;
  _snowLadders = [
    { x: Math.round(origW * 0.030), w: ladderW, top: _snowUpperY, bottom: _snowLowerY + thick },
    { x: Math.round(origW * 0.085), w: ladderW, top: _snowUpperY, bottom: _snowLowerY + thick },
    { x: Math.round(origW * 0.485), w: ladderW, top: _snowUpperY, bottom: _snowLowerY + thick },
    { x: origW + Math.round(origW * 0.030), w: ladderW, top: _snowUpperY, bottom: _snowLowerY + thick },
    { x: origW + Math.round(origW * 0.085), w: ladderW, top: _snowUpperY, bottom: _snowLowerY + thick },
    { x: origW + Math.round(origW * 0.485), w: ladderW, top: _snowUpperY, bottom: _snowLowerY + thick },
  ];

  _snowMapReady = true;
};
snowMapImg.onerror = () => { _snowMapReady = false; };

let MAP_W = 1280;  // 默认值，图片加载后更新
let MAP_H = 360;
let PLATFORMS = [];
let LADDERS = [];
let mapReady = false;

function initMapFromImage() {
  const origW = mapImg.naturalWidth;
  MAP_W = origW * 2;          // 地图往右延伸一倍
  MAP_H = mapImg.naturalHeight;

  // 两层平台的表面 Y 坐标（基于 map.png 像素实测：上层草皮顶 ~354/1600，下层 ~1123/1600）
  const upperY = Math.round(MAP_H * 0.221);
  const lowerY = Math.round(MAP_H * 0.702);
  const thick = 18;

  CONFIG.UPPER_GROUND_Y = upperY;
  CONFIG.LOWER_GROUND_Y = lowerY;

  // 两层地面（整行可 walk，跨越整个拓展地图）
  PLATFORMS = [
    { x: 0, y: upperY, w: MAP_W, h: thick, level: 'upper' },
    { x: 0, y: lowerY, w: MAP_W, h: thick, level: 'lower' },
  ];

  // 梯子：左半区 + 右半区镜像
  const ladderW = 80;
  LADDERS = [
    // ---- 左半区（原始位置）----
    { x: Math.round(origW * 0.030), w: ladderW, top: upperY, bottom: lowerY + thick },
    { x: Math.round(origW * 0.085), w: ladderW, top: upperY, bottom: lowerY + thick },
    { x: Math.round(origW * 0.485), w: ladderW, top: upperY, bottom: lowerY + thick },
    // ---- 右半区（镜像）----
    { x: origW + Math.round(origW * 0.030), w: ladderW, top: upperY, bottom: lowerY + thick },
    { x: origW + Math.round(origW * 0.085), w: ladderW, top: upperY, bottom: lowerY + thick },
    { x: origW + Math.round(origW * 0.485), w: ladderW, top: upperY, bottom: lowerY + thick },
  ];

  mapReady = true;
}

mapImg.onload = () => {
  initMapFromImage();
  // 如果用户已经按了开始，地图刚加载完，自动启动
  if (window._pendingLaunch) {
    window._pendingLaunch = false;
    if (typeof applyCanvasSize === 'function') applyCanvasSize();
    if (typeof startGame === 'function') startGame();
  }
};

// ---------- 绘制 ----------

function drawMap(ctx) {
  // 画地图背景：左半区 + 右半区镜像（世界坐标，相机会通过 ctx.translate 处理偏移）
  if (mapReady) {
    const origW = mapImg.naturalWidth;
    ctx.drawImage(mapImg, 0, 0);
    ctx.drawImage(mapImg, origW, 0);
  } else {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, MAP_W, MAP_H);
  }
}

// ---------- 碰撞工具 ----------

function getPlatforms() {
  return PLATFORMS;
}

function getLadders() {
  return LADDERS;
}

// 检查实体中心是否在某个梯子范围内
function isOnLadder(entity, size) {
  const cx = entity.x + size / 2;
  for (const l of LADDERS) {
    if (cx >= l.x && cx <= l.x + l.w &&
        entity.y + size >= l.top && entity.y <= l.bottom) {
      return l;
    }
  }
  return null;
}

// 找距离某个 x 坐标最近的梯子（用于怪物 AI）
function getNearestLadder(x) {
  let nearest = null;
  let best = Infinity;
  for (const l of LADDERS) {
    const d = Math.abs(x - (l.x + l.w / 2));
    if (d < best) {
      best = d;
      nearest = l;
    }
  }
  return nearest;
}

// 检查实体是否落在某个平台上（从上方接触）
// 下层战斗时无视上层平台，避免误撞上层地面
function tryLandOnPlatform(entity, entitySize) {
  for (const p of PLATFORMS) {
    // 实体在下方战斗区 → 不检测上层平台
    if (p.level === 'upper' && entity.y > CONFIG.UPPER_GROUND_Y + 50) continue;
    if (entity.x + entitySize > p.x + 2 && entity.x < p.x + p.w - 2) {
      const bottom = entity.y + entitySize;
      const prevBottom = bottom - entity.vy;
      const inset = CONFIG.FOOT_INSET || 0;
      // 阈值含 inset：沉入 FOOT_INSET 后静止时 prevBottom = p.y + inset，
      // 每帧重力下拉后必须仍能判为落地，否则会穿透平台
      if (prevBottom <= p.y + 4 + inset && bottom >= p.y && entity.vy >= 0) {
        // 脚底内缩：盒底沉入地表 FOOT_INSET，使精灵可见脚恰好踩在地表
        entity.y = p.y - entitySize + inset;
        entity.vy = 0;
        return true;
      }
    }
  }
  return false;
}

// 判断实体当前在哪一层
function getEntityLevel(entity, size) {
  // 用脚底到平台面的距离判断层级，而不是实体中心到平台中点的距离。
  // 避免玩家在下层跳跃时中心 Y 漂到上层平台附近导致误判。
  const feetY = entity.y + size;
  const distToUpper = Math.abs(feetY - CONFIG.UPPER_GROUND_Y);
  const distToLower = Math.abs(feetY - CONFIG.LOWER_GROUND_Y);
  return distToUpper < distToLower ? 'upper' : 'lower';
}

// ---- 场景切换 ----

/** 切换到雪山场景。返回 true 成功，false 雪山地图未就绪 */
function switchToSnowScene() {
  if (!_snowMapReady) return false;

  MAP_W = _snowMapW;
  MAP_H = _snowMapH;
  PLATFORMS = _snowPlatforms;
  LADDERS = _snowLadders;
  CONFIG.UPPER_GROUND_Y = _snowUpperY;
  CONFIG.LOWER_GROUND_Y = _snowLowerY;

  gameScene = 'snow';
  _sceneSwitchedAt = Date.now();

  // 切换 BGM 到雪山风格
  if (typeof setBGMScene === 'function') setBGMScene('snow');

  // 重设画布大小
  if (typeof applyCanvasSize === 'function') applyCanvasSize();

  return true;
}

/** 获取当前场景的地图图片（用于绘制） */
function getCurrentMapImg() {
  return gameScene === 'snow' ? snowMapImg : mapImg;
}

function isCurrentMapReady() {
  return gameScene === 'snow' ? _snowMapReady : mapReady;
}
