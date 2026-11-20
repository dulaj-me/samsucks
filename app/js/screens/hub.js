// One Home hub in full: a poster grid opened from the See all tile at the end of its row,
// loaded page by page through the hub's key, as a library is.
import { h, setText, show } from '../util/dom.js';
import { Grid } from '../ui/grid.js';
import { useAmbience } from '../ui/backdrop.js';
import { Menu } from '../ui/menu.js';
import { openItemMenu } from '../ui/itemmenu.js';
import { session } from '../session.js';
import * as router from '../router.js';
import { openItem, playItem } from '../nav.js';
import { error } from '../util/log.js';

const PAGE = 140;
const NOUNS = { movie: 'movie', show: 'show', episode: 'episode', season: 'season' };
// Stands in for a title whose page hasn't landed: it fills as a plain well. A never-filled
// tile given null keeps its default badges and the card shows no well.
const PENDING = {};
const real = it => it && it !== PENDING;

export function HubScreen(hub) {
  const el = h('div', 'screen hub');
  const ambience = useAmbience();
  const head = h('div', 'hub-head', el);
  setText(h('h1', 'hub-title', head), hub.title);
  const count = h('div', 'hub-count', head);
  const note = h('div', 'hub-note', el);
  const noteMsg = h('div', 'hub-msg', note);
  const noteHint = h('div', 'hub-hint', note);
  const noteBtn = h('div', 'btn focus', note);
  show(note, false);

  // Until the first page lands, wells stand in for as many titles as the row had.
  const seed = (hub.Metadata || []).length;
  let alive = true;
  let visible = true;
  let pages = new Map();     // page -> 'loading' | true
  let items = [];
  let generation = 0;
  let noteRun = null;        // what OK does while a message stands in for the grid

  const grid = new Grid({
    top: 252, height: 828, total: seed,
    getItem: i => items[i] || PENDING,
    onFocus: item => { if (real(item) && visible) ambience.set(item.UltraBlurColors); },
    onSelect: item => { if (real(item)) openItem(item); },
  });
  // Set after construction: the constructor asks for data before `grid` exists.
  grid.onNeed = (start, end) => {
    for (let p = Math.floor(start / PAGE); p <= Math.floor(end / PAGE); p++) loadPage(p);
  };
  el.appendChild(grid.el);
  const menu = new Menu(el);

  async function loadPage(p) {
    // Not while a message stands in: emptying the grid for it asks for page 0 again.
    if (noteRun || pages.has(p) || (p && p * PAGE >= grid.total)) return;
    pages.set(p, 'loading');
    const gen = generation;
    try {
      const mc = await session.server.get(hub.key, { 'X-Plex-Container-Start': p * PAGE, 'X-Plex-Container-Size': PAGE });
      if (!alive || gen !== generation) return;
      const total = mc.totalSize != null ? mc.totalSize : mc.size || 0;
      if (!total) {
        showNote('Nothing in ' + hub.title + ' right now.', 'It may have changed since Home loaded.', 'Back to Home', router.back);
        return;
      }
      (mc.Metadata || []).forEach((it, i) => { items[p * PAGE + i] = it; });
      pages.set(p, true);
      setText(count, total + ' ' + (NOUNS[hub.type] || 'title') + (total === 1 ? '' : 's'));
      if (grid.total !== total) grid.setTotal(total);
      else grid.refresh();
      if (grid.index >= total) grid.focusIndex(total - 1);
      else if (p === 0) grid.onFocus(grid.current());
    } catch (e) {
      if (!alive || gen !== generation) return;
      pages.delete(p);
      error('hub page failed', hub.title, p, e);
      if (p === 0) showNote('Couldn\'t load ' + hub.title + '.', 'Check that ' + session.server.name + ' is on, then try again.', 'Try again', reload);
    }
  }

  // A message, a hint and one focused button in place of the grid.
  function showNote(msg, hint, label, run) {
    setText(noteMsg, msg);
    setText(noteHint, hint);
    setText(noteBtn, label);
    setText(count, '');
    noteRun = run;
    show(note, true);
    grid.setActive(false);
    grid.setTotal(0);
  }

  function reload() {
    generation++;
    pages = new Map();
    items = [];
    noteRun = null;
    show(note, false);
    grid.index = 0;
    grid.setTotal(seed);
    grid.setActive(true);
    loadPage(0);
  }

  // Swap in the item's new watched state without reloading its page.
  async function refreshItem(it) {
    const gen = generation;
    try {
      const full = await session.server.metadata(it.ratingKey);
      const i = items.findIndex(x => x && x.ratingKey === it.ratingKey);
      if (!alive || gen !== generation || !full || i < 0) return;
      items[i] = full;
      grid.refresh();
    } catch (e) {
      error('hub refresh failed', hub.title, e);
    }
  }

  reload();

  return {
    el,
    name: 'hub',
    destroy() { alive = false; generation++; },
    onShow() {
      visible = true;
      ambience.restore();
    },
    onHide() { visible = false; },
    onKey(action) {
      if (menu.isOpen) return menu.onKey(action);
      if (noteRun) {
        if (action === 'enter' || action === 'hold') { noteRun(); return true; }
        return action !== 'back';
      }
      switch (action) {
        case 'left': grid.move(-1, 0); return true;
        case 'right': grid.move(1, 0); return true;
        case 'up': grid.move(0, -1); return true;
        case 'down': grid.move(0, 1); return true;
        case 'pageup': grid.focusIndex(grid.index - grid.cols * 3); return true;
        case 'pagedown': grid.focusIndex(grid.index + grid.cols * 3); return true;
        case 'enter': grid.select(); return true;
        case 'hold': if (real(grid.current())) openItemMenu(menu, grid.current(), { changed: refreshItem }); return true;
        case 'play': case 'playpause': if (real(grid.current())) playItem(grid.current()); return true;
      }
      return false;
    },
  };
}
