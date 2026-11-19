// Dev builds only: long-poll the devserver for key presses / snippets to run,
// so the app can be driven and inspected from the Mac.
import { DEV_HOST } from '../config.js';
import { inject } from '../input.js';
import { log, error } from '../util/log.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run(cmd) {
  if (cmd.keys) {
    for (const k of cmd.keys) {
      inject(k);
      await sleep(cmd.gap || 150);
    }
  }
  if (cmd.eval) {
    try {
      let result = (0, eval)(cmd.eval);
      if (result && typeof result.then === 'function') result = await result;
      log('eval →', result);
    } catch (e) {
      error('eval failed', e);
    }
  }
}

export async function startDevRemote() {
  for (;;) {
    try {
      const res = await fetch('http://' + DEV_HOST + '/cmd');
      const cmds = await res.json();
      for (const c of cmds) await run(c);
    } catch (e) {
      await sleep(3000);
    }
  }
}

// Frame stats while fn runs, plus a moment for transitions to settle.
async function measure(fn) {
  const deltas = [];
  let last = performance.now();
  let running = true;
  const tick = now => { deltas.push(now - last); last = now; if (running) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  await fn();
  await sleep(600);
  running = false;
  const total = deltas.reduce((a, b) => a + b, 0);
  deltas.sort((a, b) => a - b);
  return 'fps=' + Math.round(deltas.length * 1000 / total) + ' p50=' + deltas[deltas.length >> 1].toFixed(0) +
    ' p95=' + deltas[Math.floor(deltas.length * 0.95)].toFixed(0) + ' max=' + deltas[deltas.length - 1].toFixed(0);
}

// __bench(['right', ...], gapMs) → frame stats while those keys are replayed.
window.__bench = (keys, gap) => measure(async () => {
  for (const k of keys) { inject(k); await sleep(gap || 200); }
});

// __hold('right', ms) → frame stats while a key is held down. The keydowns go through the
// app's own listener with repeat set, so the held-key path (html.fast, coalescing) runs.
const KEY_CODES = { left: 37, up: 38, right: 39, down: 40 };
function key(type, code, repeat) {
  const e = new KeyboardEvent(type, { bubbles: true, cancelable: true, repeat });
  Object.defineProperty(e, 'keyCode', { get: () => code });
  document.dispatchEvent(e);
}
window.__hold = (action, ms, every) => measure(async () => {
  const code = KEY_CODES[action];
  const end = performance.now() + (ms || 3000);
  key('keydown', code, false);
  while (performance.now() < end) { await sleep(every || 50); key('keydown', code, true); }
  key('keyup', code, false);
});

// __css('selector { ... }') injects a style override for A/B experiments.
window.__css = function (text) {
  let el = document.getElementById('dev-css');
  if (!el) { el = document.createElement('style'); el.id = 'dev-css'; document.head.appendChild(el); }
  el.textContent = text;
  return 'css set';
};
