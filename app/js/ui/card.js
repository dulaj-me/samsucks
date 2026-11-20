// One item at a fixed spot, swapped in place. It holds two faces: on a swap the old one
// slides a few px the way the list travels and fades, uncovering the new one sliding in
// under it from the other side. Each face's frame stays put and its content slides inside
// it, so the frame's rounded corners clip the motion and never travel themselves.
// Rows and the grid put a lifted, ringed card over their focus; a row also keeps an
// unlifted one for the previous item's edge at its left.
import { h, toggleClass } from '../util/dom.js';
import { createTile, fillTile, createFocusBox, focusGeometry, KINDS, LIFT } from './tile.js';

const CAP_H = 64;    // the caption block: a 23px line, 5px, a 22px line at 1.2
const HOLD = 0.25;   // the old face stays solid this far into a swap, so its slide reads
const ZERO = 'translate(0, 0)';
const LIFTED = 'scale(' + LIFT + ')';

let timing = null;
function swapTiming() {
  if (!timing) {
    const css = getComputedStyle(document.documentElement);
    timing = {
      duration: parseFloat(css.getPropertyValue('--t-swap')) || 180,
      ease: css.getPropertyValue('--ease').trim() || 'ease-out',
    };
  }
  return timing;
}

export class Card {
  // x, y: the tile's top-left at rest, in the parent's coordinates.
  constructor(parent, kind, x, y, { caption = false, lifted = true } = {}) {
    const size = KINDS[kind];
    const g = focusGeometry(size);
    // How far content travels on a swap: a tenth of the tile's width.
    this.travel = Math.round(size.w / 10);
    this.drop = lifted ? g.caption : 0;
    // A focus card with no item yet (a page still loading) shows the empty well, not a hole.
    this.lifted = lifted;
    this.el = h('div', 'card' + (lifted ? ' card-lifted' : ''), parent);
    if (lifted) createFocusBox(this.el, size, x, y);

    const art = h('div', 'card-art', this.el);
    art.style.left = x + 'px';
    art.style.top = y + 'px';
    let cap = null;
    if (caption) {
      cap = h('div', 'card-cap', this.el);
      place(cap, x, y + size.h + 16 + (lifted ? g.caption : 0), size.w, CAP_H);
    }
    this.faces = [0, 1].map(() => {
      const t = createTile(kind, { caption });
      t.el.classList.add('card-face');
      art.appendChild(t.el);
      t.frame = t.img.parentNode;
      t.inner = h('div', 'card-inner');
      while (t.frame.firstChild) t.inner.appendChild(t.frame.firstChild);
      t.frame.appendChild(t.inner);
      t.text = null;
      if (cap) {
        t.text = t.cap.parentNode;
        t.text.classList.add('card-face');
        cap.appendChild(t.text);
      }
      t.anims = [];
      return t;
    });
    this.cur = 0;
  }

  // In place, no motion. Showing what is already there leaves a running swap alone, so a
  // refresh landing mid-swap doesn't snap it.
  show(item) {
    const face = this.faces[this.cur];
    if (face.item === (item || null)) return;
    stop(face);
    fillTile(face, item || null);
    setShown(face, !!item || this.lifted);
  }

  // dx, dy: the direction the content travels, -1, 0 or 1 on each axis.
  swap(item, dx, dy, instant) {
    const x = dx * this.travel;
    const y = dy * this.travel;
    const from = 'translate(' + -x + 'px, ' + -y + 'px)';
    const to = 'translate(' + x + 'px, ' + y + 'px)';
    // The old art fades over the new, which stays solid so no background shows between
    // them. Captions hand over instead, as overlapping lines of text read as a smudge.
    this.flip(item, instant, face => [
      [face.inner, [{ transform: ZERO, opacity: 1 }, { opacity: 1, offset: HOLD }, { transform: to, opacity: 0 }]],
      [face.text, [{ transform: ZERO, opacity: 1 }, { opacity: 0, offset: 0.4 }, { transform: to, opacity: 0 }]],
    ], (face, covered) => [
      [face.inner, covered
        ? [{ transform: from, opacity: 1 }, { transform: ZERO, opacity: 1 }]
        : [{ transform: from, opacity: 0 }, { opacity: 1, offset: 0.6 }, { transform: ZERO, opacity: 1 }]],
      [face.text, [{ transform: from, opacity: 0 }, { opacity: 0, offset: 0.35 }, { transform: ZERO, opacity: 1 }]],
    ]);
  }

  // For a card that itself travels to the new item: the old content settles to rest size and
  // fades as it leaves, and the new one lifts in as it lands on the matching poster.
  handOver(item, instant) {
    const rest = 'scale(1)';
    const up = 'translateY(' + -this.drop + 'px)';
    this.flip(item, instant, face => [
      [face.frame, [{ transform: LIFTED }, { transform: rest, offset: 0.4 }, { transform: rest }]],
      [face.inner, [{ opacity: 1 }, { opacity: 0, offset: 0.4 }, { opacity: 0 }]],
      [face.text, [{ transform: ZERO, opacity: 1 }, { transform: up, opacity: 0, offset: 0.4 }, { transform: up, opacity: 0 }]],
    ], face => [
      [face.frame, [{ transform: rest }, { transform: rest, offset: 0.6 }, { transform: LIFTED }]],
      [face.inner, [{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }]],
      [face.text, [{ transform: up, opacity: 0 }, { transform: up, opacity: 0, offset: 0.6 }, { transform: ZERO, opacity: 1 }]],
    ]);
  }

  // Shows item on the other face. outAnims and inAnims list [element, keyframes] for a face;
  // inAnims learns whether the old face covers the new one as it starts.
  flip(item, instant, outAnims, inAnims) {
    const out = this.faces[this.cur];
    if (out.item === (item || null)) return;
    this.cur ^= 1;
    const inn = this.faces[this.cur];
    stop(out);
    stop(inn);
    fillTile(inn, item || null);
    const had = out.el.classList.contains('shown');
    setShown(out, false);
    setShown(inn, !!item || this.lifted);
    if (instant || !inn.el.animate) return;
    const { duration, ease } = swapTiming();
    const run = (face, list) => {
      face.anims = list.filter(([el]) => el).map(([el, frames]) => {
        frames[0].easing = ease;
        return el.animate(frames, { duration });
      });
    };
    if (had) run(out, outAnims(out));
    if (item || this.lifted) run(inn, inAnims(inn, had));
  }
}

function place(el, x, y, w, hgt) {
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.width = w + 'px';
  el.style.height = hgt + 'px';
}

function stop(face) {
  face.anims.forEach(a => a.cancel());
  face.anims = [];
}

function setShown(face, on) {
  toggleClass(face.el, 'shown', on);
  if (face.text) toggleClass(face.text, 'shown', on);
}
