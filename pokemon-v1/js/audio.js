// ============================================================
// 音频模块 audio.js
// Web Audio API 合成：背景音乐 + 技能/受击音效
// ============================================================

let audioCtx = null;
let bgmPlaying = false;
let _bgmNodes = null; // 保存 BGM 节点引用，用于停止

// ---- 初始化（首次用户交互时调用）----
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

// ---- 启动背景音乐 ----
function startBGM() {
  if (!audioCtx) initAudio();
  if (bgmPlaying) return;
  bgmPlaying = true;

  const now = audioCtx.currentTime;
  const master = audioCtx.createGain();
  master.gain.value = 1.0;
  master.connect(audioCtx.destination);

  // ====== 森林风铃：随机叮咚声 ======
  const chimeNotes = [
    523.25, 587.33, 659.25, 783.99, 880,        // C5 D5 E5 G5 A5
    1046.5, 1174.7, 1318.5, 1568, 1760           // C6 D6 E6 G6 A6
  ];

  const chimeGain = audioCtx.createGain();
  chimeGain.gain.value = 0.30;

  function scheduleChimes() {
    if (!bgmPlaying) return;
    const count = 2 + Math.floor(Math.random() * 3);
    let t = audioCtx.currentTime;
    for (let i = 0; i < count; i++) {
      const freq = chimeNotes[Math.floor(Math.random() * chimeNotes.length)];
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const env = audioCtx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.5, t + 0.02);
      env.gain.exponentialRampToValueAtTime(0.01, t + 1.5 + Math.random() * 1.5);

      osc.connect(env).connect(chimeGain);
      osc.start(t);
      osc.stop(t + 3.5);
      t += 0.6 + Math.random() * 1.2;
    }
    const nextDelay = 3000 + Math.random() * 4000;
    setTimeout(() => { if (bgmPlaying) scheduleChimes(); }, nextDelay);
  }
  scheduleChimes();

  // ====== 轻盈旋律线：五声音阶随机漫步 ======
  const melodyNotes = [220, 261.63, 293.66, 329.63, 392]; // A3 C4 D4 E4 G4
  const melodyGain = audioCtx.createGain();
  melodyGain.gain.value = 0.16;

  let melodyIndex = 2;
  function scheduleMelodyNote() {
    if (!bgmPlaying) return;
    const t = audioCtx.currentTime;
    const step = (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.6 ? 1 : 2);
    melodyIndex = Math.max(0, Math.min(melodyNotes.length - 1, melodyIndex + step));
    const freq = melodyNotes[melodyIndex];

    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.35, t + 0.04);
    env.gain.exponentialRampToValueAtTime(0.01, t + 1.8);

    osc.connect(env).connect(melodyGain);
    osc.start(t);
    osc.stop(t + 2.2);

    const nextDelay = 2000 + Math.random() * 1500;
    setTimeout(() => { if (bgmPlaying) scheduleMelodyNote(); }, nextDelay);
  }
  scheduleMelodyNote();

  // 保存引用（只需要 master，所有声音通过调度+setTimeout 管理）
  _bgmNodes = { master };
}

// ---- 停止背景音乐 ----
function stopBGM() {
  bgmPlaying = false;
  if (_bgmNodes && audioCtx) {
    try {
      _bgmNodes.master.gain.setValueAtTime(0, audioCtx.currentTime);
      _bgmNodes.master.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
    } catch (e) { /* ignore */ }
  }
  _bgmNodes = null;
  // 不关闭 audioCtx，方便重启时复用
}

// ---- 播放技能释放音效 ----
function playSkillSound(key) {
  if (!audioCtx || audioCtx.state === 'closed') return;
  const now = audioCtx.currentTime;

  const master = audioCtx.createGain();
  master.gain.value = 0.25;
  master.connect(audioCtx.destination);

  if (key === 'j') {
    // ----- J 普攻：沉闷拳击 -----
    // 低频正弦快速下坠 + 噪声冲击层
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0.5, now);
    env.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    osc.connect(filter).connect(env).connect(master);
    osc.start(now);
    osc.stop(now + 0.12);

    // 短噪声冲击（模拟打击感）
    const nEnv = audioCtx.createGain();
    nEnv.gain.setValueAtTime(0.12, now);
    nEnv.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    const nOsc = audioCtx.createOscillator();
    nOsc.type = 'square';
    nOsc.frequency.value = 80;
    const nFilter = audioCtx.createBiquadFilter();
    nFilter.type = 'lowpass';
    nFilter.frequency.value = 300;
    nOsc.connect(nFilter).connect(nEnv).connect(master);
    nOsc.start(now);
    nOsc.stop(now + 0.08);
  } else if (key === 'k') {
    // ----- K 冰冻：冰晶碎裂（轻柔）-----
    const osc1 = audioCtx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 1200;
    const env1 = audioCtx.createGain();
    env1.gain.setValueAtTime(0.06, now);
    env1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc1.connect(env1).connect(master);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 1800;
    osc2.detune.value = 4;
    const env2 = audioCtx.createGain();
    env2.gain.setValueAtTime(0, now);
    env2.gain.linearRampToValueAtTime(0.04, now + 0.05);
    env2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc2.connect(env2).connect(master);
    osc2.start(now);
    osc2.stop(now + 0.3);

    // 微噪碎裂（很轻）
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.015, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    const nOsc = audioCtx.createOscillator();
    nOsc.type = 'square';
    nOsc.frequency.value = 3000;
    const nFilter = audioCtx.createBiquadFilter();
    nFilter.type = 'highpass';
    nFilter.frequency.value = 3000;
    nOsc.connect(nFilter).connect(noiseGain).connect(master);
    nOsc.start(now);
    nOsc.stop(now + 0.2);
  } else if (key === 'l') {
    // ----- L 远攻：破空音 (whoosh) -----
    // 用方波+带通扫频模拟风声呼啸
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 150;

    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.18, now + 0.04);
    env.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.5;
    // 扫频：从低频破空升起 → 高频嘶鸣远逝
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(1200, now + 0.12);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.25);

    osc.connect(filter).connect(env).connect(master);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (key === 'i') {
    // ----- I 大招：强力冲击 -----
    // 低频冲击
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);

    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0.6, now);
    env.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc.connect(env).connect(master);
    osc.start(now);
    osc.stop(now + 0.45);

    // 高频嘶鸣
    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(1500, now);
    osc2.frequency.exponentialRampToValueAtTime(400, now + 0.2);

    const env2 = audioCtx.createGain();
    env2.gain.setValueAtTime(0.15, now);
    env2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    const f2 = audioCtx.createBiquadFilter();
    f2.type = 'highpass';
    f2.frequency.value = 600;
    osc2.connect(f2).connect(env2).connect(master);
    osc2.start(now);
    osc2.stop(now + 0.3);
  }
}

// ---- 技能命中怪物音效 ----
function playMonsterHitSound() {
  if (!audioCtx || audioCtx.state === 'closed') return;
  const now = audioCtx.currentTime;

  const master = audioCtx.createGain();
  master.gain.value = 0.2;
  master.connect(audioCtx.destination);

  // 短促打击感
  const osc = audioCtx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(250, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

  const env = audioCtx.createGain();
  env.gain.setValueAtTime(0.5, now);
  env.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

  osc.connect(env).connect(master);
  osc.start(now);
  osc.stop(now + 0.12);

  // 叠加一点噪声
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.1, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
  const nOsc = audioCtx.createOscillator();
  nOsc.type = 'square';
  nOsc.frequency.value = 500;
  nOsc.connect(noiseGain).connect(master);
  nOsc.start(now);
  nOsc.stop(now + 0.06);
}

// ---- 玩家受击音效 ----
function playPlayerHitSound() {
  if (!audioCtx || audioCtx.state === 'closed') return;
  const now = audioCtx.currentTime;

  const master = audioCtx.createGain();
  master.gain.value = 0.25;
  master.connect(audioCtx.destination);

  // 低沉撞击
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

  const env = audioCtx.createGain();
  env.gain.setValueAtTime(0.6, now);
  env.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
  osc.connect(env).connect(master);
  osc.start(now);
  osc.stop(now + 0.22);

  // 噪声层
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.15, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
  const nOsc = audioCtx.createOscillator();
  nOsc.type = 'square';
  nOsc.frequency.value = 200;
  const nFilter = audioCtx.createBiquadFilter();
  nFilter.type = 'lowpass';
  nFilter.frequency.value = 400;
  nOsc.connect(nFilter).connect(noiseGain).connect(master);
  nOsc.start(now);
  nOsc.stop(now + 0.1);
}
