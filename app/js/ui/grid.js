// Vertical, virtualized poster grid for whole libraries.
// Each row is its own compositor layer, so scrolling only re-rasterizes the one
// row that gets recycled with new posters. The focused row always sits in the top
// slot under a card that carries the ring and the focused item. Up and Down slide the
// track under the still card and swap its content; Left and Right move the card.
// One thing moves per key press.
import { h, setTransform, toggleClass } from '../util/dom.js';
import { createTile, fillTile, KINDS } from './tile.js';
import { Card } from './card.js';
import { isFast } from '../input.js';

const LEFT = 96;
// Clear space between the clip's top and the first row's posters, so the lifted
// tile and its ring are never cut (DESIGN.md, Headroom Rule). At most rowGap minus the
// 74px caption block, or the row above's sub-line shows at the clip's top edge.
const HEAD = 36;
// How far the poster entering or leaving the card travels on its own: under the 20 px
// between the card's caption block and the poster below it.
const SHORT = 16;

export class Grid {
  constructor({ cols = 7, kind = 'grid', rowGap = 112, top = 0, height = 1080, getItem, total = 0, onFocus, onSelect, onNeed }) {
    this.cols = cols;
    this.size = KINDS[kind];
    this.stepX = this.size.w + this.size.gap;
    this.stepY = this.size.h + rowGap;
    this.getItem = getItem;
    this.total = total;
    this.onFocus = onFocus;
    this.onSelect = onSelect;
    this.onNeed = onNeed;
    this.index = 0;
    this.scrollRow = 0;
    // Starts with focus, as the screens that own a grid open on it.
    this.active = true;

    this.el = h('div', 'grid active');
    this.el.style.top = top + 'px';
    this.el.style.height = height + 'px';
    // A poster at or above focus in its column waits one row lower less SHORT, hidden, so
    // riding the track's curve its net travel on Up or Down is SHORT alone.
    this.el.style.setProperty('--gone-y', (this.stepY - SHORT) + 'px');
    this.track = h('div', 'grid-track', this.el);
    this.track.style.left = LEFT + 'px';
    this.track.style.top = HEAD + 'px';
    this.card = new Card(this.el, kind, LEFT, HEAD, { caption: true });

    this.visibleRows = Math.ceil(height / this.stepY) + 1;
    this.poolRows = this.visibleRows + 2;
    this.rows = [];
    for (let r = 0; r < this.poolRows; r++) {
      const rowEl = h('div', 'grid-row', this.track);
      const tiles = [];
      for (let c = 0; c < cols; c++) {
        const tile = createTile(kind, { caption: true });
        const slot = h('div', 'grid-slot', rowEl);
        setTransform(slot, 'translateX(' + c * this.stepX + 'px)');
        slot.appendChild(tile.el);
        tiles.push(tile);
      }
      this.rows.push({ el: rowEl, tiles, row: -1 });
    }
    this.render();
  }

  get rowCount() {
    return Math.ceil(this.total / this.cols);
  }

  setTotal(total) {
    this.total = total;
    this.refresh();
  }

  current() {
    return this.getItem(this.index);
  }

  // The card shows only while the grid has focus. Taking focus swaps tile for card in place.
  setActive(on) {
    if (on === this.active) return;
    this.active = on;
    this.setMode('');
    toggleClass(this.el, 'active', on);
    if (on) this.card.show(this.current());
  }

  // Which transitions the tiles get: the last move's axis, or none while focus comes or goes.
  setMode(mode) {
    toggleClass(this.el, 'vmove', mode === 'v');
    toggleClass(this.el, 'hmove', mode === 'h');
  }

  // Data for some rows arrived: re-fill whatever is on screen.
  refresh() {
    for (const r of this.rows) r.row = -1;
    this.render();
    if (this.active) this.card.show(this.current());
  }

  move(dx, dy) {
    const col = this.index % this.cols;
    let next = this.index;
    if (dx) {
      if (col + dx < 0 || col + dx >= this.cols) return false;
      next += dx;
    }
    if (dy) next += dy * this.cols;
    if (next < 0) return false;
    if (next >= this.total) {
      // Moving down into a short last row lands on its last item.
      if (dy > 0 && Math.floor(next / this.cols) < this.rowCount) next = this.total - 1;
      else return false;
    }
    if (next === this.index) return false;
    this.setMode(dy ? 'v' : 'h');
    this.index = next;
    this.render();
    if (this.active) {
      if (dy) this.card.swap(this.current(), 0, -dy, isFast());
      else this.card.handOver(this.current(), isFast());
    }
    if (this.onFocus) this.onFocus(this.current(), this.index);
    return true;
  }

  focusIndex(i) {
    this.index = Math.max(0, Math.min(this.total - 1, i));
    this.render();
    if (this.active) this.card.show(this.current());
    if (this.onFocus) this.onFocus(this.current(), this.index);
  }

  select() {
    const item = this.current();
    if (item && this.onSelect) this.onSelect(item, this.index);
  }

  render() {
    const focusRow = Math.floor(this.index / this.cols);
    const focusCol = this.index % this.cols;
    this.scrollRow = focusRow;
    const firstRow = Math.max(0, this.scrollRow - 1);
    const lastRow = Math.min(this.rowCount, firstRow + this.poolRows);

    for (let r = firstRow; r < lastRow; r++) {
      const slot = this.rows[r % this.poolRows];
      // A recycled row takes its tiles' state without transitions.
      toggleClass(slot.el, 'fresh', slot.row !== r);
      if (slot.row !== r) {
        slot.row = r;
        slot.el.style.visibility = '';
        setTransform(slot.el, 'translateY(' + r * this.stepY + 'px)');
        for (let c = 0; c < this.cols; c++) {
          const i = r * this.cols + c;
          const tile = slot.tiles[c];
          if (i < this.total) {
            tile.el.style.visibility = '';
            fillTile(tile, this.getItem(i) || null);
          } else {
            tile.el.style.visibility = 'hidden';
          }
        }
      }
      for (let c = 0; c < this.cols; c++) toggleClass(slot.tiles[c].el, 'gone', c === focusCol && r <= focusRow);
    }
    for (const slot of this.rows) {
      if (slot.row < firstRow || slot.row >= lastRow) {
        slot.row = -1;
        slot.el.style.visibility = 'hidden';
      }
    }
    if (this.onNeed) this.onNeed(firstRow * this.cols, lastRow * this.cols + this.cols * 4);

    setTransform(this.track, 'translateY(' + (-this.scrollRow * this.stepY) + 'px)');
    setTransform(this.card.el, 'translateX(' + focusCol * this.stepX + 'px)');
  }
}
