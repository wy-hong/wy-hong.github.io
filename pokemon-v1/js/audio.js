// ============================================================
// 音频模块 audio.js
// Web Audio API 合成：背景音乐 + 技能/受击音效
// ============================================================

let audioCtx = null;
let bgmPlaying = false;
let _bgmNodes = null; // 保存 BGM 节点引用，用于停止
let _bgmScene = 'forest'; // 当前场景：'forest' | 'snow'
let _snowWindOsc = null; // 雪山风声节点引用
let _snowCrystalsActive = false; // 冰晶音效调度中

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

  // ====== 森林风铃：随机叮咚声（雪山时更清脆）======
  const forestChimes = [523.25, 587.33, 659.25, 783.99, 880];    // C5 D5 E5 G5 A5
  const snowChimes   = [587.33, 659.25, 698.46, 783.99, 987.77]; // D5 E5 F5 G5 B5（更冷/小调感）

  const chimeGain = audioCtx.createGain();
  chimeGain.gain.value = 0.50;
  chimeGain.connect(master);

  function scheduleChimes() {
    if (!bgmPlaying) return;
    const notes = _bgmScene === 'snow' ? snowChimes : forestChimes;
    const count = 2 + Math.floor(Math.random() * 3);
    let t = audioCtx.currentTime;
    for (let i = 0; i < count; i++) {
      const freq = notes[Math.floor(Math.random() * notes.length)];
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

  // ====== 旋律漫步：五声音阶随机漫步（雪山用更冷的 Dm 调）======
  const forestMelody = [220, 261.63, 293.66, 329.63, 392];    // A3 C4 D4 E4 G4（明亮）
  const snowMelody   = [174.61, 196, 220, 261.63, 329.63];    // F3 G3 A3 C4 E4（冷/小调感）

  const melodyGain = audioCtx.createGain();
  melodyGain.gain.value = 0.28;
  melodyGain.connect(master);

  let melodyIndex = 2;
  function scheduleMelodyNote() {
    if (!bgmPlaying) return;
    const notes = _bgmScene === 'snow' ? snowMelody : forestMelody;
    const t = audioCtx.currentTime;
    const step = (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.6 ? 1 : 2);
    melodyIndex = Math.max(0, Math.min(notes.length - 1, melodyIndex + step));
    const freq = notes[melodyIndex];

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

  // 保存引用（必须在雪山层启动之前，因为 startSnowWind 依赖 _bgmNodes）
  _bgmNodes = { master };

  // 如果已经是雪山场景，启动风声和冰晶
  if (_bgmScene === 'snow') {
    startSnowWind();
    _snowCrystalsActive = true;
    scheduleSnowCrystals();
  }
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
  // 停止雪山风声
  if (_snowWindOsc) {
    try { _snowWindOsc.stop(); } catch (e) { /* ignore */ }
    _snowWindOsc = null;
  }
  _bgmNodes = null;
}

// ---- 切换 BGM 场景 ----
function setBGMScene(scene) {
  if (_bgmScene === scene) return;
  _bgmScene = scene;

  if (!bgmPlaying || !audioCtx) return;

  if (scene === 'snow') {
    // 启动雪山风声层
    startSnowWind();
    // 启动冰晶音效
    if (!_snowCrystalsActive) {
      _snowCrystalsActive = true;
      scheduleSnowCrystals();
    }
  } else {
    // 停止雪山风声层
    stopSnowWind();
    _snowCrystalsActive = false;
  }
}

// ---- 雪山风声（北国寒风低吟）----
function startSnowWind() {
  if (!audioCtx || _snowWindOsc) return;
  const now = audioCtx.currentTime;

  // === 底层持续微风（噪声 + 低频 LFO 摆动）===
  const bufSize = audioCtx.sampleRate * 2;
  const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.4;
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;

  // bandpass 扫到中频模拟风啸
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 600;
  filter.Q.value = 1.5;

  // LFO 调制频率 → 风声自然起伏
  const lfo = audioCtx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.08; // 极慢
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 400;
  lfo.connect(lfoGain).connect(filter.frequency);

  const windGain = audioCtx.createGain();
  windGain.gain.setValueAtTime(0, now);
  windGain.gain.linearRampToValueAtTime(0.10, now + 2); // 渐入稍大

  noise.connect(filter).connect(windGain);
  windGain.connect(_bgmNodes.master);
  noise.start(now);
  lfo.start(now);

  // === 间歇大风呼啸（每隔约 6-12 秒）===
  let gustTimer;
  function scheduleGust() {
    if (!_snowWindOsc || _bgmScene !== 'snow') return;
    const t = audioCtx.currentTime;

    // 大风：宽频噪声 + 更剧烈扫频
    const gBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 1.5, audioCtx.sampleRate);
    const gData = gBuf.getChannelData(0);
    for (let i = 0; i < gBuf.length; i++) gData[i] = (Math.random() * 2 - 1);

    const gNoise = audioCtx.createBufferSource();
    gNoise.buffer = gBuf;

    const gFilter = audioCtx.createBiquadFilter();
    gFilter.type = 'bandpass';
    gFilter.Q.value = 0.8;
    gFilter.frequency.setValueAtTime(300, t);
    gFilter.frequency.linearRampToValueAtTime(1200, t + 0.5);
    gFilter.frequency.linearRampToValueAtTime(200, t + 1.5);

    const gEnv = audioCtx.createGain();
    gEnv.gain.setValueAtTime(0, t);
    gEnv.gain.linearRampToValueAtTime(0.25, t + 0.3);
    gEnv.gain.setValueAtTime(0.25, t + 0.8);
    gEnv.gain.linearRampToValueAtTime(0, t + 1.8);

    gNoise.connect(gFilter).connect(gEnv).connect(_bgmNodes.master);
    gNoise.start(t);
    gNoise.stop(t + 1.9);

    gustTimer = setTimeout(scheduleGust, 6000 + Math.random() * 8000);
  }
  scheduleGust();

  _snowWindOsc = { noise, lfo, windGain, filter, gustTimer };
}

function stopSnowWind() {
  if (!_snowWindOsc) return;
  const now = audioCtx.currentTime;
  try {
    _snowWindOsc.windGain.gain.linearRampToValueAtTime(0, now + 1.0);
    _snowWindOsc.noise.stop(now + 1.2);
    _snowWindOsc.lfo.stop(now + 1.2);
    if (_snowWindOsc.gustTimer) clearTimeout(_snowWindOsc.gustTimer);
  } catch (e) { /* ignore */ }
  _snowWindOsc = null;
}

// ---- 雪山冰晶音效（清脆叮叮）----
function scheduleSnowCrystals() {
  if (!bgmPlaying || _bgmScene !== 'snow' || !audioCtx) return;

  const now = audioCtx.currentTime;
  // 高八度五声音阶，保证清脆
  const crystalNotes = [2093, 2349, 2637, 3136, 3520]; // C7 D7 E7 G7 A7

  const count = 2 + Math.floor(Math.random() * 2); // 2-3 个一组
  let t = now;
  for (let i = 0; i < count; i++) {
    const freq = crystalNotes[Math.floor(Math.random() * crystalNotes.length)];

    // 主音：三角波（比正弦更脆）
    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;

    // 泛音：高 1 个八度的正弦，微音量，增加冰晶感
    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;

    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.08, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    const env2 = audioCtx.createGain();
    env2.gain.setValueAtTime(0, t);
    env2.gain.linearRampToValueAtTime(0.03, t + 0.006);
    env2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(env).connect(_bgmNodes.master);
    osc2.connect(env2).connect(_bgmNodes.master);
    osc.start(t);
    osc2.start(t);
    osc.stop(t + 0.4);
    osc2.stop(t + 0.3);

    t += 0.6 + Math.random() * 1.0;
  }

  const nextDelay = 3000 + Math.random() * 4000; // 3-7 秒一轮
  setTimeout(() => { scheduleSnowCrystals(); }, nextDelay);
}

// ---- 播放技能释放音效 ----
// ---- 雪山箭矢破空声 ----
function playSniperArrowSound() {
  if (!audioCtx || audioCtx.state === 'closed') return;
  const now = audioCtx.currentTime;

  const master = audioCtx.createGain();
  master.gain.value = 0.12;
  master.connect(audioCtx.destination);

  // 白噪声 → 带通滤波 → 模拟箭矢破空
  const bufSize = audioCtx.sampleRate * 0.3;
  const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);

  const noise = audioCtx.createBufferSource();
  noise.buffer = buf;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 2;
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.exponentialRampToValueAtTime(2000, now + 0.08);
  filter.frequency.exponentialRampToValueAtTime(600, now + 0.25);

  const env = audioCtx.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(0.5, now + 0.02);
  env.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

  noise.connect(filter).connect(env).connect(master);
  noise.start(now);
  noise.stop(now + 0.3);
}

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
