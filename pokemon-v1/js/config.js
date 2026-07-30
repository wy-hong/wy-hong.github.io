// ============================================================
// 共享配置 config.js
// 视口 640×360，地图可更宽
// ============================================================

/** 去除白色背景，返回带透明通道的 Canvas（输入 Image） */
function removeWhiteBg(image) {
  const c = document.createElement('canvas');
  c.width = image.naturalWidth;
  c.height = image.naturalHeight;
  const cctx = c.getContext('2d');
  cctx.drawImage(image, 0, 0);
  return removeWhiteBgFromCanvas(c);
}

/** 去除白色背景（输入已有内容的 Canvas，原地处理并返回） */
function removeWhiteBgFromCanvas(c) {
  const cctx = c.getContext('2d');
  const imgData = cctx.getImageData(0, 0, c.width, c.height);
  const px = imgData.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    if (r > 235 && g > 235 && b > 235) {
      px[i + 3] = 0; // 透明
    }
  }
  cctx.putImageData(imgData, 0, 0);
  return c;
}

/** 生成精灵的单色剪影（保留原 alpha 形状），用于受击闪白等特效 */
function makeSilhouette(img, cssColor) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const cc = c.getContext('2d');
  cc.drawImage(img, 0, 0);
  cc.globalCompositeOperation = 'source-in'; // 只保留精灵形状内的颜色
  cc.fillStyle = cssColor;
  cc.fillRect(0, 0, c.width, c.height);
  return c;
}

const CONFIG = {
  // 视口（屏幕上看到的区域）
  VIEW_WIDTH: 640,
  VIEW_HEIGHT: 360,

  // 物理
  GRAVITY: 1.0,
  JUMP_SPEED: -25,
  CLIMB_SPEED: 12,

  // 地面高度（由 map.js 根据图片比例动态设置）
  UPPER_GROUND_Y: 0,
  LOWER_GROUND_Y: 0,

  // 玩家
  PLAYER_SIZE: 256,
  PLAYER_SPEED: 9,
  PLAYER_MAX_HP: 50,

  // 怪物
  MONSTER_SIZE: 200,
  MONSTER_MAX_HP: 100,
  MONSTER_SPEED: 4.2,
  MONSTER_CONTACT_DAMAGE: 20,

  // 无敌时间（毫秒）
  INVINCIBLE_DURATION: 1500,

  // 等级与经验
  XP_PER_KILL: 30,             // 击杀额外掉落
  XP_PER_DAMAGE: 0.45,         // 每1点伤害掉 0.45 XP（和伤害成正比）
  XP_LEVELS: [0, 150, 400, 800, 1400], // 累计经验需求
  MAX_LEVEL: 5,

  // 关卡：总共 3 只，开局 1 只，每 15 秒刷一只
  TOTAL_MONSTERS: 3,
  INITIAL_MONSTERS: 1,
  SPAWN_INTERVAL: 15000,        // 刷怪间隔（毫秒）
  ENDLESS_INITIAL_MONSTERS: 2,   // 无尽模式开局怪物数
  ENDLESS_SPAWN_INTERVAL: 10000,// 无尽模式初始刷怪间隔（杀4→4s一只，杀8→5s两只）
  SPAWN_MIN_DIST: 300,         // 刷怪离玩家最小距离

  // 平台边缘安全边距（怪物不能走过）
  PLATFORM_EDGE_MARGIN: 80,

  // 脚底内缩：精灵图可见脚部约在盒子底部上方 ~24px，
  // 落地时让盒底沉入地表 24px，使可见脚恰好踩在地表线上
  FOOT_INSET: 24,
};

// 相机偏移（main.js 每帧更新）
let cameraX = 0;
let cameraY = 0;
