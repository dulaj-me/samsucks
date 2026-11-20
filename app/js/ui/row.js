// Horizontal, virtualized row. A card fixed at the left anchor shows the focused item: it
// never moves. A move swaps the card's content while the track slides one slot under it,
// so no poster is ever seen travelling through the ring. Left of the ring, a second card
// shows the edge of the previous item, swapped the same way.
import { h, setText, setTransform, toggleClass } from '../util/dom.js';
import { createTile, fillTile, focusGeometry, KINDS } from './tile.js';
import { Card } from './card.js';
import { isFast } from '../input.js';

const LEFT = 96;
const TILES_TOP = 64;  // below the row's top; the heading's 40px line sits above
const CAPTION_H = 81;  // caption block plus the drop of the focused one
const BELOW = 76;      // so a wide row pitches 464 and a poster row 500 (DESIGN.md)
// Tiles right of the focused one sit this much further right, clear of its lift, and the
// previous item's edge this much further left. A row without focus closes both gaps, so
// its tiles line up under its heading.
const AFTER = 16;
const BEHIND = 1;      // tiles kept left of focus, hidden, so a move left has one to bring in
// How far the item entering or leaving the card travels on its own. Under the ring's
// clearance to the next slot (23 px for search-wide), so it never shows inside the ring.
const SHORT = 16;
const IDLE_MS = 300;   // past --t-focus: an unfocused row's cards stop painting once faded

export class Row {
  constructor({ title, kind = 'poster', items = [], caption = false, onFocus, onSelect }) {
    this.kind = kind;
    this.size = KINDS[kind];
    this.step = this.size.w + this.size.gap;
    this.items = items;
    this.index = 0;
    this.active = false;
    this.onFocus = onFocus;
    this.onSelect = onSelect;

    const geo = focusGeometry(this.size);
    this.el = h('section', 'row idle');
    // A tile at or left of focus waits here, one slot right less SHORT, hidden. Moving with
    // the track on the same curve, its net travel on a move is SHORT alone.
    this.el.style.setProperty('--gone-x', (this.step - SHORT) + 'px');
    this.titleEl = h('h2', 'row-title', this.el);
    setText(this.titleEl, title || '');
    const top = title ? TILES_TOP : -geo.ring.y;

    // Starts at the lifted tile's left edge: the track shows nothing left of the anchor.
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

    // The previous item's right edge sits AFTER plus a gap left of the anchor, mirroring the
    // next item's clearance on the right.
    this.peek = new Card(this.el, kind, LEFT - AFTER - this.size.gap - this.size.w, top, { lifted: false });
    this.card = new Card(this.el, kind, LEFT, top, { caption });

    this.height = top + this.size.h + (caption ? CAPTION_H : 0) + BELOW;

    const visible = Math.ceil((1920 - LEFT) / this.step);
    this.poolSize = visible + BEHIND + 2;
    this.pool = [];
    for (let i = 0; i < this.poolSize; i++) {
      const tile = createTile(kind, { caption });
      tile.index = -1;
      // The slot places the tile; the tile's own transform is free for the short move.
      tile.slot = h('div', 'row-slot', this.track);
      tile.slot.appendChild(tile.el);
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
    this.showCards();
  }

  setTitle(title) {
    setText(this.titleEl, title);
  }

  current() {
    return this.items[this.index];
  }

  // The cards stand in for the focused tile and the previous one only while the row has
  // focus. Tiles animate only after the first move (.live), so taking focus is in place.
  setActive(on) {
    if (on === this.active) return;
    this.active = on;
    toggleClass(this.el, 'live', false);
    toggleClass(this.el, 'active', on);
    clearTimeout(this.idleTimer);
    if (on) {
      toggleClass(this.el, 'idle', false);
      this.showCards();
    } else {
      this.idleTimer = setTimeout(() => toggleClass(this.el, 'idle', true), IDLE_MS);
    }
    this.slide();
  }

  showCards() {
    if (!this.active) return;
    this.card.show(this.current());
    this.peek.show(this.items[this.index - 1]);
  }

  slide() {
    setTransform(this.track, 'translateX(' + (-this.index * this.step - (this.active ? 0 : AFTER)) + 'px)');
  }

  focusIndex(i) {
    if (!this.items.length) return;
    this.index = Math.max(0, Math.min(this.items.length - 1, i));
    this.render();
    this.showCards();
    if (this.onFocus) this.onFocus(this.current(), this);
  }

  // Returns false at the edges so the parent can decide what to do.
  move(dx) {
    const next = this.index + dx;
    if (next < 0 || next >= this.items.length) return false;
    this.index = next;
    toggleClass(this.el, 'live', true);
    this.render();
    if (this.active) {
      const fast = isFast();
      this.card.swap(this.current(), -dx, 0, fast);
      this.peek.swap(this.items[this.index - 1], -dx, 0, fast);
    }
    if (this.onFocus) this.onFocus(this.current(), this);
    return true;
  }

  select() {
    if (this.onSelect && this.current()) this.onSelect(this.current(), this);
  }

  render() {
    const first = Math.max(0, this.index - BEHIND);
    const last = Math.min(this.items.length, first + this.poolSize);
    for (let i = first; i < last; i++) {
      const tile = this.pool[i % this.poolSize];
      // A recycled tile takes its state without transitions.
      toggleClass(tile.slot, 'fresh', tile.index !== i);
      if (tile.index !== i) {
        tile.index = i;
        setTransform(tile.slot, 'translateX(' + i * this.step + 'px)');
        tile.slot.style.visibility = '';
      }
      fillTile(tile, this.items[i]);
      toggleClass(tile.el, 'gone', i <= this.index);
      toggleClass(tile.slot, 'under', i <= this.index);
    }
    // Slots not covering any item this frame.
    for (const tile of this.pool) {
      if (tile.index < first || tile.index >= last) {
        tile.index = -1;
        tile.slot.style.visibility = 'hidden';
      }
    }
    this.slide();
  }
}
