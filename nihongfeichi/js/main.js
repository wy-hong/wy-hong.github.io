/* 入口：启动游戏 */
import { ui } from './ui.js';
import { wireUI, loop } from './game.js';
import { loadAchievements } from './achievements.js';

ui.loading.classList.add('hidden');
ui.menu.classList.remove('hidden');
wireUI();
loadAchievements();
loop();
