/* 后端 API 客户端（失败时静默降级，游戏仍可离线运行） */

async function req(path, opts = {}) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

/* 历史成绩 */
export async function postScore(d) {
  try { await req('/api/scores', { method: 'POST', body: JSON.stringify(d) }); return true; }
  catch (e) { return false; }
}
export async function getScores() {
  try { return (await req('/api/scores')).scores; }
  catch (e) { return null; }
}
export async function clearScores() {
  try { await req('/api/scores', { method: 'DELETE' }); return true; }
  catch (e) { return false; }
}

/* 成就 */
export async function syncAchievements(map) {
  try { await req('/api/achievements', { method: 'POST', body: JSON.stringify({ unlocked: map }) }); }
  catch (e) { /* 离线忽略 */ }
}
export async function getAchievements() {
  try { return (await req('/api/achievements')).achievements; }
  catch (e) { return null; }
}
export async function clearAchievements() {
  try { await req('/api/achievements', { method: 'DELETE' }); return true; }
  catch (e) { return false; }
}
