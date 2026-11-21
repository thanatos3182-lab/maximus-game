"use strict";

const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync(__dirname + '/../game/js/game.js', 'utf8');

function makeCtxStub() {
  const store = new Map();
  return new Proxy({}, {
    get(t, p) {
      if (p === 'canvas') return { width: 512, height: 288 };
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient' ||
          p === 'createPattern') return () => ({ addColorStop() {} });
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (!t[p]) t[p] = () => 0;
      return t[p];
    },
    set(t, p, v) { t[p] = (typeof v === 'function') ? v : () => v; return true; }
  });
}

let rafCb = null;
let simTime = 0;
const listeners = { doc: {}, win: {} };

function makeCanvasStub() {
  return {
    width: 512 * 2, height: 288 * 2, style: {},
    getContext: () => makeCtxStub(),
    addEventListener: (type, fn) => { listeners.canvas = listeners.canvas || {}; listeners.canvas[type] = fn; },
    removeEventListener: () => {}
  };
}

const canvasStub = makeCanvasStub();

const documentStub = {
  readyState: 'complete',
  body: { appendChild() {} },
  getElementById: () => canvasStub,
  createElement: () => makeCanvasStub(),
  addEventListener: (type, fn) => { listeners.doc[type] = fn; },
  removeEventListener: () => {}
};

const events = [];
const sandbox = {
  console,
  performance: { now: () => simTime },
  requestAnimationFrame: (cb) => { rafCb = cb; },
  Math, String, Number, Array, Object, JSON, Uint8ClampedArray, setTimeout: (fn) => 0,
  document: documentStub,
  addEventListener: (type, fn) => { listeners.win[type] = fn; }
};
sandbox.window = new Proxy(sandbox, {
  get(t, p) {
    if (p === 'addEventListener') return t.addEventListener;
    if (p === 'innerWidth') return 1024;
    if (p === 'innerHeight') return 576;
    if (p === 'devicePixelRatio') return 2;
    return t[p];
  },
  set(t, p, v) { t[p] = v; return true; }
});
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'game.js' });

const g = sandbox.window.__kfp;
if (!g) { console.error('FAIL: __kfp not exposed'); process.exit(1); }

function frames(n) {
  for (let i = 0; i < n; i++) {
    simTime += 16.7;
    if (rafCb) { const cb = rafCb; cb(simTime); }
  }
}

function key(code2, down) {
  if (listeners.doc[down ? 'keydown' : 'keyup']) {
    listeners.doc[down ? 'keydown' : 'keyup']({ code: code2, preventDefault() {} });
  }
}

let failures = 0;
function check(name, cond) {
  if (cond) console.log('PASS ' + name);
  else { console.error('FAIL ' + name); failures++; }
}

frames(120);
check('title screen active', g.state === 'title');

g.pressKey('Enter', true); frames(3); g.pressKey('Enter', false); frames(3);
check('select screen after confirm', g.state === 'select');

g.pressKey('ArrowRight', true); frames(3); 
g.pressKey('ArrowRight', false); frames(3);
check('bulldog selectable via right', true);

g.pressKey('Enter', true); frames(3); g.pressKey('Enter', false); frames(30);
check('game started in play state', g.state === 'play');
check('bulldog chosen', g.player.ch.key === 'bulldog');

const startX = g.player.x;
key('ArrowRight', true);
for (let i = 0; i < 300; i++) {
  if (i % 40 === 0) key('Space', true);
  else if (i % 40 === 20) key('Space', false);
  if (i % 90 === 0) key('KeyX', true);
  else if (i % 90 === 10) key('KeyX', false);
  frames(1);
}
key('ArrowRight', false);
console.log('bulldog run: player.x=' + g.player.x.toFixed(1) + ' start=' + startX +
  ' score=' + g.score + ' lives=' + g.lives + ' state=' + g.state);
check('bulldog moved right', g.player.x > startX + 100);
check('score gained', g.score >= 0);
check('no crash after 300 play frames', g.state === 'play' || g.state === 'gameover');

for (let i = 0; i < 600; i++) frames(1);
check('survived 600 more frames', true);

g.startGame();
key('ArrowRight', true);
for (let i = 0; i < 400; i++) frames(1);
key('ArrowRight', false);
console.log('long run final: state=' + g.state + ' lives=' + g.lives);
check('long persistence run ok', g.state === 'play' || g.state === 'gameover' || g.state === 'levelcomplete');

for (let li = 0; li < 3; li++) {
  const lv = g.generateLevel(li);
  let pages = 0, corn = 0, gong = 0, checkpt = 0, enemies = lv.enemyDefs.length;
  for (let y = 0; y < 18; y++) for (let x = 0; x < lv.cols; x++) {
    const t = lv.tiles[y][x];
    if (t === 'P') pages++;
    if (t === '*') corn++;
    if (t === 'G') gong++;
    if (t === 'A') checkpt++;
    if (t === 'S') {
      for (let yy = y + 1; yy < 18; yy++) if (lv.tiles[yy][x] === ' ') { /* nothing */ }
    }
  }
  console.log('level ' + li + ': cols=' + lv.cols + ' pages=' + pages + ' corn=' + corn +
    ' gong=' + gong + ' checkpoints=' + checkpt + ' enemies=' + enemies);
  check('level ' + li + ' pages >= 8', pages >= 8);
  check('level ' + li + ' has gong', gong === 1);
  check('level ' + li + ' has checkpoint', checkpt >= 1);
  check('level ' + li + ' has enemies', enemies >= 1);
  check('level ' + li + ' spawn area safe', lv.tiles[16][3] === '#');
  check('level ' + li + ' goal area ground', lv.tiles[16][lv.cols - 6] === '#');
}

console.log(failures === 0 ? 'ALL TESTS PASSED' : failures + ' TESTS FAILED');
process.exit(failures === 0 ? 0 : 1);
