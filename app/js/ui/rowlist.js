// A vertical stack of Rows. The active row sits at the top of the list and the track
// slides by whole rows, so moving between rows is one compositor-only transform.
// Rows above the active one are hidden, like rows past `ahead` below it.
// A row is anything with el, height and setActive(on); Row is the usual one.
import { h, setTransform, toggleClass } from '../util/dom.js';

export class RowList {
  // ahead: how many rows below the active one stay visible. Detail keeps one, because a
  // second would land on the bottom edge with its heading half on screen.
  constructor({ ahead = Infinity } = {}) {
    this.el = h('div', 'rowlist');
    this.track = h('div', 'rows-track', this.el);
    this.rows = [];
    this.offsets = [];
    this.height = 0;
    this.index = 0;
    this.active = false;
    this.ahead = ahead;
  }

  // Replaces the stack. Focus stays on the same row if it is still there.
  setRows(rows) {
    const keep = this.rows[this.index];
    for (const r of this.rows) if (!rows.includes(r)) r.el.remove();
    for (const r of rows) if (r.el.parentNode !== this.track) this.track.appendChild(r.el);
    this.rows = rows;
    const i = rows.indexOf(keep);
    this.index = i >= 0 ? i : Math.max(0, Math.min(this.index, rows.length - 1));
    let y = 0;
    this.offsets = rows.map(r => {
      const at = y;
      setTransform(r.el, 'translateY(' + y + 'px)');
      y += r.height;
      return at;
    });
    this.height = y;
    this.render();
  }

  current() {
    return this.rows[this.index];
  }

  setActive(on) {
    this.active = on;
    this.render();
  }

  // Returns false at the ends so the screen can decide what to do.
  move(dy) {
    const next = this.index + dy;
    if (next < 0 || next >= this.rows.length) return false;
    this.index = next;
    this.render();
    return true;
  }

  focus(i) {
    this.index = Math.max(0, Math.min(this.rows.length - 1, i));
    this.render();
  }

  render() {
    this.rows.forEach((r, i) => {
      r.setActive(this.active && i === this.index);
      toggleClass(r.el, 'current', i === this.index);
      toggleClass(r.el, 'above', i < this.index || i > this.index + this.ahead);
    });
    setTransform(this.track, 'translateY(' + (-(this.offsets[this.index] || 0)) + 'px)');
  }
}
