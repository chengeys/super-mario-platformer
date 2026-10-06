/* 超级水管工大冒险 —— 原创同人横版过关游戏（代码绘制，无外部素材） */
'use strict';
/* ================= 基础 ================= */
const W = 960, H = 560, TILE = 40, ROWS = 14;
const GRAV = 2300, JUMP_V = 840, MOVE_SPD = 270, MAX_FALL = 950;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* ================= 音效（WebAudio 合成） ================= */
const AU = {
  ctx: null, muted: false,
  init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } },
  beep(f, dur, type, vol, slideTo) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + dur);
  },
  jump(big) { this.beep(big ? 220 : 300, 0.18, 'square', 0.10, big ? 660 : 880); },
  stomp() { this.beep(400, 0.12, 'square', 0.12, 120); },
  bump() { this.beep(140, 0.1, 'square', 0.12, 90); },
  brk() { this.beep(300, 0.2, 'sawtooth', 0.10, 80); },
  coin() { this.beep(990, 0.08, 'square', 0.09); setTimeout(() => this.beep(1320, 0.25, 'square', 0.09), 70); },
  sprout() { this.beep(200, 0.4, 'sine', 0.10, 900); },
  power() { const s = [523, 659, 784, 1046]; s.forEach((f, i) => setTimeout(() => this.beep(f, 0.12, 'square', 0.10), i * 90)); },
  kick() { this.beep(500, 0.12, 'square', 0.12, 1500); },
  pipe() { this.beep(300, 0.35, 'sine', 0.12, 90); },
  flag() { const s = [392, 523, 659, 784, 1046, 1318]; s.forEach((f, i) => setTimeout(() => this.beep(f, 0.18, 'triangle', 0.12), i * 110)); },
  die() { this.beep(500, 0.5, 'sawtooth', 0.12, 110); },
  oneup() { const s = [660, 830, 990, 1320]; s.forEach((f, i) => setTimeout(() => this.beep(f, 0.12, 'square', 0.10), i * 80)); }
};
window.addEventListener('pointerdown', () => AU.init(), { once: true });
window.addEventListener('keydown', () => AU.init(), { once: true });

/* ================= 输入 ================= */
const keys = {};
const justP = new Set();
window.addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  if (!keys[e.code]) justP.add(e.code);
  keys[e.code] = true;
  if (e.code === 'KeyM') AU.muted = !AU.muted;
  if (e.code === 'KeyP' && (state === 'play' || state === 'pause')) state = state === 'play' ? 'pause' : 'play';
  if (e.code === 'KeyF') toggleFS();
  if ((state === 'title' || state === 'gameover' || state === 'win') && (e.code === 'Space' || e.code === 'Enter')) startAll();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
const K = {
  left: () => keys['ArrowLeft'] || keys['KeyA'] || touch.left,
  right: () => keys['ArrowRight'] || keys['KeyD'] || touch.right,
  down: () => keys['ArrowDown'] || keys['KeyS'] || touch.down,
  jumpHit: () => justP.has('Space') || justP.has('ArrowUp') || justP.has('KeyW') || touch.jumpQ,
  jumpHeld: () => keys['Space'] || keys['ArrowUp'] || keys['KeyW'] || touch.jump
};
const touch = { left: false, right: false, down: false, jump: false, jumpQ: false };
function bindBtn(id, prop) {
  const el = document.getElementById(id);
  const on = e => {
    e.preventDefault(); AU.init();
    if (state === 'title' || state === 'gameover' || state === 'win') { startAll(); return; }
    touch[prop] = true; if (prop === 'jump') touch.jumpQ = true;
  };
  const off = e => { e.preventDefault(); touch[prop] = false; };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
}
bindBtn('tLeft', 'left'); bindBtn('tRight', 'right'); bindBtn('tDown', 'down'); bindBtn('tJump', 'jump');
/* 点屏幕开始（手机无键盘） */
canvas.addEventListener('pointerdown', () => {
  AU.init();
  if (state === 'title' || state === 'gameover' || state === 'win') startAll();
});
const IS_TOUCH = navigator.maxTouchPoints > 0;
if (IS_TOUCH) document.body.classList.add('touch');
function toggleFS() {
  if (!document.fullscreenElement) canvas.requestFullscreen && canvas.requestFullscreen();
  else document.exitFullscreen();
}
document.getElementById('fsBtn').addEventListener('click', toggleFS);

/* ================= 主题 ================= */
const THEMES = {
  day:    { sky: ['#5c94fc', '#b8e2ff'], g0: '#c84c0c', g1: '#7a2e05', hill: '#3fae2e', cloud: '#ffffff', deco: 'hills', night: false },
  sunset: { sky: ['#ff8a4c', '#ffd9a0'], g0: '#b8542a', g1: '#6e2f10', hill: '#2e8b3a', cloud: '#ffe8d0', deco: 'hills', night: false },
  night:  { sky: ['#0a0a2e', '#2c2c5e'], g0: '#5a3a6e', g1: '#2e1a3e', hill: '#1e4a2e', cloud: '#8a8ab0', deco: 'hills', night: true },
  cave:   { sky: ['#0d0d14', '#1c1c28'], g0: '#8a5a2b', g1: '#4a2e12', hill: '#3a3a4a', cloud: '#555566', deco: 'cave', night: true },
  snow:   { sky: ['#9ac0e8', '#e8f4ff'], g0: '#e8f0f8', g1: '#9ab4d0', hill: '#ffffff', cloud: '#ffffff', deco: 'snow', night: false },
  castle: { sky: ['#141422', '#2e2e44'], g0: '#6e6e7e', g1: '#33333e', hill: '#2a2a36', cloud: '#44445a', deco: 'castle', night: true }
};

/* ================= 关卡建造器 ================= */
function newMap(w) { const g = []; for (let r = 0; r < ROWS; r++) g.push(new Array(w).fill(' ')); return g; }
function B_ground(g, x0, x1, gaps) {
  for (let x = x0; x < x1; x++) {
    if (gaps && gaps.some(([a, b]) => x >= a && x < b)) continue;
    for (let y = 11; y < ROWS; y++) g[y][x] = '#';
  }
}
function B_rect(g, x0, x1, y0, y1, ch) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
    if (x >= 0 && y >= 0 && x < g[0].length && y < ROWS) g[y][x] = ch;
}
function B_block(g, x, y, ch) { if (x >= 0 && y >= 0 && x < g[0].length && y < ROWS) g[y][x] = ch; }
function B_qb(g, x, y, kind) { B_block(g, x, y, kind === 'coin' ? 'C' : '?'); }
function B_brick(g, x0, x1, y) { for (let x = x0; x <= x1; x++) B_block(g, x, y, 'B'); }
function B_stairs(g, x, h, dir) {
  for (let i = 0; i < h; i++) {
    const cx = dir === 'up' ? x + i : x + h - 1 - i;
    for (let y = 10; y > 10 - (i + 1); y--) B_block(g, cx, y, 'H');
  }
}
/* warps 由各关收集 */
let _warps;
function B_pipe(g, x, h, opt) {
  opt = opt || {};
  for (let i = 0; i < h; i++) for (let dx = 0; dx < 2; dx++)
    B_block(g, x + dx, 11 - h + i, opt.piranha ? 'Q' : 'O');
  if (opt.warp) _warps.push({ fx: x, fy: 11 - h, tx: opt.warp[0], ty: opt.warp[1] });
}
function B_flag(g, x) { for (let y = 3; y <= 10; y++) B_block(g, x, y, 'F'); }
function B_enemy(g, x, t) { B_block(g, x, 10, t === 'koopa' ? 'K' : 'E'); }
function B_spawn(g, x) { B_block(g, x, 10, 'S'); }
function finishLevel(name, theme, g) {
  const grid = g.map(r => r.join(''));
  const L = { name, theme, grid, warps: _warps };
  _warps = [];
  return L;
}

/* ================= 10 关 ================= */
const levels = [];
(function buildLevels() {
  _warps = [];
  { // 第壹关 · 青青平原（教学）
    const g = newMap(180);
    B_ground(g, 0, 180, [[48, 51]]);
    B_spawn(g, 3);
    B_qb(g, 14, 7); B_brick(g, 24, 26, 7); B_qb(g, 25, 7);
    B_enemy(g, 22, 'goomba'); B_enemy(g, 31, 'goomba'); B_enemy(g, 44, 'goomba');
    B_pipe(g, 62, 2);
    B_enemy(g, 72, 'koopa');
    B_stairs(g, 84, 4, 'up'); B_stairs(g, 89, 4, 'down');
    B_qb(g, 100, 7); B_qb(g, 104, 7, 'coin');
    B_enemy(g, 112, 'goomba'); B_enemy(g, 118, 'goomba');
    B_pipe(g, 128, 3, { piranha: true });
    B_enemy(g, 142, 'koopa');
    B_brick(g, 150, 152, 7); B_qb(g, 151, 7);
    B_flag(g, 170);
    levels.push(finishLevel('第壹关 · 青青平原', 'day', g));
  }
  { // 第贰关 · 地下水道（水管+奖励房）
    const g = newMap(180);
    B_ground(g, 0, 180);
    B_spawn(g, 3);
    B_rect(g, 15, 55, 3, 3, 'H');           // 低顶
    B_brick(g, 20, 24, 7); B_qb(g, 22, 7); B_qb(g, 30, 7, 'coin'); B_brick(g, 28, 32, 7);
    B_enemy(g, 40, 'goomba'); B_enemy(g, 48, 'koopa');
    B_pipe(g, 58, 2, { warp: [118, 10] });    // 进奖励房
    // 奖励房（115~140，6~10 行）
    B_rect(g, 115, 140, 6, 6, 'H');
    B_rect(g, 115, 115, 7, 10, 'H'); B_rect(g, 140, 140, 7, 10, 'H');
    B_rect(g, 115, 140, 10, 10, 'H');
    B_qb(g, 122, 8, 'coin'); B_qb(g, 126, 8, 'coin'); B_qb(g, 130, 8); B_qb(g, 134, 8, 'coin');
    B_pipe(g, 137, 2, { warp: [60, 11] });   // 回来
    B_pipe(g, 74, 3, { piranha: true });
    B_brick(g, 84, 88, 7); B_qb(g, 86, 7);
    B_enemy(g, 96, 'goomba'); B_enemy(g, 102, 'goomba'); B_enemy(g, 108, 'koopa');
    B_pipe(g, 146, 2, { piranha: true });
    B_stairs(g, 152, 3, 'up');
    B_flag(g, 170);
    levels.push(finishLevel('第贰关 · 地下水道', 'cave', g));
  }
  { // 第叁关 · 黄昏丘陵
    const g = newMap(195);
    B_ground(g, 0, 195, [[40, 43], [82, 86]]);
    B_spawn(g, 3);
    B_enemy(g, 16, 'goomba'); B_enemy(g, 24, 'koopa');
    B_brick(g, 28, 30, 7); B_qb(g, 29, 7);
    B_rect(g, 50, 57, 8, 8, 'H');            // 浮空平台
    B_qb(g, 53, 5);
    B_enemy(g, 62, 'goomba'); B_enemy(g, 68, 'goomba');
    B_stairs(g, 72, 4, 'up');
    B_pipe(g, 95, 2, { piranha: true });
    B_brick(g, 104, 108, 7); B_qb(g, 106, 7); B_qb(g, 110, 7, 'coin'); B_brick(g, 110, 112, 7);
    B_enemy(g, 120, 'koopa'); B_enemy(g, 128, 'goomba'); B_enemy(g, 134, 'goomba');
    B_stairs(g, 142, 5, 'up'); B_stairs(g, 148, 5, 'down');
    B_pipe(g, 158, 3);
    B_enemy(g, 166, 'koopa');
    B_flag(g, 185);
    levels.push(finishLevel('第叁关 · 黄昏丘陵', 'sunset', g));
  }
  { // 第肆关 · 星空之夜
    const g = newMap(195);
    B_ground(g, 0, 195, [[55, 58]]);
    B_spawn(g, 3);
    B_qb(g, 12, 7);
    B_enemy(g, 20, 'goomba'); B_enemy(g, 26, 'koopa'); B_enemy(g, 34, 'goomba');
    B_rect(g, 44, 52, 7, 7, 'B'); B_qb(g, 48, 7);
    B_pipe(g, 64, 3, { piranha: true });
    B_enemy(g, 74, 'goomba'); B_enemy(g, 80, 'goomba');
    B_brick(g, 90, 94, 7); B_qb(g, 92, 7); B_qb(g, 96, 7, 'coin'); B_brick(g, 96, 98, 7);
    B_pipe(g, 108, 2, { piranha: true });
    B_enemy(g, 118, 'koopa'); B_enemy(g, 126, 'koopa');
    B_stairs(g, 134, 4, 'up'); B_stairs(g, 139, 4, 'down');
    B_enemy(g, 150, 'goomba'); B_enemy(g, 156, 'goomba'); B_enemy(g, 162, 'goomba');
    B_pipe(g, 170, 4, { piranha: true });
    B_flag(g, 185);
    levels.push(finishLevel('第肆关 · 星空之夜', 'night', g));
  }
  { // 第伍关 · 管道迷宫（必经水管）
    const g = newMap(205);
    B_ground(g, 0, 205, [[90, 100]]);        // 10 格宽深渊，必须钻管
    B_spawn(g, 3);
    B_pipe(g, 14, 2); B_pipe(g, 24, 3, { piranha: true }); B_pipe(g, 34, 2);
    B_enemy(g, 44, 'goomba'); B_enemy(g, 52, 'koopa');
    B_brick(g, 58, 62, 7); B_qb(g, 60, 7);
    B_pipe(g, 70, 2, { piranha: true });
    B_enemy(g, 78, 'goomba');
    B_pipe(g, 84, 2, { warp: [111, 11] });    // 跳过深渊
    // 地下通道（108~150，挖空 8~10 行）
    B_rect(g, 108, 150, 8, 8, 'H');
    B_rect(g, 108, 150, 9, 10, ' ');
    B_rect(g, 107, 107, 8, 10, 'H'); B_rect(g, 151, 151, 8, 10, 'H');
    B_qb(g, 120, 8, 'coin'); B_qb(g, 126, 8, 'coin'); B_qb(g, 132, 8);
    B_enemy(g, 140, 'goomba');
    B_pipe(g, 147, 2, { warp: [102, 11] });  // 回到深渊对岸
    B_enemy(g, 118, 'koopa'); B_enemy(g, 126, 'goomba');
    B_pipe(g, 130, 3, { piranha: true });
    B_brick(g, 140, 144, 7); B_qb(g, 142, 7);
    B_stairs(g, 152, 4, 'up'); B_stairs(g, 157, 4, 'down');
    B_enemy(g, 168, 'koopa'); B_enemy(g, 176, 'goomba');
    B_flag(g, 195);
    levels.push(finishLevel('第伍关 · 管道迷宫', 'cave', g));
  }
  { // 第陆关 · 天空云梯
    const g = newMap(200);
    B_ground(g, 0, 200, [[30, 40], [62, 76], [104, 122], [150, 158]]);
    B_spawn(g, 3);
    B_qb(g, 14, 7);
    B_rect(g, 30, 36, 8, 8, 'H'); B_qb(g, 33, 5);
    B_rect(g, 64, 70, 7, 7, 'H'); B_rect(g, 72, 76, 8, 8, 'H');
    B_enemy(g, 46, 'goomba');
    B_brick(g, 84, 88, 7); B_qb(g, 86, 7);
    B_rect(g, 106, 112, 8, 8, 'H'); B_rect(g, 114, 120, 6, 6, 'H'); B_qb(g, 117, 3, 'coin');
    B_enemy(g, 92, 'koopa');
    B_pipe(g, 130, 2);
    B_enemy(g, 136, 'goomba'); B_enemy(g, 142, 'goomba');
    B_rect(g, 150, 156, 8, 8, 'H');
    B_stairs(g, 164, 4, 'up'); B_stairs(g, 169, 4, 'down');
    B_qb(g, 178, 7);
    B_flag(g, 190);
    levels.push(finishLevel('第陆关 · 天空云梯', 'day', g));
  }
  { // 第柒关 · 熔岩洞窟
    const g = newMap(195);
    B_ground(g, 0, 195, [[70, 73]]);
    B_spawn(g, 3);
    B_rect(g, 12, 40, 4, 4, 'H');
    B_brick(g, 16, 20, 7); B_qb(g, 18, 7); B_enemy(g, 26, 'goomba');
    B_brick(g, 30, 34, 7); B_qb(g, 32, 7, 'coin');
    B_enemy(g, 44, 'koopa'); B_enemy(g, 50, 'goomba'); B_enemy(g, 56, 'goomba');
    B_pipe(g, 62, 3, { piranha: true });
    B_rect(g, 78, 100, 4, 4, 'H');
    B_brick(g, 82, 86, 7); B_qb(g, 84, 7);
    B_enemy(g, 92, 'koopa'); B_enemy(g, 98, 'goomba');
    B_pipe(g, 108, 2, { piranha: true });
    B_stairs(g, 116, 5, 'up');
    B_brick(g, 126, 130, 7); B_qb(g, 128, 7);
    B_enemy(g, 136, 'goomba'); B_enemy(g, 142, 'koopa'); B_enemy(g, 148, 'goomba');
    B_pipe(g, 156, 4, { piranha: true });
    B_qb(g, 166, 7);
    B_flag(g, 185);
    levels.push(finishLevel('第柒关 · 熔岩洞窟', 'castle', g));
  }
  { // 第捌关 · 雪原
    const g = newMap(195);
    B_ground(g, 0, 195, [[36, 40], [88, 93], [140, 144]]);
    B_spawn(g, 3);
    B_qb(g, 12, 7);
    B_enemy(g, 20, 'goomba'); B_enemy(g, 28, 'koopa');
    B_stairs(g, 44, 4, 'up'); B_stairs(g, 49, 4, 'down');
    B_brick(g, 58, 62, 7); B_qb(g, 60, 7); B_qb(g, 64, 7, 'coin'); B_brick(g, 64, 66, 7);
    B_pipe(g, 74, 2, { piranha: true });
    B_enemy(g, 98, 'goomba'); B_enemy(g, 104, 'goomba'); B_enemy(g, 110, 'koopa');
    B_rect(g, 118, 124, 8, 8, 'H'); B_qb(g, 121, 5);
    B_pipe(g, 130, 3);
    B_enemy(g, 150, 'koopa'); B_enemy(g, 158, 'goomba');
    B_brick(g, 166, 170, 7); B_qb(g, 168, 7);
    B_flag(g, 185);
    levels.push(finishLevel('第捌关 · 雪原', 'snow', g));
  }
  { // 第玖关 · 暮色城堡外围
    const g = newMap(205);
    B_ground(g, 0, 205, [[52, 56], [120, 125]]);
    B_spawn(g, 3);
    B_enemy(g, 12, 'goomba'); B_enemy(g, 18, 'koopa');
    B_brick(g, 24, 28, 7); B_qb(g, 26, 7);
    B_pipe(g, 34, 3, { piranha: true });
    B_stairs(g, 42, 5, 'up');
    B_rect(g, 58, 64, 8, 8, 'H'); B_qb(g, 61, 5, 'coin');
    B_enemy(g, 70, 'goomba'); B_enemy(g, 76, 'goomba'); B_enemy(g, 82, 'koopa');
    B_brick(g, 90, 94, 7); B_qb(g, 92, 7); B_pipe(g, 100, 2, { piranha: true });
    B_enemy(g, 110, 'koopa'); B_enemy(g, 116, 'goomba');
    B_rect(g, 130, 138, 4, 4, 'H');
    B_brick(g, 132, 136, 7); B_qb(g, 134, 7);
    B_enemy(g, 144, 'goomba'); B_enemy(g, 150, 'koopa'); B_enemy(g, 156, 'goomba');
    B_pipe(g, 164, 4, { piranha: true });
    B_stairs(g, 172, 4, 'up'); B_stairs(g, 177, 4, 'down');
    B_qb(g, 186, 7);
    B_flag(g, 196);
    levels.push(finishLevel('第玖关 · 暮色城堡外围', 'sunset', g));
  }
  { // 第拾关 · 决战城堡
    const g = newMap(225);
    B_ground(g, 0, 225, [[60, 64], [140, 145]]);
    B_spawn(g, 3);
    B_qb(g, 10, 7);
    B_enemy(g, 18, 'goomba'); B_enemy(g, 24, 'goomba'); B_enemy(g, 30, 'koopa');
    B_rect(g, 38, 58, 4, 4, 'H');
    B_brick(g, 42, 46, 7); B_qb(g, 44, 7);
    B_pipe(g, 68, 3, { piranha: true });
    B_enemy(g, 78, 'koopa'); B_enemy(g, 84, 'goomba'); B_enemy(g, 90, 'goomba');
    B_brick(g, 98, 102, 7); B_qb(g, 100, 7); B_qb(g, 104, 7, 'coin'); B_brick(g, 104, 106, 7);
    B_pipe(g, 114, 2, { piranha: true });
    B_stairs(g, 122, 6, 'up');
    B_enemy(g, 132, 'koopa');
    B_rect(g, 150, 170, 4, 4, 'H');
    B_brick(g, 154, 158, 7); B_qb(g, 156, 7);
    B_enemy(g, 164, 'goomba'); B_enemy(g, 170, 'goomba');
    B_pipe(g, 178, 4, { piranha: true });
    B_enemy(g, 188, 'koopa'); B_enemy(g, 194, 'koopa'); B_enemy(g, 200, 'goomba');
    B_brick(g, 206, 208, 7); B_qb(g, 207, 7);
    B_flag(g, 216);
    levels.push(finishLevel('第拾关 · 决战城堡', 'castle', g));
  }
})();

/* ================= 游戏状态 ================= */
let state = 'title';           // title play dead flag clear gameover win pause
let levelIdx = 0, grid = [], levelW = 0, levelTheme = THEMES.day;
let warps = [], camX = 0, time = 0;
let score = 0, coins = 0, lives = 3;
let flagInfo = null, seqT = 0, seqPhase = 0, fadeA = 0;
let bumpAnims = [], popups = [], parts = [], items = [], enemies = [];
let shakeT = 0;

const player = {
  x: 0, y: 0, w: 26, h: 34, vx: 0, vy: 0,
  big: false, face: 1, onGround: false, coyote: 0, jumpBuf: 0,
  invuln: 0, animT: 0, dead: false, pipeT: 0
};

function tileAt(tx, ty) {
  if (tx < 0) return '#';
  if (tx >= levelW || ty < 0) return ' ';
  if (ty >= ROWS) return ' ';
  return grid[ty][tx];
}
function solidAt(tx, ty) {
  const t = tileAt(tx, ty);
  return t === '#' || t === 'H' || t === 'B' || t === '?' || t === 'C' || t === 'U' || t === 'O' || t === 'Q';
}
function setTile(tx, ty, ch) {
  if (tx >= 0 && ty >= 0 && tx < levelW && ty < ROWS) grid[ty][tx] = ch;
}

/* 通用 AABB vs 瓦片碰撞：先 X 后 Y */
function moveCollide(e, dt) {
  e.onGround = false;
  // X
  e.x += e.vx * dt;
  let x0 = Math.floor(e.x / TILE), x1 = Math.floor((e.x + e.w) / TILE);
  let y0 = Math.floor(e.y / TILE), y1 = Math.floor((e.y + e.h - 1) / TILE);
  if (e.vx > 0) {
    for (let ty = y0; ty <= y1; ty++) if (solidAt(x1, ty)) {
      e.x = x1 * TILE - e.w - 0.01; e.hitWall = 1; break;
    }
  } else if (e.vx < 0) {
    for (let ty = y0; ty <= y1; ty++) if (solidAt(x0, ty)) {
      e.x = (x0 + 1) * TILE + 0.01; e.hitWall = -1; break;
    }
  } else e.hitWall = 0;
  // Y
  e.y += e.vy * dt;
  e.headHit = null;
  x0 = Math.floor((e.x + 1) / TILE); x1 = Math.floor((e.x + e.w - 1) / TILE);
  y0 = Math.floor(e.y / TILE); y1 = Math.floor((e.y + e.h) / TILE);
  if (e.vy > 0) {
    for (let tx = x0; tx <= x1; tx++) if (solidAt(tx, y1)) {
      e.y = y1 * TILE - e.h; e.vy = 0; e.onGround = true; break;
    }
  } else if (e.vy < 0) {
    for (let tx = x0; tx <= x1; tx++) if (solidAt(tx, y0)) {
      e.y = (y0 + 1) * TILE + 0.01; e.vy = 0; e.headHit = { tx, ty: y0 }; break;
    }
  }
}

/* ================= 关卡载入 ================= */
function loadLevel(i) {
  levelIdx = i;
  const L = levels[i];
  levelTheme = THEMES[L.theme];
  grid = L.grid.map(r => r.split(''));
  levelW = grid[0].length;
  warps = L.warps;
  enemies = []; items = []; parts = []; popups = []; bumpAnims = [];
  flagInfo = null; seqT = 0; seqPhase = 0;
  let sx = 3, poleX = -1;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < levelW; x++) {
    const t = grid[y][x];
    if (t === 'S') { sx = x; setTile(x, y, ' '); }
    else if (t === 'E') { setTile(x, y, ' '); spawnGoomba(x); }
    else if (t === 'K') { setTile(x, y, ' '); spawnKoopa(x); }
    else if (t === 'F' && poleX < 0) poleX = x;
    else if (t === 'Q' && tileAt(x, y - 1) !== 'Q' && tileAt(x, y - 1) !== 'O') spawnPiranha(x, y);
  }
  flagInfo = { tx: poleX, x: poleX * TILE + TILE / 2, topY: 3 * TILE, clothY: 3 * TILE + 20, grabbed: false };
  player.x = (sx + 0.5) * TILE - 13; player.y = 10 * TILE - player.h;
  player.vx = 0; player.vy = 0; player.face = 1; player.invuln = 0; player.dead = false; player.pipeT = 0;
  camX = clamp(player.x - W * 0.42, 0, levelW * TILE - W);
}
function startAll() { score = 0; coins = 0; lives = 3; player.big = false; justP.clear(); touch.jumpQ = false; loadLevel(0); state = 'play'; }
function restartLevel() { loadLevel(levelIdx); state = 'play'; }

/* ================= 顶砖块 ================= */
function addPopup(x, y, txt, color) { popups.push({ x, y, txt, color: color || '#fff', t: 0 }); }
function addScore(x, y, n) { score += n; addPopup(x, y, '+' + n); }
function hitBlock(tx, ty) {
  const t = tileAt(tx, ty);
  if (t === '?') {
    setTile(tx, ty, 'U'); AU.sprout();
    items.push({ type: 'mush', x: tx * TILE + 5, y: ty * TILE - 30, w: 30, h: 30, vx: 0, vy: 0, rise: 1, t: 0 });
  } else if (t === 'C') {
    setTile(tx, ty, 'U'); coins++; AU.coin(); addScore(tx * TILE, ty * TILE, 200);
    parts.push({ type: 'coin', x: tx * TILE + 20, y: ty * TILE, vx: 0, vy: -420, t: 0 });
  } else if (t === 'B') {
    if (player.big) {
      setTile(tx, ty, ' '); AU.brk(); addScore(tx * TILE, ty * TILE, 50); shakeT = 0.12;
      for (let k = 0; k < 4; k++) parts.push({ type: 'brick', x: tx * TILE + 20, y: ty * TILE + 20, vx: (k % 2 ? 1 : -1) * rand(80, 200), vy: -rand(200, 420), t: 0 });
    } else { bumpAnims.push({ tx, ty, t: 0 }); AU.bump(); }
  } else if (t === 'H' || t === 'U' || t === 'O' || t === 'Q' || t === '#' ) { AU.bump(); }
  // 顶死站在砖上的怪
  for (const e of enemies) {
    if ((e.type === 'goomba' || e.type === 'koopa') && e.st === 'walk') {
      const feetTY = Math.floor((e.y + e.h + 2) / TILE);
      const ex = Math.floor((e.x + e.w / 2) / TILE);
      if (feetTY === ty && ex === tx) { e.st = 'die'; e.t = 0; addScore(e.x, e.y, 100); }
    }
  }
}

/* ================= 玩家受伤/死亡 ================= */
function hurtPlayer() {
  if (player.invuln > 0 || player.dead || state !== 'play') return;
  if (player.big) {
    player.big = false; player.h = 34; player.y += 20; player.invuln = 2; AU.bump();
  } else killPlayer();
}
function killPlayer() {
  if (player.dead) return;
  player.dead = true; player.vy = -640; state = 'dead'; seqT = 0; AU.die();
}

/* ================= 敌人生成 ================= */
function spawnGoomba(tx) {
  enemies.push({ type: 'goomba', x: tx * TILE + 4, y: 10 * TILE - 30, w: 32, h: 30, vx: -65, vy: 0, st: 'walk', t: 0, animT: rand(0, 1) });
}
function spawnKoopa(tx) {
  enemies.push({ type: 'koopa', x: tx * TILE + 4, y: 10 * TILE - 44, w: 32, h: 44, vx: -75, vy: 0, st: 'walk', t: 0, animT: rand(0, 1) });
}
function spawnPiranha(tx, ty) {
  enemies.push({ type: 'piranha', x: tx * TILE + 3, y: ty * TILE - 44, w: 34, h: 48, vx: 0, vy: 0, st: 'hide', t: rand(0, 1), baseY: ty * TILE - 44, pipeX: tx });
}

/* ================= 主更新 ================= */
function update(dt) {
  time += dt;
  if (shakeT > 0) shakeT -= dt;
  for (const b of bumpAnims) b.t += dt;
  bumpAnims = bumpAnims.filter(b => b.t < 0.25);
  for (const p of popups) { p.t += dt; p.y -= 40 * dt; }
  popups = popups.filter(p => p.t < 1);
  for (const p of parts) {
    p.t += dt; p.vy += GRAV * dt * 0.8; p.x += p.vx * dt; p.y += p.vy * dt;
  }
  parts = parts.filter(p => p.t < 1.6 && p.y < H + 60);
  if (state === 'play') updatePlay(dt);
  else if (state === 'dead') updateDead(dt);
  else if (state === 'flag') updateFlag(dt);
  else if (state === 'clear') { seqT += dt; if (seqT > 1.4) nextLevel(); }
  justP.clear(); touch.jumpQ = false;
}
function nextLevel() {
  if (levelIdx + 1 >= levels.length) { state = 'win'; AU.flag(); }
  else { loadLevel(levelIdx + 1); state = 'play'; }
}

/* ---- play ---- */
function updatePlay(dt) {
  const p = player;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.coyote > 0) p.coyote -= dt;
  if (p.jumpBuf > 0) p.jumpBuf -= dt;
  // 水管传送中
  if (p.pipeT > 0) { updatePipe(dt); return; }

  const L = K.left(), R = K.right();
  if (L && !R) { p.vx = -MOVE_SPD; p.face = -1; }
  else if (R && !L) { p.vx = MOVE_SPD; p.face = 1; }
  else p.vx = 0;
  if (K.jumpHit()) p.jumpBuf = 0.14;
  if (p.onGround) p.coyote = 0.1;
  if (p.jumpBuf > 0 && p.coyote > 0) {
    p.vy = -JUMP_V; p.onGround = false; p.coyote = 0; p.jumpBuf = 0; AU.jump(p.big);
  }
  if (!K.jumpHeld() && p.vy < -300) p.vy = -300;   // 松开跳跃键截断
  p.vy = Math.min(p.vy + GRAV * dt, MAX_FALL);
  const wasGround = p.onGround;
  moveCollide(p, dt);
  if (!wasGround && p.onGround) { /* 落地 */ }
  if (p.headHit) hitBlock(p.headHit.tx, p.headHit.ty);
  p.animT += dt * (Math.abs(p.vx) > 10 ? 10 : 2);

  // 掉坑
  if (p.y > ROWS * TILE + 60) { killPlayer(); return; }
  // 钻水管
  if (p.pipeCD > 0) p.pipeCD -= dt;
  else if (K.down()) tryPipe();
  // 旗杆
  checkFlag();
  // 敌人 / 道具
  updateEnemies(dt);
  updateItems(dt);
  // 镜头跟随（可来回）
  camX = clamp(p.x + p.w / 2 - W * 0.42, 0, Math.max(0, levelW * TILE - W));
}

/* ---- 水管 ---- */
function pipeTopAt(px, feetY) {
  const ty = Math.floor((feetY + 2) / TILE);
  const tx = Math.floor(px / TILE);
  const t = tileAt(tx, ty);
  if (t !== 'O' && t !== 'Q') return null;
  let lx = tx;
  while (tileAt(lx - 1, ty) === 'O' || tileAt(lx - 1, ty) === 'Q') lx--;
  return { tx: lx, ty };
}
function tryPipe() {
  const p = player;
  if (!p.onGround) return;
  const top = pipeTopAt(p.x + p.w / 2, p.y + p.h);
  if (!top) return;
  const w = warps.find(w => w.fx === top.tx && w.fy === top.ty);
  if (!w) return;
  p.pipeT = 0.0001; p.pipeWarp = w; p.vx = 0; AU.pipe();
}
function updatePipe(dt) {
  const p = player;
  p.pipeT += dt;
  if (p.pipeT < 0.7) { p.y += 60 * dt; return; }          // 沉入
  if (p.pipeT < 0.9) return;                              // 黑场
  if (!p.warped) {
    const w = p.pipeWarp;
    p.x = (w.tx + 0.5) * TILE - p.w / 2; p.y = w.ty * TILE - p.h;
    p.vy = 0; p.warped = true;
  }
  if (p.pipeT < 1.6) { p.y -= 60 * dt; return; }           // 升起
  p.pipeT = 0; p.warped = false; p.pipeWarp = null; p.pipeCD = 0.6;
}

/* ---- 旗杆 ---- */
function checkFlag() {
  const p = player, f = flagInfo;
  if (!f || f.grabbed || p.dead || f.tx < 0) return;
  const x0 = Math.floor(p.x / TILE), x1 = Math.floor((p.x + p.w) / TILE);
  const y0 = Math.floor(p.y / TILE), y1 = Math.floor((p.y + p.h) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++)
    if (tileAt(tx, ty) === 'F') { startFlagSeq(); return; }
}
function startFlagSeq() {
  const p = player, f = flagInfo;
  f.grabbed = true;
  const grabH = clamp(Math.floor((10 * TILE - p.y) / TILE), 1, 8);
  addScore(f.x, p.y, grabH * 100);
  state = 'flag'; seqT = 0; seqPhase = 0;
  p.vx = 0; p.vy = 0; p.x = f.x - 30;
  AU.flag();
}
function updateFlag(dt) {
  const p = player, f = flagInfo;
  seqT += dt;
  const groundY = 11 * TILE - p.h;
  if (seqPhase === 0) {                       // 沿杆下滑，旗帜落下
    p.y = Math.min(p.y + 260 * dt, groundY);
    f.clothY = Math.min(f.clothY + 300 * dt, 10 * TILE - 20);
    if (p.y >= groundY && f.clothY >= 10 * TILE - 21) { seqPhase = 1; seqT = 0; addPopup(f.x, groundY - 40, '过关！', '#ffe14d'); }
  } else if (seqPhase === 1) {                // 庆祝
    if (seqT > 1.6) { seqPhase = 2; seqT = 0; }
  } else { state = 'clear'; seqT = 0; }
}

/* ---- 死亡 ---- */
function updateDead(dt) {
  const p = player;
  seqT += dt;
  if (seqT < 0.4) return;
  p.vy = Math.min(p.vy + GRAV * dt, MAX_FALL);
  p.y += p.vy * dt;
  if (seqT > 2.2) {
    lives--;
    if (lives <= 0) state = 'gameover';
    else restartLevel();
  }
}

/* ---- 敌人 ---- */
function updateEnemies(dt) {
  const p = player;
  for (const e of enemies) {
    e.t += dt; e.animT += dt;
    if (e.st === 'die') continue;
    if (e.type === 'goomba' || (e.type === 'koopa' && e.st === 'walk')) {
      e.vy = Math.min(e.vy + GRAV * dt, MAX_FALL);
      if (e.hitWall) { e.vx = -e.vx; e.hitWall = 0; }
      moveCollide(e, dt);
      if (e.hitWall) { e.vx = -e.vx; e.hitWall = 0; }
      if (e.y > ROWS * TILE + 80) { e.st = 'die'; continue; }
      // 与玩家
      if (!p.dead && overlap(p, e)) {
        const stomp = p.vy > 0 && (p.y + p.h) - e.y < 22;
        if (stomp) {
          if (e.type === 'goomba') { e.st = 'die'; addScore(e.x, e.y, 100); }
          else { e.st = 'shell'; e.vx = 0; e.h = 30; e.y += 14; e.t = 0; addScore(e.x, e.y, 100); }
          p.vy = K.jumpHeld() ? -700 : -460; p.onGround = false; AU.stomp();
        } else hurtPlayer();
      }
    } else if (e.type === 'koopa' && (e.st === 'shell' || e.st === 'slide')) {
      if (e.st === 'slide') {
        e.vy = Math.min(e.vy + GRAV * dt, MAX_FALL);
        moveCollide(e, dt);
        if (e.hitWall) { e.vx = -e.vx; e.hitWall = 0; AU.bump(); }
        // 龟壳撞碎砖块、撞死怪
        const dir = Math.sign(e.vx);
        const ftx = Math.floor((e.x + (dir > 0 ? e.w + 2 : -2)) / TILE);
        for (let ty = Math.floor(e.y / TILE); ty <= Math.floor((e.y + e.h) / TILE); ty++)
          if (tileAt(ftx, ty) === 'B') { setTile(ftx, ty, ' '); addScore(ftx * TILE, ty * TILE, 50); AU.brk(); }
        for (const o of enemies) {
          if (o !== e && o.st !== 'die' && (o.type === 'goomba' || (o.type === 'koopa' && o.st === 'walk')) && overlap(e, o)) {
            o.st = 'die'; o.t = 0; o.flip = true; o.vy = -400; addScore(o.x, o.y, 200);
          }
        }
        if (e.y > ROWS * TILE + 80) { e.st = 'die'; continue; }
      }
      if (!p.dead && overlap(p, e)) {
        const stomp = p.vy > 0 && (p.y + p.h) - e.y < 22;
        if (stomp) {
          if (e.st === 'slide') { e.st = 'shell'; e.vx = 0; }
          else { e.st = 'slide'; e.vx = (p.x + p.w / 2 < e.x + e.w / 2 ? 1 : -1) * 420; AU.kick(); }
          p.vy = K.jumpHeld() ? -700 : -460; p.onGround = false; AU.stomp();
        } else if (e.st === 'shell') {
          e.st = 'slide'; e.vx = (p.x + p.w / 2 < e.x + e.w / 2 ? 1 : -1) * 420; AU.kick();
          if (p.invuln <= 0) p.invuln = 0.3;
        } else hurtPlayer();
      }
      // 龟壳静置久了乌龟爬出来
      if (e.st === 'shell' && e.t > 8) { e.st = 'walk'; e.h = 44; e.y -= 14; e.vx = -75; e.t = 0; }
    } else if (e.type === 'piranha') {
      // 周期：藏1.2s → 出0.5s → 停2s → 回0.5s
      const cyc = e.t % 4.2;
      const nearPlayer = Math.abs((p.x + p.w / 2) - (e.pipeX * TILE + TILE)) < 70;
      let target = 0; // 0 藏 1 出
      if (!nearPlayer && cyc > 1.2 && cyc < 3.7) target = 1;
      const wantY = target ? e.baseY : e.baseY + e.h - 6;
      e.y += clamp(wantY - e.y, -90 * dt, 90 * dt);
      if (!p.dead && e.y < e.baseY + e.h - 14 && overlap(p, e)) hurtPlayer();
    }
  }
  // 翻倒死亡动画
  for (const e of enemies) if (e.st === 'die' && e.flip) { e.vy += GRAV * dt; e.y += e.vy * dt; }
  enemies = enemies.filter(e => !(e.st === 'die' && e.t > 1.2));
}
function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/* ---- 道具 ---- */
function updateItems(dt) {
  const p = player;
  for (const it of items) {
    it.t += dt;
    if (it.type === 'mush') {
      if (it.rise) {
        it.y -= 30 * dt;
        if (it.t > 1) { it.rise = 0; it.vx = 120; }
        continue;
      }
      it.vy = Math.min(it.vy + GRAV * dt, MAX_FALL);
      const e2 = { x: it.x, y: it.y, w: it.w, h: it.h, vx: it.vx, vy: it.vy, hitWall: 0 };
      moveCollide(e2, dt);
      it.x = e2.x; it.y = e2.y; it.vy = e2.vy;
      it.vx = e2.hitWall ? -it.vx : it.vx;
      if (it.y > ROWS * TILE + 60) it.dead = true;
      if (!p.dead && overlap(p, it)) {
        it.dead = true;
        if (!p.big) { p.big = true; p.h = 54; p.y -= 20; }
        AU.power(); addScore(p.x, p.y - 20, 1000);
      }
    } else if (it.type === 'coinfly') {
      it.vy += GRAV * dt; it.y += it.vy * dt;
      if (it.t > 0.5) it.dead = true;
    }
  }
  items = items.filter(i => !i.dead);
}

/* ================= 渲染 ================= */
function render() {
  ctx.save();
  if (shakeT > 0) ctx.translate(rand(-3, 3), rand(-3, 3));
  drawSkyDeco();
  ctx.save();
  ctx.translate(-Math.round(camX), 0);
  drawTiles();
  drawFlagCastle();
  drawWarpHints();
  drawItems();
  if (state !== 'title') drawEnemies();
  if (state !== 'title') drawPlayer();
  drawParts();
  drawPopups();
  ctx.restore();
  ctx.restore();
  drawHUD();
  drawOverlay();
}
function drawSkyDeco() {
  const th = levelTheme;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (th.night) {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 60; i++) {
      const sx = (i * 173) % W, sy = (i * 97) % 300;
      ctx.globalAlpha = 0.4 + 0.4 * Math.sin(time * 2 + i);
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f4f0d0'; ctx.beginPath(); ctx.arc(830, 80, 34, 0, 6.3); ctx.fill();
  } else {
    ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(850, 70, 40, 0, 6.3); ctx.fill();
  }
  // 远景（视差）
  const off1 = -camX * 0.4, off2 = -camX * 0.65;
  if (th.deco === 'hills' || th.deco === 'snow') {
    ctx.fillStyle = th.hill;
    for (let x = -200; x < W + 400; x += 340) {
      const hx = x + off1 % 340;
      ctx.beginPath(); ctx.moveTo(hx, 440); ctx.lineTo(hx + 130, 300); ctx.lineTo(hx + 260, 440); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = th.cloud;
    for (let x = -100; x < W + 400; x += 420) {
      const cx = x + off2 % 420, cy = 90 + (x % 3) * 30;
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, 6.3); ctx.arc(cx + 30, cy - 10, 32, 0, 6.3); ctx.arc(cx + 62, cy, 26, 0, 6.3);
      ctx.fill();
    }
    if (th.deco === 'snow') { // 飘雪
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 50; i++) {
        const sx = (i * 211 + time * 30) % (W + 40) - 20, sy = (i * 157 + time * 60) % (H + 40) - 20;
        ctx.fillRect(sx, sy, 3, 3);
      }
    }
  } else if (th.deco === 'cave') {
    ctx.fillStyle = '#08080e';
    for (let x = -100; x < W + 300; x += 220) {
      const sx = x + off1 % 220;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx + 60, 0); ctx.lineTo(sx + 30, 120); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(120,200,255,0.25)';
    for (let x = 0; x < W + 300; x += 300) {
      const cx = x + off2 % 300;
      ctx.beginPath(); ctx.arc(cx, 380, 10, 0, 6.3); ctx.fill();
    }
  } else if (th.deco === 'castle') {
    ctx.fillStyle = '#0c0c16';
    for (let x = -100; x < W + 300; x += 200) {
      const bx = x + off1 % 200;
      ctx.fillRect(bx, 330, 200, 130);
      for (let k = 0; k < 5; k++) ctx.fillRect(bx + k * 40, 310, 24, 24);
    }
  }
}
function bumpOff(tx, ty) {
  for (const b of bumpAnims) if (b.tx === tx && b.ty === ty) return -Math.sin(b.t / 0.25 * Math.PI) * 12;
  return 0;
}
function drawTiles() {
  const th = levelTheme;
  const x0 = Math.max(0, Math.floor(camX / TILE) - 1), x1 = Math.min(levelW - 1, Math.ceil((camX + W) / TILE) + 1);
  for (let y = 0; y < ROWS; y++) for (let x = x0; x <= x1; x++) {
    const t = grid[y][x];
    if (t === ' ') continue;
    const px = x * TILE, py = y * TILE, bo = bumpOff(x, y);
    if (t === '#') {
      ctx.fillStyle = th.g1; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = th.g0; ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      if (!solidAt(x, y - 1)) { ctx.fillStyle = th.deco === 'snow' ? '#ffffff' : '#5fc94e'; ctx.fillRect(px, py, TILE, 10); }
    } else if (t === 'H') {
      ctx.fillStyle = '#8a4a1a'; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#a85e22'; ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      ctx.fillStyle = '#6e3a12'; ctx.fillRect(px + 3, py + 3, TILE - 6, 4); ctx.fillRect(px + 3, py + TILE - 7, TILE - 6, 4);
    } else if (t === 'B') {
      ctx.fillStyle = '#c84c0c'; ctx.fillRect(px, py + bo, TILE, TILE);
      ctx.fillStyle = '#e06a28'; ctx.fillRect(px + 2, py + bo + 2, TILE - 4, 8);
      ctx.fillStyle = '#93300a';
      ctx.fillRect(px, py + bo + 18, TILE, 3); ctx.fillRect(px + 18, py + bo, 3, 18); ctx.fillRect(px + 18, py + bo + 21, 3, 19);
    } else if (t === '?' || t === 'C') {
      const sh = 0.75 + 0.25 * Math.sin(time * 5 + x);
      ctx.fillStyle = '#e89c2a'; ctx.fillRect(px, py + bo, TILE, TILE);
      ctx.fillStyle = `rgba(255,220,150,${sh})`; ctx.fillRect(px + 4, py + bo + 4, TILE - 8, TILE - 8);
      ctx.fillStyle = '#7a4a10'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('?', px + TILE / 2, py + bo + 29);
    } else if (t === 'U') {
      ctx.fillStyle = '#8a5a2a'; ctx.fillRect(px, py + bo, TILE, TILE);
      ctx.fillStyle = '#6e451e'; ctx.fillRect(px + 4, py + bo + 4, TILE - 8, TILE - 8);
    } else if (t === 'O' || t === 'Q') {
      const isTop = tileAt(x, y - 1) !== 'O' && tileAt(x, y - 1) !== 'Q';
      const isLeft = tileAt(x - 1, y) !== 'O' && tileAt(x - 1, y) !== 'Q';
      ctx.fillStyle = '#1a8a2e'; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#2ec44a'; ctx.fillRect(px + (isLeft ? 6 : 0), py, 10, TILE);
      if (isTop) {
        const lx = isLeft ? px - 4 : px;
        ctx.fillStyle = '#1a8a2e'; ctx.fillRect(lx, py - 6, isLeft ? TILE + 8 : TILE + 4, 14);
        ctx.fillStyle = '#2ec44a'; ctx.fillRect(lx + 4, py - 4, 12, 10);
        ctx.fillStyle = '#0d4d18'; ctx.fillRect(lx, py + 6, isLeft ? TILE + 8 : TILE + 4, 4);
      }
    } else if (t === 'F') {
      ctx.fillStyle = '#2e8b57'; ctx.fillRect(px + TILE / 2 - 4, py, 8, TILE);
      if (y === 3) { ctx.fillStyle = '#ffd94d'; ctx.beginPath(); ctx.arc(px + TILE / 2, py - 6, 10, 0, 6.3); ctx.fill(); }
    }
  }
}
function drawFlagCastle() {
  const f = flagInfo;
  if (!f || f.tx < 0) return;
  // 旗帜
  ctx.fillStyle = '#e83a3a';
  const cy = f.clothY;
  ctx.beginPath(); ctx.moveTo(f.x - 4, cy); ctx.lineTo(f.x - 44, cy + 14); ctx.lineTo(f.x - 4, cy + 28); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(f.x - 24, cy + 14, 6, 0, 6.3); ctx.fill();
  // 城堡
  const cx = f.x + 6 * TILE, gy = 11 * TILE;
  ctx.fillStyle = '#b8b0a0';
  ctx.fillRect(cx, gy - 160, 200, 160);
  for (let k = 0; k < 5; k++) ctx.fillRect(cx + k * 44, gy - 184, 28, 26);
  ctx.fillStyle = '#5a4a3a'; ctx.fillRect(cx + 80, gy - 70, 44, 70); // 门
  ctx.fillStyle = '#3a3a5a';
  ctx.fillRect(cx + 30, gy - 120, 30, 36); ctx.fillRect(cx + 140, gy - 120, 30, 36);
  ctx.fillStyle = '#e83a3a';
  ctx.fillRect(cx + 98, gy - 230, 4, 48);
  ctx.beginPath(); ctx.moveTo(cx + 102, gy - 230); ctx.lineTo(cx + 132, gy - 218); ctx.lineTo(cx + 102, gy - 206); ctx.closePath(); ctx.fill();
}
function drawWarpHints() {
  ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
  for (const w of warps) {
    const px = (w.fx + 1) * TILE, py = w.fy * TILE - 26 + Math.sin(time * 4) * 6;
    ctx.fillStyle = '#ffe14d';
    ctx.fillText('▼', px, py);
  }
}
function drawItems() {
  for (const it of items) {
    if (it.type === 'mush') {
      ctx.fillStyle = '#e83a3a';
      ctx.beginPath(); ctx.arc(it.x + 15, it.y + 12, 15, Math.PI, 0); ctx.fill();
      ctx.fillRect(it.x, it.y + 12, 30, 6);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(it.x + 8, it.y + 6, 5, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.arc(it.x + 22, it.y + 6, 5, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#ffdcb8'; ctx.fillRect(it.x + 7, it.y + 18, 16, 12);
      ctx.fillStyle = '#333';
      ctx.fillRect(it.x + 10, it.y + 21, 3, 5); ctx.fillRect(it.x + 17, it.y + 21, 3, 5);
    }
  }
}
function drawEnemies() {
  for (const e of enemies) {
    if (e.st === 'die' && !e.flip) { // 压扁
      ctx.fillStyle = '#7a4a1a';
      ctx.beginPath(); ctx.ellipse(e.x + e.w / 2, e.y + e.h - 4, e.w / 2, 7, 0, 0, 6.3); ctx.fill();
      continue;
    }
    const cx = e.x + e.w / 2;
    if (e.type === 'goomba') {
      const wob = Math.sin(e.animT * 12) * 3;
      ctx.fillStyle = '#8a5a22';
      ctx.beginPath(); ctx.arc(cx, e.y + 16, 16, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#5a3a12';
      ctx.fillRect(e.x + 2 + wob, e.y + e.h - 8, 10, 8); ctx.fillRect(e.x + e.w - 12 - wob, e.y + e.h - 8, 10, 8);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - 6, e.y + 12, 5, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 6, e.y + 12, 5, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(cx - 6 + Math.sign(e.vx) * 2, e.y + 13, 2.5, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 6 + Math.sign(e.vx) * 2, e.y + 13, 2.5, 0, 6.3); ctx.fill();
    } else if (e.type === 'koopa') {
      if (e.st === 'walk') {
        const wob = Math.sin(e.animT * 10) * 3;
        ctx.fillStyle = '#2ea84a'; // 身体
        ctx.fillRect(e.x + 6, e.y + 12, 20, e.h - 12);
        ctx.fillStyle = '#1a7a32'; // 龟壳纹
        ctx.fillRect(e.x + 6, e.y + 18, 20, 14);
        ctx.fillStyle = '#2ea84a'; // 头
        ctx.beginPath(); ctx.arc(cx + Math.sign(e.vx) * 14, e.y + 8, 9, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#ffdcb8'; ctx.beginPath(); ctx.arc(cx + Math.sign(e.vx) * 17, e.y + 10, 5, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#1a7a32';
        ctx.fillRect(e.x + 4 + wob, e.y + e.h - 7, 9, 7); ctx.fillRect(e.x + e.w - 13 - wob, e.y + e.h - 7, 9, 7);
      } else { // 龟壳
        const spin = e.st === 'slide' ? time * 20 : 0;
        ctx.save(); ctx.translate(cx, e.y + e.h / 2); ctx.rotate(Math.sin(spin) * 0.15);
        ctx.fillStyle = '#f0f0e0';
        ctx.beginPath(); ctx.ellipse(0, 0, e.w / 2, e.h / 2 - 2, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#2ea84a';
        ctx.beginPath(); ctx.ellipse(0, -3, e.w / 2 - 4, e.h / 2 - 8, 0, 0, 6.3); ctx.fill();
        ctx.restore();
        if (e.st === 'shell' && e.t > 6) { // 快苏醒闪烁
          ctx.fillStyle = (Math.floor(time * 6) % 2) ? '#fff' : '#ffd94d';
          ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', cx, e.y - 6);
        }
      }
    } else if (e.type === 'piranha') {
      const open = Math.sin(time * 8) > 0;
      ctx.fillStyle = '#1a8a2e'; ctx.fillRect(cx - 5, e.y + e.h - 20, 10, 24); // 茎
      ctx.fillStyle = '#e83a3a'; // 头
      ctx.beginPath(); ctx.arc(cx, e.y + 20, 18, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - 8, e.y + 12, 5, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 8, e.y + 12, 5, 0, 6.3); ctx.fill();
      ctx.fillStyle = open ? '#7a1010' : '#a02020'; // 嘴
      ctx.beginPath(); ctx.ellipse(cx, e.y + 28, 10, open ? 8 : 3, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#2ea84a'; // 叶子
      ctx.beginPath(); ctx.ellipse(cx - 12, e.y + e.h - 8, 10, 5, -0.5, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 12, e.y + e.h - 8, 10, 5, 0.5, 0, 6.3); ctx.fill();
    }
  }
}
function drawPlayer() {
  const p = player;
  if (p.invuln > 0 && Math.floor(time * 12) % 2 === 0 && state === 'play') return; // 受伤闪烁
  if (p.pipeT > 0 && p.pipeT > 0.7 && p.pipeT < 0.9) return; // 传送黑场
  const cx = p.x + p.w / 2, feet = p.y + p.h;
  const run = Math.abs(p.vx) > 10 && p.onGround;
  const legSwing = run ? Math.sin(p.animT * 2.4) * 8 : 0;
  ctx.save();
  ctx.translate(cx, 0); ctx.scale(p.face, 1); ctx.translate(-cx, 0);
  const s = p.big ? 1.35 : 1; // 大号放大
  const bw = 13 * s;
  // 腿
  ctx.fillStyle = '#2a4ad8';
  ctx.fillRect(cx - bw - 2, feet - 14 * s + Math.max(0, legSwing), 11 * s, 14 * s - Math.max(0, legSwing));
  ctx.fillRect(cx + 2, feet - 14 * s + Math.max(0, -legSwing), 11 * s, 14 * s - Math.max(0, -legSwing));
  // 身体（背带裤）
  ctx.fillStyle = '#2a4ad8';
  ctx.fillRect(cx - bw, feet - 30 * s, bw * 2, 18 * s);
  ctx.fillStyle = '#e83a3a';
  ctx.fillRect(cx - bw, feet - 30 * s, bw * 2, 6 * s);
  // 手臂
  ctx.fillStyle = '#ffdcb8';
  const armSwing = run ? Math.sin(p.animT * 2.4 + 3) * 6 : 0;
  ctx.fillRect(cx - bw - 7, feet - 28 * s + armSwing, 7, 14 * s);
  // 头
  const hy = feet - 30 * s - 16 * s;
  ctx.fillStyle = '#ffdcb8';
  ctx.fillRect(cx - 9 * s, hy, 18 * s, 16 * s);
  ctx.fillStyle = '#5a3a1a'; // 胡子
  ctx.fillRect(cx + 1 * s, hy + 9 * s, 8 * s, 4 * s);
  ctx.fillStyle = '#111'; // 眼睛
  ctx.fillRect(cx + 2 * s, hy + 4 * s, 4 * s, 5 * s);
  // 帽子
  ctx.fillStyle = '#e83a3a';
  ctx.fillRect(cx - 10 * s, hy - 8 * s, 20 * s, 9 * s);
  ctx.fillRect(cx - 10 * s, hy - 1 * s, 26 * s, 3 * s);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx, hy - 3 * s, 4 * s, 0, 6.3); ctx.fill();
  ctx.restore();
}
function drawParts() {
  for (const pt of parts) {
    if (pt.type === 'brick') {
      ctx.fillStyle = '#c84c0c';
      ctx.save(); ctx.translate(pt.x, pt.y); ctx.rotate(pt.t * 8);
      ctx.fillRect(-8, -6, 16, 12); ctx.restore();
    } else if (pt.type === 'coin') {
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath(); ctx.ellipse(pt.x, pt.y, 10, 13, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#e8a812';
      ctx.beginPath(); ctx.ellipse(pt.x, pt.y, 6, 9, 0, 0, 6.3); ctx.fill();
    }
  }
}
function drawPopups() {
  ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
  for (const p of popups) {
    ctx.globalAlpha = 1 - p.t;
    ctx.fillStyle = p.color;
    ctx.fillText(p.txt, p.x - camX, p.y);
  }
  ctx.globalAlpha = 1;
}
function drawHUD() {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, 34);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'left';
  const L = levels[levelIdx];
  ctx.fillText(L ? L.name : '', 12, 23);
  ctx.textAlign = 'right';
  ctx.fillText('分数 ' + score, W - 220, 23);
  ctx.fillText('金币×' + coins, W - 110, 23);
  ctx.fillText('命×' + lives, W - 12, 23);
  if (AU.muted) { ctx.textAlign = 'left'; ctx.fillText('🔇', 12, 52); }
}
function drawOverlay() {
  const cx = W / 2;
  if (state === 'title') {
    ctx.fillStyle = 'rgba(0,0,20,0.72)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94d'; ctx.font = 'bold 64px sans-serif';
    ctx.fillText('超级水管工', cx, 170);
    ctx.fillStyle = '#7de87d'; ctx.font = 'bold 40px sans-serif';
    ctx.fillText('大冒险', cx, 225);
    ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
    ctx.fillText('10 个关卡 · 顶砖块 · 吃蘑菇变大 · 踩乌龟踢龟壳 · 钻水管 · 跳旗杆拔旗！', cx, 290);
    ctx.fillStyle = '#ffd94d'; ctx.font = 'bold 22px sans-serif';
    const isTouch = IS_TOUCH;
    ctx.fillText(isTouch ? '◀ ▶ 移动　跳 跳跃　▼ 进水管' : '←→/AD 移动　空格/W/↑ 跳　↓/S 进水管', cx, 340);
    ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
    if (Math.floor(time * 2) % 2 === 0) ctx.fillText(isTouch ? '— 点击屏幕开始 —' : '— 按 空格 开始 —', cx, 400);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '15px sans-serif';
    ctx.fillText('P 暂停 · M 静音 · F 全屏', cx, 450);
  } else if (state === 'pause') {
    ctx.fillStyle = 'rgba(0,0,20,0.6)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('暂停中', cx, 280);
  } else if (state === 'gameover') {
    ctx.fillStyle = 'rgba(20,0,0,0.8)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a5a'; ctx.font = 'bold 56px sans-serif';
    ctx.fillText('游戏结束', cx, 240);
    ctx.fillStyle = '#fff'; ctx.font = '22px sans-serif';
    ctx.fillText('分数：' + score, cx, 300);
    if (Math.floor(time * 2) % 2 === 0) { ctx.fillStyle = '#ffd94d'; ctx.fillText(IS_TOUCH ? '— 点击屏幕重新开始 —' : '— 按 空格 重新开始 —', cx, 360); }
  } else if (state === 'win') {
    ctx.fillStyle = 'rgba(0,20,0,0.8)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94d'; ctx.font = 'bold 56px sans-serif';
    ctx.fillText('★ 全部通关 ★', cx, 220);
    ctx.fillStyle = '#fff'; ctx.font = '24px sans-serif';
    ctx.fillText('你拯救了蘑菇王国！', cx, 280);
    ctx.fillText('最终分数：' + score + '　金币：' + coins, cx, 330);
    if (Math.floor(time * 2) % 2 === 0) { ctx.fillStyle = '#7de87d'; ctx.fillText(IS_TOUCH ? '— 点击屏幕再来一局 —' : '— 按 空格 再来一局 —', cx, 390); }
  }
}

/* ================= 主循环 ================= */
let lastT = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const now = ts / 1000;
  let dt = Math.min(now - (lastT || now), 0.033);
  lastT = now;
  if (state !== 'pause') update(dt);
  render();
}
loadLevel(0);
requestAnimationFrame(frame);
