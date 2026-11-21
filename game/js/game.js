"use strict";

var TILE = 16;
var VW = 512, VH = 288, ROWS = 18, GROUND_Y = 16;

var CHARACTERS = {
  pigeon: {
    key: 'pigeon', name: 'KUNG FU PIGEON',
    w: 12, h: 13, accel: 0.35, maxRun: 2.2, fric: 0.82,
    jumpV: 7.3, gravity: 0.34, glide: true, jumpBreak: true, headBreak: false,
    atkRange: 22, atkH: 12, atkCool: 26,
    blurb: 'Fast. High jump. Glides. Breaks bricks from below.'
  },
  bulldog: {
    key: 'bulldog', name: 'BULLDOG',
    w: 16, h: 12, accel: 0.30, maxRun: 1.9, fric: 0.72,
    jumpV: 6.6, gravity: 0.42, glide: false, jumpBreak: false, headBreak: true,
    atkRange: 26, atkH: 14, atkCool: 30,
    blurb: 'Heavy headbutt. Smash bricks standing up.'
  }
};

var THEMES = [
  { name: 'MOONLIT MEADOW', skyTop: '#8fd3ff', skyBot: '#eafaff', sun: '#fff3a3', hillA: '#8fce5a', hillB: '#63a83e', grass: '#6ab04c', grassDark: '#57943c', dirt: '#9a6b3f', dirtDot: '#825a33', brick: '#c96a3f', brickDark: '#a3502b', plank: '#b98544', plankTop: '#d9a05b', cloud: '#ffffff' },
  { name: 'ROOFTOP RUN', skyTop: '#3d3c77', skyBot: '#ff9d6f', sun: '#ffd27d', hillA: '#5d5f9e', hillB: '#464883', grass: '#7d8a95', grassDark: '#69737d', dirt: '#5d6a75', dirtDot: '#4a545e', brick: '#8a5a7a', brickDark: '#6d4260', plank: '#8a6a4a', plankTop: '#a98858', cloud: '#f7c6a0' },
  { name: 'SECRET TEMPLE', skyTop: '#12132a', skyBot: '#332a54', sun: '#cfd8ff', hillA: '#2c2c4e', hillB: '#222246', grass: '#3f4a8a', grassDark: '#333d76', dirt: '#37355e', dirtDot: '#2b2a4c', brick: '#6d5a3a', brickDark: '#524328', plank: '#5c4a2e', plankTop: '#7c6a42', cloud: '#8a86b8' }
];

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

var audio = { ac: null };
function ensureAudio() {
  if (audio.ac) { if (audio.ac.state === 'suspended') audio.ac.resume(); return; }
  try {
    var AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
    if (AC) { audio.ac = new AC(); }
  } catch (e) { audio.ac = null; }
}
function tone(freq, dur, type, vol, slide) {
  if (!audio.ac) return;
  try {
    var ac = audio.ac, t = ac.currentTime;
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}
var SFX = {
  jump: function () { tone(300, 0.12, 'square', 0.06, 520); },
  glide: function () { tone(500, 0.05, 'triangle', 0.03, 420); },
  coin: function () { tone(880, 0.06, 'square', 0.05, 1180); },
  page: function () { tone(660, 0.09, 'square', 0.06, 990); setTimeout(function(){tone(990, 0.12, 'square', 0.05, 1320);}, 70); },
  kick: function () { tone(240, 0.1, 'square', 0.07, 90); },
  break: function () { tone(140, 0.12, 'sawtooth', 0.07, 60); },
  spring: function () { tone(240, 0.2, 'square', 0.07, 900); },
  hurt: function () { tone(300, 0.3, 'sawtooth', 0.08, 70); },
  check: function () { tone(520, 0.1, 'triangle', 0.06, 780); },
  select: function () { tone(600, 0.06, 'square', 0.05, 800); },
  win: function () { tone(523, 0.12, 'square', 0.06); setTimeout(function(){tone(659,0.12,'square',0.06);},120); setTimeout(function(){tone(784,0.2,'square',0.07);},240); },
  over: function () { tone(392, 0.15, 'square', 0.07); setTimeout(function(){tone(311,0.15,'square',0.07);},150); setTimeout(function(){tone(233,0.4,'square',0.07);},300); }
};

var input = { left: false, right: false, jump: false, attack: false };
var inputPrev = { jump: false, attack: false };
var tapFlag = false;

function pressKey(code, down) {
  switch (code) {
    case 'ArrowLeft': case 'KeyA': keyLeftHeld = down; return true;
    case 'ArrowRight': case 'KeyD': keyRightHeld = down; return true;
    case 'ArrowUp': case 'KeyW': case 'KeyZ': case 'Space': input.jump = down; keyJumpHeld = down; if (down) ensureAudio(); return true;
    case 'KeyX': case 'KeyK': case 'Enter': input.attack = down; keyAttackHeld = down; if (down) ensureAudio(); return true;
  }
  return false;
}

var pointers = {};
var zones = { left: false, right: false, jump: false, attack: false };
var ZONE_DEFS = [
  { id: 'left', cx: 38, cy: 246, r: 30 },
  { id: 'right', cx: 108, cy: 246, r: 30 },
  { id: 'attack', cx: 414, cy: 258, r: 27 },
  { id: 'jump', cx: 476, cy: 232, r: 32 }
];

function pointerToLogical(clientX, clientY) {
  var dpr = view.dpr;
  return { x: (clientX * dpr - view.offX) / view.scale, y: (clientY * dpr - view.offY) / view.scale };
}
function zoneAt(lx, ly) {
  for (var i = 0; i < ZONE_DEFS.length; i++) {
    var z = ZONE_DEFS[i];
    var dx = lx - z.cx, dy = ly - z.cy;
    if (dx * dx + dy * dy <= z.r * z.r * 1.44) return z.id;
  }
  return null;
}
function refreshZones() {
  var z = { left: false, right: false, jump: false, attack: false };
  for (var k in pointers) {
    var p = pointers[k];
    var id = zoneAt(p.x, p.y);
    if (id) z[id] = true;
  }
  zones = z;
  input.left = z.left || keyLeftHeld;
  input.right = z.right || keyRightHeld;
  input.jump = z.jump || keyJumpHeld;
  input.attack = z.attack || keyAttackHeld;
}
var keyLeftHeld = false, keyRightHeld = false, keyJumpHeld = false, keyAttackHeld = false;

var view = { scale: 1, offX: 0, offY: 0, dpr: 1 };

var particles = [];
function puff(px, py, color, n, spd) {
  for (var i = 0; i < (n || 8); i++) {
    particles.push({
      x: px, y: py,
      vx: (Math.random() - 0.5) * (spd || 3),
      vy: -Math.random() * (spd || 3) - 0.5,
      life: 20 + Math.random() * 15, color: color
    });
  }
}
function updateParticles() {
  for (var i = particles.length - 1; i >= 0; i--) {
    var p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

var CHUNK_POOL = [
  { id: 'flat', w: 10, min: 0, weight: 2 },
  { id: 'corn', w: 9, min: 0, weight: 2 },
  { id: 'gap3', w: 8, min: 0, weight: 2 },
  { id: 'page', w: 9, min: 0, weight: 2 },
  { id: 'bricks', w: 10, min: 0, weight: 2 },
  { id: 'stairs', w: 6, min: 0, weight: 1 },
  { id: 'crow', w: 11, min: 0, weight: 1 },
  { id: 'gap5plat', w: 11, min: 1, weight: 2 },
  { id: 'spikes', w: 10, min: 1, weight: 2 },
  { id: 'spring', w: 8, min: 1, weight: 1 },
  { id: 'gaunt', w: 12, min: 2, weight: 2 }
];

function makeGrid(cols) {
  var g = [], x, y;
  for (y = 0; y < ROWS; y++) {
    g.push(new Array(cols).fill(' '));
  }
  for (x = 0; x < cols; x++) { g[16][x] = '#'; g[17][x] = '#'; }
  return g;
}

function stampChunk(id, x, li, rng, put, pit, addEnemy) {
  var i;
  switch (id) {
    case 'flat': break;
    case 'corn':
      put(x + 3, 14, '*'); put(x + 4, 13, '*'); put(x + 5, 14, '*');
      break;
    case 'gap3': pit(x + 3, 3); break;
    case 'page':
      for (i = 3; i <= 5; i++) put(x + i, 14, '=');
      put(x + 4, 13, 'P');
      break;
    case 'bricks':
      for (i = 2; i <= 5; i++) put(x + i, 14, 'B');
      addEnemy('cat', x + 7, 15);
      break;
    case 'stairs':
      put(x + 2, 15, '#'); put(x + 3, 15, '#'); put(x + 3, 14, '#');
      put(x + 2, 13, '*');
      break;
    case 'crow': addEnemy('crow', x + 5, 11); break;
    case 'gap5plat':
      pit(x + 3, 5);
      for (i = 4; i <= 6; i++) put(x + i, 14, '=');
      break;
    case 'spikes':
      put(x + 4, 15, '^'); put(x + 5, 15, '^');
      put(x + 4, 13, '='); put(x + 5, 13, '=');
      break;
    case 'spring':
      put(x + 3, 15, 'S'); put(x + 3, 10, '*'); put(x + 4, 10, '*');
      break;
    case 'gaunt':
      pit(x + 3, 4);
      put(x + 3, 14, '='); put(x + 4, 14, '=');
      addEnemy('rat', x + 8, 15); addEnemy('crow', x + 9, 10);
      break;
  }
}

function pickGroundCol(tiles, cols, target) {
  for (var d = 0; d < cols; d++) {
    var c = target + (d % 2 === 0 ? d / 2 : -(d + 1) / 2);
    if (c < 8 || c > cols - 16) continue;
    if (tiles[16][c] === '#' && tiles[15][c] === ' ' && tiles[14][c] === ' ') return c;
  }
  return -1;
}

function generateLevel(li) {
  var rng = mulberry32(1337 + li * 7919);
  var cols = 150 + li * 25;
  var tiles = makeGrid(cols);
  var enemyDefs = [];
  var i, c, y, guard;

  function put(x, yy, ch) {
    if (x >= 0 && x < cols && yy >= 0 && yy < ROWS) tiles[yy][x] = ch;
  }
  function pit(sx, len) {
    for (var cc = sx; cc < sx + len; cc++) {
      if (cc >= 0 && cc < cols) { tiles[16][cc] = ' '; tiles[17][cc] = ' '; }
    }
  }
  function addEnemy(type, tx, ty) {
    enemyDefs.push({ type: type, tx: tx, ty: ty });
  }

  var pool = [], k;
  for (i = 0; i < CHUNK_POOL.length; i++) {
    if (CHUNK_POOL[i].min <= li) {
      for (k = 0; k < CHUNK_POOL[i].weight; k++) pool.push(CHUNK_POOL[i]);
    }
  }

  var x = 10;
  var nextEnemyChance = 0.12 + li * 0.13;
  while (x < cols - 18) {
    var ch = pool[(rng() * pool.length) | 0];
    stampChunk(ch.id, x, li, rng, put, pit, addEnemy);
    if (rng() < nextEnemyChance) {
      var et = li === 0 ? (rng() < 0.7 ? 'cat' : 'rat') : (rng() < 0.4 ? 'rat' : 'cat');
      addEnemy(et, x + 1, 15);
    }
    x += ch.w;
  }

  var mid = pickGroundCol(tiles, cols, Math.floor(cols / 2));
  if (mid > 0) put(mid, 15, 'A');
  put(cols - 6, 15, 'G');

  var pageTotal = 0;
  for (y = 0; y < ROWS; y++) for (c = 0; c < cols; c++) if (tiles[y][c] === 'P') pageTotal++;
  var need = Math.max(0, 8 + li * 2 - pageTotal);
  guard = 0;
  while (need > 0 && guard++ < 500) {
    c = 12 + ((rng() * (cols - 30)) | 0);
    if (tiles[16][c] !== '#') continue;
    y = 11 + ((rng() * 4) | 0);
    if (tiles[y][c] !== ' ') continue;
    put(c, y, 'P');
    pageTotal++; need--;
  }
  var cornNeed = 24 + li * 12;
  guard = 0;
  while (cornNeed > 0 && guard++ < 600) {
    c = 10 + ((rng() * (cols - 26)) | 0);
    y = 12 + ((rng() * 4) | 0);
    if (tiles[16][c] !== '#' || tiles[y][c] !== ' ' || tiles[y + 1] && tiles[y + 1][c] !== ' ') continue;
    put(c, y, '*');
    cornNeed--;
  }

  var clouds = [];
  for (i = 0; i < 14; i++) {
    clouds.push({ x: rng() * cols * TILE, y: 10 + rng() * 60, s: 0.6 + rng() * 0.9 });
  }

  return { tiles: tiles, cols: cols, enemyDefs: enemyDefs, theme: THEMES[li % THEMES.length], clouds: clouds, num: li };
}

function isSolid(ch) { return ch === '#' || ch === 'B'; }
function tileAt(col, row) {
  if (!level) return ' ';
  if (col < 0 || col >= level.cols) return '#';
  if (row < 0 || row >= ROWS) return ' ';
  return level.tiles[row][col];
}

function resolveX(e) {
  var c1 = Math.floor(e.x / TILE), c2 = Math.floor((e.x + e.w - 1) / TILE);
  var r1 = Math.floor(e.y / TILE), r2 = Math.floor((e.y + e.h - 1) / TILE);
  var hit = false, c, r;
  for (r = r1; r <= r2; r++) {
    for (c = c1; c <= c2; c++) {
      if (isSolid(tileAt(c, r))) { hit = true; break; }
    }
    if (hit) break;
  }
  e.hitWall = false;
  if (hit) {
    e.x -= e.vx;
    e.vx = 0;
    e.hitWall = true;
  }
}
function resolveY(e, allowOneWay) {
  var bottomPrev = e.y + e.h - e.vy;
  var c1 = Math.floor(e.x / TILE), c2 = Math.floor((e.x + e.w - 1) / TILE);
  var r1 = Math.floor(e.y / TILE), r2 = Math.floor((e.y + e.h - 1) / TILE);
  var c, r, ch;
  e.onGround = false;
  if (e.vy >= 0) {
    for (c = c1; c <= c2; c++) {
      for (r = r1; r <= r2; r++) {
        ch = tileAt(c, r);
        if (isSolid(ch) || (allowOneWay && ch === '=' && bottomPrev <= r * TILE)) {
          e.y = r * TILE - e.h;
          e.vy = 0;
          e.onGround = true;
          return;
        }
      }
    }
  } else {
    for (c = c1; c <= c2; c++) {
      for (r = r2; r >= r1; r--) {
        ch = tileAt(c, r);
        if (isSolid(ch)) {
          e.y = (r + 1) * TILE;
          e.vy = 0;
          e.bumpedTile = { c: c, r: r, ch: ch };
          return;
        }
      }
    }
  }
}

function makeEnemy(type, px, py, anchorY) {
  var e = { type: type, dead: false, t: 0, vx: 0, vy: 0, dir: -1 };
  if (type === 'cat') { e.w = 14; e.h = 12; e.speed = 0.45; e.score = 100; e.y = GROUND_Y * TILE - 12; }
  else if (type === 'rat') { e.w = 12; e.h = 7; e.speed = 0.95; e.score = 100; e.y = GROUND_Y * TILE - 7; }
  else { e.w = 14; e.h = 10; e.speed = 0; e.score = 150; e.y = py; e.ay = py; e.x = px; return e; }
  e.x = px + (TILE - e.w) / 2;
  return e;
}

var state = 'title', stateT = 0, time = 0;
var level = null, levelIndex = 0;
var score = 0, lives = 3;
var pagesGot = 0, pagesTotal = 0;
var grandPages = 0, grandLevelPages = 0;
var chosen = 'pigeon';
var selIndex = 0;
var cam = 0;
var player = null;

function newPlayer() {
  var c = CHARACTERS[chosen];
  return {
    ch: c, x: 3.5 * TILE, y: GROUND_Y * TILE - c.h,
    w: c.w, h: c.h, vx: 0, vy: 0, facing: 1,
    onGround: false, attackT: 0, attackCd: 0, inv: 0,
    dead: false, deadT: 0, glideT: 0, walked: 0
  };
}

function startLevel(li) {
  level = generateLevel(li);
  levelIndex = li;
  pagesTotal = 0;
  for (var y = 0; y < ROWS; y++) for (var x = 0; x < level.cols; x++) if (level.tiles[y][x] === 'P') pagesTotal++;
  pagesGot = 0;
  grandLevelPages = pagesTotal;
  player = newPlayer();
  player.checkpoint = { x: player.x, y: player.y };
  level.enemies = [];
  for (var i = 0; i < level.enemyDefs.length; i++) {
    var d = level.enemyDefs[i];
    level.enemies.push(makeEnemy(d.type, d.tx * TILE, d.ty * TILE));
  }
  if (!level.enemies.length && li === 0) {
    level.enemies.push(makeEnemy('cat', 20 * TILE, 15 * TILE));
  }
  particles = [];
  cam = 0;
  state = 'play'; stateT = 0;
}

function startGame() {
  score = 0; lives = 3; grandPages = 0;
  startLevel(0);
}

function killEnemy(e, stomp) {
  e.dead = true;
  score += e.score;
  puff(e.x + e.w / 2, e.y + e.h / 2, '#ffffff', 10, 2.5);
  SFX.kick();
}

function breakBrick(c, r) {
  if (tileAt(c, r) !== 'B') return;
  level.tiles[r][c] = ' ';
  puff(c * TILE + 8, r * TILE + 8, THEMES[level.num % THEMES.length].brick, 10, 3);
  score += 20;
  SFX.break();
}

function attackRect() {
  var c = player.ch;
  var range = c.atkRange;
  if (player.facing > 0) {
    return { x: player.x + player.w - 2, y: player.y - 2, w: range, h: c.atkH };
  }
  return { x: player.x - range + 2, y: player.y - 2, w: range, h: c.atkH };
}

function doDie() {
  player.dead = true;
  player.deadT = 80;
  player.vy = -6;
  lives--;
  SFX.hurt();
}

function respawn() {
  if (lives <= 0) {
    state = 'gameover'; stateT = 0;
    SFX.over();
    return;
  }
  player.dead = false;
  player.x = player.checkpoint.x;
  player.y = player.checkpoint.y;
  player.vx = 0; player.vy = 0;
  player.inv = 110;
}

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function updatePlayerTiles() {
  var c1 = Math.floor(player.x / TILE), c2 = Math.floor((player.x + player.w - 1) / TILE);
  var r1 = Math.floor(player.y / TILE), r2 = Math.floor((player.y + player.h - 1) / TILE);
  var c, r, ch;
  for (r = r1; r <= r2; r++) {
    for (c = c1; c <= c2; c++) {
      ch = tileAt(c, r);
      if (ch === '*' || ch === 'P') {
        level.tiles[r][c] = ' ';
        if (ch === '*') { score += 10; SFX.coin(); puff(c * TILE + 8, r * TILE + 8, '#ffe066', 6, 2); }
        else {
          pagesGot++; score += 100; SFX.page();
          puff(c * TILE + 8, r * TILE + 8, '#ffffff', 12, 2.5);
        }
      } else if (ch === 'S' && player.vy >= 0) {
        player.vy = -12.4;
        player.onGround = false;
        SFX.spring();
      } else if (ch === '^') {
        if (player.inv <= 0) doDie();
      } else if (ch === 'A') {
        level.tiles[r][c] = ' ';
        player.checkpoint = { x: c * TILE, y: r * TILE - player.h };
        score += 50;
        SFX.check();
        puff(c * TILE + 8, r * TILE + 8, '#7ec8ff', 10, 2);
      } else if (ch === 'G') {
        grandPages += pagesGot;
        score += pagesGot * 50 + 500;
        state = 'levelcomplete'; stateT = 0;
        SFX.win();
        return;
      }
    }
  }
}

function updatePlay() {
  var c = player.ch;
  refreshZones();
  var jumpPressed = input.jump && !inputPrev.jump;
  var attackPressed = input.attack && !inputPrev.attack;
  var dir = 0;
  if (input.left) dir = -1; else if (input.right) dir = 1;

  if (player.dead) {
    player.vy += player.ch.gravity;
    player.y += player.vy;
    player.deadT--;
    if (player.deadT <= 0) respawn();
    inputPrev.jump = input.jump; inputPrev.attack = input.attack;
    tapFlag = false;
    return;
  }

  if (dir !== 0) {
    player.vx += dir * c.accel;
    player.facing = dir;
    player.walked += Math.abs(player.vx);
  } else if (player.onGround) {
    player.vx *= c.fric;
    if (Math.abs(player.vx) < 0.05) player.vx = 0;
  }
  player.vx = clamp(player.vx, -c.maxRun, c.maxRun);

  if (player.onGround && jumpPressed) {
    player.vy = -c.jumpV;
    player.onGround = false;
    SFX.jump();
  }
  if (c.glide && !player.onGround && player.vy > 1.2 && input.jump) {
    player.vy = Math.max(1.4, player.vy - 0.34);
    player.glideT = 6;
    if (time % 14 === 0) SFX.glide();
  } else if (player.glideT > 0) {
    player.glideT--;
  }
  if (!player.onGround && input.down && attackPressed && !c.glide) {
    player.vy = 12;
  }

  if (attackPressed && player.attackCd <= 0) {
    player.attackT = 12;
    player.attackCd = c.atkCool;
    SFX.kick();
    if (c.headBreak) {
      var frontC = player.facing > 0 ? Math.floor((player.x + player.w + 2) / TILE) : Math.floor((player.x - 3) / TILE);
      var rowA = Math.floor((player.y + 4) / TILE);
      var rowB = Math.floor((player.y + player.h - 4) / TILE);
      breakBrick(frontC, rowA); breakBrick(frontC, rowB);
    }
  }
  if (player.attackT > 0) {
    player.attackT--;
    var ar = attackRect();
    var es = level.enemies;
    for (var i = 0; i < es.length; i++) {
      if (!es[i].dead && aabb(ar, es[i])) killEnemy(es[i], false);
    }
  }
  if (player.attackCd > 0) player.attackCd--;
  if (player.inv > 0) player.inv--;

  player.vy += player.ch.gravity;
  player.vy = Math.min(player.vy, 9);
  player.x += player.vx;
  resolveX(player);
  var wasFalling = player.vy > 0;
  var prevFeet = player.y + player.h;
  player.y += player.vy;
  player.bumpedTile = null;
  resolveY(player, true);
  if (player.bumpedTile && player.bumpedTile.ch === 'B' && c.jumpBreak) {
    breakBrick(player.bumpedTile.c, player.bumpedTile.r);
  }

  if (player.x < 0) { player.x = 0; player.vx = 0; }
  var maxX = level.cols * TILE - player.w;
  if (player.x > maxX) { player.x = maxX; player.vx = 0; }

  updatePlayerTiles();
  if (state !== 'play') { inputPrev.jump = input.jump; inputPrev.attack = input.attack; return; }

  var es = level.enemies;
  for (i = 0; i < es.length; i++) {
    var e = es[i];
    if (e.dead) continue;
    updateEnemy(e);
    if (player.dead) break;
    if (aabb(player, e)) {
      if (player.vy > 0 && (player.y + player.h) - e.y < e.h * 0.6) {
        killEnemy(e, true);
        player.vy = input.jump ? -7.2 : -5.4;
        player.onGround = false;
      } else if (player.inv <= 0 && player.attackT <= 0) {
        doDie();
      }
    }
  }

  if (player.y > ROWS * TILE + 40) doDie();

  var targetCam = player.x + player.w / 2 - VW / 2;
  cam = clamp(targetCam, 0, level.cols * TILE - VW);

  updateParticles();
  inputPrev.jump = input.jump; inputPrev.attack = input.attack;
  tapFlag = false;
}

function updateEnemy(e) {
  e.t++;
  if (e.type === 'crow') {
    e.vx += Math.sign(player.x - e.x) * 0.03;
    e.vx = clamp(e.vx, -1.3, 1.3);
    e.x += e.vx;
    e.y = e.ay + Math.sin(e.t * 0.06) * 14;
    return;
  }
  e.vx = e.dir * e.speed;
  e.vy = Math.min(e.vy + 0.34, 9);
  e.x += e.vx;
  resolveX(e);
  if (e.hitWall) e.dir *= -1;
  e.y += e.vy;
  resolveY(e, true);
}

function consumeTap() { var t = tapFlag; tapFlag = false; return t; }
function menuConfirm() {
  var jumpPressed = input.jump && !inputPrev.jump;
  var attackPressed = input.attack && !inputPrev.attack;
  var t = consumeTap();
  inputPrev.jump = input.jump; inputPrev.attack = input.attack;
  return t || jumpPressed || attackPressed;
}

function step() {
  time++; stateT++;
  if (state === 'title') {
    refreshZones();
    if (menuConfirm()) { state = 'select'; stateT = 0; SFX.select(); }
  } else if (state === 'select') {
    refreshZones();
    if (input.left) selIndex = 0;
    if (input.right) selIndex = 1;
    if (menuConfirm()) {
      chosen = selIndex === 0 ? 'pigeon' : 'bulldog';
      startGame();
      SFX.select();
    }
  } else if (state === 'play') {
    updatePlay();
  } else if (state === 'levelcomplete') {
    updateParticles();
    if (menuConfirm()) {
      if (levelIndex + 1 >= 3) { state = 'win'; stateT = 0; }
      else { startLevel(levelIndex + 1); }
    }
  } else if (state === 'gameover') {
    if (menuConfirm()) { state = 'title'; stateT = 0; }
  } else if (state === 'win') {
    if (menuConfirm()) { state = 'title'; stateT = 0; }
  } else {
    inputPrev.jump = input.jump; inputPrev.attack = input.attack;
  }
  tapFlag = false;
}

function rrect(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }
function txt(s, x, y, size, col, align) {
  ctx.fillStyle = col || '#222';
  ctx.font = 'bold ' + size + 'px monospace';
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
  ctx.textAlign = 'left';
}

var canvas = null, ctx = null;

function drawSprite(cx, bottomY, facing, rects, opts) {
  opts = opts || {};
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(bottomY));
  ctx.scale(facing < 0 ? -1 : 1, 1);
  var i, rr;
  if (opts.blink && (time % 8) < 4) { ctx.restore(); return; }
  for (i = 0; i < rects.length; i++) {
    rr = rects[i];
    if (opts.wingUp && rr[5] === 'wing') rrect(rr[0], rr[1] - 3, rr[2], rr[3], rr[4]);
    else rrect(rr[0], rr[1], rr[2], rr[3], rr[4]);
  }
  ctx.restore();
}

var PIGEON_RECTS = [
  [-4, -2, 2, 2, '#f7b500'],
  [2, -2, 2, 2, '#f7b500'],
  [-6, -11, 12, 9, '#f5f1e6'],
  [-6, -4, 12, 2, '#222222'],
  [-4, -9, 6, 4, '#cfc6b8', 'wing'],
  [0, -16, 7, 7, '#f5f1e6'],
  [0, -16, 7, 2, '#d63031'],
  [6, -13, 3, 2, '#f7a500'],
  [3, -14, 2, 2, '#111111']
];
var PIGEON_GLYDE_RECTS = [
  [-5, -3, 3, 2, '#f7b500'],
  [2, -3, 3, 2, '#f7b500'],
  [-6, -11, 12, 9, '#f5f1e6'],
  [-6, -4, 12, 2, '#222222'],
  [-8, -14, 8, 3, '#cfc6b8'],
  [6, -14, 8, 3, '#cfc6b8'],
  [0, -16, 7, 7, '#f5f1e6'],
  [0, -16, 7, 2, '#d63031'],
  [6, -13, 3, 2, '#f7a500'],
  [3, -14, 2, 2, '#111111']
];
var BULLDOG_RECTS = [
  [-7, -2, 3, 3, '#8a5a33'],
  [-1, -2, 3, 3, '#8a5a33'],
  [-8, -12, 15, 10, '#a9702f'],
  [2, -14, 8, 10, '#a9702f'],
  [4, -3, 6, 3, '#8a5a33'],
  [5, -13, 5, 4, '#3a2a1a'],
  [6, -12, 2, 2, '#ffffff'],
  [7, -12, 1, 1, '#000000'],
  [9, -10, 2, 2, '#111111'],
  [3, -16, 2, 3, '#6b4420'],
  [3, -6, 4, 2, '#d63031']
];
var CAT_RECTS = [
  [-5, -2, 2, 2, '#8a8a8a'],
  [3, -2, 2, 2, '#8a8a8a'],
  [-7, -9, 14, 7, '#9e9e9e'],
  [4, -13, 7, 7, '#9e9e9e'],
  [5, -15, 2, 3, '#9e9e9e'],
  [9, -15, 2, 3, '#9e9e9e'],
  [-10, -12, 3, 2, '#8a8a8a'],
  [8, -11, 2, 2, '#38d960']
];
var RAT_RECTS = [
  [-10, -5, 4, 1, '#c8a582'],
  [-6, -7, 12, 6, '#8d6748'],
  [3, -10, 5, 5, '#8d6748'],
  [-3, -9, 2, 2, '#e0a188'],
  [5, -9, 2, 2, '#111111']
];
var CROW_RECTS = [
  [-7, -9, 13, 7, '#2b2b3a'],
  [4, -13, 6, 6, '#2b2b3a'],
  [9, -11, 4, 2, '#f7a500'],
  [6, -12, 2, 2, '#e74c3c'],
  [-4, -11, 8, 4, '#42425c', 'wing']
];

function drawPlayer() {
  var p = player;
  var cx = p.x + p.w / 2, by = p.y + p.h;
  var opts = { blink: p.inv > 0 && !p.dead, wingUp: (p.ch.glide && !p.onGround) || p.attackT > 6 };
  if (p.dead) {
    ctx.save();
    ctx.translate(cx, by);
    ctx.rotate(p.deadT * 0.2);
    ctx.translate(-cx, -by);
    drawSprite(cx, by, p.facing, p.ch.key === 'pigeon' ? PIGEON_RECTS : BULLDOG_RECTS, {});
    ctx.restore();
    return;
  }
  drawSprite(cx, by, p.facing * (p.ch.key === 'pigeon' ? 1 : 1), p.ch.key === 'pigeon' ? (opts.wingUp ? PIGEON_GLYDE_RECTS : PIGEON_RECTS) : BULLDOG_RECTS, opts);
  if (p.attackT > 2) {
    var ar = attackRect();
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (p.facing > 0) ctx.arc(player.x + player.w + ar.w * 0.25, player.y + player.h / 2, p.atkArcR || ar.w * 0.25, -1.1, 1.1);
    else ctx.arc(player.x - ar.w * 0.25, player.y + player.h / 2, p.atkArcR || ar.w * 0.25, Math.PI - 1.1, Math.PI + 1.1);
    ctx.stroke();
    ctx.restore();
  }
}

function drawTileSpecial(ch, px, py) {
  var th = level.theme, bob = Math.sin(time * 0.1) * 1.5;
  switch (ch) {
    case '*':
      rrect(px + 5, py + 3 + bob, 6, 10, '#ffe066');
      rrect(px + 5, py + 3 + bob, 3, 10, '#ffd23f');
      rrect(px + 5, py + 1 + bob, 6, 3, '#7ac74f');
      break;
    case 'P':
      ctx.save();
      ctx.globalAlpha = 0.9;
      rrect(px + 3, py + 2 + bob, 10, 12, '#fdfbf5');
      rrect(px + 5, py + 4 + bob, 6, 1, '#c8c2b4');
      rrect(px + 5, py + 6 + bob, 6, 1, '#c8c2b4');
      rrect(px + 5, py + 8 + bob, 4, 1, '#c8c2b4');
      rrect(px + 3, py + 2 + bob, 2, 4, '#d63031');
      ctx.restore();
      break;
    case '^':
      rrect(px, py + 12, 16, 4, '#555b6e');
      ctx.fillStyle = '#9aa2ab';
      ctx.beginPath();
      ctx.moveTo(px + 2, py + 12); ctx.lineTo(px + 5, py + 2); ctx.lineTo(px + 8, py + 12);
      ctx.moveTo(px + 8, py + 12); ctx.lineTo(px + 11, py + 2); ctx.lineTo(px + 14, py + 12);
      ctx.fill();
      break;
    case 'S':
      rrect(px + 2, py + 13, 12, 3, '#555b6e');
      ctx.fillStyle = '#8b98a5';
      ctx.fillRect(px + 4, py + 9, 8, 2);
      ctx.fillRect(px + 3, py + 6, 10, 2);
      ctx.fillRect(px + 4, py + 3, 8, 2);
      rrect(px + 2, py + 1, 12, 3, '#d63031');
      break;
    case 'G':
      rrect(px + 1, py + 4, 3, 12, '#8a5a33');
      rrect(px + 12, py + 4, 3, 12, '#8a5a33');
      rrect(px + 1, py + 2, 14, 3, '#a9702f');
      ctx.fillStyle = (time % 40 < 20) ? '#ffcf3f' : '#ffd76b';
      ctx.beginPath();
      ctx.arc(px + 8, py + 10, 6, 0, Math.PI * 2);
      ctx.fill();
      rrect(px + 8, py + 4, 1, 12, '#8a5a33');
      break;
    case 'A':
      rrect(px + 7, py - 8, 2, 24, '#6b7a8a');
      rrect(px + 9, py - 8, 6, 5, (time % 30 < 15) ? '#7ec8ff' : '#48a9d8');
      break;
  }
}

function render() {
  var i, x, y, ch, px, py;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.scale, 0, 0, view.scale, view.offX, view.offY);
  var clipX = (0 - view.offX) / view.scale, clipW = canvas.width / view.scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VW, VH);
  ctx.clip();

  var theme = THEMES[0];
  if (level) theme = level.theme;

  var grad = ctx.createLinearGradient(0, 0, 0, VH);
  grad.addColorStop(0, theme.skyTop);
  grad.addColorStop(1, theme.skyBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VW, VH);

  if (state === 'title' || state === 'select' || state === 'win') {
    renderMenuScene(theme);
    ctx.restore();
    return;
  }

  var par = cam * 0.4;
  ctx.fillStyle = theme.hillA;
  for (i = -1; i < 6; i++) {
    var hx = i * 140 - (par % 140) - 60;
    ctx.beginPath();
    ctx.arc(hx + 70, VH - 30, 70, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = theme.hillB;
  for (i = -1; i < 7; i++) {
    var hx2 = i * 110 - ((par * 1.5) % 110) - 80;
    ctx.beginPath();
    ctx.arc(hx2 + 55, VH - 30, 55, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = theme.cloud;
  for (i = 0; level && i < level.clouds.length; i++) {
    var cl = level.clouds[i];
    var cxp = ((cl.x - cam * 0.25) % (level.cols * TILE));
    if (cxp < -80) cxp += level.cols * TILE;
    if (cxp > VW + 80) continue;
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(cxp, cl.y, 10 * cl.s, 0, Math.PI * 2);
    ctx.arc(cxp + 12 * cl.s, cl.y + 3, 8 * cl.s, 0, Math.PI * 2);
    ctx.arc(cxp - 12 * cl.s, cl.y + 3, 8 * cl.s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(-Math.round(cam), 0);

  var c1 = Math.max(0, Math.floor(cam / TILE) - 1);
  var c2 = Math.min(level.cols - 1, Math.floor((cam + VW) / TILE) + 1);
  for (x = c1; x <= c2; x++) {
    for (y = 0; y < ROWS; y++) {
      ch = level.tiles[y][x];
      if (ch === ' ') continue;
      px = x * TILE; py = y * TILE;
      if (ch === '#') {
        rrect(px, py, TILE, TILE, theme.dirt);
        if (y === GROUND_Y && level.tiles[y - 1][x] !== '#') {
          rrect(px, py, TILE, 4, theme.grass);
          rrect(px, py + 4, TILE, 1, theme.grassDark);
        }
        if ((x * 7 + y * 13) % 5 === 0) rrect(px + 4, py + 8, 3, 3, theme.dirtDot);
      } else if (ch === 'B') {
        rrect(px, py, TILE, TILE, theme.brick);
        rrect(px, py, TILE, 1, theme.brickDark);
        rrect(px + 7, py + 1, 1, 7, theme.brickDark);
        rrect(px, py + 8, TILE, 1, theme.brickDark);
        rrect(px + 3, py + 9, 1, 7, theme.brickDark);
        rrect(px + 11, py + 9, 1, 7, theme.brickDark);
      } else if (ch === '=') {
        rrect(px, py, TILE, 5, theme.plankTop);
        rrect(px, py + 5, TILE, 3, theme.plank);
      } else {
        drawTileSpecial(ch, px, py);
      }
    }
  }

  var es = level.enemies;
  for (i = 0; i < es.length; i++) {
    var e = es[i];
    if (e.dead) continue;
    var rects = e.type === 'cat' ? CAT_RECTS : e.type === 'rat' ? RAT_RECTS : CROW_RECTS;
    drawSprite(e.x + e.w / 2, e.y + e.h, e.type === 'crow' ? (e.vx < 0 ? -1 : 1) : e.dir, rects, { wingUp: e.type === 'crow' && (e.t % 20 < 10) });
  }

  drawPlayer();

  for (i = 0; i < particles.length; i++) {
    var pr = particles[i];
    ctx.globalAlpha = clamp(pr.life / 20, 0, 1);
    rrect(pr.x - 1.5, pr.y - 1.5, 3, 3, pr.color);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  renderHUD();
  renderTouch();
  renderStateOverlays();
  ctx.restore();
}

function heart(x, y, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, 3, 3);
  ctx.fillRect(x + 4, y, 3, 3);
  ctx.fillRect(x + 1, y + 2, 5, 3);
  ctx.fillRect(x + 2, y + 4, 3, 2);
}

function renderHUD() {
  ctx.save();
  ctx.globalAlpha = 0.85;
  rrect(4, 4, 200, 22, 'rgba(0,0,0,0.35)');
  ctx.globalAlpha = 1;
  txt(String(score).padStart(6, '0'), 12, 15, 12, '#ffffff', 'left');
  for (var i = 0; i < 3; i++) {
    heart(80 + i * 12, 9, i < lives ? '#ff5b5b' : 'rgba(255,255,255,0.3)');
  }
  var picon = chosen === 'pigeon' ? '#f5f1e6' : '#a9702f';
  rrect(126, 8, 10, 8, picon);
  txt('LV' + (levelIndex + 1), 140, 15, 11, '#ffe066', 'left');
  txt('PAGES ' + String(pagesGot) + '/' + String(pagesTotal), 400, 15, 12, '#fdfbf5', 'left');
  ctx.restore();
}

function renderTouch() {
  if (state !== 'play') return;
  ctx.save();
  ctx.globalAlpha = 0.28;
  for (var i = 0; i < ZONE_DEFS.length; i++) {
    var z = ZONE_DEFS[i];
    ctx.beginPath();
    ctx.arc(z.cx, z.cy, z.r, 0, Math.PI * 2);
    ctx.fillStyle = zones[z.id] ? '#ffffff' : '#000000';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.globalAlpha = 0.7;
  txt('<', 38, 248, 22, '#ffffff');
  txt('>', 108, 248, 22, '#ffffff');
  txt('A', 476, 234, 20, '#ffffff');
  txt('K', 414, 260, 18, '#ffffff');
  ctx.restore();
}

function renderStateOverlays() {
  if (state === 'levelcomplete') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, VW, VH);
    txt('LEVEL ' + (levelIndex + 1) + ' COMPLETE!', VW / 2, 90, 24, '#ffe066');
    txt('Pages found: ' + pagesGot + ' / ' + pagesTotal, VW / 2, 130, 14, '#ffffff');
    txt('Score: ' + score, VW / 2, 155, 14, '#ffffff');
    if ((time % 50) < 30) txt('TAP OR PRESS A', VW / 2, 210, 15, '#7ec8ff');
  } else if (state === 'gameover') {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, VW, VH);
    txt('GAME OVER', VW / 2, 110, 28, '#ff5b5b');
    txt('Score: ' + score, VW / 2, 150, 14, '#ffffff');
    if ((time % 50) < 30) txt('TAP TO TRY AGAIN', VW / 2, 200, 15, '#ffffff');
  }
}

function renderMenuScene(theme) {
  var th = level ? level.theme : THEMES[0];
  var grad = ctx.createLinearGradient(0, 0, 0, VH);
  grad.addColorStop(0, th.skyTop);
  grad.addColorStop(1, th.skyBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = th.hillA;
  ctx.beginPath(); ctx.arc(110, VH - 30, 80, Math.PI, 0); ctx.fill();
  ctx.beginPath(); ctx.arc(400, VH - 20, 60, Math.PI, 0); ctx.fill();

  if (state === 'title') {
    drawSprite(140, 150, 1, time % 80 < 40 ? PIGEON_GLYDE_RECTS : PIGEON_RECTS, { wingUp: true });
    drawSprite(370, 150, -1, BULLDOG_RECTS, {});
    txt('KUNG FU PIGEON', VW / 2, 55, 30, '#ffffff');
    txt('&', VW / 2, 80, 16, '#ffe066');
    txt('THE BULLDOG', VW / 2, 102, 26, '#ffffff');
    txt('A STORYBOOK ADVENTURE', VW / 2, 135, 12, '#fdfbf5');
    if ((time % 50) < 30) txt('TAP OR PRESS ENTER', VW / 2, 200, 16, '#ffe066');
    txt('WASD / ARROWS to move - X to attack - Z or SPACE to jump', VW / 2, 258, 10, 'rgba(255,255,255,0.8)');
  } else if (state === 'select') {
    txt('CHOOSE YOUR HERO', VW / 2, 45, 20, '#ffffff');
    var keys = ['pigeon', 'bulldog'];
    for (var i = 0; i < 2; i++) {
      var sel = selIndex === i;
      var bx = 70 + i * 210, by = 70, bw = 162, bh = 140;
      rrect(bx, by, bw, bh, sel ? 'rgba(255,224,102,0.25)' : 'rgba(0,0,0,0.3)');
      ctx.strokeStyle = sel ? '#ffe066' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = sel ? 3 : 1;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.save();
      ctx.translate(bx + bw / 2, by + 95);
      ctx.scale(2.2, 2.2);
      ctx.translate(-(bx + bw / 2), -(by + 95));
      if (i === 0) drawSprite(bx + bw / 2, by + 95, 1, time % 60 < 30 ? PIGEON_GLYDE_RECTS : PIGEON_RECTS, { wingUp: true });
      else drawSprite(bx + bw / 2, by + 95, 1, BULLDOG_RECTS, {});
      ctx.restore();
      txt(CHARACTERS[keys[i]].name, bx + bw / 2, by + 112, 11, sel ? '#ffe066' : '#ffffff');
    }
    var ck = CHARACTERS[keys[selIndex]];
    txt(ck.blurb, VW / 2, 232, 11, '#fdfbf5');
    if ((time % 50) < 30) txt('TAP A CARD OR PRESS A', VW / 2, 258, 13, '#7ec8ff');
  } else if (state === 'win') {
    txt('THE END', VW / 2, 90, 32, '#ffe066');
    txt('...or is it?', VW / 2, 120, 14, '#ffffff');
    txt('Story pages recovered: ' + grandPages + ' / ' + grandLevelPages + ' x3', VW / 2, 160, 13, '#fdfbf5');
    txt('Final score: ' + score, VW / 2, 185, 14, '#ffffff');
    txt('Thanks for playing. Look for the next book!', VW / 2, 215, 12, '#7ec8ff');
    if ((time % 50) < 30) txt('TAP TO RETURN', VW / 2, 250, 13, '#ffffff');
  }
}

var rafHandle = null;
function frame(now) {
  var last = frame.last || now;
  var dt = Math.min(100, now - last);
  frame.last = now;
  frame.acc = (frame.acc || 0) + dt;
  while (frame.acc >= 16.666) {
    step();
    frame.acc -= 16.666;
  }
  render();
  rafHandle = requestAnimationFrame(frame);
}

function resize() {
  var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  view.dpr = dpr;
  if (typeof document === 'undefined' || !document.body) return;
  var w = window.innerWidth, h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  view.scale = Math.min(canvas.width / VW, canvas.height / VH);
  view.offX = (canvas.width - VW * view.scale) / 2;
  view.offY = (canvas.height - VH * view.scale) / 2;
}

function init() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  resize();

  document.addEventListener('keydown', function (e) {
    if (pressKey(e.code, true)) { if (e.preventDefault) e.preventDefault(); }
    if (e.code === 'Enter') tapFlag = true;
  });
  document.addEventListener('keyup', function (e) { pressKey(e.code, false); });
  canvas.addEventListener('pointerdown', function (e) {
    ensureAudio();
    var l = pointerToLogical(e.clientX, e.clientY);
    if (state !== 'play') { tapFlag = true; }
    pointers[e.pointerId] = l;
    if (e.preventDefault) e.preventDefault();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (pointers[e.pointerId] !== undefined) {
      pointers[e.pointerId] = pointerToLogical(e.clientX, e.clientY);
    }
  });
  function up(e) { delete pointers[e.pointerId]; }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  document.addEventListener('touchstart', function (e) { if (e.preventDefault) e.preventDefault(); }, { passive: false });
  window.addEventListener('resize', resize);

  requestAnimationFrame(frame);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.__kfp = {
    get state() { return state; },
    get player() { return player; },
    get level() { return level; },
    get score() { return score; },
    get lives() { return lives; },
    step: step,
    startLevel: startLevel,
    startGame: startGame,
    generateLevel: generateLevel,
    input: input,
    zones: zones,
    pressKey: pressKey
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
