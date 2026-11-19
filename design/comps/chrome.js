// Shared Evening chrome for the comps: icons, nav line, ambience, focus lift.
import { h } from './data.js';

const S = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const icon = {
  search: S('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20"/>'),
  gear: S('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8l1.6 2.4 2.8-.7.7 2.8 2.4 1.6-1.2 2.6 1.2 2.6-2.4 1.6-.7 2.8-2.8-.7L12 21.2l-1.6-2.4-2.8.7-.7-2.8-2.4-1.6L5.7 12 4.5 9.4l2.4-1.6.7-2.8 2.8.7z"/>'),
  play: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 4.6v14.8a1 1 0 0 0 1.5.86l12.3-7.4a1 1 0 0 0 0-1.72L8.5 3.74A1 1 0 0 0 7 4.6z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect fill="currentColor" x="5.5" y="4" width="4.6" height="16" rx="1.4"/><rect fill="currentColor" x="13.9" y="4" width="4.6" height="16" rx="1.4"/></svg>',
  restart: S('<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"/>'),
  back10: S('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.2h4.2"/><text x="12.2" y="15.6" font-size="7.4" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">10</text>'),
  fwd10: S('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v4.2h-4.2"/><text x="11.8" y="15.6" font-size="7.4" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">10</text>'),
  next: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 5.6v12.8a1 1 0 0 0 1.5.86l9.8-6.4a1 1 0 0 0 0-1.72L6.5 4.74A1 1 0 0 0 5 5.6z"/><rect fill="currentColor" x="17" y="5" width="2.6" height="14" rx="1.2"/></svg>',
  audio: S('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  subs: S('<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M6.5 15h4M13 15h4.5M6.5 11.5h7M15.5 11.5h2"/>'),
  check: S('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="2.8"'),
  circle: S('<circle cx="12" cy="12" r="8"/>'),
  plus: S('<path d="M12 5v14M5 12h14"/>'),
  down: S('<path d="M6 9.5l6 6 6-6"/>', 'stroke-width="2.6"'),
  info: S('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.2"/>'),
  minus: S('<path d="M5 12h14"/>'),
  lock: S('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  del: S('<path d="M9 5h10.5a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6-7z"/><path d="M12 9.5l5 5M17 9.5l-5 5"/>'),
  space: S('<path d="M4 10v4h16v-4"/>'),
  user: S('<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.4-3.8 4.2-5.5 7.5-5.5s6.1 1.7 7.5 5.5"/>'),
  server: S('<rect x="3.5" y="4" width="17" height="7" rx="2"/><rect x="3.5" y="13" width="17" height="7" rx="2"/><path d="M7 7.5h.1M7 16.5h.1"/>'),
  sliders: S('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/>'),
  wrench: S('<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3z"/><path d="M14.5 6.5L17 4l3 3-2.5 2.5"/>'),
  heart: S('<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>'),
  exit: S('<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 16l4-4-4-4M14 12H4"/>'),
  film: S('<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M3.5 9.5h17M3.5 14.5h17M8 5v14M16 5v14"/>'),
  swap: S('<path d="M7 7h11l-3-3M17 17H6l3 3"/>'),
};

export const MARK = '<svg viewBox="0 0 34 34"><rect x="2" y="5" width="30" height="21" rx="6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M11 31h12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="17" cy="15.5" r="3.5" fill="currentColor"/></svg>';

// current: 'home' or a library title. focus: index into the entries, or -1.
export function nav(sections, current = 'home', focus = null) {
  const top = h('div', 'top', document.body);
  h('div', 'brand', top).innerHTML = MARK + 'kinescope';
  const n = h('div', 'nav', top);
  const entries = [{ id: 'home', label: 'Home' }].concat(sections.map(s => ({ id: s.title, label: s.title })));
  entries.forEach(e => h('div', 'ni' + (e.id === current ? ' on' : '') + (focus === e.id ? ' focus' : ''), n, e.label));
  const ic = h('div', 'icons', top);
  h('div', 'ni icon' + (focus === 'search' ? ' focus' : ''), ic).innerHTML = icon.search;
  h('div', 'ni icon' + (focus === 'settings' ? ' focus' : ''), ic).innerHTML = icon.gear;
  h('div', 'avatar' + (focus === 'avatar' ? ' focus' : ''), top, 'A');
  return top;
}

// The app's 2x2 WebGL ambience, painted here on a 2D canvas the same way.
const DIM = 0.42, GRAY = 0.3;
export function ambience(canvas, u) {
  const c = canvas.getContext('2d');
  const img = c.createImageData(2, 2);
  const px = u ? [u.topLeft, u.topRight, u.bottomLeft, u.bottomRight] : ['1b1f2b', '0f1118', '1d1416', '0b0d12'];
  px.forEach((hex, i) => {
    const n = parseInt(hex, 16);
    const rgb = [n >> 16 & 255, n >> 8 & 255, n & 255];
    const avg = (rgb[0] + rgb[1] + rgb[2]) / 3;
    img.data.set(rgb.map(v => (v + (avg - v) * GRAY) * DIM).concat(255), i * 4);
  });
  c.putImageData(img, 0, 0);
}

export function backdrop() {
  const amb = h('canvas', '', document.body);
  amb.id = 'amb'; amb.width = 2; amb.height = 2;
  const art = h('img', 'art', document.body);
  h('div', 'topveil', document.body);
  return { amb, art };
}

// Lift and ring around a tile of w x h whose top-left is (x, y) in parent.
export function lift(parent, x, y, w, hgt, S = 1.07) {
  const W = w * S, H = hgt * S, lx = x - (W - w) / 2, ly = y - (H - hgt) / 2;
  h('div', 'lift', parent).style.cssText = `left:${lx}px;top:${ly}px;width:${W}px;height:${H}px;border-radius:${14 * S}px`;
  h('div', 'ring', parent).style.cssText = `left:${lx - 8}px;top:${ly - 8}px;width:${W + 16}px;height:${H + 16}px;border-radius:${14 * S + 8}px`;
}
