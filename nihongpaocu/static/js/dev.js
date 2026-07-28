/* ============================================================
   开发者调试面板（独立文件）
   ⚠ 正式发布前：删除本文件，并删除 index.html 中对应的
     <script src="static/js/dev.js"></script> 引用即可完全移除。
   功能：
   - 无敌模式：撞击不结束游戏（便于场景/美术走查）
   - N 键：直接跳转到下一场景（场景测试）
   ============================================================ */
window.NR = window.NR || {};

NR.dev = (function () {
  let invincible = false;
  let btn = null, badge = null;

  const CSS = `
    .dev-btn { border-style: dashed !important; border-color: rgba(251, 113, 133, .6) !important;
      color: #fb7185 !important; }
    .dev-btn.on { background: rgba(251, 113, 133, .25) !important; color: #fff !important;
      border-style: solid !important; box-shadow: 0 0 18px rgba(251, 113, 133, .4) !important; }
    #dev-badge {
      display: none; position: fixed; left: 22px; bottom: 20px; z-index: 30;
      font-family: 'Orbitron', sans-serif; font-size: 11px; font-weight: 900; letter-spacing: 3px;
      color: #fff; background: rgba(251, 113, 133, .85); border-radius: 6px; padding: 6px 14px;
      box-shadow: 0 0 18px rgba(251, 113, 133, .6);
      animation: devPulse 1s infinite alternate; pointer-events: none;
    }
    @keyframes devPulse { from { opacity: 1; } to { opacity: .55; } }
  `;

  function inject() {
    // 自带样式，不污染 style.css
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    // 无敌模式按钮 → 注入开始界面菜单行
    const row = document.querySelector('#overlay-start .menu-row');
    if (row) {
      btn = document.createElement('button');
      btn.className = 'ghost-btn dev-btn';
      btn.id = 'btn-dev-invincible';
      btn.addEventListener('click', toggle);
      row.appendChild(btn);
      refreshBtn();
    }

    // 游玩时的无敌标识
    badge = document.createElement('div');
    badge.id = 'dev-badge';
    badge.textContent = 'INVINCIBLE';
    document.body.appendChild(badge);

    // N 键直接跳下一场景
    addEventListener('keydown', e => {
      if (e.code === 'KeyN') skipScene();
    });
  }

  function toggle() {
    invincible = !invincible;
    refreshBtn();
    badge.style.display = invincible ? 'block' : 'none';
  }

  function refreshBtn() {
    if (btn) {
      btn.textContent = '无敌模式 · ' + (invincible ? 'ON' : 'OFF');
      btn.classList.toggle('on', invincible);
    }
  }

  function skipScene() {
    if (!NR.world || !NR.spawner) return;
    const name = NR.world.nextTheme();
    NR.spawner.setTheme(NR.world.currentName());
    const el = document.getElementById('scene-name');
    if (el) el.textContent = name;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }

  return {
    get invincible() { return invincible; }
  };
})();
