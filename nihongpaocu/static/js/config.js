/* ===== 全局配置与常量 ===== */
window.NR = window.NR || {};

NR.CONF = {
  LANES: [-2.2, 0, 2.2],
  GRAV: -32,
  JUMP_V: 11.5,
  STAND_H: 1.62,
  SLIDE_H: 0.72,
  PLAYER_HW: 0.34,
  PLAYER_HD: 0.3,
  BASE_SPEED: 13,
  MAX_SPEED: 30,
  SPEED_RAMP: 0.14,          // 每秒增速
  MAGNET_TIME: 8,            // 磁铁持续秒数
  MAGNET_RANGE: 4.2,         // 磁铁吸附半径
  RAGE_TIME: 15,             // 红色无敌道具持续秒数
  RAGE_BONUS: 30,            // 无敌撞碎障碍加分
  SHIELD_BONUS: 15,          // 护盾撞碎障碍加分
  MILESTONE: 400,            // 里程碑间隔分
  STREAK_WINDOW: 1.5,        // 连击有效窗口秒
  POWERUP_CHANCE: 0.14       // 每行生成道具概率
};

/* 皮肤定义：body=主色 emissive=发光色 visor=面罩色 */
NR.SKINS = [
  { id: 'cyan',    name: '经典青', body: 0x22d3ee, emissive: 0x0e7490, visor: 0xfde047, css: '#22d3ee' },
  { id: 'magenta', name: '霓虹粉', body: 0xe879f9, emissive: 0xa21caf, visor: 0x67e8f9, css: '#e879f9' },
  { id: 'lime',    name: '电光绿', body: 0xa3e635, emissive: 0x4d7c0f, visor: 0x0ea5e9, css: '#a3e635' },
  { id: 'amber',   name: '熔岩橙', body: 0xfb923c, emissive: 0xc2410c, visor: 0x22d3ee, css: '#fb923c' },
  { id: 'violet',  name: '幻影紫', body: 0x8b5cf6, emissive: 0x5b21b6, visor: 0xfde047, css: '#8b5cf6' }
];

/* 本地存储工具 */
NR.store = {
  get(key, def) {
    try {
      const v = localStorage.getItem('neonrush_' + key);
      return v === null ? def : JSON.parse(v);
    } catch (e) { return def; }
  },
  set(key, val) {
    try { localStorage.setItem('neonrush_' + key, JSON.stringify(val)); } catch (e) {}
  }
};

/* 排行榜（本地 Top 10） */
NR.rank = {
  list() { return NR.store.get('rank', []); },
  add(score, dist, coins) {
    const list = NR.rank.list();
    const now = new Date();
    const p2 = n => String(n).padStart(2, '0');
    list.push({
      score: score, dist: dist, coins: coins,
      date: now.getFullYear() + '/' + p2(now.getMonth() + 1) + '/' + p2(now.getDate()) + ' ' +
            p2(now.getHours()) + ':' + p2(now.getMinutes()) + ':' + p2(now.getSeconds())
    });
    list.sort((a, b) => b.score - a.score);
    const top = list.slice(0, 10);
    NR.store.set('rank', top);
    return top.indexOf(list.find(r => r.score === score)) >= 0 ? list.indexOf(list.find(r => r.score === score)) : -1;
  },
  clear() { NR.store.set('rank', []); }
};
