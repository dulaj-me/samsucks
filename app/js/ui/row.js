// Horizontal, virtualized row. A card fixed at the left anchor shows the focused item: it
// never moves. A move swaps the card's content with a short nudge while the track slides
// one slot under it, so no poster is ever seen travelling through the ring.
import { h, setText, setTransform, toggleClass, swapIn } from '../util/dom.js';
import { createTile, fillTile, createFocusBox, focusGeometry, KINDS } from './tile.js';
import { isFast } from '../input.js';

const LEFT = 96;
const TILES_TOP = 64;  // below the row's top; the heading's 40px line sits above
const CAPTION_H = 81;  // caption block plus the drop of the focused one
const BELOW = 76;      // so a wide row pitches 464 and a poster row 500 (DESIGN.md)
// Tiles right of the focused one sit this much further right, clear of its lift. A row
// without focus closes the gap, so its tiles line up under its heading.
const AFTER = 16;
const BEHIND = 1;      // tiles kept left of focus, hidden by the clip, so a move left slides one in
// How far the item entering or leaving the card travels on its own. Under the ring's
// clearance to the next slot (23 px for search-wide), so it never shows inside the ring.
const SHORT = 16;
const NUDGE = 12;      // the card's new content slides this far into place

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
    this.el = h('section', 'row');
    this.el.style.setProperty('--cap-shift', geo.caption + 'px');
    // A tile at or left of focus waits here, one slot right less SHORT, hidden. Moving with
    // the track on the same curve, its net travel on a move is SHORT alone.
    this.el.style.setProperty('--gone-x', (this.step - SHORT) + 'px');
    this.titleEl = h('h2', 'row-title', this.el);
    setText(this.titleEl, title || '');
    const top = title ? TILES_TOP : -geo.ring.y;

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

    this.card = h('div', 'row-card', this.el);
    createFocusBox(this.card, this.size, LEFT, top);
    this.cardTile = createTile(kind, { caption });
    this.cardTile.el.style.left = LEFT + 'px';
    this.cardTile.el.style.top = top + 'px';
    this.card.appendChild(this.cardTile.el);

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
  }

  setTitle(title) {
    setText(this.titleEl, title);
  }

  current() {
    return this.items[this.index];
  }

  // The card stands in for the focused tile only while the row has focus. Tiles animate only
  // after the first move (.live), so taking focus swaps tile for card in place.
  setActive(on) {
    if (on !== this.active) toggleClass(this.el, 'live', false);
    this.active = on;
    toggleClass(this.el, 'active', on);
    if (on) fillTile(this.cardTile, this.current() || null);
    this.slide();
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
    toggleClass(this.el, 'live', true);
    this.render();
    if (this.active) swapIn(this.cardTile.el, dx * NUDGE, 0, isFast());
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
      if (tile.index !== i) {
        tile.index = i;
        setTransform(tile.slot, 'translateX(' + i * this.step + 'px)');
        tile.slot.style.visibility = '';
      }
      fillTile(tile, this.items[i]);
      toggleClass(tile.el, 'gone', i <= this.index);
    }
    // Slots not covering any item this frame.
    for (const tile of this.pool) {
      if (tile.index < first || tile.index >= last) {
        tile.index = -1;
        tile.slot.style.visibility = 'hidden';
      }
    }
    if (this.active) fillTile(this.cardTile, this.current() || null);
    this.slide();
  }
}
