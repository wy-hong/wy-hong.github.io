/* UI 模块：DOM 引用与提示组件 */

export function $(id) { return document.getElementById(id); }

export const ui = {
  loading: $('loading'), menu: $('menu'), hud: $('hud'), over: $('over'),
  score: $('score'), gems: $('gems'), speed: $('speed'), combo: $('combo'),
  msg: $('msg'), vig: $('vignette'), hiscore: $('hiscore'), shieldIcon: $('shieldIcon'),
  finalScore: $('finalScore'), finalGems: $('finalGems'), finalDist: $('finalDist'),
  newRecord: $('newRecord'), homeBtn: $('homeBtn'),
  powers: $('powers'), toast: $('toast'),
  startBtn: $('startBtn'), retryBtn: $('retryBtn'),
  musicBtn: $('musicBtn'),
  achBtn: $('achBtn'), achPanel: $('achPanel'), achList: $('achList'),
  achClose: $('achClose'), achClear: $('achClear'),
  histBtn: $('histBtn'), historyPanel: $('historyPanel'), historyList: $('historyList'),
  histClose: $('histClose'), histClear: $('histClear')
};

let msgTimer = null;
export function showMsg(t, sec) {
  ui.msg.textContent = t;
  ui.msg.style.transition = 'none'; ui.msg.style.opacity = 1;
  clearTimeout(msgTimer);
  if (sec < 100) msgTimer = setTimeout(hideMsg, sec * 1000);
}
export function hideMsg() { ui.msg.style.transition = 'opacity .5s'; ui.msg.style.opacity = 0; }

let toastTimer = null;
export function showToast(t) {
  ui.toast.textContent = t;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2600);
}
