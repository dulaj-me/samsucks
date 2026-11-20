// On-screen keyboard for the d-pad: a fixed grid of fixed-size keys. Moving focus only
// swaps a class on two keys, so a press lays nothing out.
import { h, setText, toggleClass } from '../util/dom.js';
import * as icons from './icons.js';

const COLS = 6;
const LAYOUT = [
  'abcdef', 'ghijkl', 'mnopqr', 'stuvwx', 'yz1234', '567890',
  [{ id: 'space', icon: icons.space, span: 2 }, { id: 'delete', icon: icons.del, span: 2 }, { id: 'clear', label: 'Clear', span: 2 }],
];

export class Keyboard {
  // onPress(id): a character, or 'space', 'delete', 'clear'.
  constructor(parent, onPress) {
    this.el = h('div', 'keyboard', parent);
    this.onPress = onPress;
    // cells[r][c] is the key covering that slot; a wide key fills several.
    this.cells = LAYOUT.map(row => {
      const keys = typeof row === 'string' ? row.split('').map(id => ({ id, label: id, span: 1 })) : row;
      const cells = [];
      for (const k of keys) {
        const key = { id: k.id, el: h('div', k.span > 1 ? 'key key-wide' : 'key', this.el) };
        if (k.icon) key.el.innerHTML = k.icon;
        else setText(key.el, k.label);
        if (k.span > 1) key.el.style.gridColumn = 'span ' + k.span;
        for (let i = 0; i < k.span; i++) cells.push(key);
      }
      return cells;
    });
    this.r = 0;
    this.c = 0;
    this.active = false;
  }

  current() {
    return this.cells[this.r][this.c];
  }

  setActive(on) {
    this.active = on;
    toggleClass(this.current().el, 'focus', on);
  }

  // Returns false at the edges so the screen can move to another zone. Up and down keep
  // the column, so passing over a wide key comes back down where it went up.
  move(dx, dy) {
    const from = this.current();
    let r = this.r + dy;
    let c = this.c;
    if (dx) {
      while (c >= 0 && c < COLS && this.cells[r][c] === from) c += dx;
    }
    if (r < 0 || r >= this.cells.length || c < 0 || c >= COLS) return false;
    toggleClass(from.el, 'focus', false);
    this.r = r;
    this.c = c;
    toggleClass(this.current().el, 'focus', this.active);
    return true;
  }

  press() {
    this.onPress(this.current().id);
  }
}
