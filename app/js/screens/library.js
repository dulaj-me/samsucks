// A whole library as a virtualized poster grid, loaded page by page, under the nav.
// Zones from the top: nav, filter bar (genre, unwatched, sort), grid.
// Yellow cycles the sort; CH▲/CH▼ jump by letter (title sort) or by page.
import { h, setText, show, toggleClass } from '../util/dom.js';
import { Grid } from '../ui/grid.js';
import { useAmbience } from '../ui/backdrop.js';
import { TopNav } from '../ui/topnav.js';
import { Menu } from '../ui/menu.js';
import { openItemMenu } from '../ui/itemmenu.js';
import * as icons from '../ui/icons.js';
import { session } from '../session.js';
import { prefetch } from '../ui/images.js';
import { isFast } from '../input.js';
import { openItem, playItem } from '../nav.js';
import { error } from '../util/log.js';
import { metaLine } from '../util/format.js';

const PAGE = 140;
const SORTS = [
  { id: 'titleSort', label: 'A–Z' },
  { id: 'addedAt:desc', label: 'Recently added' },
  { id: 'originallyAvailableAt:desc', label: 'Release date' },
  { id: 'audienceRating:desc', label: 'Rating' },
];

export function LibraryScreen(section) {
  const el = h('div', 'screen library');
  const ambience = useAmbience();
  // The nav's current entry names the library, so the line below it is about the focus.
  const topnav = new TopNav(el, section.key);
  const focusInfo = h('div', 'lib-focus', el);
  const head = h('div', 'lib-head', el);
  const count = h('div', 'lib-count', head);
  const empty = h('div', 'lib-empty', el);
  show(empty, false);

  const isShow = section.type === 'show';
  const type = isShow ? 2 : 1;
  // A show counts as unwatched while any episode is, as in Plex's own filter.
  const unwatchedParam = isShow ? 'unwatchedLeaves' : 'unwatched';

  let sortIndex = 0;
  let genre = null;          // one of `genres`, or null for all
  let unwatched = false;
  let genres = null;         // [{ key, title }] once loaded
  let pages = new Map();     // page -> 'loading' | true
  let items = [];
  let letters = [];          // [{ title: 'A', start: 0 }]
  let generation = 0;
  let isEmpty = false;       // the current filters matched nothing
  let zone = 'grid';

  function chip(run) {
    const c = { el: h('div', 'pill', head), run };
    c.label = h('span', '', c.el);
    return c;
  }
  const genreChip = chip(openGenres);
  genreChip.label.className = 'lib-genre';
  const unwatchedChip = chip(() => { unwatched = !unwatched; filtersChanged(); });
  setText(unwatchedChip.label, 'Unwatched');
  unwatchedChip.icon = h('span', '', unwatchedChip.el);
  const sortChip = chip(openSorts);
  let bar = [genreChip, unwatchedChip, sortChip];
  let barIndex = 0;

  const grid = new Grid({
    top: 200, height: 880, total: 0,
    getItem: i => items[i],
    onFocus: (item, index) => {
      // Warm posters for the row just past the recycled pool.
      if (!isFast()) {
        const start = (Math.floor(index / grid.cols) + grid.poolRows - 1) * grid.cols;
        for (let i = start; i < start + grid.cols; i++) {
          if (items[i]) prefetch(session.server.image(items[i].thumb, 216, 324));
        }
      }
      if (!item) { setText(focusInfo, ''); return; }
      setText(focusInfo, item.title + '   ' + metaLine(item));
      ambience.set(item.UltraBlurColors);
    },
    onSelect: item => openItem(item),
  });
  // Set after construction: the constructor asks for data before `grid` exists.
  grid.onNeed = (start, end) => {
    for (let p = Math.floor(start / PAGE); p <= Math.floor(end / PAGE); p++) loadPage(p);
  };
  el.appendChild(grid.el);
  const menu = new Menu(el);

  // The same filters go to the items and to the first characters, or letter jump lands on the wrong rows.
  function filters() {
    return { type, genre: genre ? genre.key : undefined, [unwatchedParam]: unwatched ? 1 : undefined };
  }

  async function loadPage(p) {
    if (pages.has(p)) return;
    if (grid.total && p * PAGE >= grid.total) return;
    pages.set(p, 'loading');
    const gen = generation;
    try {
      const res = await session.server.items(section.key, p * PAGE, PAGE, Object.assign({ sort: SORTS[sortIndex].id }, filters()));
      if (gen !== generation) return;
      res.items.forEach((it, i) => { items[p * PAGE + i] = it; });
      pages.set(p, true);
      showTotal(res.total);
      if (grid.total !== res.total) grid.setTotal(res.total);
      else grid.refresh();
      if (p === 0 && res.items[0]) grid.onFocus(grid.current());
    } catch (e) {
      if (gen !== generation) return;
      pages.delete(p);
      error('library page failed', section.title, p, e);
      if (p === 0) showEmpty("Couldn't load this library.");
    }
  }

  function showTotal(total) {
    setText(count, total + (isShow ? ' show' : ' movie') + (total === 1 ? '' : 's'));
    if (!total) showEmpty(genre || unwatched ? 'Nothing matches these filters. Press Back to clear them.' : 'This library is empty.');
  }

  function showEmpty(text) {
    isEmpty = true;
    setText(empty, text);
    show(empty, true);
    setText(focusInfo, '');
    if (zone === 'grid') setZone('bar');
  }

  async function loadLetters() {
    letters = [];
    if (SORTS[sortIndex].id !== 'titleSort') return;
    const gen = generation;
    try {
      const mc = await session.server.get('/library/sections/' + section.key + '/firstCharacter', filters());
      if (gen !== generation) return;
      let start = 0;
      letters = (mc.Directory || []).map(d => {
        const l = { title: d.title, start };
        start += d.size;
        return l;
      });
    } catch (e) { /* letter jump just won't work */ }
  }

  async function loadGenres() {
    try {
      const mc = await session.server.get('/library/sections/' + section.key + '/genre', { type }, { maxAge: 300000 });
      genres = mc.Directory || [];
    } catch (e) {
      genres = [];
      error('library genres failed', section.title, e);
    }
    if (genres.length) return;
    const focused = bar[barIndex];
    head.removeChild(genreChip.el);
    bar = bar.filter(c => c !== genreChip);
    barIndex = Math.max(0, bar.indexOf(focused));
    renderBar();
  }

  function reload() {
    generation++;
    pages = new Map();
    items = [];
    isEmpty = false;
    show(empty, false);
    setText(count, '');
    grid.total = 0;
    grid.index = 0;
    grid.refresh();
    loadPage(0);
    loadLetters();
  }

  function filtersChanged() {
    renderChips();
    reload();
  }

  // Only a filter change touches the labels. A focus move toggles .focus and nothing that
  // lays out, or the band repaints far beyond the chip.
  function renderChips() {
    setText(genreChip.label, genre ? genre.title : 'All genres');
    toggleClass(genreChip.el, 'current', !!genre);
    unwatchedChip.icon.innerHTML = unwatched ? icons.check : icons.uncheck;
    toggleClass(unwatchedChip.el, 'current', unwatched);
    setText(sortChip.label, 'Sort: ' + SORTS[sortIndex].label);
  }

  function renderBar() {
    bar.forEach((c, i) => toggleClass(c.el, 'focus', zone === 'bar' && i === barIndex));
  }

  function openGenres() {
    if (!genres) return;
    menu.open({
      title: 'Genre', sub: section.title,
      items: [null].concat(genres).map(g => ({
        label: g ? g.title : 'All genres',
        current: g === genre,
        run: () => { if (g !== genre) { genre = g; filtersChanged(); } },
      })),
    });
  }

  function openSorts() {
    menu.open({
      title: 'Sort by', sub: section.title,
      items: SORTS.map((s, i) => ({ label: s.label, current: i === sortIndex, run: () => setSort(i) })),
    });
  }

  function setSort(i) {
    if (i === sortIndex) return;
    sortIndex = i;
    filtersChanged();
  }

  renderChips();
  reload();
  loadGenres();

  function jump(dir) {
    if (letters.length) {
      const i = grid.index;
      let li = letters.findIndex((l, k) => i >= l.start && (k === letters.length - 1 || i < letters[k + 1].start));
      li = Math.max(0, Math.min(letters.length - 1, li + dir));
      grid.focusIndex(letters[li].start);
      setText(focusInfo, letters[li].title);
    } else {
      grid.focusIndex(grid.index + dir * grid.cols * 3);
    }
  }

  // Swap in the item's new watched state without reloading the page it's on.
  async function refreshItem(it) {
    const gen = generation;
    try {
      const full = await session.server.metadata(it.ratingKey);
      const i = items.indexOf(it);
      if (gen !== generation || !full || i < 0) return;
      items[i] = full;
      grid.refresh();
    } catch (e) {
      error('library refresh failed', section.title, e);
    }
  }

  function setZone(z) {
    zone = z;
    topnav.setActive(z === 'nav');
    grid.setActive(z === 'grid');
    renderBar();
  }

  function barKey(action) {
    switch (action) {
      case 'left': case 'right': {
        const next = barIndex + (action === 'right' ? 1 : -1);
        if (next >= 0 && next < bar.length) { barIndex = next; renderBar(); }
        return true;
      }
      case 'up': setZone('nav'); return true;
      case 'down': if (!isEmpty) setZone('grid'); return true;
      case 'enter': bar[barIndex].run(); return true;
      case 'yellow': setSort((sortIndex + 1) % SORTS.length); return true;
      case 'back':
        if (!isEmpty || !(genre || unwatched)) return false;
        genre = null;
        unwatched = false;
        filtersChanged();
        return true;
    }
    return false;
  }

  return {
    el,
    name: 'library',
    destroy() { generation++; },
    onShow() {
      ambience.restore();
      topnav.render();
    },
    onKey(action) {
      if (menu.isOpen) return menu.onKey(action);
      if (zone === 'nav') {
        if (topnav.onKey(action)) return true;
        if (action === 'down') { setZone('bar'); return true; }
        if (action === 'back') return false;
        return true;
      }
      if (zone === 'bar') return barKey(action);
      switch (action) {
        case 'left': grid.move(-1, 0); return true;
        case 'right': grid.move(1, 0); return true;
        case 'up': if (!grid.move(0, -1)) setZone('bar'); return true;
        case 'down': grid.move(0, 1); return true;
        case 'pageup': jump(-1); return true;
        case 'pagedown': jump(1); return true;
        case 'enter': grid.select(); return true;
        case 'hold': openItemMenu(menu, grid.current(), { changed: refreshItem }); return true;
        case 'play': case 'playpause': if (grid.current()) playItem(grid.current()); return true;
        case 'yellow': setSort((sortIndex + 1) % SORTS.length); return true;
        case 'back':
          if (grid.index > grid.cols * 2) { grid.focusIndex(0); return true; }
          return false;
      }
      return false;
    },
  };
}
