// The nav line on every top-level screen: brand, Home, one entry per library, search,
// settings and the server name. The entries sit on a track that slides inside a fixed
// clip, so any number of libraries fits. The owning screen forwards keys while the nav
// has focus and takes Down back itself.
import { h, setText, setTransform, toggleClass } from '../util/dom.js';
import { session } from '../session.js';
import * as icons from './icons.js';
import { goHome, openLibrary, openSearch, openSettings } from '../nav.js';

const PAD = 80; // wider than the 64px edge fade in base.css

// Home fetches the libraries; a nav built later (a library's) starts from the last list.
let known = [];

export class TopNav {
  // current: 'home', or the key of the library the owning screen shows.
  constructor(parent, current) {
    this.current = current;
    this.el = h('header', 'topbar', parent);
    const brand = h('div', 'brand', this.el);
    h('img', 'brand-mark', brand).src = 'img/mascot.png';
    const brandText = h('div', 'brand-text', brand);
    h('img', 'brand-wordmark', brandText).src = 'img/wordmark.png';
    this.clip = h('nav', 'nav', this.el);
    this.track = h('div', 'nav-track', this.clip);
    setText(h('div', 'topbar-who', this.el), session.server ? session.server.name : '');
    this.items = [];
    this.index = 0;
    this.scroll = 0;
    this.active = false;
    this.setSections(known);
    // Inter swaps in after first paint and changes the label widths.
    if (document.fonts) document.fonts.ready.then(() => this.render());
  }

  setSections(sections) {
    known = sections;
    this.track.innerHTML = '';
    this.items = [{ label: 'Home', id: 'home' }]
      .concat(sections.map(s => ({ label: s.title, id: s.key, section: s })))
      .concat([{ label: 'Search', id: 'search', icon: icons.search }, { label: 'Settings', id: 'settings', icon: icons.gear }]);
    this.items.forEach((n, i) => {
      if (n.icon && !this.items[i - 1].icon) h('i', 'nav-sep', this.track);
      n.el = h('div', 'nav-item' + (n.icon ? ' nav-icon' : ''), this.track);
      if (n.icon) n.el.innerHTML = n.icon;
      else h('span', '', n.el).textContent = n.label;
      toggleClass(n.el, 'current', n.id === this.current);
    });
    this.index = Math.min(this.index, this.items.length - 1);
    this.render();
  }

  currentIndex() {
    return Math.max(0, this.items.findIndex(n => n.id === this.current));
  }

  // Entering the nav focuses the current entry.
  setActive(on) {
    if (on && !this.active) this.index = this.currentIndex();
    this.active = on;
    this.render();
  }

  // Slide the track just enough to keep the focused entry (the current one while the
  // nav isn't focused) clear of the edge fades.
  scrollIntoView() {
    const room = this.clip.clientWidth;
    if (!room) return; // hidden screen: nothing to measure
    const max = Math.max(0, this.track.offsetWidth - room);
    const n = this.items[this.active ? this.index : this.currentIndex()];
    if (n) {
      const left = n.el.offsetLeft;
      const right = left + n.el.offsetWidth;
      if (left - PAD < this.scroll) this.scroll = left - PAD;
      else if (right + PAD > this.scroll + room) this.scroll = right + PAD - room;
    }
    this.scroll = Math.round(Math.max(0, Math.min(max, this.scroll)));
    setTransform(this.track, 'translateX(' + (-this.scroll) + 'px)');
    toggleClass(this.clip, 'more-left', this.scroll > 0);
    toggleClass(this.clip, 'more-right', this.scroll < max - 1);
  }

  // Also call from the screen's onShow: widths can't be measured while it was hidden.
  render() {
    this.scrollIntoView(); // measure before the class writes below dirty the style
    this.items.forEach((n, i) => toggleClass(n.el, 'focus', this.active && i === this.index));
  }

  // Left, Right and OK. Returns false for anything else, Down included.
  onKey(action) {
    if (action === 'left' || action === 'right') {
      this.index = Math.max(0, Math.min(this.items.length - 1, this.index + (action === 'right' ? 1 : -1)));
      this.render();
      return true;
    }
    if (action === 'enter') {
      this.activate(this.items[this.index]);
      return true;
    }
    return false;
  }

  activate(n) {
    if (!n || n.id === this.current) return;
    if (n.id === 'search') { openSearch(); return; }
    if (n.id === 'settings') { openSettings(); return; }
    // Switching top-level screens: when this one shows again, focus is on its own entry.
    this.index = this.currentIndex();
    this.render();
    if (n.id === 'home') goHome();
    else openLibrary(n.section);
  }
}
