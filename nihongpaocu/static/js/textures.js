/* ===== 程序化贴图：全部素材由 Canvas 生成，零外部资源 ===== */
window.NR = window.NR || {};

NR.textures = (function () {

  /* 网格地面（颜色可按主题定制） */
  function grid(base, line, sub) {
    base = base || '#0d1030';
    line = line || 'rgba(56, 189, 248, .28)';
    sub = sub || 'rgba(56, 189, 248, .08)';
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = line; g.lineWidth = 2;
    g.strokeRect(1, 1, 126, 126);
    g.strokeStyle = sub;
    g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.moveTo(0, 64); g.lineTo(128, 64); g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5, 52);
    return t;
  }

  /* 建筑发光窗户 */
  function windows() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#070918'; g.fillRect(0, 0, 128, 256);
    const colors = ['#67e8f9', '#f0abfc', '#fde68a', '#a5b4fc'];
    for (let y = 10; y < 240; y += 18) {
      for (let x = 10; x < 112; x += 18) {
        if (Math.random() < 0.42) {
          g.fillStyle = colors[(Math.random() * colors.length) | 0];
          g.globalAlpha = 0.5 + Math.random() * 0.5;
          g.fillRect(x, y, 9, 11);
        }
      }
    }
    g.globalAlpha = 1;
    return new THREE.CanvasTexture(c);
  }

  /* 合成波条纹太阳（颜色可按主题定制） */
  function sun(c1, c2, c3) {
    c1 = c1 || '#ffd166'; c2 = c2 || '#ff5e8a'; c3 = c3 || '#c026d3';
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, c1);
    grad.addColorStop(0.5, c2);
    grad.addColorStop(1, c3);
    g.fillStyle = grad;
    g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'destination-out';
    let h = 2;
    for (let y = 130; y < 256; y += 14 + h) { g.fillRect(0, y, 256, h); h += 1.5; }
    return new THREE.CanvasTexture(c);
  }

  /* 极光幕帘（雪原场景） */
  function aurora() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    for (let x = 0; x < 512; x++) {
      const hue = 150 + Math.sin(x * 0.02) * 40 + Math.sin(x * 0.006) * 60;
      const amp = 0.5 + 0.5 * Math.sin(x * 0.013 + 1.7);
      const grad = g.createLinearGradient(0, 0, 0, 128);
      grad.addColorStop(0, 'hsla(' + hue + ', 90%, 65%, 0)');
      grad.addColorStop(0.35, 'hsla(' + hue + ', 90%, 62%, ' + (0.5 * amp + 0.18) + ')');
      grad.addColorStop(1, 'hsla(' + hue + ', 90%, 55%, 0)');
      g.fillStyle = grad;
      g.fillRect(x, 0, 1, 128);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    return t;
  }

  /* 警示斜纹（矮栏） */
  function hazard() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#f97316'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#431407';
    for (let i = -64; i < 128; i += 24) {
      g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 16, 0); g.lineTo(i + 28, 0); g.lineTo(i + 12, 64); g.fill();
    }
    return new THREE.CanvasTexture(c);
  }

  /* 径向光斑（粒子/光晕通用） */
  function glow() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  /* 警示符号 ! */
  function warn() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.font = '900 48px Orbitron, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#fde047'; g.shadowBlur = 12;
    g.fillStyle = '#fde047'; g.fillText('!', 32, 34);
    return new THREE.CanvasTexture(c);
  }

  /* 渐变天空（stops: [[位置, 颜色], ...]） */
  function sky(stops) {
    stops = stops || [[0, '#070a24'], [0.4, '#1b1040'], [0.72, '#3b1663'], [1, '#0a0618']];
    const c = document.createElement('canvas');
    c.width = 2; c.height = 512;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 512);
    stops.forEach(([pos, col]) => grad.addColorStop(pos, col));
    g.fillStyle = grad; g.fillRect(0, 0, 2, 512);
    return new THREE.CanvasTexture(c);
  }

  /* 木纹（雨林障碍/平台） */
  function wood() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#7c4a1e'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 16) {
      g.fillStyle = 'rgba(66, 36, 10, ' + (0.25 + Math.random() * 0.3) + ')';
      g.fillRect(0, y, 128, 3);
      g.fillStyle = 'rgba(255, 214, 150, .08)';
      g.fillRect(0, y + 8, 128, 2);
    }
    g.strokeStyle = 'rgba(66, 36, 10, .35)';
    for (let i = 0; i < 10; i++) {
      g.beginPath();
      const y = Math.random() * 128;
      g.moveTo(0, y);
      g.bezierCurveTo(40, y + 4, 90, y - 4, 128, y + 2);
      g.stroke();
    }
    return new THREE.CanvasTexture(c);
  }

  /* 藤蔓绿叶（雨林悬空板） */
  function vine() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#15803d'; g.fillRect(0, 0, 128, 128);
    for (let x = 8; x < 128; x += 22) {
      g.fillStyle = 'rgba(20, 83, 45, .6)';
      g.fillRect(x, 0, 5, 128);
    }
    g.fillStyle = '#86efac';
    for (let i = 0; i < 28; i++) {
      g.globalAlpha = 0.35 + Math.random() * 0.5;
      g.fillRect(Math.random() * 124, Math.random() * 124, 4, 6);
    }
    g.globalAlpha = 1;
    return new THREE.CanvasTexture(c);
  }

  /* 砂岩（沙漠障碍/平台） */
  function sandstone() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#d6a05a'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 10 + Math.random() * 8) {
      g.fillStyle = 'rgba(180, 83, 9, ' + (0.15 + Math.random() * 0.25) + ')';
      g.fillRect(0, y, 128, 2 + Math.random() * 3);
    }
    g.fillStyle = 'rgba(120, 53, 15, .3)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 126, Math.random() * 126, 2, 2);
    return new THREE.CanvasTexture(c);
  }

  /* 高台台面导向箭头 */
  function chevron() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.strokeStyle = '#22d3ee'; g.lineWidth = 12; g.lineCap = 'round'; g.lineJoin = 'round';
    g.shadowColor = '#22d3ee'; g.shadowBlur = 10;
    [[70, 34], [104, 68]].forEach(([y1, y2]) => {
      g.beginPath();
      g.moveTo(28, y1); g.lineTo(64, y2); g.lineTo(100, y1);
      g.stroke();
    });
    return new THREE.CanvasTexture(c);
  }

  /* 道具图标贴图：护盾(六边形) / 磁铁(U形) */
  function shieldIcon() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.strokeStyle = '#67e8f9'; g.lineWidth = 8;
    g.shadowColor = '#67e8f9'; g.shadowBlur = 16;
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i - Math.PI / 6;
      const x = 64 + Math.cos(a) * 44, y = 64 + Math.sin(a) * 44;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.closePath(); g.stroke();
    g.font = '900 44px Orbitron, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#a5f3fc'; g.fillText('S', 64, 68);
    return new THREE.CanvasTexture(c);
  }
  function magnetIcon() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.lineWidth = 18; g.lineCap = 'butt';
    g.shadowBlur = 16;
    g.strokeStyle = '#f472b6'; g.shadowColor = '#f472b6';
    g.beginPath(); g.arc(64, 60, 34, Math.PI, 0, false); g.stroke();
    g.beginPath(); g.moveTo(30, 60); g.lineTo(30, 96); g.stroke();
    g.strokeStyle = '#e2f3ff'; g.shadowColor = '#e2f3ff';
    g.beginPath(); g.moveTo(98, 60); g.lineTo(98, 96); g.stroke();
    return new THREE.CanvasTexture(c);
  }

  /* 红色无敌道具图标（爆裂星形） */
  function rageIcon() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.translate(64, 64);
    g.shadowColor = '#ef4444'; g.shadowBlur = 16;
    const grad = g.createRadialGradient(0, 0, 6, 0, 0, 54);
    grad.addColorStop(0, '#fde047');
    grad.addColorStop(0.5, '#f97316');
    grad.addColorStop(1, '#dc2626');
    g.fillStyle = grad;
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI / 8) * i;
      const r = i % 2 === 0 ? 52 : 24;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.closePath(); g.fill();
    return new THREE.CanvasTexture(c);
  }

  return { grid, windows, sun, aurora, hazard, glow, warn, sky, chevron, wood, vine, sandstone, shieldIcon, magnetIcon, rageIcon };
})();
