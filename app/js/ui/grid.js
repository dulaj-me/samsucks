// Vertical, virtualized poster grid for whole libraries.
// Each row is its own compositor layer, so scrolling only re-rasterizes the one
// row that gets recycled with new posters. The focused row always sits in the top
// slot: Up and Down slide the track under a still ring, Left and Right move the
// ring. One thing moves per key press.
import { h, setTransform, toggleClass } from '../util/dom.js';
import { createTile, fillTile, createFocusBox, focusGeometry, KINDS } from './tile.js';

const LEFT = 96;
// Clear space between the clip's top and the first row's posters, so the lifted
// tile and its ring are never cut (DESIGN.md, Headroom Rule). At most rowGap minus the
// 74px caption block, or the row above's sub-line shows at the clip's top edge.
const HEAD = 36;

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
    this.focused = null;

    this.el = h('div', 'grid');
    this.el.style.top = top + 'px';
    this.el.style.height = height + 'px';
    this.el.style.setProperty('--cap-shift', focusGeometry(this.size).caption + 'px');
    this.ring = createFocusBox(this.el, this.size, LEFT, HEAD);
    toggleClass(this.ring, 'on', true);
    this.track = h('div', 'grid-track', this.el);
    this.track.style.left = LEFT + 'px';
    this.track.style.top = HEAD + 'px';

    this.visibleRows = Math.ceil(height / this.stepY) + 1;
    this.poolRows = this.visibleRows + 2;
    this.rows = [];
    for (let r = 0; r < this.poolRows; r++) {
      const rowEl = h('div', 'grid-row', this.track);
      const tiles = [];
      for (let c = 0; c < cols; c++) {
        const tile = createTile(kind, { caption: true });
        setTransform(tile.el, 'translateX(' + c * this.stepX + 'px)');
        rowEl.appendChild(tile.el);
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

  // The ring and the lift show only while the grid has focus.
  setActive(on) {
    this.active = on;
    toggleClass(this.ring, 'on', on);
    this.markFocus();
  }

  // Data for some rows arrived: re-fill whatever is on screen.
  refresh() {
    for (const r of this.rows) r.row = -1;
    this.render();
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
    this.focusIndex(next);
    return true;
  }

  focusIndex(i) {
    this.index = Math.max(0, Math.min(this.total - 1, i));
    this.render();
    if (this.onFocus) this.onFocus(this.current(), this.index);
  }

  select() {
    const item = this.current();
    if (item && this.onSelect) this.onSelect(item, this.index);
  }

  markFocus() {
    let tile = null;
    if (this.active && this.index < this.total) {
      const slot = this.rows[Math.floor(this.index / this.cols) % this.poolRows];
      if (slot.row === Math.floor(this.index / this.cols)) tile = slot.tiles[this.index % this.cols];
    }
    if (tile === this.focused) return;
    if (this.focused) toggleClass(this.focused.el, 'focus', false);
    if (tile) toggleClass(tile.el, 'focus', true);
    this.focused = tile;
  }

  render() {
    const focusRow = Math.floor(this.index / this.cols);
    this.scrollRow = focusRow;
    const firstRow = Math.max(0, this.scrollRow - 1);
    const lastRow = Math.min(this.rowCount, firstRow + this.poolRows);

    for (let r = firstRow; r < lastRow; r++) {
      const slot = this.rows[r % this.poolRows];
      if (slot.row === r) continue;
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
    for (const slot of this.rows) {
      if (slot.row < firstRow || slot.row >= lastRow) {
        slot.row = -1;
        slot.el.style.visibility = 'hidden';
      }
    }
    if (this.onNeed) this.onNeed(firstRow * this.cols, lastRow * this.cols + this.cols * 4);

    setTransform(this.track, 'translateY(' + (-this.scrollRow * this.stepY) + 'px)');
    setTransform(this.ring, 'translateX(' + (this.index % this.cols) * this.stepX + 'px)');
    this.markFocus();
  }
}
