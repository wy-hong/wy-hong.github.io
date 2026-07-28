/* 全局配置与工具函数 */

export const TRACK_W = 30, TRACK_LEN = 320;
export const BASE_SPEED = 46, MAX_SPEED = 150;
export const PLAYER_Z = 8, PLAYER_Y = 1.15, LANES_X = 22;

/* 移动设备识别：移动设备使用更大的视角(FOV)与略高的触屏灵敏度 */
export const IS_MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
export const BASE_FOV = IS_MOBILE ? 86 : 72;
export const TOUCH_SENS = IS_MOBILE ? 0.17 : 0.14;

/* 弯道函数：以行驶里程为参数的道路中心横向偏移 */
export function roadX(d) { return 14 * Math.sin(d * 0.005) + 8 * Math.sin(d * 0.0016); }

export function rand(a, b) { return a + Math.random() * (b - a); }
export function laneX() { return (Math.random() * 2 - 1) * LANES_X; }
