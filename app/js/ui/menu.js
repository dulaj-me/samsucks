// Side sheet of actions for the focused item, or of choices for a filter. Modal: while
// it's open the owning screen forwards every key to onKey(). A list longer than the
// sheet scrolls by transform inside a fixed clip.
import { h, setText, setTransform, toggleClass } from '../util/dom.js';
import * as icons from './icons.js';

// Keeps unchecked choices aligned with the checked one.
const BLANK = '<svg viewBox="0 0 24 24"></svg>';

export class Menu {
  constructor(parent) {
    this.el = h('div', 'menu', parent);
    this.titleEl = h('div', 'menu-title', this.el);
    this.subEl = h('div', 'menu-sub', this.el);
    this.list = h('div', 'menu-list', this.el);
    this.track = h('div', 'menu-track', this.list);
    this.items = [];
    this.index = 0;
    this.scroll = 0;
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
      const icon = choice ? (it.current ? icons.check : BLANK) : it.icon;
      if (icon) el.innerHTML = icon;
      h('span', '', el).textContent = it.label;
      return Object.assign({ el }, it);
    });
    this.index = Math.max(0, items.findIndex(it => it.current));
    this.scroll = 0;
    this.isOpen = true;
    // Open at the focused choice instead of sliding there from the last list's scroll.
    toggleClass(this.track, 'now', true);
    this.render();
    this.track.getBoundingClientRect();
    toggleClass(this.track, 'now', false);
    toggleClass(this.el, 'open', true);
  }

  close() {
    this.isOpen = false;
    toggleClass(this.el, 'open', false);
  }

  render() {
    this.scrollIntoView(); // measure before the class writes below dirty the style
    this.items.forEach((it, i) => toggleClass(it.el, 'focus', i === this.index));
  }

  // Keep the focused option's neighbors in view, so more of the list always shows.
  scrollIntoView() {
    const room = this.list.clientHeight;
    if (!room || !this.items.length) return;
    const first = (this.items[this.index - 1] || this.items[this.index]).el;
    const last = (this.items[this.index + 1] || this.items[this.index]).el;
    if (first.offsetTop < this.scroll) this.scroll = first.offsetTop;
    else if (last.offsetTop + last.offsetHeight > this.scroll + room) this.scroll = last.offsetTop + last.offsetHeight - room;
    this.scroll = Math.max(0, Math.min(this.track.offsetHeight - room, this.scroll));
    setTransform(this.track, 'translateY(' + (-this.scroll) + 'px)');
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
