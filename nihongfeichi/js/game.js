/* 游戏主逻辑：状态机 / 输入 / 更新循环 / 流程控制 */
import { TRACK_W, TRACK_LEN, BASE_SPEED, MAX_SPEED, PLAYER_Z, PLAYER_Y,
         BASE_FOV, TOUCH_SENS, IS_MOBILE, GYRO_TILT, roadX, rand } from './config.js';
import * as W from './world.js';
import { ship, exhausts, shieldMesh } from './ship.js';
import { active, spawnWave, resetObjects, getSpawnZ, addSpawnZ } from './objects.js';
import { explode, clearParticles, emitTrail, updateTrail, updateBurst } from './particles.js';
import { initAudio, startMusic, pumpMusic, setMusic, isMusicOn, sfx,
         engineStart, engineStop, engineMute, engineResume, engineFreq, getAC } from './audio.js';
import { ui, showMsg, hideMsg, showToast } from './ui.js';
import { unlock, renderAch, clearAllAchievements } from './achievements.js';
import * as api from './api.js';

export const S = { MENU: 0, PLAY: 1, OVER: 2, PAUSE: 3 };
let state = S.MENU;

let score = 0, gems = 0, distance = 0, combo = 0, comboTimer = 0;
let speed = BASE_SPEED, boostT = 0, shieldT = 0, shakeT = 0;
let magnetT = 0, doubleT = 0, slowT = 0, magnetGems = 0;
let travel = 0;
let hiscore = +(localStorage.getItem('neon_hiscore') || 0);
let totalGems = +(localStorage.getItem('neon_totalgems') || 0);
let totalDist = +(localStorage.getItem('neon_totaldist') || 0);

const player = { vx: 0, tiltZ: 0 };
const keys = {};

/* ---------------- 输入 ---------------- */
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyP' && (state === S.PLAY || state === S.PAUSE)) togglePause();
  if (e.code === 'KeyR' && state === S.OVER) startGame();
  if (e.code === 'KeyM' && getAC()) setMusic(!isMusicOn());
  if (e.code === 'Enter' && state === S.MENU) startGame();
  if (e.code === 'Escape') {
    if (!ui.achPanel.classList.contains('hidden')) ui.achPanel.classList.add('hidden');
    else if (!ui.historyPanel.classList.contains('hidden')) ui.historyPanel.classList.add('hidden');
    else if (state === S.PLAY || state === S.PAUSE || state === S.OVER) goHome();
  }
  if (['ArrowLeft','ArrowRight','ArrowUp','Space'].indexOf(e.code) >= 0) e.preventDefault();
});
addEventListener('keyup', e => keys[e.code] = false);

/* 触屏：相对滑动加速（增量式） */
let touchX = null;
addEventListener('touchstart', e => {
  if (state !== S.PLAY) return;
  touchX = e.touches[0].clientX;
}, { passive: true });
addEventListener('touchmove', e => {
  if (touchX === null) return;
  player.vx += (e.touches[0].clientX - touchX) * TOUCH_SENS;
  touchX = e.touches[0].clientX;
}, { passive: true });
addEventListener('touchend', () => touchX = null);
addEventListener('touchcancel', () => touchX = null);

/* 陀螺仪：倾斜手机转向（仅移动端，每次开局自动校准当前握持角度为基准） */
let gyroRaw = 0, gyroBase = null, gyroBaseSum = 0, gyroBaseN = 0, gyroSteer = 0, gyroInit = false;
function onOrient(e) {
  /* 根据屏幕方向选择倾斜轴：竖屏用 gamma，横屏用 beta，并修正反向 */
  const o = (screen.orientation && typeof screen.orientation.angle === 'number')
    ? screen.orientation.angle : (window.orientation || 0);
  let a;
  if (o === 90) a = e.beta;
  else if (o === -90 || o === 270) a = -e.beta;
  else if (o === 180) a = -e.gamma;
  else a = e.gamma;
  if (a === null || a === undefined) return;
  gyroRaw = a;
  if (gyroBase === null) {          /* 校准中：采集约 12 个样本取平均作为基准角 */
    gyroBaseSum += a;
    if (++gyroBaseN >= 12) gyroBase = gyroBaseSum / gyroBaseN;
  }
}
function calibrateGyro() { gyroBase = null; gyroBaseSum = 0; gyroBaseN = 0; gyroSteer = 0; }
function enableGyro() {
  if (gyroInit || !IS_MOBILE || !('DeviceOrientationEvent' in window)) return;
  gyroInit = true;
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {   /* iOS 13+ 需在用户手势中申请权限 */
    DeviceOrientationEvent.requestPermission()
      .then(r => { if (r === 'granted') addEventListener('deviceorientation', onOrient); })
      .catch(() => {});
  } else {
    addEventListener('deviceorientation', onOrient);
  }
}

/* ---------------- 流程控制 ---------------- */
export function startGame() {
  enableGyro(); calibrateGyro();
  initAudio(); startMusic(); sfx.click();
  score = 0; gems = 0; distance = 0; combo = 0; comboTimer = 0;
  speed = BASE_SPEED; boostT = 0; shieldT = 0; shakeT = 0;
  magnetT = 0; doubleT = 0; slowT = 0; magnetGems = 0;
  travel = 0; W.roadGroup.rotation.y = 0;
  ui.combo.style.opacity = 0;
  ui.vig.style.boxShadow = 'inset 0 0 180px rgba(255,20,60,0)';
  clearParticles();
  resetObjects();
  ship.position.set(0, PLAYER_Y, PLAYER_Z);
  ship.rotation.set(0, 0, 0);
  ship.visible = true;
  player.vx = 0;
  ui.menu.classList.add('hidden');
  ui.over.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  state = S.PLAY;
  engineStart();
  showMsg('GO!', 0.7);
}

export function gameOver() {
  state = S.OVER;
  sfx.crash();
  explode(ship.position, 0xff2a6d, 90, 14, speed);
  explode(ship.position, 0xffd166, 50, 9, speed);
  shakeT = 1;
  ship.visible = false;
  engineStop();
  /* 累计数据与成就 */
  unlock('first');
  totalGems += gems; totalDist += distance;
  localStorage.setItem('neon_totalgems', totalGems);
  localStorage.setItem('neon_totaldist', Math.floor(totalDist));
  if (totalGems >= 50) unlock('gems50');
  if (totalDist >= 10000) unlock('dist10k');
  const finalScore = Math.floor(score), finalDist = Math.floor(distance);
  const isRecord = finalScore > hiscore;
  if (isRecord) { hiscore = finalScore; localStorage.setItem('neon_hiscore', hiscore); }
  /* 上传成绩到后端数据库 */
  api.postScore({ score: finalScore, gems, distance: finalDist });
  ui.finalScore.textContent = finalScore;
  ui.finalGems.textContent = gems;
  ui.finalDist.textContent = finalDist + 'm';
  ui.newRecord.classList.toggle('hidden', !isRecord);
  setTimeout(() => {
    ui.hud.classList.add('hidden');
    ui.over.classList.remove('hidden');
    ship.visible = true;
  }, 1100);
}

export function goHome() {
  sfx.click();
  state = S.MENU;
  hideMsg();
  clearParticles();
  resetObjects();
  ship.visible = true;
  ship.rotation.set(0, 0, 0);
  ship.position.set(0, PLAYER_Y, PLAYER_Z);
  W.roadGroup.rotation.y = 0;
  ui.combo.style.opacity = 0;
  ui.vig.style.boxShadow = 'inset 0 0 180px rgba(255,20,60,0)';
  engineStop();
  ui.hiscore.textContent = hiscore > 0 ? 'HISCORE  ' + hiscore : '';
  ui.hud.classList.add('hidden');
  ui.over.classList.add('hidden');
  ui.achPanel.classList.add('hidden');
  ui.historyPanel.classList.add('hidden');
  ui.menu.classList.remove('hidden');
}

export function togglePause() {
  if (state === S.PLAY) {
    state = S.PAUSE; showMsg('PAUSED', 9999);
    engineMute();
  } else {
    state = S.PLAY; hideMsg();
    calibrateGyro();
    engineResume();
  }
}

/* ---------------- 历史成绩面板 ---------------- */
async function openHistory() {
  const list = await api.getScores();
  let html;
  if (list === null) {
    html = '<div class="panel-item"><div class="panel-ico">◇</div><div class="panel-main">' +
      '<div class="panel-name">无法连接后端数据库</div>' +
      '<div class="panel-desc">请使用 python server.py 启动游戏以启用云端存档</div></div></div>';
    if (hiscore > 0) {
      html += '<div class="panel-item hl"><div class="panel-ico">★</div><div class="panel-main">' +
        '<div class="panel-name">本地最高分 ' + hiscore + '</div>' +
        '<div class="panel-desc">来自浏览器本地存储</div></div></div>';
    }
  } else if (list.length === 0) {
    html = '<div class="panel-item"><div class="panel-ico">◇</div><div class="panel-main">' +
      '<div class="panel-name">暂无成绩记录</div>' +
      '<div class="panel-desc">完成一局游戏后会自动上传成绩</div></div></div>';
  } else {
    const best = Math.max(...list.map(s => s.score));
    html = list.map(s =>
      '<div class="panel-item ' + (s.score === best ? 'hl' : '') + '">' +
      '<div class="panel-ico">' + (s.score === best ? '★' : '·') + '</div>' +
      '<div class="panel-main"><div class="panel-name">' + s.score + ' 分</div>' +
      '<div class="panel-desc">◆ ' + s.gems + ' 晶石 · ' + s.distance + 'm · ' + s.time + '</div>' +
      '</div></div>'
    ).join('');
  }
  ui.historyList.innerHTML = html;
  ui.historyPanel.classList.remove('hidden');
}

/* ---------------- UI 事件绑定 ---------------- */
export function wireUI() {
  ui.hiscore.textContent = hiscore > 0 ? 'HISCORE  ' + hiscore : '';
  ui.musicBtn.textContent = isMusicOn() ? '音乐：开' : '音乐：关';

  ui.startBtn.onclick = startGame;
  ui.retryBtn.onclick = startGame;
  ui.homeBtn.onclick = goHome;

  ui.achBtn.onclick = () => {
    initAudio(); sfx.click();
    renderAch();
    ui.achPanel.classList.remove('hidden');
  };
  ui.achClose.onclick = () => { sfx.click(); ui.achPanel.classList.add('hidden'); };
  ui.achClear.onclick = async () => {
    if (!confirm('确定清除所有已解锁成就？此操作不可撤销。')) return;
    await clearAllAchievements();
    renderAch();
    showToast('成就已全部清除');
    sfx.click();
  };

  ui.histBtn.onclick = () => { initAudio(); sfx.click(); openHistory(); };
  ui.histClose.onclick = () => { sfx.click(); ui.historyPanel.classList.add('hidden'); };
  ui.histClear.onclick = async () => {
    if (!confirm('确定清除所有历史成绩？此操作不可撤销。')) return;
    const ok = await api.clearScores();
    showToast(ok ? '历史成绩已清除' : '清除失败：后端未连接');
    openHistory();
    sfx.click();
  };

  ui.musicBtn.onclick = () => {
    initAudio(); startMusic();
    setMusic(!isMusicOn()); sfx.click();
  };
}

/* ---------------- 主更新 ---------------- */
const clock = new THREE.Clock();
let gridOffset = 0;

function update(dt) {
  const diff = Math.min(1, distance / 9000);

  /* 弯道：道路中心偏移与坡度 */
  travel += speed * dt;
  const roadCur = roadX(travel);
  const slope = (roadX(travel + 40) - roadCur) / 40;
  W.roadGroup.rotation.y = -Math.asin(Math.max(-0.9, Math.min(0.9, slope * 0.9)));

  let targetSpeed = boostT > 0 ? MAX_SPEED : BASE_SPEED + diff * 62 + (keys.KeyW || keys.ArrowUp ? 26 : 0);
  if (slowT > 0) targetSpeed *= 0.55;
  speed += (targetSpeed - speed) * Math.min(1, dt * 2.2);
  if (boostT > 0) boostT -= dt;
  if (magnetT > 0) magnetT -= dt;
  if (doubleT > 0) doubleT -= dt;
  if (slowT > 0) slowT -= dt;
  if (shieldT > 0) { shieldT -= dt; if (shieldT <= 0) shieldMesh.visible = false; }
  if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) { combo = 0; ui.combo.style.opacity = 0; } }

  const steer = (keys.KeyA || keys.ArrowLeft ? -1 : 0) + (keys.KeyD || keys.ArrowRight ? 1 : 0);
  player.vx += steer * 90 * dt;
  /* 陀螺仪转向：相对基准角的倾斜映射为 -1..1，与键盘相同的加速度汇入 vx */
  if (gyroBase !== null) {
    let d = gyroRaw - gyroBase;
    d = Math.abs(d) < 1 ? 0 : d - Math.sign(d) * 1;   /* 死区防抖 */
    const gTarget = Math.max(-1, Math.min(1, d / GYRO_TILT));
    gyroSteer += (gTarget - gyroSteer) * Math.min(1, dt * 12);
    player.vx += gyroSteer * 90 * dt;
  }
  player.vx *= Math.pow(0.0018, dt);
  ship.position.x += player.vx * dt;
  const lim = TRACK_W / 2 - 1.6;
  if (ship.position.x < -lim) { ship.position.x = -lim; player.vx *= -0.4; }
  if (ship.position.x >  lim) { ship.position.x =  lim; player.vx *= -0.4; }
  player.tiltZ += ((-player.vx * 0.045) - player.tiltZ) * Math.min(1, dt * 10);
  ship.rotation.z = player.tiltZ;
  ship.rotation.y = -player.vx * 0.012;
  ship.position.y = PLAYER_Y + Math.sin(clock.elapsedTime * 3.2) * 0.12;

  if (shieldT > 0) shieldMesh.material.opacity = 0.14 + Math.sin(clock.elapsedTime * 8) * 0.06;

  gridOffset += speed * dt / 22;
  W.gridTex.offset.y = gridOffset % 1;
  W.floorGrid.position.z = (gridOffset * 22) % (1400 / 120);
  distance += speed * dt / 10;
  score += speed * dt * 0.12 * (1 + combo * 0.25) * (doubleT > 0 ? 2 : 1);

  W.pillars.forEach(p => {
    p.position.z += speed * dt;
    if (p.position.z > 20) p.position.z -= TRACK_LEN;
    p.position.x = p.userData.bx + roadX(travel + (PLAYER_Z - p.position.z)) - roadCur;
  });
  W.floaters.forEach(f => {
    f.position.z += speed * dt * 0.9;
    f.rotation.y += f.userData.rs * dt;
    f.rotation.x += f.userData.rs * 0.6 * dt;
    if (f.position.z > 30) {
      f.position.z -= TRACK_LEN + 60;
      f.position.x = (Math.random() < 0.5 ? -1 : 1) * (26 + Math.random() * 90);
    }
  });

  while (getSpawnZ() > -TRACK_LEN + 30) spawnWave(diff);
  addSpawnZ(speed * dt);

  /* 场上对象 */
  for (let i = active.length - 1; i >= 0; i--) {
    const o = active[i];
    o.position.z += speed * dt;
    /* 弯道横向偏移 */
    o.position.x = o.userData.baseX + roadX(travel + (PLAYER_Z - o.position.z)) - roadCur;
    /* 磁铁吸附晶石 */
    if (magnetT > 0 && o.userData.type === 'gem') {
      const mdx = ship.position.x - o.position.x, mdz = o.position.z - PLAYER_Z;
      if (mdx * mdx + mdz * mdz < 400) {
        o.userData.baseX += mdx * dt * 5;
        o.position.y += (PLAYER_Y - o.position.y) * dt * 5;
      }
    }
    const sp = o.userData.spin;
    if (sp) { o.rotation.x += sp.x * dt; o.rotation.y += sp.y * dt; o.rotation.z += sp.z * dt; }
    if (o.userData.good) o.position.y += Math.sin(clock.elapsedTime * 4 + o.userData.id) * dt * 0.8;

    if (o.position.z > 24) { o.visible = false; active.splice(i, 1); continue; }

    if (!o.userData.hit && Math.abs(o.position.z - PLAYER_Z) < 2.2) {
      const dx = o.position.x - ship.position.x;
      const dy = o.position.y - ship.position.y;
      if (dx * dx + dy * dy < o.userData.r * o.userData.r) {
        o.userData.hit = true;
        if (o.userData.isRing) {
          combo++; comboTimer = 3;
          score += 250 * combo * (doubleT > 0 ? 2 : 1); boostT = 1.6;
          sfx.ring();
          explode(o.position, 0x22d3ee, 40, 10, speed);
          ui.combo.textContent = 'COMBO x' + combo;
          ui.combo.style.opacity = 1;
          if (combo >= 5) unlock('combo5');
          o.visible = false; active.splice(i, 1); continue;
        } else if (o.userData.isShield) {
          shieldT = 6; sfx.shield();
          explode(o.position, 0x34d399, 30, 7, speed);
          showMsg('SHIELD ONLINE', 1);
          o.visible = false; active.splice(i, 1); continue;
        } else if (o.userData.isMagnet) {
          magnetT = 8; sfx.shield();
          explode(o.position, 0xec4899, 30, 7, speed);
          showMsg('MAGNET ON', 1);
          o.visible = false; active.splice(i, 1); continue;
        } else if (o.userData.isDouble) {
          doubleT = 10; sfx.ring();
          explode(o.position, 0x38bdf8, 30, 7, speed);
          showMsg('SCORE x2', 1);
          o.visible = false; active.splice(i, 1); continue;
        } else if (o.userData.isSlow) {
          slowT = 6; sfx.shield();
          explode(o.position, 0x2dd4bf, 30, 7, speed);
          showMsg('SLOW-MO', 1);
          o.visible = false; active.splice(i, 1); continue;
        } else if (o.userData.isStar) {
          score += 300 * (doubleT > 0 ? 2 : 1); sfx.gem();
          explode(o.position, 0xfbbf24, 26, 7, speed);
          o.visible = false; active.splice(i, 1); continue;
        } else if (o.userData.good) {
          gems++; score += 60 * (1 + combo * 0.25) * (doubleT > 0 ? 2 : 1);
          sfx.gem();
          explode(o.position, 0xffd166, 18, 5, speed);
          if (magnetT > 0) { magnetGems++; if (magnetGems >= 15) unlock('magnet'); }
          if (gems >= 10) unlock('gems10');
          o.visible = false; active.splice(i, 1); continue;
        } else {
          if (shieldT > 0) {
            shieldT = 0; shieldMesh.visible = false;
            explode(o.position, 0x34d399, 50, 11, speed);
            sfx.crash(); shakeT = 0.5;
            unlock('shieldbrk');
            o.visible = false; active.splice(i, 1); continue;
          }
          gameOver(); return;
        }
      }
    }
  }

  /* 粒子 */
  emitTrail(ship.position.x);
  updateTrail(dt, speed);
  updateBurst(dt);

  /* 引擎光效与音效 */
  const throttle = speed / MAX_SPEED;
  exhausts.forEach((f, idx) => {
    const s = 0.8 + throttle * 1.6 + Math.sin(clock.elapsedTime * 40 + idx * 2) * 0.25;
    f.scale.set(s, s * 1.4, 1);
  });
  engineFreq(throttle);
  W.pinkLight.intensity = 1 + throttle * 1.2;

  /* 相机 */
  W.camera.position.x += (ship.position.x * 0.55 - W.camera.position.x) * Math.min(1, dt * 5);
  W.camera.position.y = 5.2 + Math.sin(clock.elapsedTime * 2.4) * 0.1;
  if (shakeT > 0) {
    shakeT -= dt;
    W.camera.position.x += rand(-1, 1) * shakeT * 0.9;
    W.camera.position.y += rand(-1, 1) * shakeT * 0.9;
    ui.vig.style.boxShadow = 'inset 0 0 180px rgba(255,20,60,' + Math.min(0.8, shakeT) + ')';
  } else ui.vig.style.boxShadow = 'inset 0 0 180px rgba(255,20,60,0)';
  W.camera.lookAt(ship.position.x * 0.8 + slope * 26, 2.2, -30);
  W.camera.fov = BASE_FOV + throttle * 14;
  W.camera.updateProjectionMatrix();

  /* 成就：里程 / 分数 / 极速 */
  if (distance >= 1000) unlock('dist1k');
  if (score >= 5000) unlock('score5k');
  if (speed * 6.5 >= 800) unlock('speed');

  /* HUD */
  ui.score.textContent = Math.floor(score);
  ui.gems.textContent = '◆ ' + gems;
  ui.speed.textContent = Math.floor(speed * 6.5) + ' km/h';
  ui.shieldIcon.style.opacity = shieldT > 0 ? 1 : 0;
  let pw = '';
  if (magnetT > 0) pw += '<div class="pow" style="border-color:#ec4899;color:#f9a8d4">◉ 磁铁 ' + magnetT.toFixed(1) + 's</div>';
  if (doubleT > 0) pw += '<div class="pow" style="border-color:#38bdf8;color:#7dd3fc">✦ 双倍 ' + doubleT.toFixed(1) + 's</div>';
  if (slowT > 0)   pw += '<div class="pow" style="border-color:#2dd4bf;color:#5eead4">◔ 缓时 ' + slowT.toFixed(1) + 's</div>';
  ui.powers.innerHTML = pw;
}

function idleUpdate(dt) {
  const t = clock.elapsedTime * 0.25;
  W.camera.position.set(Math.sin(t) * 26, 7 + Math.sin(t * 0.7) * 2.5, PLAYER_Z + 20 + Math.cos(t) * 6);
  W.camera.lookAt(0, 3, -60);
  W.roadGroup.rotation.y = Math.sin(clock.elapsedTime * 0.15) * 0.06;
  ship.rotation.y += dt * 0.6;
  ship.position.set(0, PLAYER_Y + Math.sin(clock.elapsedTime * 2) * 0.15, PLAYER_Z);
  ship.rotation.z = Math.sin(clock.elapsedTime * 1.4) * 0.08;
  W.gridTex.offset.y += dt * 0.25;
  W.floaters.forEach(f => f.rotation.y += f.userData.rs * dt);
  exhausts.forEach((f, idx) => {
    const s = 0.7 + Math.sin(clock.elapsedTime * 30 + idx * 2) * 0.18;
    f.scale.set(s, s * 1.3, 1);
  });
}

export function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state === S.PLAY) update(dt);
  else if (state !== S.PAUSE) idleUpdate(dt);
  pumpMusic();
  W.stars1.rotation.y += dt * 0.004;
  W.stars2.rotation.y -= dt * 0.003;
  W.sun.material.opacity = 0.92 + Math.sin(clock.elapsedTime * 1.6) * 0.08;
  W.nebulae.forEach((n, i) => { n.material.opacity = 0.3 + Math.sin(clock.elapsedTime * 0.8 + i * 2) * 0.08; });
  W.renderer.render(W.scene, W.camera);
}
