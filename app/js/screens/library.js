// A whole library as a virtualized poster grid, loaded page by page, under the nav.
// Zones from the top: nav, filter bar (filter, unwatched, sort), grid.
// Yellow cycles the sort; CH▲/CH▼ jump by letter (title sort) or by page.
import { h, setText, show, toggleClass } from '../util/dom.js';
import { Grid } from '../ui/grid.js';
import { useAmbience } from '../ui/backdrop.js';
import { TopNav } from '../ui/topnav.js';
import { Menu } from '../ui/menu.js';
import { openItemMenu, isWatched } from '../ui/itemmenu.js';
import * as icons from '../ui/icons.js';
import * as store from '../util/store.js';
import { session } from '../session.js';
import { prefetch } from '../ui/images.js';
import { isFast } from '../input.js';
import { openItem, playItem } from '../nav.js';
import { error } from '../util/log.js';
import { metaLine } from '../util/format.js';

const PAGE = 140;
// `chip` is the label in the bar, short so the band fits the Filter chip at its widest.
const SORTS = [
  { id: 'titleSort', label: 'A–Z' },
  { id: 'addedAt:desc', label: 'Recently added', chip: 'Added' },
  { id: 'originallyAvailableAt:desc', label: 'Release date', chip: 'Released' },
  { id: 'audienceRating:desc', label: 'Rating' },
];
// The Filter chip's menu. Each id is both the section's directory of values and the
// filter parameter /all takes. Plex filters a collection by its tag, like a genre.
const CATEGORIES = [
  { id: 'genre', title: 'Genre', all: 'All genres' },
  { id: 'decade', title: 'Decade', all: 'All decades' },
  { id: 'contentRating', title: 'Content rating', all: 'All ratings' },
  { id: 'collection', title: 'Collection', all: 'All collections' },
];

// Directory keys come URL-encoded ("Not%20Rated") and query() encodes them again.
function tag(d) {
  let key = d.key;
  try { key = decodeURIComponent(key); } catch (e) { /* a literal % */ }
  return { key, title: d.title };
}

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

  // Remembered per profile, server and library. A value is { key, title } or null.
  const storeKey = [session.user && session.user.uuid, session.server.id, section.key].join('/');
  const savedFilters = () => {
    const s = store.get('libFilters');
    return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
  };
  const f = Object.assign({ sort: SORTS[0].id, unwatched: false }, savedFilters()[storeKey]);
  if (!SORTS.some(s => s.id === f.sort)) f.sort = SORTS[0].id;
  let lists = null;          // category id -> [{ key, title }] once loaded
  let listsLoading = null;   // the lists request, started once page 0 has settled
  let menuWaits = false;     // the Filter menu shows "Loading…" until the lists arrive
  let alive = true;
  let visible = true;
  let pages = new Map();     // page -> 'loading' | true
  let items = [];
  let letters = [];          // [{ title: 'A', start: 0 }]
  let generation = 0;
  let isEmpty = false;       // the current filters matched nothing
  let zone = 'grid';
  let inPicker = false;      // the menu shows one category's values

  const sortIndex = () => Math.max(0, SORTS.findIndex(s => s.id === f.sort));
  const anyFilter = () => f.unwatched || CATEGORIES.some(c => f[c.id]);

  function chip(run) {
    const c = { el: h('div', 'pill', head), run };
    c.label = h('span', '', c.el);
    return c;
  }
  const filterChip = chip(openFilters);
  filterChip.label.className = 'lib-filter';
  const unwatchedChip = chip(() => { f.unwatched = !f.unwatched; filtersChanged(); });
  setText(unwatchedChip.label, 'Unwatched');
  unwatchedChip.icon = h('span', '', unwatchedChip.el);
  const sortChip = chip(openSorts);
  let bar = [filterChip, unwatchedChip, sortChip];
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
      // The backdrop is shared: a late answer must not tint the screen on top.
      if (visible) ambience.set(item.UltraBlurColors);
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
    const params = { type, [unwatchedParam]: f.unwatched ? 1 : undefined };
    for (const c of CATEGORIES) params[c.id] = f[c.id] ? f[c.id].key : undefined;
    return params;
  }

  async function loadPage(p) {
    if (pages.has(p)) return;
    if (grid.total && p * PAGE >= grid.total) return;
    pages.set(p, 'loading');
    const gen = generation;
    try {
      const res = await session.server.items(section.key, p * PAGE, PAGE, Object.assign({ sort: f.sort }, filters()));
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
    // The four filter lists wait for the first page, so they never hold up its posters.
    if (p === 0) ensureLists();
  }

  function ensureLists() {
    if (!listsLoading) listsLoading = loadLists();
    return listsLoading;
  }

  function showTotal(total) {
    setText(count, total + (isShow ? ' show' : ' movie') + (total === 1 ? '' : 's'));
    if (!total) showEmpty(anyFilter() ? 'Nothing matches these filters. Press Back to clear them.' : 'This library is empty.');
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
    if (f.sort !== 'titleSort') return;
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

  async function loadLists() {
    const all = await Promise.all(CATEGORIES.map(c =>
      session.server.get('/library/sections/' + section.key + '/' + c.id, { type }, { maxAge: 300000 })
        .then(mc => (mc.Directory || []).map(tag), e => {
          error('library filter list failed', section.title, c.id, e);
          return [];
        })));
    if (!alive) return;
    lists = {};
    CATEGORIES.forEach((c, i) => { lists[c.id] = all[i]; });
    if (menuWaits && menu.isOpen) openFilters();
    menuWaits = false;
    // A failed list looks empty too; a remembered value keeps the chip so it can be cleared.
    if (CATEGORIES.some(c => lists[c.id].length || f[c.id])) return;
    const focused = bar[barIndex];
    head.removeChild(filterChip.el);
    bar = bar.filter(c => c !== filterChip);
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
    const saved = savedFilters();
    saved[storeKey] = f;
    store.set('libFilters', saved);
    renderChips();
    reload();
  }

  // Only a filter change touches the labels. A focus move toggles .focus and nothing that
  // lays out, or the band repaints far beyond the chip.
  function renderChips() {
    const values = CATEGORIES.filter(c => f[c.id]).map(c => f[c.id].title);
    setText(filterChip.label, values.length ? values.join(' · ') : 'Filter');
    toggleClass(filterChip.el, 'current', values.length > 0);
    unwatchedChip.icon.innerHTML = f.unwatched ? icons.check : icons.uncheck;
    toggleClass(unwatchedChip.el, 'current', f.unwatched);
    const sort = SORTS[sortIndex()];
    setText(sortChip.label, 'Sort: ' + (sort.chip || sort.label));
  }

  function renderBar() {
    bar.forEach((c, i) => toggleClass(c.el, 'focus', zone === 'bar' && i === barIndex));
  }

  function openFilters() {
    inPicker = false;
    if (!lists) {
      menuWaits = true;
      menu.open({ title: 'Filter', sub: section.title, items: [{ label: 'Loading…', run() {} }] });
      ensureLists();
      return;
    }
    const entries = CATEGORIES.filter(c => lists[c.id].length || f[c.id]).map(c => ({
      label: c.title + ': ' + (f[c.id] ? f[c.id].title : 'All'),
      run: () => openPicker(c),
    }));
    if (CATEGORIES.some(c => f[c.id])) {
      entries.push({ label: 'Clear filters', run: () => { clearCategories(); filtersChanged(); } });
    }
    menu.open({ title: 'Filter', sub: section.title, items: entries });
  }

  function openPicker(c) {
    const cur = f[c.id];
    menu.open({
      title: c.title, sub: section.title,
      items: [null].concat(lists[c.id]).map(v => ({
        label: v ? v.title : c.all,
        current: v ? !!cur && cur.key === v.key : !cur,
        run: () => { if ((v && v.key) !== (cur && cur.key)) { f[c.id] = v; filtersChanged(); } },
      })),
    });
    inPicker = true;
  }

  function openSorts() {
    menuWaits = false;
    menu.open({
      title: 'Sort by', sub: section.title,
      items: SORTS.map((s, i) => ({ label: s.label, current: i === sortIndex(), run: () => setSort(i) })),
    });
  }

  function setSort(i) {
    if (SORTS[i].id === f.sort) return;
    f.sort = SORTS[i].id;
    filtersChanged();
  }

  renderChips();
  reload();

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

  // By key: a page refetch may have replaced the object the menu was opened on.
  const indexOf = it => items.findIndex(x => x && x.ratingKey === it.ratingKey);

  // Swap in the item's new watched state without reloading the page it's on.
  async function refreshItem(it) {
    const gen = generation;
    try {
      const full = await session.server.metadata(it.ratingKey);
      const i = indexOf(it);
      if (gen !== generation || !full || i < 0) return;
      items[i] = full;
      grid.refresh();
    } catch (e) {
      error('library refresh failed', section.title, e);
    }
  }

  // Under Unwatched, a title marked watched leaves at once. Focus keeps its place and lands
  // on the title that moved up into it.
  function removeItem(it) {
    if (!alive) return;
    if (!f.unwatched) { refreshItem(it); return; }
    const i = indexOf(it);
    if (i < 0) return;
    items.splice(i, 1);
    // Every later title moved up one on the server too. Refetch from this page on, so no page
    // keeps a gap at its end or lands one place off, and drop answers already on their way.
    generation++;
    const p = Math.floor(i / PAGE);
    for (const k of [...pages.keys()]) if (k >= p || pages.get(k) === 'loading') pages.delete(k);
    const total = grid.total - 1;
    showTotal(total);
    grid.setTotal(total);
    // If focus moved past the removed title while the scrobble was on its way, it shifts with its title.
    const j = grid.index > i ? grid.index - 1 : grid.index;
    if (total) grid.focusIndex(Math.min(j, total - 1));
    loadLetters();
  }

  function setZone(z) {
    zone = z;
    topnav.setActive(z === 'nav');
    grid.setActive(z === 'grid');
    renderBar();
  }

  function clearCategories() {
    for (const c of CATEGORIES) f[c.id] = null;
  }

  function clearFilters() {
    clearCategories();
    f.unwatched = false;
    filtersChanged();
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
      case 'yellow': setSort((sortIndex() + 1) % SORTS.length); return true;
      case 'back':
        if (!isEmpty || !anyFilter()) return false;
        clearFilters();
        return true;
    }
    return false;
  }

  return {
    el,
    name: 'library',
    destroy() { alive = false; generation++; },
    onShow() {
      visible = true;
      ambience.restore();
      topnav.render();
    },
    onHide() { visible = false; },
    onKey(action) {
      if (menu.isOpen) {
        // Back from one category's values returns to the list of categories.
        if (inPicker && action === 'back') { openFilters(); return true; }
        return menu.onKey(action);
      }
      inPicker = false;
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
        case 'hold': {
          const it = grid.current();
          // Read before the change: an unwatched title marked watched no longer matches.
          const leaves = f.unwatched && it && !isWatched(it);
          openItemMenu(menu, it, { changed: leaves ? removeItem : refreshItem });
          return true;
        }
        case 'play': case 'playpause': if (grid.current()) playItem(grid.current()); return true;
        case 'yellow': setSort((sortIndex() + 1) % SORTS.length); return true;
        case 'back':
          if (grid.index > grid.cols * 2) { grid.focusIndex(0); return true; }
          return false;
      }
      return false;
    },
  };
}
