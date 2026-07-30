/* Canvas 程序化纹理 */

export function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  return new THREE.CanvasTexture(c);
}

export function radialTex(inner, outer) {
  return canvasTex(128, (g, s) => {
    const r = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
    r.addColorStop(0, inner); r.addColorStop(1, outer);
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  });
}

export const dotTex = radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)');

/* 条纹辉光纹理（合成波太阳） */
export const sunTex = canvasTex(256, (g, s) => {
  const grd = g.createLinearGradient(0, 0, 0, s);
  grd.addColorStop(0, '#ffe95e'); grd.addColorStop(0.55, '#ff9a3d'); grd.addColorStop(1, '#ff2a6d');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) {
    const y = s * 0.5 + i * i * 2.2 + i * 8;
    g.fillRect(0, y, s, 3 + i * 2.2);
  }
});

/* 赛道辉光网格纹理 */
export const gridTex = canvasTex(512, (g, s) => {
  g.clearRect(0, 0, s, s);
  g.strokeStyle = '#22d3ee'; g.lineWidth = 3;
  g.shadowColor = '#22d3ee'; g.shadowBlur = 14;
  g.strokeRect(1.5, 1.5, s - 3, s - 3);
});
gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
gridTex.repeat.set(4, 4);

/* 远景山脉剪影纹理 */
export const mtnTex = (() => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 60, 0, 256);
  grad.addColorStop(0, 'rgba(168,85,247,0.9)'); grad.addColorStop(1, 'rgba(10,6,30,0.2)');
  g.fillStyle = grad;
  g.beginPath(); g.moveTo(0, 256);
  let y = 130;
  for (let x = 0; x <= 1024; x += 64) {
    y = 90 + Math.random() * 90;
    g.lineTo(x + 32, y); g.lineTo(x + 64, 200 + Math.random() * 56);
  }
  g.lineTo(1024, 256); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.repeat.x = 3;
  return t;
})();
