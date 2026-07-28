/* ===== 成就系统：事件计数 + 达成次数 + 持久化 ===== */
window.NR = window.NR || {};

NR.achieve = (function () {
  const DEFS = [
    { id: 'near',     name: '擦肩而过', desc: '与障碍擦身而过（累计 5 次）',   icon: '✦', target: 5 },
    { id: 'coins',    name: '金币大亨', desc: '收集金币（累计 50 枚）',        icon: '●', target: 50 },
    { id: 'djump',    name: '二段跳跃', desc: '完成二段跳（累计 10 次）',      icon: '▲', target: 10 },
    { id: 'power',    name: '道具猎人', desc: '拾取道具（累计 3 个）',         icon: '◆', target: 3 },
    { id: 'shield',   name: '护盾守护', desc: '用护盾抵挡撞击（每次达成）',     icon: '◈', target: 1 },
    { id: 'scene',    name: '世界旅行', desc: '穿越到新场景（每次达成）',       icon: '★', target: 1 },
    { id: 'marathon', name: '千米长跑', desc: '单局奔跑超过 1000 米',         icon: '✧', target: 1 },
    { id: 'maxspeed', name: '极速传说', desc: '单局速度达到 MAX',             icon: '➤', target: 1 },
    { id: 'record',   name: '破纪录者', desc: '刷新历史最高分',               icon: '✪', target: 1 }
  ];

  let data = NR.store.get('achieve', {});
  let toastCb = null;

  function save() { NR.store.set('achieve', data); }

  /* 事件上报：每跨过 target 的整数倍记为「达成一次」并弹出提示 */
  function bump(id, n) {
    n = n || 1;
    const def = DEFS.find(d => d.id === id);
    if (!def) return;
    const before = Math.floor((data[id] || 0) / def.target);
    data[id] = (data[id] || 0) + n;
    const after = Math.floor(data[id] / def.target);
    save();
    if (after > before && toastCb) toastCb(def, after);
  }

  function list() {
    return DEFS.map(d => {
      const count = data[d.id] || 0;
      return Object.assign({}, d, {
        count,
        times: Math.floor(count / d.target),
        prog: (count % d.target) / d.target
      });
    });
  }

  return {
    bump, list,
    onToast(cb) { toastCb = cb; }
  };
})();
