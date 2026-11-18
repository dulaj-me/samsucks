// Side sheet of actions for the focused item. Modal: while it's open the
// owning screen forwards every key to onKey().
import { h, setText, toggleClass } from '../util/dom.js';

export class Menu {
  constructor(parent) {
    this.el = h('div', 'menu', parent);
    this.titleEl = h('div', 'menu-title', this.el);
    this.subEl = h('div', 'menu-sub', this.el);
    this.list = h('div', 'menu-list', this.el);
    this.items = [];
    this.index = 0;
    this.isOpen = false;
  }

  // items: [{ label, icon?, run }]
  open({ title, sub, items }) {
    setText(this.titleEl, title);
    setText(this.subEl, sub);
    this.list.innerHTML = '';
    this.items = items.map(it => {
      const el = h('div', 'menu-opt', this.list);
      if (it.icon) el.innerHTML = it.icon;
      h('span', '', el).textContent = it.label;
      return Object.assign({ el }, it);
    });
    this.index = 0;
    this.isOpen = true;
    this.render();
    toggleClass(this.el, 'open', true);
  }

  close() {
    this.isOpen = false;
    toggleClass(this.el, 'open', false);
  }

  render() {
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
