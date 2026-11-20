// The nav line on every top-level screen: brand, Home, one entry per library, then search,
// settings and a fixed slot at the right. Home and the libraries sit on a track that slides
// inside a fixed clip, so any number of libraries fits. The owning screen forwards keys
// while the nav has focus and takes Down back itself.
// The slot is the profile entry when the Plex Home has 2+ users, else the server name.
import { h, setTransform, toggleClass } from '../util/dom.js';
import { session, hasProfiles, onUsersChange } from '../session.js';
import * as icons from './icons.js';
import { avatar } from './avatar.js';
import { goHome, openLibrary, openSearch, openSettings, openProfiles } from '../nav.js';

const PAD = 80; // wider than the 64px edge fade in base.css
const AVATAR = 52;

// Found through the DOM so a destroyed screen's nav is never kept alive.
onUsersChange(() => {
  document.querySelectorAll('.topbar').forEach(el => { if (el._nav) el._nav.updateProfile(); });
});

// Home fetches the libraries; a nav built later (a library's) starts from the last list.
let known = [];

export class TopNav {
  // current: 'home', or the key of the library the owning screen shows.
  constructor(parent, current) {
    this.current = current;
    this.el = h('header', 'topbar', parent);
    const brand = h('div', 'brand', this.el);
    brand.innerHTML = icons.mark;
    h('span', '', brand).textContent = 'kinescope';
    this.clip = h('nav', 'nav', this.el);
    this.track = h('div', 'nav-track', this.clip);
    this.icons = h('div', 'nav-icons', this.el);
    this.who = h('div', '', this.el);
    this.el._nav = this;
    this.items = [];
    this.index = 0;
    this.scroll = 0;
    this.active = false;
    this.fillProfile();
    this.setSections(known);
    // The font swaps in after first paint and changes the label widths.
    if (document.fonts) document.fonts.ready.then(() => this.render());
  }

  setSections(sections) {
    const onEntry = this.onEntry();
    known = sections;
    this.track.innerHTML = '';
    this.icons.innerHTML = '';
    this.items = [{ label: 'Home', id: 'home' }]
      .concat(sections.map(s => ({ label: s.title, id: s.key, section: s })))
      .concat([{ label: 'Search', id: 'search', icon: icons.search }, { label: 'Settings', id: 'settings', icon: icons.gear }]);
    this.items.forEach(n => {
      n.el = h('div', 'nav-item' + (n.icon ? ' nav-icon' : ''), n.icon ? this.icons : this.track);
      if (n.icon) n.el.innerHTML = n.icon;
      else h('span', '', n.el).textContent = n.label;
      toggleClass(n.el, 'current', n.id === this.current);
    });
    this.index = onEntry ? this.items.length : Math.min(this.index, this.items.length - 1);
    this.render();
  }

  // Focus on the profile entry is the index one past the last track entry.
  onEntry() {
    return this.multi && this.index === this.items.length;
  }

  // Returns true when the slot changed.
  fillProfile() {
    const multi = hasProfiles();
    const u = session.user || {};
    const key = multi ? [u.uuid, u.title, u.thumb].join('|') : (session.server ? session.server.name : '');
    if (multi === this.multi && key === this.whoKey) return false;
    if (this.onEntry() && !multi) this.index = this.currentIndex();
    this.multi = multi;
    this.whoKey = key;
    this.who.innerHTML = '';
    this.who.className = multi ? 'profile-entry' : 'topbar-who';
    if (multi) {
      avatar(this.who, u, AVATAR);
    } else {
      this.who.textContent = key;
    }
    return true;
  }

  updateProfile() {
    if (this.fillProfile()) this.render();
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
  // nav isn't focused) clear of the edge fades. Search and settings sit outside the track.
  scrollIntoView() {
    const room = this.clip.clientWidth;
    if (!room) return; // hidden screen: nothing to measure
    const max = Math.max(0, this.track.offsetWidth - room);
    const n = this.items[this.active ? this.index : this.currentIndex()];
    if (n && !n.icon) {
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
    toggleClass(this.who, 'focus', this.active && this.onEntry());
  }

  // Left, Right and OK. Returns false for anything else, Down included.
  onKey(action) {
    if (action === 'left' || action === 'right') {
      const step = action === 'right' ? 1 : -1;
      if (this.multi) {
        // The profile entry sits between the last entry and Home, so focus goes round
        // through it: Left from Home reaches it in one press.
        const slots = this.items.length + 1;
        this.index = (this.index + step + slots) % slots;
      } else {
        this.index = Math.max(0, Math.min(this.items.length - 1, this.index + step));
      }
      this.render();
      return true;
    }
    if (action === 'enter') {
      if (this.onEntry()) openProfiles();
      else this.activate(this.items[this.index]);
      return true;
    }
    return false;
  }

  activate(n) {
    if (!n || n.id === this.current) return;
    if (n.id === 'search') { openSearch(); return; }
    if (n.id === 'settings') { openSettings(); return; }
    // When this screen shows again, focus sits on its own entry, the current one.
    this.index = this.currentIndex();
    this.render();
    if (n.id === 'home') goHome();
    else openLibrary(n.section);
  }
}
