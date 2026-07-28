/* ===== 音频引擎 =====
   SFX：WebAudio 合成音效
   BGM：合成波风格循环（Am-F-C-G），前瞻调度器保证节奏精准
   结构：底鼓/军鼓/踩镲 + 驱动贝斯 + 琶音主奏(回声) + Pad 和弦
*/
window.NR = window.NR || {};

NR.audio = (function () {
  let ctx = null, master = null, delaySend = null, noiseBuf = null;
  let muted = NR.store.get('muted', false);
  let musicTimer = null;
  let gameState = 'start';

  // 自适应节奏：随游戏速度从 100 BPM 平滑升至 140 BPM
  const MIN_BPM = 100, MAX_BPM = 140;
  let bpm = MIN_BPM, targetBpm = MIN_BPM, intensity = 0;
  let step = 0, nextTime = 0;

  // Am - F - C - G 和弦进行（每和弦 16 步，共 64 步一循环）
  const PROG = [
    { root: 55.00, chord: [220.00, 261.63, 329.63] },  // Am
    { root: 43.65, chord: [174.61, 220.00, 261.63] },  // F
    { root: 65.41, chord: [261.63, 329.63, 392.00] },  // C
    { root: 49.00, chord: [196.00, 246.94, 293.66] }   // G
  ];
  const ARP_IDX = [0, 1, 2, 1];
  // 配器分层阈值：17 m/s 加入琶音，24 m/s 全力冲刺（换算为强度值）
  const T1 = (17 - NR.CONF.BASE_SPEED) / (NR.CONF.MAX_SPEED - NR.CONF.BASE_SPEED);
  const T2 = (24 - NR.CONF.BASE_SPEED) / (NR.CONF.MAX_SPEED - NR.CONF.BASE_SPEED);

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
      if (ctx) {
        // 主音量总线（静音开关）
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.9;
        master.connect(ctx.destination);
        // 回声总线（琶音使用）
        const delay = ctx.createDelay(0.6);
        delay.delayTime.value = 0.27;
        const fb = ctx.createGain(); fb.gain.value = 0.24;
        const wet = ctx.createGain(); wet.gain.value = 0.3;
        delay.connect(fb).connect(delay);
        delay.connect(wet).connect(master);
        delaySend = delay;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return !!ctx;
  }

  function getNoise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  // ================= SFX =================
  function beep(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(master);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  // ================= 乐器 =================
  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.11);
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.14);
  }
  function snare(t) {
    const src = ctx.createBufferSource(); src.buffer = getNoise();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(bp).connect(g).connect(master);
    src.start(t); src.stop(t + 0.1);
    const o = ctx.createOscillator(), g2 = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 190;
    g2.gain.setValueAtTime(0.05, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g2).connect(master);
    o.start(t); o.stop(t + 0.06);
  }
  function hat(t, open, vol) {
    const src = ctx.createBufferSource(); src.buffer = getNoise();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7500;
    const g = ctx.createGain();
    const dur = open ? 0.12 : 0.035;
    g.gain.setValueAtTime(vol || 0.035, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(hp).connect(g).connect(master);
    src.start(t); src.stop(t + dur + 0.01);
  }
  function bassNote(t, f) {
    const o = ctx.createOscillator(), g = ctx.createGain(), flt = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f;
    flt.type = 'lowpass'; flt.frequency.value = 340;
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    o.connect(flt).connect(g).connect(master);
    o.start(t); o.stop(t + 0.14);
  }
  function leadNote(t, f, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = f;
    g.gain.setValueAtTime(vol || 0.035, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    o.connect(g);
    g.connect(master);      // 干声
    g.connect(delaySend);   // 回声
    o.start(t); o.stop(t + 0.12);
  }
  function padChord(t, freqs, stepDur) {
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = 900;
    flt.connect(master);
    freqs.forEach(f => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.028, t + 0.3);
      g.gain.setValueAtTime(0.028, t + stepDur * 12);
      g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 16);
      o.connect(g).connect(flt);
      o.start(t); o.stop(t + stepDur * 16 + 0.05);
    });
  }

  // ================= 步进音序器（分层自适应） =================
  // tier 0 低速：鼓+贝斯+Pad，平稳起步
  // tier 1 中速：加入琶音主奏、开放踩镲
  // tier 2 高速：琶音加密为 16 分、军鼓加花，全力冲刺
  function scheduleStep(s, t, stepDur) {
    const bar = (s / 16) | 0;   // 第几段和弦 0-3
    const st = s % 16;          // 段内步 0-15
    const seg = PROG[bar];
    const tier = intensity < T1 ? 0 : (intensity < T2 ? 1 : 2);

    if (st % 4 === 0) kick(t);
    if (st === 4 || st === 12) snare(t);
    if ((tier >= 2 && st === 14) || (bar === 3 && st >= 14)) snare(t);
    if (st % 2 === 1) hat(t, tier >= 1 && st === 15, tier === 0 ? 0.022 : 0.035);

    if (st % 2 === 0) bassNote(t, st % 4 === 2 ? seg.root * 2 : seg.root);

    if (tier >= 1 && st % 2 === 0) {
      leadNote(t, seg.chord[ARP_IDX[(st / 2) % 4]] * (st % 8 < 4 ? 2 : 4), 0.035);
    }
    if (tier >= 2 && st % 2 === 1) {
      leadNote(t, seg.chord[ARP_IDX[((st - 1) / 2 + 2) % 4]] * 4, 0.022);
    }

    if (st === 0) padChord(t, seg.chord, stepDur);
  }

  // 前瞻调度：始终提前 0.18s 排音符，避免 setInterval 抖动
  // BPM 每拍平滑逼近目标值，变速无级无顿挫
  function scheduler() {
    if (!ctx || muted || gameState !== 'playing') { nextTime = 0; return; }
    bpm += (targetBpm - bpm) * 0.06;
    const stepDur = 60 / bpm / 4;
    if (!nextTime) nextTime = ctx.currentTime + 0.06;
    while (nextTime < ctx.currentTime + 0.18) {
      scheduleStep(step, nextTime, stepDur);
      nextTime += stepDur;
      step = (step + 1) % 64;
    }
  }

  return {
    unlock() { ensure(); },
    setState(s) { gameState = s; },
    isMuted() { return muted; },
    toggleMute() {
      muted = !muted;
      NR.store.set('muted', muted);
      if (master) master.gain.value = muted ? 0 : 0.9;
      return muted;
    },
    startMusic() {
      if (musicTimer) clearInterval(musicTimer);
      step = 0; nextTime = 0;
      bpm = targetBpm = MIN_BPM; intensity = 0;
      musicTimer = setInterval(scheduler, 60);
    },
    // 游戏速度同步：映射为强度 0~1，驱动 BPM 与配器分层
    setSpeed(s) {
      intensity = Math.max(0, Math.min(1, (s - NR.CONF.BASE_SPEED) / (NR.CONF.MAX_SPEED - NR.CONF.BASE_SPEED)));
      targetBpm = MIN_BPM + intensity * (MAX_BPM - MIN_BPM);
    },
    stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },

    jump()      { beep(320, 0.18, 'square', 0.1, 640); },
    jump2()     { beep(520, 0.16, 'square', 0.1, 1040); },
    coin()      { beep(880, 0.09, 'sine', 0.11); setTimeout(() => beep(1320, 0.12, 'sine', 0.11), 55); },
    crash()     { beep(220, 0.45, 'sawtooth', 0.16, 50); },
    slide()     { beep(500, 0.12, 'triangle', 0.07, 180); },
    near()      { beep(660, 0.1, 'sine', 0.08, 990); },
    milestone() { beep(523, 0.12, 'square', 0.09); setTimeout(() => beep(784, 0.16, 'square', 0.09), 100); },
    lane()      { beep(200, 0.06, 'triangle', 0.05, 300); },
    count()     { beep(440, 0.12, 'square', 0.09); },
    go()        { beep(880, 0.25, 'square', 0.11); },
    powerup()   { beep(523, 0.1, 'sine', 0.1); setTimeout(() => beep(659, 0.1, 'sine', 0.1), 80); setTimeout(() => beep(880, 0.18, 'sine', 0.1), 160); },
    shieldBreak(){ beep(300, 0.25, 'sawtooth', 0.12, 90); },
    boom() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(32, t + 0.22);
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + 0.26);
      const src = ctx.createBufferSource(); src.buffer = getNoise();
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.12, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      src.connect(lp).connect(g2).connect(master);
      src.start(t); src.stop(t + 0.2);
    },
    warp()      { beep(180, 0.5, 'sawtooth', 0.07, 1400); setTimeout(() => beep(900, 0.3, 'sine', 0.08, 1800), 120); }
  };
})();
