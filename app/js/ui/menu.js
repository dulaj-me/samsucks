// Side sheet of actions for the focused item, or of choices for a filter. Modal: while
// it's open the owning screen forwards every key to onKey().
// The highlight is a white card riding in the list's track, over the options. On a single
// press it clips a few pooled dark labels that counter-move with it, so they sit exactly over
// the list's own: only the fill travels. While a key is held it carries one dark label, the
// focused option's, rewritten per press, which reads better at speed. At rest both look alike.
// One key press moves either the highlight or the list, never both. On a long list the
// highlight travels to the middle slot, stays there while the list slides, and travels
// again near the end.
import { h, setText, setTransform, toggleClass, show } from '../util/dom.js';
import { isFast } from '../input.js';
import * as icons from './icons.js';

// Options are one fixed height, so every position comes from the index: no layout reads.
const PITCH = 78;    // 72px option + 6px gap
const CLIP = 818;    // from below the sub-line to y 1026
const SLOTS = Math.floor((CLIP + PITCH - 72) / PITCH);
const MIDDLE = Math.floor((SLOTS - 1) / 2);
// Dark labels pooled around focus: ±2 still covers a fill retargeted midway by a quick tap.
const REACH = 2;
const WINDOW = REACH * 2 + 1;
// Outlasts the fade out (--t-focus). A timer, since an action that pushes a screen hides the
// sheet before its fade starts, and then no transition event ever comes.
const IDLE_MS = 250;

export class Menu {
  constructor(parent) {
    this.scrim = h('div', 'menu-scrim', parent);
    this.el = h('div', 'menu', parent);
    this.titleEl = h('div', 'menu-title', this.el);
    this.subEl = h('div', 'menu-sub', this.el);
    this.list = h('div', 'menu-list', this.el);
    this.list.style.height = CLIP + 'px';
    this.track = h('div', 'menu-track', this.list);
    this.hl = h('div', 'menu-hl');
    // A .menu-track, so it shares the highlight's transition, held-key speed and .now.
    this.hlTrack = h('div', 'menu-track', this.hl);
    this.win = [];
    for (let i = 0; i < WINDOW; i++) {
      const el = h('div', 'menu-opt menu-win', this.hlTrack);
      const label = h('span', '', el);
      const tick = h('i', 'menu-tick', el);
      tick.innerHTML = icons.check;
      this.win.push({ el, label, tick, svg: null, icon: '', k: null });
    }
    this.one = h('div', 'menu-opt menu-one', this.hlTrack);
    this.held = false;
    this.shown = 0;
    this.items = [];
    this.index = 0;
    this.isOpen = false;
    // Out of the layer tree while closed: hidden once the fade out ends.
    this.idleTimer = 0;
    this.idle(true);
  }

  idle(on) {
    toggleClass(this.scrim, 'idle', on);
    toggleClass(this.el, 'idle', on);
  }

  // items: [{ label, icon?, current?, run }]. A list where items set `current` is a
  // choice: the current one is checked and has focus when the menu opens.
  // { heading } starts a section; it takes a row but never focus.
  open({ title, sub, items }) {
    setText(this.titleEl, title);
    setText(this.subEl, sub);
    this.track.innerHTML = '';
    const choice = items.some(it => it.current != null);
    this.items = items.map(it => {
      if (it.heading) {
        const el = h('div', 'menu-opt menu-head', this.track);
        el.textContent = it.heading;
        return { el, heading: true };
      }
      const el = h('div', 'menu-opt', this.track);
      if (!choice && it.icon) el.innerHTML = it.icon;
      h('span', '', el).textContent = it.label;
      if (it.current) h('i', 'menu-tick', el).innerHTML = icons.check;
      // icon: what the row shows, so a pooled label copies the same.
      return Object.assign({ el }, it, { icon: !choice && it.icon ? it.icon : '' });
    });
    this.win.forEach(w => { w.k = null; });
    this.track.appendChild(this.hl);
    const current = items.findIndex(it => it.current);
    this.index = current >= 0 ? current : Math.max(0, items.findIndex(it => !it.heading));
    this.isOpen = true;
    clearTimeout(this.idleTimer);
    // Shown before the layout below, which then starts the slide in from the closed state.
    this.idle(false);
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
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.idle(true), IDLE_MS);
  }

  render() {
    const max = Math.max(0, this.items.length - SLOTS);
    const scroll = Math.max(0, Math.min(max, this.index - MIDDLE));
    const held = isFast();
    if (held !== this.held) this.setHeld(held);
    setTransform(this.track, 'translateY(' + (-scroll * PITCH) + 'px)');
    setTransform(this.hl, 'translateY(' + this.index * PITCH + 'px)');
    if (held) {
      const it = this.items[this.index];
      this.one.innerHTML = it ? it.el.innerHTML : '';
    } else {
      // Set together with the highlight, on one transition, from offsets that cancel: the
      // labels stay on the list's through every frame, even when a tap retargets a slide.
      setTransform(this.hlTrack, 'translateY(' + (-this.index * PITCH) + 'px)');
      this.place(this.index);
    }
    this.shown = this.index;
    // The list fades at an edge only while more of it lies beyond.
    toggleClass(this.list, 'more-top', scroll > 0);
    toggleClass(this.list, 'more-bottom', scroll < max);
  }

  // Labels for index ± REACH, each at its row. A press re-targets only the one that enters.
  place(index) {
    for (let k = index - REACH; k <= index + REACH; k++) {
      const w = this.win[((k % WINDOW) + WINDOW) % WINDOW];
      if (w.k === k) continue;
      w.k = k;
      const it = this.items[k];
      show(w.el, !!it && !it.heading);
      if (!it || it.heading) continue;
      setText(w.label, it.label);
      show(w.tick, !!it.current);
      if (w.icon !== it.icon) {
        if (w.svg) w.el.removeChild(w.svg);
        w.svg = it.icon ? it.el.firstChild.cloneNode(true) : null;
        if (w.svg) w.el.insertBefore(w.svg, w.label);
        w.icon = it.icon;
      }
      setTransform(w.el, 'translateY(' + k * PITCH + 'px)');
    }
  }

  // Held: one label at the fill's origin, carried by it; the pool hides. Back to presses: the
  // pool is laid at the last focus before the new press moves it, so the swap shows nothing.
  setHeld(on) {
    this.held = on;
    if (on) {
      toggleClass(this.hl, 'held', true);
      setTransform(this.hlTrack, 'translateY(0)');
      return;
    }
    setTransform(this.hlTrack, 'translateY(' + (-this.shown * PITCH) + 'px)');
    this.place(this.shown);
    // Commits that offset untransitioned, so the press's slide starts from it.
    getComputedStyle(this.hlTrack).transform;
    toggleClass(this.hl, 'held', false);
  }

  onKey(action) {
    if (action === 'up' || action === 'down') {
      const dir = action === 'down' ? 1 : -1;
      let next = this.index + dir;
      while (this.items[next] && this.items[next].heading) next += dir;
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
