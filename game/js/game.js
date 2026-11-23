"use strict";
// MAXIMUS AND THE KUNG FU PIGEON: ADVENTURES  (side-scroller)  --  Book 1: The Book of Page 47
(function () {

var TILE = 16, VW = 512, VH = 288, PXS = 6, TOTAL_PAGES = 6;
var SPRDIM = {"maximus": {"idle": {"w": 132, "h": 149}, "walk": {"w": 189, "h": 132}, "down": {"w": 207, "h": 143}, "attack": {"w": 149, "h": 151}}, "chuck": {"idle": {"w": 166, "h": 148}, "attack": {"w": 157, "h": 135}, "win": {"w": 126, "h": 168}, "hurt": {"w": 159, "h": 140}}};
var FACES = {
  chuck:   { idle: 0, attack: 1, win: 1, hurt: 0 },
  maximus: { idle: 1, walk: -1, down: 1, attack: -1 }
};
var HERO = {
  maximus: { name: 'MAXIMUS', hw: 7, h: 15, run: 1.95, acc: 0.32, fr: 0.38, air: 0.2,  jump: 4.8, grav: 0.30, btn: 'BASH', range: 24, cd: 22 },
  chuck:   { name: 'CHUCK',   hw: 6, h: 20, run: 2.25, acc: 0.34, fr: 0.40, air: 0.24, jump: 5.1, grav: 0.28, btn: 'KICK', range: 30, cd: 16 }
};
// optional painted backgrounds: drop PNGs here and they replace the placeholder cave automatically
var BG_FILES = [['art/bg/cave_far.png', 0.15], ['art/bg/cave_mid.png', 0.35], ['art/bg/cave_near.png', 0.6]];

var canvas, ctx;
var view = { scale: 1, offX: 0, offY: 0, dpr: 1 };
var IMG = {}, BGL = [];
var G = null, LV = null;
var cam = { x: 0, y: 0 };

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function sgn(v) { return v > 0 ? 1 : (v < 0 ? -1 : 0); }
function ov(a0, b0, a1, b1, c0, d0, c1, d1) { return a0 < c1 && a1 > c0 && b0 < d1 && b1 > d0; }
function hash(c, r) { return ((c * 73856093) ^ (r * 19349663)) >>> 0; }
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- assets ----------
function loadImg(k, src) { var im = new Image(); im.src = src; im.onerror = function () { im.bad = true; }; IMG[k] = im; return im; }
function imgOK(im) { return im && im.complete && im.naturalWidth > 0 && !im.bad; }
function loadAssets() {
  Object.keys(SPRDIM).forEach(function (who) {
    Object.keys(SPRDIM[who]).forEach(function (pose) { loadImg(who + '_' + pose, 'art/' + who + '_' + pose + '.png'); });
  });
  loadImg('p13', 'art/ch1_p13.webp'); loadImg('p15', 'art/ch1_p15.webp');
  BG_FILES.forEach(function (f, i) { BGL.push({ img: loadImg('bg' + i, f[0]), speed: f[1], proc: null }); });
}

// ---------- audio ----------
var audio = { ac: null };
function ensureAudio() {
  if (audio.ac) { if (audio.ac.state === 'suspended') audio.ac.resume(); return; }
  try { var AC = window.AudioContext || window.webkitAudioContext; if (AC) audio.ac = new AC(); } catch (e) { audio.ac = null; }
}
function tone(freq, dur, type, vol, slide) {
  if (!audio.ac) return;
  try {
    var ac = audio.ac, t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol || 0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}
function later(fn, ms) { setTimeout(fn, ms); }
var SFX = {
  jump: function () { tone(330, 0.12, 'square', 0.05, 620); },
  land: function () { tone(110, 0.06, 'triangle', 0.05, 70); },
  kick: function () { tone(260, 0.1, 'square', 0.07, 90); },
  bash: function () { tone(150, 0.14, 'sawtooth', 0.08, 60); },
  smash: function () { tone(140, 0.2, 'sawtooth', 0.09, 40); later(function () { tone(90, 0.2, 'square', 0.07, 40); }, 60); },
  hurt: function () { tone(300, 0.3, 'sawtooth', 0.08, 70); },
  page: function () { tone(660, 0.09, 'square', 0.06, 990); later(function () { tone(990, 0.12, 'square', 0.05, 1320); }, 70); },
  heart: function () { tone(520, 0.1, 'triangle', 0.07, 880); },
  swap: function () { tone(420, 0.06, 'triangle', 0.06, 700); },
  clunk: function () { tone(110, 0.25, 'square', 0.09, 70); later(function () { tone(220, 0.15, 'square', 0.06, 330); }, 120); },
  grab: function () { tone(500, 0.05, 'triangle', 0.05, 380); },
  crumble: function () { tone(120, 0.15, 'sawtooth', 0.05, 50); },
  stomp: function () { tone(200, 0.08, 'square', 0.07, 520); },
  arrow: function () { tone(700, 0.08, 'sawtooth', 0.03, 300); },
  select: function () { tone(600, 0.06, 'square', 0.05, 800); },
  win: function () { tone(523, 0.12, 'square', 0.06); later(function () { tone(659, 0.12, 'square', 0.06); }, 120); later(function () { tone(784, 0.25, 'square', 0.07); }, 240); },
  warn: function () { tone(200, 0.08, 'square', 0.04, 260); },
  cp: function () { tone(440, 0.08, 'triangle', 0.06, 660); later(function () { tone(660, 0.12, 'triangle', 0.06, 880); }, 80); }
};

// ---------- input ----------
var keys = {}, pointers = {}, tapFlag = false;
var inp = { l: false, r: false, u: false, d: false, jump: false, act: false, swap: false, reset: false, jumpP: false, actP: false, swapP: false, resetP: false };
var prevIn = { jump: false, act: false, swap: false, reset: false };
var BTN = {
  l: { x: 34, y: 250, r: 24 }, r: { x: 96, y: 250, r: 24 }, u: { x: 150, y: 222, r: 18 }, d: { x: 150, y: 268, r: 18 },
  jump: { x: 452, y: 246, r: 28 }, act: { x: 396, y: 262, r: 23 }, swap: { x: 496, y: 198, r: 20 }, reset: { x: 488, y: 22, r: 13 }
};
function toLogical(cx, cy) { return { x: (cx * view.dpr - view.offX) / view.scale, y: (cy * view.dpr - view.offY) / view.scale }; }
function onDown(e) {
  ensureAudio();
  var l = toLogical(e.clientX, e.clientY);
  pointers[e.pointerId] = { x: l.x, y: l.y };
  tapFlag = true;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
}
function onMove(e) { var p = pointers[e.pointerId]; if (!p) return; var l = toLogical(e.clientX, e.clientY); p.x = l.x; p.y = l.y; }
function onUp(e) { delete pointers[e.pointerId]; }
function readInput() {
  var k, p, n, b, dx, dy, any = { l: false, r: false, u: false, d: false, jump: false, act: false, swap: false, reset: false };
  for (k in pointers) {
    p = pointers[k];
    for (n in BTN) {
      b = BTN[n]; dx = p.x - b.x; dy = p.y - b.y;
      if (dx * dx + dy * dy <= b.r * b.r * 1.55) any[n] = true;
    }
  }
  inp.l = any.l || !!(keys.ArrowLeft || keys.KeyA);
  inp.r = any.r || !!(keys.ArrowRight || keys.KeyD);
  inp.u = any.u || !!(keys.ArrowUp || keys.KeyW);
  inp.d = any.d || !!(keys.ArrowDown || keys.KeyS);
  inp.jump = any.jump || !!(keys.KeyZ || keys.Space || keys.KeyK);
  inp.act = any.act || !!(keys.KeyX || keys.KeyJ || keys.Enter);
  inp.swap = any.swap || !!(keys.KeyC || keys.Tab || keys.ShiftLeft);
  inp.reset = any.reset || !!keys.KeyR;
  inp.jumpP = inp.jump && !prevIn.jump; inp.actP = inp.act && !prevIn.act;
  inp.swapP = inp.swap && !prevIn.swap; inp.resetP = inp.reset && !prevIn.reset;
}

// ---------- state ----------
function mkHero(k) {
  return { key: k, x: 0, y: 0, vx: 0, vy: 0, onGround: false, coy: 0, jbuf: 0, face: 1, atkT: 0, atkCd: 0, inv: 0, hurt: 0,
           state: 'n', vine: null, vs: 0, vineCd: 0, slam: false, gliding: false, pushing: false, walked: 0,
           vis: { air: false, moving: false } };
}
function newG() {
  return { state: 'title', t: 0, hearts: 5, maxHearts: 5, pages: 0, gone: {}, leader: 'maximus',
           heroes: { maximus: mkHero('maximus'), chuck: mkHero('chuck') }, trail: [], cp: { x: 4 * TILE + 8, y: 18 * TILE },
           popups: [], parts: [], shake: 0, caption: null, capT: 0, signText: null, pend: [], cut: null, fade: 0,
           oopsT: 0, completeT: 0, popCd: 0, hintT: 0, flags: {}, cpCuts: {} };
}
function lead() { return G.heroes[G.leader]; }
function follow() { return G.heroes[G.leader === 'maximus' ? 'chuck' : 'maximus']; }
function pop(s, x, y, size, color) { G.popups.push({ s: s, x: x, y: y, vy: -0.4, life: 70, max: 70, size: size || 16, color: color || '#fff', rot: rnd(-0.15, 0.15) }); }
function puff(x, y, col, n, spd) {
  for (var i = 0; i < (n || 8); i++) G.parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * (spd || 3), vy: -Math.random() * (spd || 3) - 0.3, life: 20 + Math.random() * 15, col: col });
}
function say(lines, t) { G.caption = lines; G.capT = t || 200; }
function pend(t, fn) { G.pend.push({ t: t, fn: fn }); }

// ---------- level ----------
function buildLevel() {
  var W = 160, H = 24, g = [], r, c, row, i;
  for (r = 0; r < H; r++) { row = []; for (c = 0; c < W; c++) row.push(' '); g.push(row); }
  var V = { W: W, H: H, g: g, blocks: [], crabs: [], vines: [], shooters: [], arrows: [], pages: [], hearts: [], signs: [], cps: [],
            plates: [], fall: {}, ygid: {}, yrev: {}, boss: null, torches: [], arenaL: 127 * TILE + 24, arenaR: 157 * TILE - 24 };
  function fill(c0, r0, c1, r1, ch) { for (var rr = r0; rr <= r1; rr++) for (var cc = c0; cc <= c1; cc++) g[rr][cc] = ch; }
  function key(t, cc, rr) { return t + ':' + cc + ',' + rr; }
  function page(cc, rr) { var k = key('page', cc, rr); if (!G.gone[k]) V.pages.push({ x: cc * TILE + 8, y: rr * TILE + 8, k: k }); }
  function heart(cc, rr) { var k = key('heart', cc, rr); if (!G.gone[k]) V.hearts.push({ x: cc * TILE + 8, y: rr * TILE + 8, k: k }); }
  function sign(cc, text) { V.signs.push({ x: cc * TILE + 8, y: 18 * TILE, text: text }); }
  function crab(cc) { var k = key('crab', cc, 0); if (!G.gone[k]) V.crabs.push(mkCrab(cc * TILE + 8, 18 * TILE, -1, k)); }
  function cp(cc, cut) { V.cps.push({ x: cc * TILE + 8, y: 18 * TILE, cut: cut || null, id: 'cp' + cc }); }
  function block(cc, rr) { V.blocks.push({ x: cc * TILE, y: rr * TILE, vy: 0, sx: cc * TILE, sy: rr * TILE }); }
  function vine(cc, r0, len) { V.vines.push({ ax: cc * TILE + 8, ay: r0 * TILE, len: len, a: 0, vel: 0, hero: null }); }

  // terrain
  fill(0, 0, W - 1, 3, '#'); fill(0, 18, W - 1, 23, '#'); fill(0, 0, 1, 23, '#'); fill(W - 2, 0, W - 1, 23, '#');

  // 1: start, steps, crab, TRAP #1 spikes
  cp(4);
  sign(7, 'Swap heroes with SWAP. Stomp the crabs!');
  fill(14, 17, 15, 17, '#'); fill(18, 16, 20, 17, '#');
  crab(25);
  sign(28, "TRAP #1. YOU'RE WELCOME.");
  for (c = 32; c <= 33; c++) g[17][c] = '^';

  // 2: crumbling bridge
  fill(38, 18, 47, 23, ' ');
  for (c = 38; c <= 47; c++) g[18][c] = 'F';

  // 3: block + plateau (with a secret pocket), cracked wall
  block(49, 17);
  sign(51, 'Maximus pushes blocks. Chuck cannot. Teamwork!');
  fill(53, 15, 56, 17, '#');
  page(54, 14);
  fill(54, 16, 55, 17, ' '); g[16][56] = 'Y'; g[17][56] = 'Y';
  heart(54, 17); page(55, 17);
  sign(58, 'That wall looks cracked. Who is good at smashing?');
  fill(60, 4, 61, 14, '#'); fill(60, 15, 61, 17, 'X');
  cp(63);

  // 4: vine chasm
  sign(62, 'Vines! JUMP to grab. LEFT/RIGHT to swing. JUMP to let go.');
  fill(65, 18, 77, 23, ' ');
  fill(66, 4, 67, 9, '#'); fill(72, 4, 73, 9, '#');
  vine(67, 10, 7); vine(73, 10, 7);
  cp(79, 'hat');

  // 5: staff door + closet
  crab(84);
  sign(87, 'STAFF ONLY (ALSO PRIVATE)');
  fill(90, 4, 90, 14, '#'); fill(90, 15, 90, 17, 'W');
  page(93, 16); heart(95, 17);

  // 6: hidden room under the floor, dart pillars
  fill(94, 19, 101, 21, ' ');
  g[18][100] = 'X'; g[18][101] = 'X';
  g[21][99] = '#'; g[20][100] = '#'; g[21][100] = '#'; g[19][101] = '#'; g[20][101] = '#'; g[21][101] = '#';
  page(94, 21); heart(96, 21); page(98, 21);
  g[17][106] = 'a'; g[17][111] = 'a';
  cp(112);

  // 7: block onto plate opens the gate
  block(114, 17);
  sign(117, 'Push the block onto the plate.');
  V.plates.push({ c: 121, r: 17, open: false, gc: 125 });
  fill(125, 4, 125, 14, '#'); fill(125, 15, 125, 17, 'G');

  // 8: Barnacle Bart's lair
  fill(134, 16, 137, 16, '='); fill(146, 16, 149, 16, '=');
  V.boss = mkBoss();
  [129, 141, 153].forEach(function (t) { V.torches.push({ x: t * TILE + 8, y: 18 * TILE - 14 }); });

  // scan for shooters + secret wall groups + torches near checkpoints
  for (r = 0; r < H; r++) for (c = 0; c < W; c++) {
    if (g[r][c] === 'a' || g[r][c] === 'A') V.shooters.push({ c: c, r: r, dir: g[r][c] === 'a' ? -1 : 1, t: (c * 29) % 150 });
  }
  var gid = 0;
  for (r = 0; r < H; r++) for (c = 0; c < W; c++) {
    if (g[r][c] === 'Y' && V.ygid[c + ',' + r] === undefined) {
      gid++; var st = [[c, r]];
      while (st.length) { var p = st.pop(), k = p[0] + ',' + p[1]; if (V.ygid[k] !== undefined) continue; if (g[p[1]][p[0]] !== 'Y') continue; V.ygid[k] = gid; st.push([p[0] + 1, p[1]], [p[0] - 1, p[1]], [p[0], p[1] + 1], [p[0], p[1] - 1]); }
    }
  }
  return V;
}
function mkCrab(x, y, dir, k) { return { x: x, y: y, dir: dir, alive: true, k: k, wob: rnd(0, 6) }; }
function mkBoss() { return { x: 150 * TILE, y: 18 * TILE, face: -1, hp: 6, maxHp: 6, mode: 'idle', t0: 0, cd: 160, stun: 0, flash: 0, vx: 0, dead: false, dd: 0, active: false }; }

function tileAt(c, r) { if (c < 0 || c >= LV.W || r < 0) return '#'; if (r >= LV.H) return ' '; return LV.g[r][c]; }
function solidCh(ch) { return ch === '#' || ch === 'X' || ch === 'F' || ch === 'W' || ch === 'G' || ch === 'a' || ch === 'A'; }
function boxHitsSolid(x0, y0, x1, y1) {
  var c0 = Math.floor(x0 / TILE), c1 = Math.floor((x1 - 0.001) / TILE), r0 = Math.floor(y0 / TILE), r1 = Math.floor((y1 - 0.001) / TILE), c, r;
  for (r = r0; r <= r1; r++) for (c = c0; c <= c1; c++) if (solidCh(tileAt(c, r))) return true;
  return false;
}

// ---------- blocks ----------
function blockFree(b, nx, ny) {
  if (boxHitsSolid(nx, ny, nx + TILE, ny + TILE)) return false;
  for (var i = 0; i < LV.blocks.length; i++) { var o = LV.blocks[i]; if (o !== b && ov(nx, ny, nx + TILE, ny + TILE, o.x, o.y, o.x + TILE, o.y + TILE)) return false; }
  return true;
}
function pushBlock(b, dx) { if (!blockFree(b, b.x + dx, b.y)) return false; b.x += dx; return true; }
function updateBlocks() {
  for (var i = 0; i < LV.blocks.length; i++) {
    var b = LV.blocks[i];
    b.vy = Math.min(b.vy + 0.3, 6);
    var ny = b.y + b.vy;
    if (blockFree(b, b.x, ny)) b.y = ny; else { b.y = Math.floor((b.y + 0.001) / TILE) * TILE; if (!blockFree(b, b.x, b.y)) b.y = Math.round(b.y / TILE) * TILE; b.vy = 0; }
    if (b.y > LV.H * TILE + 40) { b.x = b.sx; b.y = b.sy; b.vy = 0; }
  }
}

// ---------- hero physics ----------
function heroBlockOverlap(h, b) {
  var cfg = HERO[h.key];
  return ov(h.x - cfg.hw, h.y - cfg.h, h.x + cfg.hw, h.y - 0.5, b.x, b.y, b.x + TILE, b.y + TILE) && h.y > b.y + 0.6;
}
function moveX(h, dx) {
  var cfg = HERO[h.key], hw = cfg.hw, hh = cfg.h, i, b;
  if (!dx) return;
  h.x += dx; h.pushing = false;
  for (i = 0; i < LV.blocks.length; i++) {
    b = LV.blocks[i];
    if (heroBlockOverlap(h, b)) {
      if (h.key === 'maximus' && h.hurt <= 0 && pushBlock(b, dx)) { h.pushing = true; }
      else { h.x = dx > 0 ? b.x - hw : b.x + TILE + hw; h.vx = 0; }
    }
  }
  var c = dx > 0 ? Math.floor((h.x + hw - 0.001) / TILE) : Math.floor((h.x - hw) / TILE), r, r0 = Math.floor((h.y - hh + 0.001) / TILE), r1 = Math.floor((h.y - 0.001) / TILE);
  for (r = r0; r <= r1; r++) {
    if (solidCh(tileAt(c, r))) { h.x = dx > 0 ? c * TILE - hw : (c + 1) * TILE + hw; h.vx = 0; break; }
  }
}
function moveY(h, dy) {
  var cfg = HERO[h.key], hw = cfg.hw, hh = cfg.h, i, b, c, r, prevY = h.y;
  var wasAir = !h.onGround;
  h.y += dy; h.onGround = false;
  var c0 = Math.floor((h.x - hw + 0.001) / TILE), c1 = Math.floor((h.x + hw - 0.001) / TILE);
  if (dy >= 0) {
    r = Math.floor(h.y / TILE);
    for (c = c0; c <= c1; c++) {
      var ch = tileAt(c, r);
      if (solidCh(ch) || (ch === '=' && prevY <= r * TILE + 0.01 && !(inp.d && h.key === 'chuck'))) {
        h.y = r * TILE; h.onGround = true; h.land = { c: c, r: r, ch: ch }; break;
      }
    }
    if (!h.onGround) {
      for (i = 0; i < LV.blocks.length; i++) {
        b = LV.blocks[i];
        if (ov(h.x - hw, h.y - hh, h.x + hw, h.y, b.x, b.y, b.x + TILE, b.y + TILE) && prevY <= b.y + 1) { h.y = b.y; h.onGround = true; h.land = { c: -1, r: -1, ch: 'B' }; break; }
      }
    }
    if (h.onGround) {
      if (h.vy > 2.5 && wasAir) { SFX.land(); puff(h.x, h.y, 'rgba(255,255,255,0.7)', 4, 1.5); }
      if (h.slam) landSlam(h);
      h.vy = 0;
      if (h.land.ch === 'F') {
        var fk = h.land.c + ',' + h.land.r;
        if (LV.fall[fk] === undefined) LV.fall[fk] = 48;
      }
    }
  } else {
    r = Math.floor((h.y - hh) / TILE);
    for (c = c0; c <= c1; c++) {
      if (solidCh(tileAt(c, r))) { h.y = (r + 1) * TILE + hh; h.vy = 0; break; }
    }
    for (i = 0; i < LV.blocks.length; i++) {
      b = LV.blocks[i];
      if (ov(h.x - hw, h.y - hh, h.x + hw, h.y, b.x, b.y, b.x + TILE, b.y + TILE) && h.y - hh >= b.y + TILE - 6) { h.y = b.y + TILE + hh; h.vy = 0; break; }
    }
  }
}
function landSlam(h) {
  h.slam = false; G.shake = Math.max(G.shake, 7);
  var broke = false, r = h.land.r, cc, c0 = Math.floor((h.x - 9) / TILE), c1 = Math.floor((h.x + 9) / TILE);
  for (cc = c0; cc <= c1; cc++) if (tileAt(cc, r) === 'X') { LV.g[r][cc] = ' '; broke = true; puff(cc * TILE + 8, r * TILE + 8, '#8aa6aa', 10, 3); }
  SFX.smash(); pop(broke ? 'KA-BOOM!' : 'SLAM!', h.x, h.y - 26, broke ? 22 : 15, '#ffd27d');
  if (broke) say(['The floor gives way!'], 100);
}

// ---------- vines ----------
function updateVines() {
  for (var i = 0; i < LV.vines.length; i++) {
    var v = LV.vines[i], L = v.len * TILE;
    v.vel += -(0.25 / L) * Math.sin(v.a);
    v.vel *= v.hero ? 0.9993 : 0.995;
    v.a += v.vel;
    if (v.a > 1.2) { v.a = 1.2; v.vel = Math.min(0, v.vel); }
    if (v.a < -1.2) { v.a = -1.2; v.vel = Math.max(0, v.vel); }
  }
}
function tryGrab(h) {
  if (h.vineCd > 0 || h.onGround || h.hurt > 0) return;
  var cfg = HERO[h.key], px = h.x, py = h.y - cfg.h * 0.7, i, v, s, dx, dy, dist;
  for (i = 0; i < LV.vines.length; i++) {
    v = LV.vines[i];
    if (v.hero) continue;
    var dirx = Math.sin(v.a), diry = Math.cos(v.a);
    dx = px - v.ax; dy = py - v.ay;
    s = clamp(dx * dirx + dy * diry, 22, v.len * TILE);
    dist = Math.abs(dx - dirx * s) + Math.abs(dy - diry * s) * 0.0 + 0;
    var perp = Math.sqrt(Math.pow(dx - dirx * s, 2) + Math.pow(dy - diry * s, 2));
    if (perp < 11) {
      h.state = 'vine'; h.vine = v; h.vs = s; v.hero = h; h.slam = false; h.gliding = false;
      var vt = h.vx * Math.cos(v.a) - h.vy * Math.sin(v.a);
      v.vel += vt / s * 0.7;
      h.vx = 0; h.vy = 0; SFX.grab();
      return;
    }
  }
}
function updateVineHero(h) {
  var v = h.vine, cfg = HERO[h.key], dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  v.vel += dir * 0.00085;
  if (inp.u) h.vs = Math.max(24, h.vs - 1.3);
  if (inp.d) h.vs = Math.min(v.len * TILE, h.vs + 1.5);
  h.x = v.ax + Math.sin(v.a) * h.vs; h.y = v.ay + Math.cos(v.a) * h.vs + cfg.h * 0.85;
  if (dir) h.face = dir;
  h.vis.air = true; h.vis.moving = false;
  if (inp.jumpP) {
    var tv = v.vel * h.vs;
    h.vx = clamp(Math.cos(v.a) * tv * 1.2, -4, 4); h.vy = -Math.sin(v.a) * tv - 2.9;
    h.state = 'n'; v.hero = null; h.vine = null; h.vineCd = 16; h.onGround = false; SFX.jump();
    return;
  }
  if (boxHitsSolid(h.x - cfg.hw, h.y - cfg.h, h.x + cfg.hw, h.y)) { h.state = 'n'; v.hero = null; h.vine = null; h.vineCd = 16; }
}

// ---------- damage / flow ----------
function loseHeart(n) {
  G.hearts -= n;
  if (G.hearts <= 0) { G.hearts = 0; G.state = 'oops'; G.oopsT = 100; pop('OOPS!', lead().x, lead().y - 40, 30, '#ff7b7b'); }
}
function damageLeader(n, fromx) {
  var L = lead();
  if (L.inv > 0 || G.state !== 'play') return;
  if (L.state === 'vine') { L.state = 'n'; if (L.vine) L.vine.hero = null; L.vine = null; L.vineCd = 30; }
  L.inv = 90; L.hurt = 16; L.vx = (L.x < fromx ? -1 : 1) * 2.4; L.vy = -3; L.onGround = false; L.slam = false;
  SFX.hurt(); G.shake = Math.max(G.shake, 4);
  pop(G.leader === 'chuck' ? 'SQUAWK!' : 'WOOF!', L.x, L.y - 36, 12, '#ffd6d6');
  loseHeart(n);
}
function respawn() {
  var L = lead(), F = follow(), i;
  for (i = 0; i < 2; i++) { var h = i ? F : L; h.x = G.cp.x + (i ? -14 : 0); h.y = G.cp.y; h.vx = h.vy = 0; h.state = 'n'; h.vine = null; h.slam = false; h.hurt = 0; }
  LV.vines.forEach(function (v) { v.hero = null; });
  L.inv = 110; G.trail = [];
  if (G.hearts <= 0) G.hearts = G.maxHearts;
  G.state = 'play';
  if (LV.boss && !LV.boss.dead) { LV.boss.mode = 'idle'; LV.boss.cd = 120; LV.boss.stun = 0; }
  cam.x = clamp(L.x - VW / 2, 0, LV.W * TILE - VW); cam.y = clamp(L.y - 170, 0, LV.H * TILE - VH);
}
function swapHero() {
  var L = lead(), F = follow(), cfg = HERO[F.key];
  if (L.state === 'vine') return;
  var bad = boxHitsSolid(F.x - cfg.hw, F.y - cfg.h, F.x + cfg.hw, F.y);
  if (bad) { F.x = L.x; F.y = L.y; }
  G.leader = F.key; F.vx = 0; F.vy = 0; F.face = L.face; F.state = 'n'; F.inv = Math.max(F.inv, 0);
  puff(F.x, F.y - 10, '#ffe066', 10, 2.5); SFX.swap(); G.trail = [];
}
function resetBlocks() {
  LV.blocks.forEach(function (b) { b.x = b.sx; b.y = b.sy; b.vy = 0; });
  pop('BLOCKS RESET', lead().x, lead().y - 40, 11, '#ffe066');
}

// ---------- cutscenes ----------
function PN(img, c, dur) { return { img: img, crop: c, to: [c[0] + c[2] * 0.03, c[1] + c[3] * 0.03, c[2] * 0.94, c[3] * 0.94], dur: dur || 190 }; }
var CUTS = {
  crack: [PN('p13', [0.030, 0.051, 0.504, 0.315], 140), PN('p13', [0.550, 0.051, 0.420, 0.315], 150)],
  hat:   [PN('p13', [0.030, 0.380, 0.522, 0.314], 170), PN('p13', [0.570, 0.380, 0.400, 0.314], 170), PN('p13', [0.030, 0.706, 0.460, 0.271], 170)],
  door:  [PN('p15', [0.030, 0.051, 0.940, 0.315], 170), PN('p15', [0.030, 0.380, 0.940, 0.265], 170),
          PN('p15', [0.030, 0.658, 0.460, 0.319], 190), PN('p15', [0.507, 0.658, 0.462, 0.319], 190)],
  end:   [PN('p13', [0.507, 0.706, 0.462, 0.294], 220)]
};
function startCut(name, done) {
  if (!CUTS[name]) { if (done) done(); return; }
  G.cut = { list: CUTS[name], i: 0, t: 0, done: done || null }; G.state = 'cut';
}
function updateCut() {
  var c = G.cut; c.t++;
  var sc = c.list[c.i];
  if ((tapFlag && c.t > 20) || c.t >= sc.dur) {
    c.i++; c.t = 0;
    if (c.i >= c.list.length) { var d = c.done; G.cut = null; G.state = 'play'; if (d) d(); }
  }
}
function renderCut() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
  var c = G.cut; if (!c) return;
  var sc = c.list[c.i], im = IMG[sc.img];
  if (imgOK(im)) {
    var p = Math.min(1, c.t / sc.dur), e = p * p * (3 - 2 * p), a = sc.crop, b = sc.to;
    var sx = (a[0] + (b[0] - a[0]) * e) * im.naturalWidth, sy = (a[1] + (b[1] - a[1]) * e) * im.naturalHeight;
    var sw = (a[2] + (b[2] - a[2]) * e) * im.naturalWidth, sh = (a[3] + (b[3] - a[3]) * e) * im.naturalHeight;
    var fit = Math.min(VW / sw, VH / sh), dw = sw * fit, dh = sh * fit;
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(im, sx, sy, sw, sh, (VW - dw) / 2, (VH - dh) / 2, dw, dh); ctx.restore();
  }
  if ((G.t % 50) < 30) txt('TAP', VW - 24, VH - 10, 9, '#ffe066');
  var f = Math.min(c.t / 18, (sc.dur - c.t) / 18, 1);
  if (f < 1) { ctx.save(); ctx.globalAlpha = 1 - Math.max(0, f); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH); ctx.restore(); }
}

// ---------- attack ----------
function breakGroup(c, r, ch, bx, by) {
  var st = [[c, r]], n = 0;
  while (st.length) {
    var p = st.pop(); if (tileAt(p[0], p[1]) !== ch) continue;
    LV.g[p[1]][p[0]] = ' '; n++;
    puff(p[0] * TILE + 8, p[1] * TILE + 8, ch === 'W' ? '#a8743a' : '#8aa6aa', 8, 4);
    st.push([p[0], p[1] + 1], [p[0], p[1] - 1], [p[0] + 1, p[1]], [p[0] - 1, p[1]]);
  }
  return n;
}
function doAttack(L) {
  var cfg = HERO[L.key], i, o, r, c;
  L.atkT = 12; L.atkCd = cfg.cd;
  if (L.key === 'chuck') SFX.kick(); else SFX.bash();
  if (L.key === 'maximus' && L.onGround) L.vx += L.face * 1.4;
  var x0 = L.face > 0 ? L.x : L.x - cfg.range, x1 = L.face > 0 ? L.x + cfg.range : L.x, y0 = L.y - cfg.h - 2, y1 = L.y + 1;
  if (L.key === 'chuck' && G.popCd <= 0) { pop('HIIYAAAA!', L.x + L.face * 34, L.y - 36, 18, '#ffffff'); G.popCd = 90; }
  if (L.key === 'maximus' && G.popCd <= 0) { pop('BONK!', L.x + L.face * 30, L.y - 30, 14, '#ffe9a8'); G.popCd = 60; }
  // crabs
  for (i = 0; i < LV.crabs.length; i++) {
    o = LV.crabs[i];
    if (o.alive && ov(x0, y0, x1, y1, o.x - 8, o.y - 10, o.x + 8, o.y)) killCrab(o);
  }
  // tiles
  var c0 = Math.floor(x0 / TILE), c1 = Math.floor((x1 - 0.01) / TILE), r0 = Math.floor(y0 / TILE), r1 = Math.floor((y1 - 0.01) / TILE);
  var hitX = false, hitW = false, broke = false;
  for (r = r0; r <= r1; r++) for (c = c0; c <= c1; c++) {
    var ch = tileAt(c, r);
    if (ch === 'X') { if (L.key === 'maximus') { breakGroup(c, r, 'X'); broke = true; } else hitX = true; }
    if (ch === 'W') { if (L.key === 'chuck') { breakGroup(c, r, 'W'); broke = true; hitW = 'broke'; } else if (!hitW) hitW = true; }
  }
  if (broke) {
    G.shake = 16; SFX.smash();
    if (hitW === 'broke') {
      var dx = x1 + 10 * L.face, dy = L.y - 20;
      pop('CRASH!', dx - 30, dy - 30, 26, '#ffd27d');
      pend(25, function () { pop('CLANG!', dx + 30, dy - 10, 22, '#dfe9ff'); SFX.clunk(); });
      pend(50, function () { pop('CLUNK!', dx + 10, dy + 20, 22, '#ffe9a8'); SFX.clunk(); });
      pend(90, function () { startCut('door'); });
    } else pop('CRASH!', (x0 + x1) / 2, L.y - 30, 24, '#ffd27d');
  } else if (hitX && L.key === 'chuck' && G.popCd <= 60) say(['Chuck: Ow. My foot.', 'That is a Maximus job!'], 150);
  else if (hitW === true && G.popCd <= 60) say(['Maximus: That door needs a kick.', 'Switch to Chuck!'], 150);
  // boss
  var B = LV.boss;
  if (B && !B.dead && ov(x0, y0, x1, y1, B.x - 20, B.y - 30, B.x + 20, B.y)) {
    if (B.stun > 0) {
      B.hp -= (L.key === 'maximus' ? 2 : 1); B.flash = 12; B.stun = Math.max(B.stun, 90);
      pop(L.key === 'maximus' ? 'BONK!' : 'HIYA!', B.x, B.y - 44, 20, '#ffffff'); SFX.smash(); G.shake = Math.max(G.shake, 6); puff(B.x, B.y - 14, '#ffe066', 10, 3);
      if (B.hp <= 0) bossDown(B);
    } else { pop('CLANG!', B.x, B.y - 44, 16, '#dfe9ff'); SFX.clunk(); L.vx = -L.face * 2.6; }
  }
}
function killCrab(o) {
  o.alive = false; if (o.k) G.gone[o.k] = 1;
  puff(o.x, o.y - 5, '#ff7a5c', 10, 3); pop('SNIP!', o.x, o.y - 18, 11, '#ffd0c0'); SFX.stomp();
}
function bossDown(B) {
  B.dead = true; B.dd = 0; B.hp = 0;
  LV.crabs.forEach(function (c) { c.alive = false; });
  puff(B.x, B.y - 15, '#ffe066', 40, 7); G.shake = 20; SFX.smash();
  pop('BARNACLE BART IS DOWN!', B.x, B.y - 80, 20, '#ffe066');
  pend(120, function () { SFX.win(); startCut('end', function () { G.state = 'complete'; G.completeT = 0; }); });
}

// ---------- update ----------
function updateLeader(h) {
  var cfg = HERO[h.key];
  h.inv = Math.max(0, h.inv - 1); h.atkT = Math.max(0, h.atkT - 1); h.atkCd = Math.max(0, h.atkCd - 1); h.vineCd = Math.max(0, h.vineCd - 1);
  if (h.state === 'vine') { updateVineHero(h); return; }
  h.coy = h.onGround ? 6 : Math.max(0, h.coy - 1);
  if (inp.jumpP) h.jbuf = 7; else if (h.jbuf > 0) h.jbuf--;
  var dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
  if (h.hurt > 0) { h.hurt--; }
  else if (!h.slam) {
    var acc = h.onGround ? cfg.acc : cfg.air;
    if (dir) {
      h.vx += dir * acc; h.vx = clamp(h.vx, -cfg.run, cfg.run); h.face = dir;
    } else {
      var fr = h.onGround ? cfg.fr : 0.05;
      if (Math.abs(h.vx) <= fr) h.vx = 0; else h.vx -= sgn(h.vx) * fr;
    }
  }
  if (h.pushing) h.vx = clamp(h.vx, -1.05, 1.05);
  if (h.jbuf > 0 && h.coy > 0 && h.hurt <= 0 && !h.slam) { h.vy = -cfg.jump; h.jbuf = 0; h.coy = 0; h.onGround = false; SFX.jump(); }
  if (h.vy < 0 && !inp.jump) h.vy += 0.45;
  if (h.key === 'chuck' && inp.jump && h.vy > 0.6 && !h.onGround && h.hurt <= 0) { h.vy = Math.min(h.vy + cfg.grav * 0.25, 0.95); h.gliding = true; }
  else { h.vy += cfg.grav; h.gliding = false; }
  if (h.vy > 5.8) h.vy = 5.8;
  if (h.key === 'maximus' && !h.onGround && inp.d && !h.slam && h.hurt <= 0 && h.state === 'n') { h.slam = true; SFX.warn(); }
  if (h.slam) { h.vy = 7; h.vx = 0; }
  if (inp.actP && h.atkCd <= 0 && h.hurt <= 0) doAttack(h);
  moveX(h, h.vx);
  moveY(h, h.vy);
  h.vis.air = !h.onGround; h.vis.moving = Math.abs(h.vx) > 0.2 && h.onGround;
  if (h.vis.moving) h.walked += Math.abs(h.vx);
  tryGrab(h);
}
function updateFollower(F, L) {
  G.trail.push({ x: L.x, y: L.y, face: L.face, air: L.vis.air, moving: L.vis.moving, walked: L.walked, atk: L.atkT > 0, gl: L.gliding, vine: L.state === 'vine' });
  if (G.trail.length > 26) G.trail.shift();
  var t = G.trail[0];
  var dx = L.x - t.x;
  if (Math.abs(L.x - F.x) < 14 && G.trail.length > 4 && Math.abs(L.vx) < 0.1 && L.onGround) {
    F.vis.moving = false; F.vis.air = false;
    F.x += (L.x - 15 * L.face - F.x) * 0.1; F.y = L.y;
  } else { F.x = t.x - (dx === 0 ? 0 : 0); F.y = t.y; F.face = t.face; F.vis.air = t.air; F.vis.moving = t.moving; F.walked = t.walked; F.fatk = t.atk; F.fgl = t.gl; F.fvine = t.vine; }
  F.inv = 0; F.vx = F.vy = 0;
}

function updateEntities(L) {
  var i, j, o, cfg = HERO[L.key];
  // falling floor tiles
  for (var fk in LV.fall) {
    LV.fall[fk]--;
    var fp = fk.split(',');
    if (LV.fall[fk] === 0) { LV.g[+fp[1]][+fp[0]] = ' '; puff(+fp[0] * TILE + 8, +fp[1] * TILE + 8, '#a8743a', 10, 3); SFX.crumble(); }
    else if (LV.fall[fk] <= -420) { if (!boxHitsSolid(+fp[0] * TILE + 1, +fp[1] * TILE + 1, +fp[0] * TILE + 15, +fp[1] * TILE + 15)) { LV.g[+fp[1]][+fp[0]] = 'F'; delete LV.fall[fk]; } else LV.fall[fk] = -380; }
  }
  // spikes
  var c0 = Math.floor((L.x - cfg.hw) / TILE), c1 = Math.floor((L.x + cfg.hw) / TILE), r0 = Math.floor((L.y - cfg.h) / TILE), r1 = Math.floor((L.y - 1) / TILE), c, r;
  if (L.inv <= 0) for (r = r0; r <= r1; r++) for (c = c0; c <= c1; c++) {
    if (tileAt(c, r) === '^' && ov(L.x - cfg.hw, L.y - cfg.h, L.x + cfg.hw, L.y, c * TILE + 1, r * TILE + 8, c * TILE + 15, r * TILE + 16)) { damageLeader(1, c * TILE + 8); }
  }
  // secret walls
  for (r = r0; r <= r1; r++) for (c = c0; c <= c1; c++) {
    var gid = LV.ygid[c + ',' + r];
    if (gid !== undefined && !LV.yrev[gid]) { LV.yrev[gid] = true; pop('A SECRET!', L.x, L.y - 36, 14, '#d8f7ff'); puff(c * TILE + 8, r * TILE + 8, '#bfe8ff', 12, 2); SFX.heart(); }
  }
  // hollow-floor hint
  if (L.key === 'maximus' && L.onGround && L.land && L.land.ch === 'X' && L.land.r === 18 && !G.flags.hollow) { G.flags.hollow = 1; say(['Maximus: This floor sounds hollow.', 'Maybe something heavy would break it...'], 220); }
  // plates
  for (i = 0; i < LV.plates.length; i++) {
    var pl = LV.plates[i];
    if (!pl.open) for (j = 0; j < LV.blocks.length; j++) {
      var b = LV.blocks[j];
      if (Math.abs(b.x + 8 - (pl.c * TILE + 8)) < 10 && Math.abs(b.y + TILE - (pl.r + 1) * TILE) < 3) {
        pl.open = true; breakGroup(pl.gc, 17, 'G'); SFX.clunk(); G.shake = 6; pop('CLUNK!', pl.gc * TILE + 8, 15 * TILE, 20, '#ffe9a8');
      }
    }
  }
  // crabs
  for (i = 0; i < LV.crabs.length; i++) {
    o = LV.crabs[i]; if (!o.alive) continue;
    o.wob += 0.25;
    var sp = 0.5, nx = o.x + o.dir * sp;
    var ahead = tileAt(Math.floor((nx + o.dir * 8) / TILE), Math.floor((o.y - 4) / TILE));
    var floorAhead = tileAt(Math.floor((nx + o.dir * 8) / TILE), Math.floor((o.y + 2) / TILE));
    var blockAhead = false;
    for (j = 0; j < LV.blocks.length; j++) { var bb = LV.blocks[j]; if (ov(nx - 7, o.y - 10, nx + 7, o.y, bb.x, bb.y, bb.x + TILE, bb.y + TILE)) blockAhead = true; }
    if (solidCh(ahead) || !solidCh(floorAhead) && floorAhead !== '=' || blockAhead) o.dir = -o.dir; else o.x = nx;
    if (L.inv <= 0 && L.hurt <= 0 && ov(L.x - cfg.hw, L.y - cfg.h, L.x + cfg.hw, L.y, o.x - 7, o.y - 10, o.x + 7, o.y)) {
      if (L.vy > 0.5 && L.y <= o.y - 5) { killCrab(o); L.vy = -3.4; L.vx *= 0.8; }
      else damageLeader(1, o.x);
    }
  }
  // shooters + arrows
  for (i = 0; i < LV.shooters.length; i++) {
    o = LV.shooters[i]; o.t++;
    if (o.t >= 150) {
      o.t = 0;
      if (Math.abs(L.x - (o.c * TILE + 8)) < 300) { LV.arrows.push({ x: o.c * TILE + 8 + o.dir * 9, y: o.r * TILE + 8, vx: o.dir * 2.3, life: 300 }); SFX.arrow(); }
    }
  }
  for (i = LV.arrows.length - 1; i >= 0; i--) {
    o = LV.arrows[i]; o.x += o.vx; o.life--;
    if (o.life <= 0 || solidCh(tileAt(Math.floor((o.x + sgn(o.vx) * 5) / TILE), Math.floor(o.y / TILE)))) { LV.arrows.splice(i, 1); continue; }
    if (L.inv <= 0 && ov(L.x - cfg.hw, L.y - cfg.h, L.x + cfg.hw, L.y, o.x - 5, o.y - 2, o.x + 5, o.y + 2)) { LV.arrows.splice(i, 1); damageLeader(1, o.x); }
  }
  // boss
  if (LV.boss) updateBoss(LV.boss, L);
  // pickups
  for (i = LV.pages.length - 1; i >= 0; i--) {
    o = LV.pages[i];
    if (Math.abs(o.x - L.x) < 12 && o.y > L.y - cfg.h - 6 && o.y < L.y + 6) {
      LV.pages.splice(i, 1); G.gone[o.k] = 1; G.pages++; SFX.page(); puff(o.x, o.y, '#ffffff', 14, 2.5); pop('PAGE ' + G.pages + '/' + TOTAL_PAGES, o.x, o.y - 14, 12, '#ffe066');
    }
  }
  for (i = LV.hearts.length - 1; i >= 0; i--) {
    o = LV.hearts[i];
    if (Math.abs(o.x - L.x) < 12 && o.y > L.y - cfg.h - 6 && o.y < L.y + 6) {
      LV.hearts.splice(i, 1); G.gone[o.k] = 1; if (G.hearts < G.maxHearts) G.hearts++; SFX.heart(); pop('+1', o.x, o.y - 12, 12, '#ff9aa8');
    }
  }
  // checkpoints
  for (i = 0; i < LV.cps.length; i++) {
    o = LV.cps[i];
    if (Math.abs(o.x - L.x) < 18 && Math.abs(o.y - L.y) < 40 && G.cp.id !== o.id) {
      G.cp = { x: o.x, y: o.y, id: o.id }; SFX.cp(); pop('CHECKPOINT', o.x, o.y - 50, 12, '#ffe066');
      if (o.cut && !G.cpCuts[o.id]) { G.cpCuts[o.id] = 1; var cutName = o.cut; pend(30, function () { startCut(cutName); }); }
    }
  }
  // signs
  G.signText = null;
  for (i = 0; i < LV.signs.length; i++) { o = LV.signs[i]; if (Math.abs(o.x - L.x) < 30 && Math.abs(o.y - L.y) < 30) G.signText = o.text; }
  // fall into the abyss
  if (L.y > LV.H * TILE + 30 && G.state === 'play') { loseHeart(1); if (G.state === 'play') respawn(); }
}

function updateBoss(B, L) {
  var i, cfg = HERO[L.key];
  if (B.dead) { B.dd++; return; }
  if (!B.active) { if (L.x > 129 * TILE) { B.active = true; say(['Barnacle Bart guards the last page!', 'Dodge his charge. Hit him when he is dizzy!'], 280); } return; }
  if (B.flash > 0) B.flash--;
  if (B.stun > 0) { B.stun--; if (B.stun === 0) { B.mode = 'idle'; B.cd = 70; } return; }
  if (L.inv <= 0 && ov(L.x - cfg.hw, L.y - cfg.h, L.x + cfg.hw, L.y, B.x - 18, B.y - 30, B.x + 18, B.y)) damageLeader(1, B.x);
  switch (B.mode) {
    case 'idle':
      B.face = sgn(L.x - B.x) || B.face; B.x = clamp(B.x + B.face * 0.6, LV.arenaL, LV.arenaR);
      B.cd--;
      if (B.cd <= 0) {
        var alive = 0; for (i = 0; i < LV.crabs.length; i++) if (LV.crabs[i].alive) alive++;
        if (alive < 3 && Math.random() < 0.4) { B.mode = 'throw'; B.t0 = 0; } else { B.mode = 'wind'; B.t0 = 0; }
      }
      break;
    case 'throw':
      B.t0++;
      if (B.t0 === 20) { LV.crabs.push(mkCrab(clamp(B.x + B.face * 26, LV.arenaL, LV.arenaR), 18 * TILE, B.face, null)); pop('SNAP!', B.x, B.y - 44, 14, '#ffd0c0'); SFX.arrow(); }
      if (B.t0 >= 40) { B.mode = 'idle'; B.cd = 90; }
      break;
    case 'wind':
      B.t0++;
      if (B.t0 === 1) { B.face = sgn(L.x - B.x) || B.face; pop('!!', B.x, B.y - 46, 26, '#ff7b7b'); SFX.warn(); }
      B.x += (Math.random() - 0.5) * 2;
      if (B.t0 >= 42) { B.vx = B.face * 3.6; B.mode = 'dash'; }
      break;
    case 'dash':
      B.x += B.vx;
      if (B.x <= LV.arenaL || B.x >= LV.arenaR) {
        B.x = clamp(B.x, LV.arenaL, LV.arenaR); B.mode = 'stunned'; B.stun = 210; G.shake = 14; SFX.smash();
        pop('CRASH!', B.x, B.y - 44, 26, '#ffd27d'); puff(B.x, B.y - 15, '#8aa', 16, 4);
      }
      break;
  }
}

function updatePlay() {
  var L = lead(), F = follow(), i, o;
  if (G.popCd > 0) G.popCd--;
  if (G.capT > 0) G.capT--;
  if (G.hintT > 0) G.hintT--;
  if (inp.swapP) swapHero();
  if (inp.resetP) resetBlocks();
  L = lead(); F = follow();
  updateVines(); updateBlocks();
  updateLeader(L);
  updateFollower(F, L);
  updateEntities(L);
  // camera
  var tx = clamp(L.x - VW / 2 + L.face * 30, 0, LV.W * TILE - VW), ty = clamp(L.y - 170, 0, LV.H * TILE - VH);
  cam.x += (tx - cam.x) * 0.12; cam.y += (ty - cam.y) * 0.12;
}
function updateWorld() {
  var i, o;
  for (i = G.pend.length - 1; i >= 0; i--) { o = G.pend[i]; o.t--; if (o.t <= 0) { G.pend.splice(i, 1); o.fn(); } }
  for (i = G.popups.length - 1; i >= 0; i--) { o = G.popups[i]; o.y += o.vy; o.life--; if (o.life <= 0) G.popups.splice(i, 1); }
  for (i = G.parts.length - 1; i >= 0; i--) { o = G.parts[i]; o.x += o.vx; o.y += o.vy; o.vy += 0.15; o.life--; if (o.life <= 0) G.parts.splice(i, 1); }
  if (G.shake > 0) G.shake = Math.max(0, G.shake - 0.7);
  if (G.fade > 0) G.fade--;
}

function startGame() {
  G = newG(); LV = buildLevel(); G.state = 'play';
  var L = lead(), F = follow();
  L.x = 4 * TILE + 8; L.y = 18 * TILE; F.x = 2 * TILE + 8; F.y = 18 * TILE;
  cam.x = 0; cam.y = LV.H * TILE - VH; G.fade = 24; G.hintT = 420;
  say(['LEFT/RIGHT move, JUMP, BASH/KICK, SWAP heroes.', 'Maximus smashes. Chuck kicks and glides (hold JUMP).'], 300);
  startCut('crack');
}

function step() {
  G.t++;
  readInput();
  var st = G.state;
  if (st === 'title') { if (tapFlag || inp.actP || inp.jumpP) { SFX.select(); startGame(); } }
  else if (st === 'play') { updatePlay(); updateWorld(); }
  else if (st === 'cut') { updateCut(); }
  else if (st === 'oops') { G.oopsT--; updateWorld(); if (G.oopsT <= 0) respawn(); }
  else if (st === 'complete') { G.completeT++; updateWorld(); if (G.completeT > 70 && (tapFlag || inp.actP)) { var keep = null; G = newG(); } }
  prevIn.jump = inp.jump; prevIn.act = inp.act; prevIn.swap = inp.swap; prevIn.reset = inp.reset;
  tapFlag = false;
}

// ---------- drawing helpers ----------
function rect(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }
function txt(s, x, y, size, color, align) {
  ctx.font = 'bold ' + size + 'px sans-serif'; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color || '#fff'; ctx.fillText(s, x, y);
}
function comic(s, x, y, size, fill, rot, alpha) {
  ctx.save(); ctx.globalAlpha = alpha === undefined ? 1 : alpha; ctx.translate(x, y); ctx.rotate(rot || 0);
  ctx.font = 'italic 900 ' + size + 'px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.3); ctx.strokeStyle = '#000'; ctx.strokeText(s, 0, 0); ctx.fillStyle = fill; ctx.fillText(s, 0, 0);
  ctx.restore();
}
function heartShape(x, y, s, col) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x, y - s * 0.1, x - s * 0.5, y - s * 0.1, x - s * 0.5, y + s * 0.25);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.55, x, y + s * 0.75, x, y + s * 0.95);
  ctx.bezierCurveTo(x, y + s * 0.75, x + s * 0.5, y + s * 0.55, x + s * 0.5, y + s * 0.25);
  ctx.bezierCurveTo(x + s * 0.5, y - s * 0.1, x, y - s * 0.1, x, y + s * 0.35); ctx.fill();
}
function heroSprite(who, pose, x, y, facing, scale, sx, sy, rot, hang) {
  var im = IMG[who + '_' + pose]; if (!imgOK(im)) return 24;
  var d = SPRDIM[who][pose], w = d.w / PXS * scale, h = d.h / PXS * scale;
  var want = FACES[who][pose], flip = want !== 0 && facing !== want;
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (flip) ctx.scale(-1, 1);
  if (sx !== 1 || sy !== 1) ctx.scale(sx || 1, sy || 1);
  ctx.drawImage(im, -w / 2, hang ? -2 : -h, w, h); ctx.restore();
  return h;
}
function drawHero(h, isLeader) {
  var who = h.key, pose, rot = 0, sx = 1, sy = 1, bob = 0, f = h.face;
  var air = h.vis.air, moving = h.vis.moving;
  var atk = isLeader ? h.atkT > 0 : !!h.fatk, vine = isLeader ? h.state === 'vine' : !!h.fvine, gl = isLeader ? h.gliding : !!h.fgl;
  var hurt = isLeader && h.hurt > 0;
  if (isLeader && h.inv > 0 && ((G.t >> 2) & 1) && G.state === 'play' && !hurt) return;
  if (who === 'maximus') {
    pose = hurt ? 'down' : (atk || vine || h.slam ? 'attack' : (air || moving ? 'walk' : 'idle'));
    if (air && !vine) { rot = (h.vy < 0 ? -0.14 : 0.1) * f; sy = 1 + Math.min(0.12, Math.abs(h.vy) * 0.02); }
    if (h.slam) { rot = 0.9 * f; }
  } else {
    pose = hurt ? 'hurt' : (atk ? 'attack' : (vine || air ? 'win' : 'idle'));
    if (moving) rot = 0.1 * f;
    if (air && !vine) rot = (h.vy < 0 ? -0.12 : 0.06) * f;
    if (gl) { sx = 1 + Math.sin(G.t * 0.7) * 0.08; }
  }
  if (moving) bob = -Math.abs(Math.sin(h.walked * 0.2)) * 1.8;
  else if (!air) sy *= 1 + Math.sin(G.t * 0.08 + (isLeader ? 0 : 2)) * 0.015;
  if (!air && !vine) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(h.x, h.y, 9, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
  var hh;
  if (vine && isLeader && h.vine) {
    var v = h.vine, gx = v.ax + Math.sin(v.a) * h.vs, gy = v.ay + Math.cos(v.a) * h.vs;
    hh = heroSprite(who, pose, gx, gy, f, 1, 1, 1, -v.a, true);
  } else hh = heroSprite(who, pose, h.x, h.y + bob - (rot ? HERO[who].h * 0.5 : 0) * 0, f, 1, sx, sy, rot, false);
  if (isLeader && G.state === 'play' && !vine) {
    var ay = h.y - (hh || 24) - 6 + Math.sin(G.t * 0.15) * 1.5;
    ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.moveTo(h.x - 4, ay - 5); ctx.lineTo(h.x + 4, ay - 5); ctx.lineTo(h.x, ay + 1); ctx.fill();
  }
}

// ---------- backgrounds ----------
function makeLayer(seed, kind) {
  var cv = document.createElement('canvas'); cv.width = 512; cv.height = 400;
  var x = cv.getContext('2d'), rng = mulberry32(seed), i, w, hgt, px;
  function tri(px0, py0, ww, hh, up, col) {
    x.fillStyle = col;
    [0, -512, 512].forEach(function (off) {
      x.beginPath();
      if (up) { x.moveTo(px0 + off, py0); x.lineTo(px0 + ww / 2 + off, py0 - hh); x.lineTo(px0 + ww + off, py0); }
      else { x.moveTo(px0 + off, py0); x.lineTo(px0 + ww / 2 + off, py0 + hh); x.lineTo(px0 + ww + off, py0); }
      x.fill();
    });
  }
  if (kind === 0) {
    var g = x.createLinearGradient(0, 0, 0, 400); g.addColorStop(0, '#071419'); g.addColorStop(0.5, '#0f2b31'); g.addColorStop(1, '#173b40');
    x.fillStyle = g; x.fillRect(0, 0, 512, 400);
    for (i = 0; i < 18; i++) tri(rng() * 512, 0, 30 + rng() * 40, 60 + rng() * 120, false, '#0a1f25');
    for (i = 0; i < 12; i++) tri(rng() * 512, 400, 40 + rng() * 60, 50 + rng() * 100, true, '#0c242a');
    for (i = 0; i < 40; i++) { x.fillStyle = 'rgba(180,255,230,' + (0.04 + rng() * 0.1) + ')'; x.fillRect(rng() * 512, rng() * 400, 2, 2); }
  } else if (kind === 1) {
    for (i = 0; i < 12; i++) tri(rng() * 512, 0, 24 + rng() * 36, 50 + rng() * 110, false, '#143a41');
    for (i = 0; i < 10; i++) tri(rng() * 512, 400, 40 + rng() * 50, 60 + rng() * 90, true, '#17434a');
    for (i = 0; i < 7; i++) { px = rng() * 512; x.fillStyle = 'rgba(120,255,210,0.5)'; [0, -512, 512].forEach(function (off) { x.beginPath(); x.moveTo(px + off, 360); x.lineTo(px + 4 + off, 340 - rng() * 14); x.lineTo(px + 8 + off, 360); x.fill(); }); }
  } else {
    for (i = 0; i < 8; i++) tri(rng() * 512, 0, 30 + rng() * 30, 70 + rng() * 90, false, '#1d4b53');
    for (i = 0; i < 6; i++) tri(rng() * 512, 400, 50 + rng() * 50, 50 + rng() * 60, true, '#215159');
  }
  return cv;
}
function drawBackground() {
  var i, L, w, offx, im, sc, y0;
  for (i = 0; i < BGL.length; i++) {
    L = BGL[i];
    if (imgOK(L.img)) {
      im = L.img; sc = (VH + 100) / im.naturalHeight; w = im.naturalWidth * sc;
      offx = -((cam.x * L.speed) % w); y0 = -cam.y * 0.3;
      for (var x = offx; x < VW; x += w) ctx.drawImage(im, x, y0, w, im.naturalHeight * sc);
    } else {
      if (!L.proc) L.proc = makeLayer(101 + i * 17, i);
      offx = -((cam.x * L.speed) % 512); y0 = -cam.y * (0.15 + i * 0.1);
      for (var x2 = offx; x2 < VW; x2 += 512) ctx.drawImage(L.proc, x2, y0);
    }
  }
}

// ---------- tiles + entities ----------
function drawTile(ch, c, r, x, y) {
  var hv = hash(c, r), above, below, i;
  if (ch === '#' || ch === 'Y') {
    var shade = ['#2c4d52', '#2a494e', '#2f5257'][hv % 3];
    rect(x, y, TILE, TILE, shade);
    above = tileAt(c, r - 1); below = tileAt(c, r + 1);
    if (!solidCh(above)) { rect(x, y, TILE, 4, '#5aa58a'); rect(x + (hv % 5) * 3, y + 4, 3, 2, '#5aa58a'); rect(x, y, TILE, 1, '#86d0a8'); }
    else { rect(x + ((hv >> 3) & 1 ? 3 : 8), y + 6, 5, 1, '#1f383c'); rect(x + 7, y + 1, 1, 5, '#1f383c'); if ((hv >> 5) & 1) rect(x + 2, y + 11, 6, 1, '#1f383c'); }
    if (!solidCh(below)) { rect(x + 2, y + TILE, 3, 3, '#1f383c'); rect(x + 9, y + TILE, 3, 2, '#1f383c'); }
  } else if (ch === 'X') {
    rect(x, y, TILE, TILE, '#3d5e63'); rect(x, y, TILE, 1, '#86a8ac');
    ctx.strokeStyle = '#10272b'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + 3, y + 1); ctx.lineTo(x + 7, y + 6); ctx.lineTo(x + 5, y + 10); ctx.lineTo(x + 10, y + 15); ctx.moveTo(x + 7, y + 6); ctx.lineTo(x + 13, y + 7); ctx.stroke();
  } else if (ch === 'F') {
    var t = LV.fall[c + ',' + r], sh = (t !== undefined && t > 0 && t < 20) ? (Math.random() - 0.5) * 2 : 0;
    rect(x + sh, y, TILE, 6, '#a8743a'); rect(x + sh, y, TILE, 2, '#d49a5a'); rect(x + sh + 3, y + 3, 1, 3, '#6d4721'); rect(x + sh + 10, y + 2, 1, 4, '#6d4721');
  } else if (ch === 'W') {
    rect(x, y, TILE, TILE, '#8a5a2e');
    for (i = 4; i < TILE; i += 5) rect(x + i, y, 1, TILE, '#5a3a1a');
    rect(x, y + 3, TILE, 3, '#3d3d48'); rect(x, y + 11, TILE, 3, '#3d3d48');
    if (tileAt(c, r - 1) !== 'W') { rect(x - 6, y + 2, 28, 12, '#c9a063'); ctx.strokeStyle = '#6d4721'; ctx.lineWidth = 1; ctx.strokeRect(x - 5.5, y + 2.5, 27, 11); txt('STAFF ONLY', x + 8, y + 8, 6, '#2a1a08'); }
  } else if (ch === 'G') {
    rect(x, y, TILE, TILE, 'rgba(0,0,0,0.3)');
    for (i = 2; i < TILE; i += 4) rect(x + i, y, 2, TILE, '#8e97a8');
    rect(x, y + 6, TILE, 2, '#6a7080');
  } else if (ch === '=') {
    rect(x, y, TILE, 5, '#a8743a'); rect(x, y, TILE, 2, '#d49a5a');
  } else if (ch === '^') {
    ctx.fillStyle = '#d7dde6';
    for (i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + 1 + i * 5, y + TILE); ctx.lineTo(x + 3.5 + i * 5, y + 4); ctx.lineTo(x + 6 + i * 5, y + TILE); ctx.fill(); }
    rect(x, y + 14, TILE, 2, '#7d8795');
  } else if (ch === 'a' || ch === 'A') {
    rect(x, y, TILE, TILE, '#41585c'); rect(x, y, TILE, 2, '#6f8a8e'); rect(ch === 'a' ? x : x + 10, y + 6, 6, 4, '#0c1517');
  }
}
function drawBlockEnt(b) {
  var x = b.x, y = b.y;
  rect(x, y, TILE, TILE, '#8a919c'); rect(x, y, TILE, 2, '#b5bcc7'); rect(x, y + 14, TILE, 2, '#5d646f');
  ctx.strokeStyle = '#4b525c'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, 15, 15);
  rect(x + 3, y + 3, 2, 2, '#4b525c'); rect(x + 11, y + 3, 2, 2, '#4b525c'); rect(x + 3, y + 11, 2, 2, '#4b525c'); rect(x + 11, y + 11, 2, 2, '#4b525c');
}
function drawCrab(e) {
  var x = e.x, y = e.y - 5, w = Math.sin(e.wob) * 1.2;
  ctx.strokeStyle = '#d6482c'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x - 5, y + 2); ctx.lineTo(x - 9, y + 5 + w); ctx.moveTo(x + 5, y + 2); ctx.lineTo(x + 9, y + 5 - w); ctx.moveTo(x - 4, y + 3); ctx.lineTo(x - 7, y + 5 - w); ctx.moveTo(x + 4, y + 3); ctx.lineTo(x + 7, y + 5 + w); ctx.stroke();
  ctx.fillStyle = '#e8573a'; ctx.beginPath(); ctx.ellipse(x, y, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x - 9, y - 4 + w, 3.5, 0, Math.PI * 2); ctx.arc(x + 9, y - 4 - w, 3.5, 0, Math.PI * 2); ctx.fill();
  rect(x - 4, y - 6, 2, 3, '#fff'); rect(x + 2, y - 6, 2, 3, '#fff'); rect(x - 4 + (e.dir > 0 ? 1 : 0), y - 5, 1, 1, '#000'); rect(x + 2 + (e.dir > 0 ? 1 : 0), y - 5, 1, 1, '#000');
  ctx.strokeStyle = '#3a0f0a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 5, y - 8); ctx.lineTo(x - 1, y - 6); ctx.moveTo(x + 5, y - 8); ctx.lineTo(x + 1, y - 6); ctx.stroke();
}
function drawBoss(B) {
  var x = B.x, y = B.y - 15, fl = B.flash > 0 && (B.flash & 2), i;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(B.x, B.y, 22, 4, 0, 0, Math.PI * 2); ctx.fill();
  if (B.stun > 0) for (i = 0; i < 3; i++) { var a = G.t * 0.15 + i * 2.1; rect(x + Math.cos(a) * 16 - 2, y - 24 + Math.sin(a) * 4 - 2, 4, 4, '#ffe066'); }
  ctx.fillStyle = fl ? '#ffffff' : '#7a2b2b'; ctx.beginPath(); ctx.ellipse(x, y + 2, 20, 15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x - 24, y - 6, 7, 0, Math.PI * 2); ctx.arc(x + 24, y - 6, 7, 0, Math.PI * 2); ctx.fill();
  rect(x - 14, y - 22, 28, 9, '#1a1a22'); rect(x - 18, y - 15, 36, 3, '#1a1a22'); rect(x - 3, y - 20, 6, 4, '#e9e2d0'); rect(x - 1, y - 21, 2, 6, '#e9e2d0');
  rect(x - 9, y - 8, 6, 6, '#fff'); rect(x + 3, y - 8, 6, 6, '#fff'); rect(x - 7 + (B.face > 0 ? 2 : 0), y - 6, 3, 3, '#000'); rect(x + 5 + (B.face > 0 ? 2 : 0), y - 6, 3, 3, '#000');
  ctx.strokeStyle = '#1a0a0a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 11, y - 12); ctx.lineTo(x - 2, y - 8); ctx.moveTo(x + 11, y - 12); ctx.lineTo(x + 2, y - 8); ctx.stroke();
  rect(x - 8, y + 4, 16, 3, '#1a0a0a');
}
function drawVine(v) {
  var L = v.len * TILE, ex = v.ax + Math.sin(v.a) * L, ey = v.ay + Math.cos(v.a) * L;
  ctx.strokeStyle = '#3d7a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(v.ax, v.ay); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.strokeStyle = '#6fbf5a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(v.ax - 1, v.ay); ctx.lineTo(ex - 1, ey); ctx.stroke();
  for (var s = 20; s < L; s += 22) { ctx.fillStyle = '#4f9a48'; ctx.beginPath(); ctx.ellipse(v.ax + Math.sin(v.a) * s + 3, v.ay + Math.cos(v.a) * s, 3, 1.6, 0.6, 0, Math.PI * 2); ctx.fill(); }
}
function drawPage(o) { var bob = Math.sin(G.t * 0.1 + o.x) * 1.5; rect(o.x - 5, o.y - 7 + bob, 10, 13, '#fdfbf5'); rect(o.x - 3, o.y - 4 + bob, 6, 1, '#c8c2b4'); rect(o.x - 3, o.y - 1 + bob, 4, 1, '#c8c2b4'); rect(o.x - 5, o.y - 7 + bob, 2, 4, '#d63031'); }
function drawSign(s) { rect(s.x - 1, s.y - 10, 2, 10, '#5a3a1a'); rect(s.x - 8, s.y - 20, 16, 11, '#c9a063'); ctx.strokeStyle = '#6d4721'; ctx.lineWidth = 1; ctx.strokeRect(s.x - 7.5, s.y - 19.5, 15, 10); rect(s.x - 5, s.y - 17, 10, 1, '#6d4721'); rect(s.x - 5, s.y - 14, 7, 1, '#6d4721'); }
function drawTorch(x, y, lit) {
  rect(x - 1, y - 2, 2, 12, '#6b4a2a'); rect(x - 3, y - 4, 6, 3, '#4a3a2a');
  var fl = Math.sin(G.t * 0.3 + x) * 1.2;
  ctx.fillStyle = lit ? '#ff9a2e' : '#7a5a3a'; ctx.beginPath(); ctx.ellipse(x, y - 8, 3.2, 5 + fl, 0, 0, Math.PI * 2); ctx.fill();
  if (lit) { ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.ellipse(x, y - 7, 1.6, 3 + fl * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,170,60,0.12)'; ctx.beginPath(); ctx.arc(x, y - 8, 34, 0, Math.PI * 2); ctx.fill(); }
}

// ---------- render ----------
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.scale, 0, 0, view.scale, view.offX, view.offY);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.clip(); ctx.imageSmoothingEnabled = true;
  var st = G.state;
  if (st === 'title') { renderTitle(); ctx.restore(); return; }
  if (st === 'cut') { renderCut(); ctx.restore(); return; }
  drawBackground();
  ctx.save();
  var shx = G.shake > 0 ? rnd(-G.shake, G.shake) * 0.5 : 0, shy = G.shake > 0 ? rnd(-G.shake, G.shake) * 0.5 : 0;
  ctx.translate(-Math.round(cam.x) + shx, -Math.round(cam.y) + shy);
  renderWorld();
  ctx.restore();
  renderHUD();
  if (st === 'complete') renderComplete();
  if (st === 'oops') { ctx.fillStyle = 'rgba(80,0,0,0.35)'; ctx.fillRect(0, 0, VW, VH); }
  renderTouch();
  if (G.fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + (G.fade / 24) + ')'; ctx.fillRect(0, 0, VW, VH); }
  ctx.restore();
}
function renderWorld() {
  var c0 = Math.max(0, Math.floor(cam.x / TILE) - 1), c1 = Math.min(LV.W - 1, Math.ceil((cam.x + VW) / TILE) + 1);
  var r0 = Math.max(0, Math.floor(cam.y / TILE) - 1), r1 = Math.min(LV.H - 1, Math.ceil((cam.y + VH) / TILE) + 1), c, r, i, o, ch;
  // arena skull
  if (cam.x + VW > 126 * TILE) {
    var sx0 = 141 * TILE; ctx.fillStyle = 'rgba(233,226,208,0.16)'; ctx.beginPath(); ctx.arc(sx0, 130, 46, 0, Math.PI * 2); ctx.fill(); rect(sx0 - 28, 160, 56, 22, 'rgba(233,226,208,0.16)');
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(sx0 - 17, 128, 12, 0, Math.PI * 2); ctx.arc(sx0 + 17, 128, 12, 0, Math.PI * 2); ctx.fill(); rect(sx0 - 5, 142, 10, 12, 'rgba(0,0,0,0.5)');
  }
  for (i = 0; i < LV.torches.length; i++) drawTorch(LV.torches[i].x, LV.torches[i].y, true);
  for (r = r0; r <= r1; r++) for (c = c0; c <= c1; c++) {
    ch = LV.g[r][c]; if (ch === ' ') continue;
    if (ch === 'Y') { var gid = LV.ygid[c + ',' + r]; if (LV.yrev[gid]) { ctx.save(); ctx.globalAlpha = 0.28; drawTile('#', c, r, c * TILE, r * TILE); ctx.restore(); continue; } }
    drawTile(ch, c, r, c * TILE, r * TILE);
  }
  for (i = 0; i < LV.plates.length; i++) { o = LV.plates[i]; rect(o.c * TILE + 1, o.r * TILE + 12, 14, 4, o.open ? '#5fe08a' : '#8a93a6'); rect(o.c * TILE + 4, o.r * TILE + 12, 8, 2, o.open ? '#c9ffd9' : '#6a7384'); }
  for (i = 0; i < LV.cps.length; i++) drawTorch(LV.cps[i].x, LV.cps[i].y - 10, G.cp.id === LV.cps[i].id || (!G.cp.id && i === 0));
  for (i = 0; i < LV.signs.length; i++) drawSign(LV.signs[i]);
  for (i = 0; i < LV.vines.length; i++) drawVine(LV.vines[i]);
  for (i = 0; i < LV.blocks.length; i++) drawBlockEnt(LV.blocks[i]);
  for (i = 0; i < LV.crabs.length; i++) if (LV.crabs[i].alive) drawCrab(LV.crabs[i]);
  if (LV.boss && !LV.boss.dead) drawBoss(LV.boss);
  else if (LV.boss && LV.boss.dd < 60 && (LV.boss.dd & 2)) drawBoss(LV.boss);
  for (i = 0; i < LV.arrows.length; i++) { o = LV.arrows[i]; rect(o.x - 5, o.y - 1, 10, 2, '#d7dde6'); rect(o.vx > 0 ? o.x + 3 : o.x - 5, o.y - 2, 2, 4, '#c0392b'); }
  for (i = 0; i < LV.pages.length; i++) drawPage(LV.pages[i]);
  for (i = 0; i < LV.hearts.length; i++) { o = LV.hearts[i]; heartShape(o.x, o.y - 6 + Math.sin(G.t * 0.1 + o.x) * 1.5, 12, '#ff5b6e'); }
  var L = lead(), F = follow();
  drawHero(F, false); drawHero(L, true);
  for (i = 0; i < G.parts.length; i++) { o = G.parts[i]; ctx.globalAlpha = clamp(o.life / 20, 0, 1); rect(o.x - 1.5, o.y - 1.5, 3, 3, o.col); ctx.globalAlpha = 1; }
  for (i = 0; i < G.popups.length; i++) {
    o = G.popups[i]; var a = Math.min(1, o.life / 20), s = o.size * (o.life > o.max - 6 ? 1 + (o.life - (o.max - 6)) * 0.06 : 1);
    comic(o.s, o.x, o.y, s, o.color, o.rot, a);
  }
}
function renderHUD() {
  var i;
  ctx.save(); ctx.globalAlpha = 0.85; rect(4, 4, 150, 22, 'rgba(0,0,0,0.55)'); ctx.restore();
  for (i = 0; i < G.maxHearts; i++) heartShape(16 + i * 14, 8, 12, i < G.hearts ? '#ff5b6e' : 'rgba(255,255,255,0.22)');
  rect(92, 9, 7, 9, '#fdfbf5'); rect(92, 9, 2, 3, '#d63031'); txt(G.pages + '/' + TOTAL_PAGES, 104, 14, 10, '#ffe066', 'left');
  txt(HERO[G.leader].name, 8, 36, 8, 'rgba(255,255,255,0.85)', 'left');
  var B = LV.boss;
  if (B && B.active && !B.dead) { rect(176, 8, 160, 8, 'rgba(0,0,0,0.6)'); rect(177, 9, 158 * (B.hp / B.maxHp), 6, '#d84a4a'); txt('BARNACLE BART', 256, 22, 8, '#fff'); }
  var lines = null;
  if (G.capT > 0 && G.caption) lines = G.caption; else if (G.signText) lines = [G.signText];
  if (lines && G.state === 'play') {
    var h = 8 + lines.length * 12, y0 = 40;
    rect(40, y0, VW - 80, h, '#fff6d8'); ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(40, y0, VW - 80, h);
    for (i = 0; i < lines.length; i++) txt(lines[i], 256, y0 + 10 + i * 12, 9, '#111');
  }
}
function renderTouch() {
  if (G.state !== 'play' && G.state !== 'oops') return;
  var held = {}, k, n, p, b, dx, dy, i;
  for (k in pointers) { p = pointers[k]; for (n in BTN) { b = BTN[n]; dx = p.x - b.x; dy = p.y - b.y; if (dx * dx + dy * dy <= b.r * b.r * 1.55) held[n] = true; } }
  var labels = { l: '<', r: '>', u: '^', d: 'v', jump: 'JUMP', act: HERO[G.leader].btn, swap: 'SWAP', reset: 'R' };
  ctx.save();
  for (n in BTN) {
    b = BTN[n]; ctx.globalAlpha = 0.3; ctx.fillStyle = held[n] ? '#fff' : '#000';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 0.9; txt(labels[n], b.x, b.y, n === 'l' || n === 'r' ? 18 : (n === 'u' || n === 'd' ? 13 : 9), '#fff');
  }
  ctx.restore();
}
function renderTitle() {
  var g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#071419'); g.addColorStop(1, '#173b40'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  for (var i = 0; i < 4; i++) { var tx = 60 + i * 130, fl = Math.sin(G.t * 0.25 + i) * 1.5; rect(tx - 2, 40, 4, 16, '#6b4a2a'); ctx.fillStyle = '#ff9a2e'; ctx.beginPath(); ctx.ellipse(tx, 34, 5, 9 + fl, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.ellipse(tx, 36, 2.5, 5, 0, 0, Math.PI * 2); ctx.fill(); }
  comic('MAXIMUS AND THE', 256, 62, 26, '#ffffff', -0.03); comic('KUNG FU PIGEON', 256, 94, 34, '#ffd24a', -0.03); comic('ADVENTURES', 256, 126, 18, '#ffffff', 0.02);
  heroSprite('maximus', 'idle', 150, 236, 1, 2.4, 1, 1 + Math.sin(G.t * 0.08) * 0.015, 0, false);
  heroSprite('chuck', 'win', 362, 236 + Math.sin(G.t * 0.1) * 3, 1, 2.0, 1, 1, 0, false);
  if ((G.t % 60) < 38) comic('TAP TO START', 256, 258, 16, '#ffe066', 0);
}
function renderComplete() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, VW, VH);
  comic('BOOK COMPLETE!', 256, 56, 32, '#ffe066', -0.02);
  var stars = G.pages >= TOTAL_PAGES ? 3 : (G.pages >= 4 ? 2 : 1);
  txt('Pages found: ' + G.pages + ' / ' + TOTAL_PAGES, 256, 98, 14, '#ffffff'); txt(stars === 3 ? '* * *' : (stars === 2 ? '* *' : '*'), 256, 124, 26, '#ffd24a');
  if (stars < 3) txt('Secret rooms hide the rest. Look for hollow floors and fake walls!', 256, 148, 9, 'rgba(255,255,255,0.8)');
  heroSprite('chuck', 'win', 322, 236 + Math.sin(G.t * 0.12) * 3, 1, 1.6, 1, 1, 0, false); heroSprite('maximus', 'attack', 190, 236, 1, 1.6, 1, 1, 0, false);
  if (G.completeT > 70 && (G.t % 60) < 38) comic('TAP FOR TITLE', 256, 262, 14, '#ffe066', 0);
}

// ---------- boot ----------
function resize() {
  var dpr = window.devicePixelRatio || 1; view.dpr = dpr;
  var w = window.innerWidth, h = window.innerHeight;
  canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr); canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  view.scale = Math.min(canvas.width / VW, canvas.height / VH);
  view.offX = (canvas.width - VW * view.scale) / 2; view.offY = (canvas.height - VH * view.scale) / 2;
}
var acc = 0, last = 0;
function frame(now) {
  var dt = Math.min(100, now - (last || now)); last = now; acc += dt;
  while (acc >= 16.666) { step(); acc -= 16.666; }
  render(); requestAnimationFrame(frame);
}
function init() {
  canvas = document.getElementById('game'); ctx = canvas.getContext('2d');
  loadAssets(); G = newG(); LV = buildLevel(); resize();
  window.addEventListener('resize', resize);
  document.addEventListener('keydown', function (e) { keys[e.code] = true; ensureAudio(); if (e.code.indexOf('Arrow') === 0 || e.code === 'Space' || e.code === 'Tab') e.preventDefault(); });
  document.addEventListener('keyup', function (e) { keys[e.code] = false; });
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp); canvas.addEventListener('lostpointercapture', onUp);
  document.addEventListener('touchstart', function (e) { if (e.preventDefault) e.preventDefault(); }, { passive: false });
  window.__side = {
    G: function () { return G; }, LV: function () { return LV; }, step: step, render: render, keys: keys, inp: inp, startGame: startGame, buildLevel: buildLevel,
    lead: lead, follow: follow, swapHero: swapHero, doAttack: doAttack, setTap: function () { tapFlag = true; }, HERO: HERO, cam: cam, respawn: respawn, damageLeader: damageLeader
  };
  requestAnimationFrame(frame);
}
if (typeof window !== 'undefined' && typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init(); }
})();
