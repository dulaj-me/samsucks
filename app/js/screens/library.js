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
import { prefetch, warm } from '../ui/images.js';
import { isFast } from '../input.js';
import { openItem, playItem } from '../nav.js';
import { error } from '../util/log.js';
import { toast } from '../ui/toast.js';

const PAGE = 140;
const GRID_TOP = 252;
// Where the first row's posters start: the grid's top plus its headroom (HEAD in ui/grid.js).
const FIRST_ROW = 288;
// How long the letter landed on stays up after a letter jump.
const LETTER_MS = 900;
// The longest a filter change waits on the new first rows' posters before it cuts to them.
const SWAP_WAIT = 500;
const SORTS = [
  { id: 'titleSort', label: 'A–Z' },
  { id: 'addedAt:desc', label: 'Recently added' },
  { id: 'originallyAvailableAt:desc', label: 'Release date' },
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
  h('div', 'top-veil', el);
  const topnav = new TopNav(el, section.key);
  const head = h('div', 'lib-bar', el);
  const empty = h('div', 'lib-empty', el);
  const emptyMsg = h('div', 'lib-msg', empty);
  const emptyHint = h('div', 'lib-hint', empty);
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
  let isEmpty = false;       // the grid has nothing to show: no matches, an empty library or an error
  let wayOut = null;         // the bar's chip out of that: 'clear' or 'retry'
  let loading = false;       // the first page is on its way, behind the skeleton
  let swapping = false;      // new filters' first page is on its way; the old grid stays up
  let zone = 'grid';
  let inPicker = false;      // the menu shows one category's values

  const sortIndex = () => Math.max(0, SORTS.findIndex(s => s.id === f.sort));
  const anyFilter = () => f.unwatched || CATEGORIES.some(c => f[c.id]);

  // A label, its value and a chevron ("Sort  Recently added"); or a glyph, then a label.
  function chip(run, picker) {
    const c = { el: h('div', 'pill', head), run };
    if (picker) {
      c.label = h('span', '', c.el);
      c.value = h('b', '', c.el);
      c.el.insertAdjacentHTML('beforeend', icons.chevron);
    } else {
      c.icon = h('span', 'lib-lead', c.el);
      c.label = h('span', '', c.el);
    }
    return c;
  }
  const filterChip = chip(openFilters, true);
  filterChip.value.className = 'lib-value';
  const unwatchedChip = chip(() => { f.unwatched = !f.unwatched; filtersChanged(); });
  setText(unwatchedChip.label, 'Unwatched');
  const sortChip = chip(openSorts, true);
  setText(sortChip.label, 'Sort');
  // The way out of an empty or failed grid, shown only then: Clear filters or Try again.
  const actionChip = chip(null);
  show(actionChip.el, false);
  const count = h('div', 'lib-count', head);
  let bar = [filterChip, unwatchedChip, sortChip];
  let barIndex = 0;

  const grid = new Grid({
    top: GRID_TOP, height: 828, total: 0,
    getItem: i => items[i],
    onFocus: (item, index) => {
      // Warm posters for the row just past the recycled pool.
      if (!isFast()) {
        const start = (Math.floor(index / grid.cols) + grid.poolRows - 1) * grid.cols;
        for (let i = start; i < start + grid.cols; i++) {
          if (items[i]) prefetch(session.server.image(items[i].thumb, grid.size.w, grid.size.h));
        }
      }
      if (item) tint(item.UltraBlurColors);
    },
    onSelect: item => openItem(item),
  });
  // Set after construction: the constructor asks for data before `grid` exists.
  grid.onNeed = (start, end) => {
    // Pages for the new filters would land in the old grid's slots.
    if (swapping) return;
    for (let p = Math.floor(start / PAGE); p <= Math.floor(end / PAGE); p++) loadPage(p);
  };
  el.appendChild(grid.el);
  const skeleton = h('div', 'lib-skeleton', el);
  for (let i = 0; i < grid.cols * 2; i++) {
    const x = 96 + (i % grid.cols) * grid.stepX;
    const y = FIRST_ROW + Math.floor(i / grid.cols) * grid.stepY;
    place(h('div', 'lib-skel', skeleton), x, y, grid.size.w, grid.size.h);
    place(h('div', 'lib-skel lib-skel-line', skeleton), x, y + grid.size.h + 20, 150, 20);
  }
  const letter = h('div', 'lib-letter', el);
  let letterTimer = 0;
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
      const cut = swapping;
      if (cut) {
        await warm(res.items.slice(0, grid.cols * 2).map(it => session.server.image(it.thumb, grid.size.w, grid.size.h)), SWAP_WAIT);
        if (gen !== generation) return;
        swapping = false;
        items = [];
        grid.index = 0;
      }
      res.items.forEach((it, i) => { items[p * PAGE + i] = it; });
      pages.set(p, true);
      if (p === 0) setLoading(false);
      showTotal(res.total);
      // A cut lands on the first poster without sliding the old grid there.
      if (cut) toggleClass(grid.el, 'cut', true);
      if (grid.total !== res.total) grid.setTotal(res.total);
      else grid.refresh();
      if (cut) {
        grid.el.getBoundingClientRect();
        toggleClass(grid.el, 'cut', false);
      }
      if (p === 0 && res.items[0]) grid.onFocus(grid.current());
    } catch (e) {
      if (gen !== generation) return;
      pages.delete(p);
      error('library page failed', section.title, p, e);
      // The old grid no longer matches the chips.
      if (p === 0 && swapping) { swapping = false; clearGrid(); }
      // A refetch after a title left keeps the posters it has; the next move asks again.
      if (p === 0 && grid.total) toast("Couldn't refresh " + section.title + '.');
      else if (p === 0) showEmpty("Couldn't load " + section.title, 'Check that ' + session.server.name + ' is on, then try again.', 'retry');
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
    if (total) return;
    if (anyFilter()) showEmpty(noMatches(), 'Clear the filters to see the whole library.', 'clear');
    else showEmpty('Nothing in ' + section.title + ' yet', "Add titles to it in Plex and they'll show up here.");
  }

  // "No unwatched war movies from the 1990s"
  function noMatches() {
    const words = ['No'];
    if (f.unwatched) words.push('unwatched');
    if (f.genre) words.push(f.genre.title.toLowerCase());
    words.push(isShow ? 'shows' : 'movies');
    if (f.decade) words.push('from the ' + f.decade.title);
    if (f.contentRating) words.push('rated ' + f.contentRating.title);
    if (f.collection) words.push('in ' + f.collection.title);
    return words.join(' ');
  }

  // way: the chip that leads out, 'clear' or 'retry'.
  function showEmpty(msg, hint, way) {
    isEmpty = true;
    setLoading(false);
    // No title has focus, so the room takes no title's colours.
    tint(null);
    setText(emptyMsg, msg);
    setText(emptyHint, hint);
    show(empty, true);
    setAction(way);
    if (zone === 'grid') setZone('bar');
  }

  // The chip goes last in the bar. It takes focus only from outside the bar, so a page landing
  // never moves focus off a chip the user is on.
  function setAction(way) {
    wayOut = way || null;
    bar = bar.filter(c => c !== actionChip);
    toggleClass(actionChip.el, 'focus', false);
    show(actionChip.el, !!wayOut);
    if (wayOut) {
      actionChip.icon.innerHTML = wayOut === 'clear' ? icons.remove : icons.restart;
      setText(actionChip.label, wayOut === 'clear' ? 'Clear filters' : 'Try again');
      actionChip.run = wayOut === 'clear' ? clearFilters : () => { reload(); setZone('grid'); };
      bar.push(actionChip);
      if (zone !== 'bar') barIndex = bar.length - 1;
    }
    barIndex = Math.min(barIndex, bar.length - 1);
    renderBar();
  }

  // The skeleton stands in for the grid, and its focus card, until the first page lands.
  function setLoading(on) {
    loading = on;
    toggleClass(el, 'loading', on);
  }

  // The backdrop is shared: while another screen is on top, only remember the colours.
  function tint(colors) {
    if (visible) ambience.set(colors);
    else ambience.remember(colors);
  }

  function flashLetter(text) {
    setText(letter, text);
    toggleClass(letter, 'on', true);
    clearTimeout(letterTimer);
    letterTimer = setTimeout(() => toggleClass(letter, 'on', false), LETTER_MS);
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

  // A failed list is not an empty one: it never removes the Filter chip, and the next
  // ensureLists() (opening Filter, or the first page landing again) fetches it again.
  async function loadLists() {
    const all = await Promise.all(CATEGORIES.map(c =>
      session.server.get('/library/sections/' + section.key + '/' + c.id, { type }, { maxAge: 300000 })
        .then(mc => (mc.Directory || []).map(tag), e => {
          error('library filter list failed', section.title, c.id, e);
          return null;
        })));
    if (!alive) return;
    const failed = all.some(l => !l);
    if (failed) listsLoading = null;
    if (all.every(l => !l)) {
      if (menuWaits && menu.isOpen) {
        menu.open({ title: 'Filter', sub: "Couldn't load the filters", items: [{ label: 'Try again', icon: icons.restart, run: openFilters }] });
      }
      menuWaits = false;
      return;
    }
    lists = {};
    CATEGORIES.forEach((c, i) => { lists[c.id] = all[i] || []; });
    if (menuWaits && menu.isOpen) openFilters();
    menuWaits = false;
    // A remembered value keeps the chip so it can be cleared.
    if (failed || CATEGORIES.some(c => lists[c.id].length || f[c.id])) return;
    const focused = bar[barIndex];
    head.removeChild(filterChip.el);
    bar = bar.filter(c => c !== filterChip);
    barIndex = Math.max(0, bar.indexOf(focused));
    renderBar();
  }

  // keep: a filter change over posters leaves them up until the new first page and its first
  // rows' posters are in, then cuts. Anything else (opening, retrying, leaving an empty
  // result) shows the skeleton.
  function reload(keep) {
    generation++;
    pages = new Map();
    swapping = !!keep && grid.total > 0 && !isEmpty;
    if (!swapping) {
      isEmpty = false;
      show(empty, false);
      setAction(null);
      setLoading(true);
      clearGrid();
    }
    loadPage(0);
    loadLetters();
  }

  function clearGrid() {
    items = [];
    setText(count, '');
    grid.total = 0;
    grid.index = 0;
    grid.refresh();
  }

  function filtersChanged() {
    const saved = savedFilters();
    saved[storeKey] = f;
    store.set('libFilters', saved);
    renderChips();
    reload(true);
  }

  // Only a filter change touches the labels. A focus move toggles .focus and nothing that
  // lays out, or the band repaints far beyond the chip.
  function renderChips() {
    const set = CATEGORIES.filter(c => f[c.id]);
    setText(filterChip.label, set.length === 1 ? set[0].title : 'Filter');
    setText(filterChip.value, set.length ? set.map(c => f[c.id].title).join(' · ') : 'All');
    toggleClass(filterChip.el, 'current', set.length > 0);
    unwatchedChip.icon.innerHTML = f.unwatched ? icons.check : icons.uncheck;
    toggleClass(unwatchedChip.el, 'current', f.unwatched);
    setText(sortChip.value, SORTS[sortIndex()].label);
  }

  function renderBar() {
    bar.forEach((c, i) => toggleClass(c.el, 'focus', zone === 'bar' && i === barIndex));
  }

  function openFilters() {
    inPicker = false;
    // Fetches again only when the last try failed.
    ensureLists();
    if (!lists) {
      menuWaits = true;
      menu.open({ title: 'Filter', sub: section.title, items: [{ label: 'Loading…', run() {} }] });
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
    if (!grid.total || swapping) return;
    if (letters.length) {
      const i = grid.index;
      let li = letters.findIndex((l, k) => i >= l.start && (k === letters.length - 1 || i < letters[k + 1].start));
      li = Math.max(0, Math.min(letters.length - 1, li + dir));
      grid.focusIndex(letters[li].start);
      flashLetter(letters[li].title);
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
    // The first page for new filters is already on its way.
    if (swapping) return;
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

  // The whole library comes back, so focus goes to it.
  function clearFilters() {
    clearCategories();
    f.unwatched = false;
    filtersChanged();
    setZone('grid');
  }

  function barKey(action) {
    switch (action) {
      case 'left': case 'right': {
        const next = barIndex + (action === 'right' ? 1 : -1);
        if (next >= 0 && next < bar.length) { barIndex = next; renderBar(); }
        return true;
      }
      case 'up': setZone('nav'); return true;
      case 'down': if (!isEmpty && !loading) setZone('grid'); return true;
      case 'enter': bar[barIndex].run(); return true;
      case 'yellow': setSort((sortIndex() + 1) % SORTS.length); return true;
      // Back clears filters that matched nothing; after an error it leaves, filters kept.
      case 'back':
        if (wayOut !== 'clear') return false;
        clearFilters();
        return true;
    }
    return false;
  }

  return {
    el,
    name: 'library',
    destroy() { alive = false; generation++; clearTimeout(letterTimer); },
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

function place(el, x, y, w, hgt) {
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.width = w + 'px';
  el.style.height = hgt + 'px';
}
