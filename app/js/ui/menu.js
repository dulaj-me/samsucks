// Side sheet of actions for the focused item, or of choices for a filter. Modal: while
// it's open the owning screen forwards every key to onKey().
// It moves like rows and the grid: the highlight is its own layer, and one key press moves
// either the highlight or the list, never both. On a long list the highlight travels to the
// middle slot, stays there while the list slides, and travels again near the end.
import { h, setText, setTransform, toggleClass } from '../util/dom.js';
import * as icons from './icons.js';

// Options are one fixed height, so every position comes from the index: no layout reads.
const PITCH = 78;    // 72px option + 6px gap
const CLIP = 818;    // from below the sub-line to y 1026
const SLOTS = Math.floor((CLIP + PITCH - 72) / PITCH);
const MIDDLE = Math.floor((SLOTS - 1) / 2);

export class Menu {
  constructor(parent) {
    this.scrim = h('div', 'menu-scrim', parent);
    this.el = h('div', 'menu', parent);
    this.titleEl = h('div', 'menu-title', this.el);
    this.subEl = h('div', 'menu-sub', this.el);
    this.list = h('div', 'menu-list', this.el);
    this.list.style.height = CLIP + 'px';
    this.hl = h('div', 'menu-hl', this.list);
    this.track = h('div', 'menu-track', this.list);
    this.items = [];
    this.index = 0;
    this.isOpen = false;
  }

  // items: [{ label, icon?, current?, run }]. A list where items set `current` is a
  // choice: the current one is checked and has focus when the menu opens.
  open({ title, sub, items }) {
    setText(this.titleEl, title);
    setText(this.subEl, sub);
    this.track.innerHTML = '';
    const choice = items.some(it => it.current != null);
    this.items = items.map(it => {
      const el = h('div', 'menu-opt', this.track);
      if (!choice && it.icon) el.innerHTML = it.icon;
      h('span', '', el).textContent = it.label;
      if (it.current) h('i', 'menu-tick', el).innerHTML = icons.check;
      return Object.assign({ el }, it);
    });
    this.index = Math.max(0, items.findIndex(it => it.current));
    this.isOpen = true;
    // Open on the current choice in place, instead of sliding there from the last list.
    toggleClass(this.list, 'now', true);
    this.render();
    this.list.getBoundingClientRect();
    toggleClass(this.list, 'now', false);
    toggleClass(this.scrim, 'open', true);
    toggleClass(this.el, 'open', true);
  }

  close() {
    this.isOpen = false;
    toggleClass(this.scrim, 'open', false);
    toggleClass(this.el, 'open', false);
  }

  render() {
    const max = Math.max(0, this.items.length - SLOTS);
    const scroll = Math.max(0, Math.min(max, this.index - MIDDLE));
    setTransform(this.track, 'translateY(' + (-scroll * PITCH) + 'px)');
    setTransform(this.hl, 'translateY(' + (this.index - scroll) * PITCH + 'px)');
    // The list fades at an edge only while more of it lies beyond.
    toggleClass(this.list, 'more-top', scroll > 0);
    toggleClass(this.list, 'more-bottom', scroll < max);
    this.items.forEach((it, i) => toggleClass(it.el, 'focus', i === this.index));
  }

  onKey(action) {
    if (action === 'up' || action === 'down') {
      const next = this.index + (action === 'down' ? 1 : -1);
      if (next >= 0 && next < this.items.length) { this.index = next; this.render(); }
    } else if (action === 'enter') {
      const it = this.items[this.index];
      this.close();
      if (it) it.run();
    } else if (action === 'back') {
      this.close();
    }
    return true;
  }
}
