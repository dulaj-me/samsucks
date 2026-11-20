// Detail page for a movie, show, season (opens its show) or episode. Below the header: a
// show's seasons and episodes, then Cast, Extras and More like this.
import { h, setText, setTransform, toggleClass, show } from '../util/dom.js';
import { useAmbience, HeroArt } from '../ui/backdrop.js';
import { Row } from '../ui/row.js';
import { RowList } from '../ui/rowlist.js';
import { KINDS } from '../ui/tile.js';
import { Menu } from '../ui/menu.js';
import { isWatched, toggleWatched, openItemMenu } from '../ui/itemmenu.js';
import { session } from '../session.js';
import { metaLine, clock, episodeLabel } from '../util/format.js';
import { clearLogo, badges } from './home.js';
import * as icons from '../ui/icons.js';
import * as router from '../router.js';
import { openItem, playItem } from '../nav.js';
import { error } from '../util/log.js';

const SHIFT = 400; // how far the body slides up to reveal seasons/episodes

// Resolution, Dolby Vision or HDR, then Atmos or, without it, the channel layout.
function formatBadges(item) {
  const out = badges(item);
  const m = (item.Media || [])[0];
  const layout = m && { 6: '5.1', 8: '7.1' }[m.audioChannels];
  if (layout && !out.includes('ATMOS')) out.push(layout);
  return out;
}

// Empty tiles at the row's geometry while it loads: frames in `well`, like art still decoding.
function ghosts(kind) {
  const k = KINDS[kind];
  return Array.from({ length: Math.ceil((1920 - 96) / (k.w + k.gap)) }, () => ({}));
}

const playable = m => m.type === 'movie' || m.type === 'show';

export function DetailScreen(initial, { autoplay = false } = {}) {
  const el = h('div', 'screen detail');
  const ambience = useAmbience(initial.UltraBlurColors);
  const art = new HeroArt(el, 'hero-art detail-art');
  const body = h('div', 'detail-body', el);
  const head = h('div', 'detail-head', body);
  const logoBox = h('div', 'detail-logo-box', head);
  const logo = h('img', 'detail-logo', logoBox);
  const title = h('h1', 'detail-title', logoBox);
  const sub = h('div', 'detail-sub', head);
  const meta = h('div', 'detail-meta', head);
  const metaText = h('span', '', meta);
  const metaBadges = [0, 1, 2].map(() => h('span', 'badge', meta));
  const tags = h('div', 'detail-tags', head);
  const summary = h('p', 'detail-summary', head);
  const buttonsEl = h('div', 'detail-buttons', head);
  const seasonsEl = h('div', 'detail-seasons', body);
  const episodesWrap = h('div', 'detail-episodes', body);
  const rowlist = new RowList({ ahead: 1 });
  rowlist.el.classList.add('detail-rows');
  body.appendChild(rowlist.el);
  h('div', 'detail-hint', el).textContent = 'Hold OK for options';
  const menu = new Menu(el);

  // Movies and episodes have no seasons, so their rows follow the buttons.
  const showLike = initial.type === 'show' || initial.type === 'season';
  show(seasonsEl, showLike);
  show(episodesWrap, showLike);

  let item = initial;
  let buttons = [];
  let buttonIndex = 0;
  let seasons = [];
  let seasonIndex = 0;
  let episodes = null;
  let slots = [];
  let rowsBuilt = false;
  let zone = 'buttons';
  let alive = true;
  let shown = false;

  const isShowLike = () => item.type === 'show';

  function renderHeader() {
    const server = session.server;
    const logoPath = clearLogo(item);
    const showTitle = item.type === 'episode' ? item.grandparentTitle : item.title;
    if (logoPath) {
      logo.src = server.image(logoPath, 720, 240, { format: 'png' });
      logo.style.display = '';
      title.style.display = 'none';
    } else {
      logo.style.display = 'none';
      title.style.display = '';
      setText(title, showTitle);
    }
    setText(sub, item.type === 'episode' ? episodeLabel(item) + '   ' + item.title : (item.tagline || ''));
    setText(metaText, metaLine(item));
    const b = formatBadges(item);
    metaBadges.forEach((el, i) => { show(el, i < b.length); setText(el, b[i]); });
    const genres = (item.Genre || []).slice(0, 3).map(g => g.tag);
    const people = (item.Director || []).slice(0, 1).map(d => 'Directed by ' + d.tag)
      .concat((item.Role || []).length ? ['Starring ' + item.Role.slice(0, 3).map(r => r.tag).join(', ')] : []);
    setText(tags, genres.concat(people).join('   ·   '));
    setText(summary, item.summary || '');
    ambience.set(item.UltraBlurColors);
    const artPath = item.type === 'episode' ? (item.grandparentArt || item.art) : item.art;
    art.set(server.image(artPath, 1920, 1080));
  }

  function target() {
    // What Play acts on: the item itself, or for a show the next episode.
    if (!isShowLike()) return item;
    if (item.onDeck) return item.onDeck;
    if (!episodes) return null;
    const eps = episodes.items;
    return eps.find(e => e.viewOffset) || eps.find(e => !e.viewCount) || eps[0] || null;
  }

  function renderButtons() {
    buttonsEl.innerHTML = '';
    buttons = [];
    const t = target();
    const add = (icon, label, run) => {
      const b = h('div', 'btn', buttonsEl);
      b.innerHTML = icon;
      h('span', '', b).textContent = label;
      buttons.push({ el: b, run });
    };
    if (t) {
      const prefix = isShowLike() ? episodeLabel(t) + '  ' : '';
      if (t.viewOffset) {
        add(icons.play, prefix + 'Resume ' + clock(t.viewOffset), () => playItem(t, { offset: t.viewOffset }));
        add(icons.restart, 'From the start', () => playItem(t, { offset: 0 }));
      } else {
        add(icons.play, isShowLike() ? 'Play ' + prefix : 'Play', () => playItem(t, { offset: 0 }));
      }
    }
    const watched = isWatched(item);
    add(watched ? icons.check : icons.uncheck, watched ? 'Watched' : 'Mark watched', markItem);
    if (item.type === 'episode' && item.grandparentRatingKey) {
      add(icons.tv, 'Go to show', () => router.push(DetailScreen({ ratingKey: item.grandparentRatingKey, type: 'show', title: item.grandparentTitle })));
    }
    buttonIndex = Math.min(buttonIndex, buttons.length - 1);
    renderFocus();
  }

  function renderSeasons() {
    seasonsEl.innerHTML = '';
    seasons.forEach(s => {
      s.el = h('div', 'pill', seasonsEl);
      s.el.textContent = s.title;
      if (s.leafCount && isWatched(s)) s.el.insertAdjacentHTML('beforeend', icons.check);
    });
    renderFocus();
  }

  function zones() {
    const order = ['buttons'];
    if (seasons.length > 1) order.push('seasons');
    if (episodes) order.push('episodes');
    if (rowlist.rows.length) order.push('rows');
    return order;
  }

  function renderFocus() {
    // The one layout read, taken before this function writes anything.
    const listTop = zone === 'rows' ? rowlist.el.offsetTop : 0;
    buttons.forEach((b, i) => toggleClass(b.el, 'focus', zone === 'buttons' && i === buttonIndex));
    seasons.forEach((s, i) => {
      toggleClass(s.el, 'focus', zone === 'seasons' && i === seasonIndex);
      toggleClass(s.el, 'current', i === seasonIndex);
    });
    if (episodes) episodes.row.setActive(zone === 'episodes');
    rowlist.setActive(zone === 'rows');
    // Below the fold the active row lands where the header starts; the header fades out.
    const y = zone === 'rows' ? -listTop : zone === 'buttons' ? 0 : -SHIFT;
    setTransform(body, 'translateY(' + y + 'px)');
    toggleClass(el, 'shifted', zone !== 'buttons');
    toggleClass(el, 'deep', zone === 'rows');
    toggleClass(el, 'has-rows', rowlist.rows.length > 0);
  }

  // --- Rows below the fold --------------------------------------------

  // Puts `next` where the slot's entry was, or drops the slot's row when next is null.
  function swap(slot, next) {
    if (slot.entry === next) return;
    const rows = rowlist.rows.slice();
    const i = rows.indexOf(slot.entry);
    if (i < 0) return;
    if (next) rows[i] = next;
    else rows.splice(i, 1);
    slot.entry = next;
    rowlist.setRows(rows);
    if (!zones().includes(zone)) zone = zones().pop();
    renderFocus();
  }

  // Stands in for a row that failed to load, at its height so nothing below it moves.
  function failedRow(slot) {
    const row = h('section', 'row detail-failed');
    h('h2', 'row-title', row).textContent = slot.title;
    const box = h('div', 'detail-failed-box', row);
    h('p', 'detail-failed-msg', box).textContent = 'Couldn\'t load these.';
    const btn = h('div', 'btn', box);
    btn.innerHTML = icons.restart;
    h('span', '', btn).textContent = 'Try again';
    return {
      el: row,
      height: slot.row.height,
      setActive(on) { toggleClass(row, 'active', on); toggleClass(btn, 'focus', on); },
      current() { return null; },
      move() { return false; },
      select() {
        slot.row.setItems(ghosts(slot.kind));
        swap(slot, slot.row);
        slot.load();
      },
    };
  }

  // A row filled by fetch(): ghost tiles while it loads, left out when the answer is empty,
  // and a Try again in its place when it fails.
  function section(title, kind, fetch, select) {
    const row = new Row({
      title, kind, caption: kind !== 'poster', items: ghosts(kind),
      onSelect: it => { if (it.ratingKey) select(it); },
    });
    const slot = { title, kind, row, entry: row };
    slot.load = keepKey => fetch().then(items => {
      if (!alive) return;
      if (!items.length) { swap(slot, null); return; }
      row.setItems(items, keepKey);
      swap(slot, row);
    }, e => {
      if (!alive) return;
      error(title + ' failed', e);
      // A refresh that fails keeps what the row already shows.
      if (!(row.items[0] && row.items[0].ratingKey)) swap(slot, failedRow(slot));
    });
    return slot;
  }

  // Once the header has painted, so the rows never delay it.
  function buildRows() {
    if (rowsBuilt || !alive) return;
    rowsBuilt = true;
    const server = session.server;
    const path = '/library/metadata/' + item.ratingKey;
    const rows = [];
    const cast = (item.Role || []).map(r => ({ title: r.tag, role: r.role, thumb: r.thumb }));
    if (cast.length) rows.push(new Row({ title: 'Cast', kind: 'cast', caption: true, items: cast }));
    slots = [
      section('Extras', 'extra', () => server.get(path + '/extras')
        .then(mc => (mc.Metadata || []).filter(m => m.type === 'clip')), x => playItem(x)),
      // Plex's own ranking; /similar answers more titles but slower and unordered.
      section('More like this', 'poster', () => server.get(path + '/related', { count: 24 }).then(mc => {
        const hub = (mc.Hub || []).find(hb => (hb.Metadata || []).some(playable));
        return hub ? hub.Metadata.filter(playable) : [];
      }), it => openItem(it)),
    ];
    rowlist.setRows(rows.concat(slots.map(s => s.row)));
    renderFocus();
    slots.forEach(s => s.load());
  }

  // OK on an extra or a related title already plays or opens it; the menu marks it.
  function openRowMenu() {
    const slot = slots.find(s => s.entry === rowlist.current());
    const it = slot && slot.row.current();
    if (!it || !it.ratingKey) return;
    openItemMenu(menu, it, {
      sub: slot.kind === 'extra' ? item.title : undefined,
      changed: () => slot.load(it.ratingKey),
    });
  }

  // --- Loading ---------------------------------------------------------

  async function loadEpisodes(season, keepKey) {
    const kids = await session.server.children(season.ratingKey);
    if (!alive) return;
    if (!episodes) {
      const row = new Row({
        kind: 'episode', caption: true, items: kids,
        onSelect: ep => playItem(ep, { offset: ep.viewOffset || 0 }),
      });
      episodesWrap.appendChild(row.el);
      episodes = { row, items: kids };
    } else {
      episodes.items = kids;
      episodes.row.setItems(kids, keepKey);
    }
    if (!keepKey) {
      // Land on the first unwatched episode.
      const next = kids.findIndex(k => !k.viewCount || k.viewOffset);
      episodes.row.focusIndex(next >= 0 ? next : 0);
    }
    renderFocus();
  }

  async function load() {
    try {
      let key = item.ratingKey;
      let preferSeason = null;
      if (item.type === 'season') { preferSeason = item.ratingKey; key = item.parentRatingKey; }
      const full = await session.server.metadata(key);
      if (!alive || !full) return;
      item = full;
      renderHeader();
      if (!rowsBuilt) requestAnimationFrame(() => setTimeout(buildRows, 0));
      if (isShowLike()) {
        seasons = (await session.server.children(item.ratingKey)).filter(s => s.type === 'season');
        if (!alive) return;
        const deckSeason = item.onDeck ? seasons.findIndex(s => s.ratingKey === item.onDeck.parentRatingKey) : -1;
        const pref = preferSeason ? seasons.findIndex(s => s.ratingKey === preferSeason) : -1;
        seasonIndex = pref >= 0 ? pref : (deckSeason >= 0 ? deckSeason : 0);
        renderSeasons();
        if (seasons[seasonIndex]) await loadEpisodes(seasons[seasonIndex]);
      }
      renderButtons();
      if (autoplay) {
        autoplay = false;
        const t = target();
        if (t) playItem(t, { offset: t.viewOffset || 0 });
      }
    } catch (e) {
      error('detail load failed', e);
      setText(summary, 'Couldn\'t load details.');
    }
  }

  async function markItem() {
    try {
      await toggleWatched(item);
      await load();
    } catch (e) {
      error('toggle watched failed', e);
    }
  }

  // After a season or episode of this show was marked. Refreshes in place, unlike
  // load(), so focus stays on the tile or pill that was marked.
  async function refreshChildren() {
    const server = session.server;
    try {
      const keep = episodes && episodes.row.current();
      const [full, kids] = await Promise.all([server.metadata(item.ratingKey), server.children(item.ratingKey)]);
      if (!alive) return;
      if (full) item = full;
      seasons = kids.filter(s => s.type === 'season');
      seasonIndex = Math.min(seasonIndex, seasons.length - 1);
      renderSeasons();
      renderButtons();
      if (seasons[seasonIndex]) await loadEpisodes(seasons[seasonIndex], keep && keep.ratingKey);
    } catch (e) {
      error('refresh after mark failed', e);
    }
  }

  // OK on an episode already plays it, so the menu here only marks.
  function openMenu(it) {
    openItemMenu(menu, it, {
      sub: it.type === 'episode' ? episodeLabel(it) : item.title,
      play: false,
      changed: refreshChildren,
    });
  }

  if (item.title) renderHeader();
  renderButtons();
  load();

  function moveZone(dir) {
    const order = zones();
    const i = order.indexOf(zone) + dir;
    if (i < 0 || i >= order.length) return;
    zone = order[i];
    renderFocus();
  }

  return {
    el,
    name: 'detail',
    onShow() {
      ambience.restore();
      // Back from the player: refresh resume points and watched state.
      if (shown) {
        session.server.invalidate();
        load();
      }
      shown = true;
    },
    onKey(action) {
      if (menu.isOpen) return menu.onKey(action);
      if (action === 'up') {
        if (!(zone === 'rows' && rowlist.move(-1))) moveZone(-1);
        return true;
      }
      if (action === 'down') {
        if (zone === 'rows') rowlist.move(1);
        else moveZone(1);
        return true;
      }
      if (action === 'play' || action === 'playpause') {
        const picked = zone === 'episodes' ? episodes.row.current()
          : zone === 'rows' ? rowlist.current().current() : null;
        const t = picked && picked.ratingKey ? picked : target();
        if (t) playItem(t, { offset: t.viewOffset || 0 });
        return true;
      }
      if (zone === 'buttons') {
        if (action === 'left') { buttonIndex = Math.max(0, buttonIndex - 1); renderFocus(); return true; }
        if (action === 'right') { buttonIndex = Math.min(buttons.length - 1, buttonIndex + 1); renderFocus(); return true; }
        if (action === 'enter' && buttons[buttonIndex]) { buttons[buttonIndex].run(); return true; }
      } else if (zone === 'seasons') {
        if (action === 'left' || action === 'right') {
          const next = seasonIndex + (action === 'right' ? 1 : -1);
          if (next >= 0 && next < seasons.length) {
            seasonIndex = next;
            renderFocus();
            loadEpisodes(seasons[seasonIndex]).catch(e => error('episodes failed', e));
          }
          return true;
        }
        if (action === 'enter') { moveZone(1); return true; }
        if (action === 'hold') { openMenu(seasons[seasonIndex]); return true; }
      } else if (zone === 'episodes') {
        if (action === 'hold') { openMenu(episodes.row.current()); return true; }
        if (action === 'left') { episodes.row.move(-1); return true; }
        if (action === 'right') { episodes.row.move(1); return true; }
        if (action === 'enter') { episodes.row.select(); return true; }
        if (action === 'info') { router.push(DetailScreen(episodes.row.current())); return true; }
      } else if (zone === 'rows') {
        const row = rowlist.current();
        if (action === 'left') { row.move(-1); return true; }
        if (action === 'right') { row.move(1); return true; }
        // A cast face does nothing yet: people get their own page later.
        if (action === 'enter') { row.select(); return true; }
        if (action === 'hold') { openRowMenu(); return true; }
      }
      if (action === 'back' && zone !== 'buttons') {
        zone = 'buttons';
        rowlist.focus(0);
        renderFocus();
        return true;
      }
      return false;
    },
    destroy() { alive = false; },
  };
}
