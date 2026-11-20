// Horizontal, virtualized row. Focus is anchored at the left edge: the track
// slides under a stationary lift and ring, so every move is one compositor-only
// transform and the ring never repaints.
import { h, setText, setTransform, toggleClass } from '../util/dom.js';
import { createTile, fillTile, createFocusBox, focusGeometry, KINDS } from './tile.js';

const LEFT = 96;
const TILES_TOP = 64;  // below the row's top; the heading's 40px line sits above
const CAPTION_H = 81;  // caption block plus the drop of the focused one
const BELOW = 76;      // so a wide row pitches 464 and a poster row 500 (DESIGN.md)
// Tiles right of the focused one sit this much further right, clear of its lift. A row
// without focus closes the gap, so its tiles line up under its heading.
const AFTER = 16;
const BEHIND = 1;      // tiles kept left of focus, hidden by the clip, so a move left slides one in

export class Row {
  constructor({ title, kind = 'poster', items = [], caption = false, onFocus, onSelect }) {
    this.kind = kind;
    this.size = KINDS[kind];
    this.step = this.size.w + this.size.gap;
    this.items = items;
    this.index = 0;
    this.active = false;
    this.focused = null;
    this.onFocus = onFocus;
    this.onSelect = onSelect;

    const geo = focusGeometry(this.size);
    this.el = h('section', 'row');
    this.el.style.setProperty('--cap-shift', geo.caption + 'px');
    this.titleEl = h('h2', 'row-title', this.el);
    setText(this.titleEl, title || '');
    const top = title ? TILES_TOP : -geo.ring.y;
    createFocusBox(this.el, this.size, LEFT, top);

    // Starts at the lifted tile's left edge: whatever is left of the anchor stays out of sight.
    const clip = h('div', 'row-clip', this.el);
    const clipLeft = LEFT + geo.lift.x;
    const clipTop = top + geo.ring.y;
    clip.style.left = clipLeft + 'px';
    clip.style.top = clipTop + 'px';
    clip.style.width = (1920 - clipLeft) + 'px';
    clip.style.height = (geo.ring.h + (caption ? CAPTION_H : 0)) + 'px';
    this.track = h('div', 'row-track', clip);
    this.track.style.left = (LEFT - clipLeft + AFTER) + 'px';
    this.track.style.top = (top - clipTop) + 'px';

    this.height = top + this.size.h + (caption ? CAPTION_H : 0) + BELOW;

    const visible = Math.ceil((1920 - LEFT) / this.step);
    this.poolSize = visible + BEHIND + 2;
    this.pool = [];
    for (let i = 0; i < this.poolSize; i++) {
      const tile = createTile(kind, { caption });
      tile.index = -1;
      this.track.appendChild(tile.el);
      this.pool.push(tile);
    }
    this.render();
  }

  setItems(items, keepKey) {
    this.items = items;
    if (keepKey) {
      const i = items.findIndex(it => it.ratingKey === keepKey);
      this.index = i >= 0 ? i : Math.min(this.index, items.length - 1);
    } else {
      this.index = Math.min(this.index, Math.max(0, items.length - 1));
    }
    for (const t of this.pool) { t.index = -1; t.item = undefined; }
    this.render();
  }

  setTitle(title) {
    setText(this.titleEl, title);
  }

  current() {
    return this.items[this.index];
  }

  setActive(on) {
    this.active = on;
    toggleClass(this.el, 'active', on);
    this.slide();
    this.markFocus();
  }

  slide() {
    setTransform(this.track, 'translateX(' + (-this.index * this.step - (this.active ? 0 : AFTER)) + 'px)');
  }

  focusIndex(i) {
    if (!this.items.length) return;
    this.index = Math.max(0, Math.min(this.items.length - 1, i));
    this.render();
    if (this.onFocus) this.onFocus(this.current(), this);
  }

  // Returns false at the edges so the parent can decide what to do.
  move(dx) {
    const next = this.index + dx;
    if (next < 0 || next >= this.items.length) return false;
    this.index = next;
    this.render();
    if (this.onFocus) this.onFocus(this.current(), this);
    return true;
  }

  select() {
    if (this.onSelect && this.current()) this.onSelect(this.current(), this);
  }

  // The focused tile lifts only while the row has focus.
  markFocus() {
    const tile = this.active ? this.pool.find(t => t.index === this.index) : null;
    if (tile === this.focused) return;
    if (this.focused) toggleClass(this.focused.el, 'focus', false);
    if (tile) toggleClass(tile.el, 'focus', true);
    this.focused = tile || null;
  }

  render() {
    const first = Math.max(0, this.index - BEHIND);
    const last = Math.min(this.items.length, first + this.poolSize);
    for (let i = first; i < last; i++) {
      const tile = this.pool[i % this.poolSize];
      if (tile.index !== i) {
        tile.index = i;
        setTransform(tile.el, 'translateX(' + i * this.step + 'px)');
        tile.el.style.visibility = '';
      }
      fillTile(tile, this.items[i]);
    }
    // Slots not covering any item this frame.
    for (const tile of this.pool) {
      if (tile.index < first || tile.index >= last) {
        tile.index = -1;
        tile.el.style.visibility = 'hidden';
      }
    }
    this.slide();
    this.markFocus();
  }
}
