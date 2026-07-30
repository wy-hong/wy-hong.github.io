/* 成就系统（localStorage 缓存 + 后端数据库同步） */
import { ui, showToast } from './ui.js';
import * as api from './api.js';

export const ACHS = [
  { id: 'first',     ico: '►', name: '首次启航', desc: '完成第一局游戏' },
  { id: 'gems10',    ico: '◆', name: '晶石猎手', desc: '单局收集 10 颗晶石' },
  { id: 'gems50',    ico: '❖', name: '晶石大师', desc: '累计收集 50 颗晶石' },
  { id: 'combo5',    ico: '✦', name: '连环穿越', desc: '达成 5 连击' },
  { id: 'dist1k',    ico: '▲', name: '千里之行', desc: '单局飞行 1000 米' },
  { id: 'dist10k',   ico: '✧', name: '星际旅人', desc: '累计飞行 10000 米' },
  { id: 'score5k',   ico: '★', name: '高分玩家', desc: '单局获得 5000 分' },
  { id: 'shieldbrk', ico: '◈', name: '护盾粉碎', desc: '用护盾撞碎一个障碍' },
  { id: 'speed',     ico: '»', name: '极速狂飙', desc: '速度达到 800 km/h' },
  { id: 'magnet',    ico: '◉', name: '万有引力', desc: '单局用磁铁吸附 15 颗晶石' }
];

export let unlocked = {};
try { unlocked = JSON.parse(localStorage.getItem('neon_ach') || '{}'); } catch (e) {}

function save() { localStorage.setItem('neon_ach', JSON.stringify(unlocked)); }

/* 启动时从后端拉取成就并合并（离线则跳过） */
export async function loadAchievements() {
  const remote = await api.getAchievements();
  if (!remote) return;
  let changed = false;
  for (const id in remote) {
    if (!unlocked[id]) { unlocked[id] = true; changed = true; }
  }
  if (changed) save();
}

export function unlock(id) {
  if (unlocked[id]) return;
  unlocked[id] = true;
  save();
  api.syncAchievements({ [id]: true });
  const a = ACHS.find(x => x.id === id);
  if (a) showToast('★ 成就解锁：' + a.name);
}

export async function clearAllAchievements() {
  unlocked = {};
  save();
  await api.clearAchievements();
}

export function renderAch() {
  let html = '';
  ACHS.forEach(a => {
    const un = !!unlocked[a.id];
    html += '<div class="panel-item ' + (un ? 'hl' : 'locked') + '">' +
      '<div class="panel-ico">' + (un ? a.ico : '◇') + '</div>' +
      '<div class="panel-main"><div class="panel-name">' + a.name + '</div>' +
      '<div class="panel-desc">' + a.desc + '</div></div></div>';
  });
  ui.achList.innerHTML = html;
}
