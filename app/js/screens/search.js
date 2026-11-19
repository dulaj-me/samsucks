// Search across the server. Zones: the search bar (OK opens Samsung's keyboard), the d-pad
// keyboard below it, and to its right the results, or recent searches while the query is empty.
// Results update as you type, from either keyboard.
import { h, setText, setTransform, show, toggleClass } from '../util/dom.js';
import { Row } from '../ui/row.js';
import { Menu } from '../ui/menu.js';
import { Keyboard } from '../ui/keyboard.js';
import { openItemMenu } from '../ui/itemmenu.js';
import { session } from '../session.js';
import * as store from '../util/store.js';
import { openItem, playItem } from '../nav.js';
import { error } from '../util/log.js';
import * as icons from '../ui/icons.js';
import { useAmbience } from '../ui/backdrop.js';

const IME_DONE = 65376;
const IME_CANCEL = 65385;
const DEBOUNCE_MS = 350;
const MIN_QUERY = 2;
const MAX_RECENT = 8;

// Per profile, so profiles don't see each other's searches.
const recentStoreKey = () => 'recentSearches.' + ((session.user && session.user.uuid) || '');

export function SearchScreen() {
  const el = h('div', 'screen search');
  const ambience = useAmbience();
  const bar = h('div', 'search-bar', el);
  const icon = h('div', 'search-icon', bar);
  icon.innerHTML = icons.search;
  const input = h('input', 'search-input', bar);
  input.type = 'text';
  input.placeholder = 'Search movies and shows';
  input.setAttribute('autocomplete', 'off');
  const keyboard = new Keyboard(el, type);
  const status = h('div', 'search-status', el);
  const recentEl = h('div', 'search-recent', el);
  h('h2', 'row-title', recentEl).textContent = 'Recent searches';
  const recentList = h('div', 'search-recent-list', recentEl);
  const clip = h('div', 'search-rows', el);
  const track = h('div', 'rows-track', clip);
  const menu = new Menu(el);

  let zone = 'keys'; // 'input' | 'keys' | 'results' | 'recent'
  let rows = [];
  let rowIndex = 0;
  const saved = store.get(recentStoreKey());
  let recents = Array.isArray(saved) ? saved.filter(s => typeof s === 'string') : [];
  let rowsQuery = ''; // the query the visible results belong to
  let inputFrom = 'keys'; // Down from the bar returns here
  let recentOpts = null; // null: rebuild the list the next time it shows
  let recentIndex = 0;
  let timer = 0;
  let query = '';
  let generation = 0;
  let jump = 0; // results of this generation take focus when they arrive

  async function run(q) {
    query = q;
    const gen = ++generation;
    if (q.length < MIN_QUERY) { setRows([]); setText(status, ''); return; }
    setText(status, 'Searching…');
    renderRecents();
    try {
      const hubs = await session.server.search(q);
      if (gen !== generation) return;
      setRows(hubs);
      rowsQuery = q;
      setText(status, hubs.length ? '' : 'Nothing found for “' + q + '”');
      if (gen === jump && rows.length) setZone('results');
    } catch (e) {
      if (gen !== generation) return;
      error('search failed', e);
      query = null; // the same text runs again on the next change
      setText(status, 'Search failed');
    }
  }

  // Called after every edit, from the d-pad keyboard or the IME.
  function changed() {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q === query) return;
    // Nothing to fetch below the minimum, so recents come back without the debounce.
    if (q.length < MIN_QUERY) { run(q); return; }
    // Recents give way at once, not after the debounce, so focus never sits on a hidden list.
    renderRecents();
    render();
    timer = setTimeout(() => run(q), DEBOUNCE_MS);
  }

  // Run now and move focus to the results once they arrive, including a search already in flight.
  function submit() {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q !== query) run(q);
    else if (rows.length) setZone('results');
    jump = generation;
  }

  function type(id) {
    const v = input.value;
    let next = v;
    if (id === 'delete') next = v.slice(0, -1);
    else if (id === 'clear') next = '';
    else if (id === 'space') next = v && !v.endsWith(' ') ? v + ' ' : v;
    else next = v + id;
    if (next === v) return;
    input.value = next;
    changed();
  }

  function remember() {
    const q = rowsQuery.trim();
    if (!q || q.length < MIN_QUERY) return;
    const lower = q.toLowerCase();
    setRecents([q].concat(recents.filter(r => r.toLowerCase() !== lower)));
  }

  function setRecents(list) {
    recents = list.slice(0, MAX_RECENT);
    store.set(recentStoreKey(), recents.length ? recents : undefined);
    recentOpts = null;
    renderRecents();
    render();
  }

  function setRows(hubs) {
    track.innerHTML = '';
    let y = 0;
    rows = hubs.map(hub => {
      const row = new Row({
        title: hub.title, kind: hub.type === 'episode' ? 'episode' : 'poster',
        caption: true, items: hub.Metadata, onSelect: item => { remember(); openItem(item); },
      });
      setTransform(row.el, 'translateY(' + y + 'px)');
      row.y = y;
      y += row.height;
      track.appendChild(row.el);
      return row;
    });
    rowIndex = 0;
    renderRecents();
    render();
  }

  // Swap in the item's new watched state, keeping the results and focus where they are.
  async function refreshItem(row, it) {
    try {
      const full = await session.server.metadata(it.ratingKey);
      if (!full || rows.indexOf(row) < 0) return;
      row.setItems(row.items.map(x => (x === it ? full : x)));
    } catch (e) {
      error('search refresh failed', e);
    }
  }

  function recentsShown() {
    return !rows.length && input.value.trim().length < MIN_QUERY && recents.length > 0;
  }

  // Rebuilt only when the list changes; moving focus in it toggles classes.
  function renderRecents() {
    const on = recentsShown();
    show(recentEl, on);
    if (!on) return;
    if (!recentOpts) {
      recentList.innerHTML = '';
      recentOpts = recents.map(q => {
        const opt = h('div', 'menu-opt', recentList);
        opt.innerHTML = icons.search;
        h('span', '', opt).textContent = q;
        return opt;
      });
    }
    recentIndex = Math.min(recentIndex, recentOpts.length - 1);
  }

  function setZone(z) {
    zone = z;
    render();
  }

  function render() {
    // A zone whose content went away hands focus back to the keyboard.
    if ((zone === 'results' && !rows.length) || (zone === 'recent' && !recentsShown())) zone = 'keys';
    keyboard.setActive(zone === 'keys');
    rows.forEach((r, i) => r.setActive(zone === 'results' && i === rowIndex));
    if (recentOpts) recentOpts.forEach((o, i) => toggleClass(o, 'focus', zone === 'recent' && i === recentIndex));
    toggleClass(el, 'in-input', zone === 'input');
    const y = rowIndex > 0 && rows[rowIndex] ? rows[rowIndex].y : 0;
    setTransform(track, 'translateY(' + (-y) + 'px)');
  }

  // Right of the keyboard: the results, or the recents while there are none.
  function enterRight() {
    if (rows.length) setZone('results');
    else if (recentsShown()) setZone('recent');
  }

  function pickRecent(q) {
    input.value = q;
    setZone('keys');
    submit();
  }

  function recentMenu() {
    const q = recents[recentIndex];
    menu.open({
      title: q,
      items: [
        { label: 'Remove from recent searches', run: () => setRecents(recents.filter(r => r !== q)) },
        { label: 'Clear recent searches', run: () => setRecents([]) },
      ],
    });
  }

  input.addEventListener('input', changed);
  input.addEventListener('keydown', e => {
    if (e.keyCode === IME_DONE) { input.blur(); submit(); }
    else if (e.keyCode === IME_CANCEL) input.blur();
  });

  function inputKey(action) {
    const typing = document.activeElement === input;
    switch (action) {
      case 'down':
        input.blur();
        setZone(inputFrom === 'results' && rows.length ? 'results' : inputFrom === 'recent' && recentsShown() ? 'recent' : 'keys');
        return true;
      case 'enter': if (typing) { input.blur(); submit(); } else input.focus(); return true;
      case 'back': if (typing) { input.blur(); return true; } return false;
    }
    return true;
  }

  function keysKey(action) {
    switch (action) {
      case 'left': keyboard.move(-1, 0); return true;
      case 'right': if (!keyboard.move(1, 0)) enterRight(); return true;
      case 'up': if (!keyboard.move(0, -1)) { inputFrom = 'keys'; setZone('input'); } return true;
      case 'down': keyboard.move(0, 1); return true;
      case 'enter': case 'hold': keyboard.press(); return true;
    }
    return false;
  }

  function resultsKey(action) {
    const row = rows[rowIndex];
    switch (action) {
      case 'left': if (!row.move(-1)) setZone('keys'); return true;
      case 'right': row.move(1); return true;
      case 'up': if (rowIndex === 0) { inputFrom = 'results'; setZone('input'); } else { rowIndex--; render(); } return true;
      case 'down': if (rowIndex < rows.length - 1) { rowIndex++; render(); } return true;
      case 'enter': row.select(); return true;
      // The menu's Play bypasses onSelect, so the search is saved here.
      case 'hold':
        if (row.current()) {
          remember();
          openItemMenu(menu, row.current(), { changed: it => refreshItem(row, it) });
        }
        return true;
      case 'play': case 'playpause': if (row.current()) { remember(); playItem(row.current()); } return true;
      case 'back': setZone('keys'); return true;
    }
    return false;
  }

  function recentsKey(action) {
    switch (action) {
      case 'left': setZone('keys'); return true;
      case 'up': if (recentIndex === 0) { inputFrom = 'recent'; setZone('input'); } else { recentIndex--; render(); } return true;
      case 'down': if (recentIndex < recentOpts.length - 1) { recentIndex++; render(); } return true;
      case 'enter': pickRecent(recents[recentIndex]); return true;
      case 'hold': recentMenu(); return true;
      case 'back': setZone('keys'); return true;
    }
    return true;
  }

  renderRecents();
  render();

  return {
    el,
    name: 'search',
    onShow() { ambience.restore(); },
    onHide() { input.blur(); },
    onKey(action) {
      jump = 0;
      if (menu.isOpen) return menu.onKey(action);
      // Number keys on the remote type digits wherever focus is.
      if (action.length === 1 && action >= '0' && action <= '9') { type(action); return true; }
      if (zone === 'input') return inputKey(action);
      if (zone === 'results' && rows.length) return resultsKey(action);
      if (zone === 'recent') return recentsKey(action);
      return keysKey(action);
    },
    destroy() { clearTimeout(timer); generation++; },
  };
}
