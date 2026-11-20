// Home: hero for the focused item, the nav, and Plex's home hubs as rows.
// The last hub payload is cached per server and user so a cold start paints instantly.
import { h, setText, setTransform, toggleClass, show } from '../util/dom.js';
import { Row } from '../ui/row.js';
import { useAmbience, HeroArt } from '../ui/backdrop.js';
import { TopNav } from '../ui/topnav.js';
import { Menu } from '../ui/menu.js';
import { openItemMenu, removeFromContinueWatching } from '../ui/itemmenu.js';
import { toast } from '../ui/toast.js';
import { session } from '../session.js';
import { duration, progress, episodeCode, timeLeft } from '../util/format.js';
import { isFast } from '../input.js';
import * as store from '../util/store.js';
import { openItem, playItem, openHub } from '../nav.js';
import { error, log } from '../util/log.js';

// The active row's top. Its pitch keeps the next row's heading below the fold.
const ROWS_TOP = 616;
// Format badges need the full metadata, fetched once focus has settled on a title.
const BADGES_DELAY = 400;
const EMPTY = 'Nothing here yet. Add some media to your Plex server.';
// Only this hub's items can be taken out of it; On Deck has no such action.
const isContinue = hubId => /continue/i.test(hubId);

function slimHub(hub) {
  // Keep the cache small: only fields the home screen renders.
  const keep = ['ratingKey', 'key', 'type', 'title', 'grandparentTitle', 'parentTitle', 'year', 'thumb', 'art',
    'grandparentThumb', 'grandparentArt', 'parentThumb', 'index', 'parentIndex', 'duration', 'viewOffset',
    'viewCount', 'leafCount', 'viewedLeafCount', 'childCount', 'contentRating', 'audienceRating', 'summary',
    'originallyAvailableAt', 'UltraBlurColors', 'grandparentRatingKey', 'parentRatingKey', 'Image', 'Genre'];
  return {
    hubIdentifier: hub.hubIdentifier, title: hub.title, type: hub.type,
    key: hub.key, more: hub.more, size: hub.size, totalSize: hub.totalSize,
    Metadata: hub.Metadata.map(m => {
      const o = {};
      for (const k of keep) if (m[k] !== undefined) o[k] = m[k];
      if (o.Genre) o.Genre = o.Genre.slice(0, 2).map(g => ({ tag: g.tag }));
      return o;
    }),
  };
}

// A hub with more titles than its row shows ends in a See all tile, which opens the whole hub.
function rowItems(hub) {
  if (!hub.more && !(hub.totalSize > hub.size)) return hub.Metadata;
  return hub.Metadata.concat({ seeAll: true, title: 'See all', hub });
}

// See all has no hero of its own: the hero keeps the row's last title.
function heroOf(row) {
  const it = row.current();
  return it && it.seeAll ? row.items[row.index - 1] : it;
}

export function heroArtPath(item) {
  if (item.type === 'episode' || item.type === 'season') return item.grandparentArt || item.art;
  return item.art;
}

export function clearLogo(item) {
  const img = (item.Image || []).find(i => i.type === 'clearLogo');
  return img ? img.url : '';
}

// Year, rating, runtime (seasons for a show), and two genres where the hub has them.
function facts(item) {
  const year = item.type === 'episode' ? (item.originallyAvailableAt || '').slice(0, 4) : item.year;
  const length = item.type === 'show' && item.childCount
    ? item.childCount + (item.childCount === 1 ? ' season' : ' seasons')
    : duration(item.duration);
  const genres = (item.Genre || []).slice(0, 2).map(g => g.tag).join(', ');
  return [year, item.contentRating, length, genres].filter(Boolean);
}

// Resolution, then Dolby Vision or HDR, then Atmos, from the first media's streams.
export function badges(full) {
  const m = ((full && full.Media) || [])[0];
  if (!m) return [];
  const streams = (m.Part && m.Part[0] && m.Part[0].Stream) || [];
  const video = streams.find(s => s.streamType === 1) || {};
  const out = [];
  if (m.videoResolution === '4k') out.push('4K');
  if (video.DOVIPresent) out.push('DOLBY VISION');
  else if (video.colorTrc === 'smpte2084' || video.colorTrc === 'arib-std-b67') out.push('HDR');
  if (/atmos/i.test(m.audioProfile || '') || streams.some(s => s.streamType === 2 && /atmos/i.test(s.displayTitle || ''))) out.push('ATMOS');
  return out;
}

const userKey = () => (session.user && session.user.uuid) || '';

export function HomeScreen() {
  const el = h('div', 'screen home');
  const ambience = useAmbience();
  const hero = new HeroArt(el, 'hero-art home-art hero-dissolve');
  h('div', 'top-veil', el);

  const topnav = new TopNav(el, 'home');

  const info = h('div', 'hero-info', el);
  const logoBox = h('div', 'hero-logo-box', info);
  const heroLogo = h('img', 'hero-logo', logoBox);
  const heroTitle = h('h1', 'hero-title', logoBox);
  const heroMeta = h('div', 'hero-meta', info);
  // A fixed set of nodes, filled in place: a focus change creates nothing.
  const metaFacts = [];
  const metaDots = [];
  for (let i = 0; i < 4; i++) {
    if (i) metaDots.push(h('i', 'hero-dot', heroMeta));
    metaFacts.push(h('span', '', heroMeta));
  }
  const metaBadges = [0, 1, 2].map(() => h('span', 'badge', heroMeta));
  const heroEp = h('div', 'hero-ep', info);
  const epTitle = h('span', 'hero-ep-title', heroEp);
  const epCode = h('span', 'hero-ep-code', heroEp);
  const epTrack = h('i', 'hero-ep-track', heroEp);
  const epFill = h('b', '', epTrack);
  const epLeft = h('span', 'hero-ep-left', heroEp);
  const heroSummary = h('p', 'hero-summary', info);
  show(heroEp, false);

  const rowsClip = h('div', 'home-rows', el);
  rowsClip.style.top = ROWS_TOP + 'px';
  const track = h('div', 'rows-track', rowsClip);
  const skeleton = h('div', 'home-skeleton', el);
  const empty = h('div', 'home-empty', el);
  const menu = new Menu(el);

  let rows = [];
  let offsets = [];
  let rowIndex = 0;
  let zone = 'rows';
  let loadedAt = 0;
  let heroTimer = 0;
  let artTimer = 0;
  let badgeTimer = 0;
  let heroItem = null;
  let reportedPaint = false;
  let loads = 0;
  let alive = true;
  const fulls = new Map();

  function setZone(z) {
    zone = z;
    topnav.setActive(z === 'nav');
  }

  function setMeta(item, extra) {
    const f = facts(item);
    const b = extra || [];
    metaFacts.forEach((el, i) => { show(el, i < f.length); setText(el, f[i]); });
    metaDots.forEach((el, i) => show(el, i + 1 < f.length));
    metaBadges.forEach((el, i) => { show(el, i < b.length); setText(el, b[i]); });
  }

  function showBadges(item) {
    clearTimeout(badgeTimer);
    const key = item.ratingKey;
    if (fulls.has(key)) { setMeta(item, fulls.get(key)); return; }
    const server = session.server;
    // Not through the server's cache: it never evicts, and `fulls` already keeps just the badges.
    badgeTimer = setTimeout(() => {
      if (fulls.has(key)) { if (alive && heroItem === item) setMeta(item, fulls.get(key)); return; }
      server.get('/library/metadata/' + key).then(mc => {
        const b = badges((mc.Metadata || [])[0]);
        fulls.set(key, b);
        if (alive && heroItem === item && b.length) setMeta(item, b);
      }, e => error('hero badges failed', e));
    }, BADGES_DELAY);
  }

  function showHero(item) {
    if (!item) return;
    heroItem = item;
    const server = session.server;
    const logoPath = clearLogo(item);
    show(heroLogo, !!logoPath);
    show(heroTitle, !logoPath);
    if (logoPath) heroLogo.src = server.image(logoPath, 600, 196, { format: 'png' });
    else setText(heroTitle, item.type === 'episode' ? item.grandparentTitle : item.title);

    setMeta(item, fulls.get(item.ratingKey));
    const p = progress(item);
    const episode = item.type === 'episode';
    show(heroEp, episode || p > 0);
    show(epTitle, episode);
    show(epCode, episode);
    if (episode) { setText(epTitle, item.title); setText(epCode, episodeCode(item)); }
    show(epTrack, p > 0);
    show(epLeft, p > 0);
    if (p > 0) { setTransform(epFill, 'scaleX(' + p.toFixed(3) + ')'); setText(epLeft, timeLeft(item)); }
    setText(heroSummary, item.summary || '');

    ambience.set(item.UltraBlurColors);
    clearTimeout(artTimer);
    // Only once focus rests: swapping full-size art at browsing speed cost Home a frame step on the TV.
    artTimer = setTimeout(() => hero.set(server.image(heroArtPath(item), 1920, 1080)), isFast() ? 350 : 300);
    showBadges(item);
  }

  function onFocusItem(item) {
    clearTimeout(heroTimer);
    clearTimeout(badgeTimer);
    // While a key is held, skip the text repaint until the user settles.
    if (isFast()) heroTimer = setTimeout(() => showHero(item), 160);
    else showHero(item);
  }

  function layoutRows() {
    offsets = [];
    let y = 0;
    rows.forEach(r => {
      offsets.push(y);
      setTransform(r.el, 'translateY(' + y + 'px)');
      y += r.height;
    });
  }

  function renderRows() {
    rows.forEach((r, i) => {
      r.setActive(zone === 'rows' && i === rowIndex);
      toggleClass(r.el, 'current', i === rowIndex);
      toggleClass(r.el, 'above', i < rowIndex);
    });
    setTransform(track, 'translateY(' + (-(offsets[rowIndex] || 0)) + 'px)');
  }

  function setHubs(hubs) {
    const sameShape = hubs.length === rows.length && hubs.every((hb, i) => rows[i].hubId === hb.hubIdentifier);
    const focusedKey = rows[rowIndex] && rows[rowIndex].current() && rows[rowIndex].current().ratingKey;
    if (sameShape) {
      hubs.forEach((hb, i) => rows[i].setItems(rowItems(hb), i === rowIndex ? focusedKey : null));
    } else {
      track.innerHTML = '';
      rows = hubs.map(hb => {
        const wide = /continue|ondeck/i.test(hb.hubIdentifier);
        const row = new Row({
          title: hb.title, kind: wide ? 'wide' : 'poster', caption: wide, items: rowItems(hb),
          onFocus: (it, r) => onFocusItem(heroOf(r)),
          onSelect: it => (it.seeAll ? openHub(it.hub) : openItem(it)),
        });
        row.hubId = hb.hubIdentifier;
        track.appendChild(row.el);
        return row;
      });
      rowIndex = Math.min(rowIndex, Math.max(0, rows.length - 1));
      layoutRows();
    }
    renderRows();
    show(skeleton, false);
    setText(empty, rows.length ? '' : EMPTY);
    const cur = rows[rowIndex] && heroOf(rows[rowIndex]);
    if (cur) showHero(cur);
    if (!reportedPaint && rows.length) {
      reportedPaint = true;
      log('home rows ready at ' + Math.round(performance.now()) + 'ms after page start');
    }
  }

  // Out of its row at once. A reload once Plex confirms settles the rest, as a title further
  // down Continue Watching may move up into the row; a failure reloads the item back in.
  function removeContinue(hubId, item) {
    const row = rows.find(r => r.hubId === hubId);
    const i = row ? row.items.findIndex(it => it.ratingKey === item.ratingKey) : -1;
    if (i >= 0) {
      const items = row.items.filter((it, k) => k !== i);
      const titles = items.filter(it => !it.seeAll).length;
      if (!titles) dropRow(row);
      else {
        // Focus keeps its slot, now on the title that moved into it; at the end, the one before.
        row.setItems(items, items[Math.min(i, titles - 1)].ratingKey);
        if (row === rows[rowIndex]) onFocusItem(heroOf(row));
      }
    }
    removeFromContinueWatching(item).then(() => load(), e => {
      error('remove from continue watching failed', e);
      toast('Couldn\'t remove that from Continue Watching.');
      load();
    });
  }

  // The row below moves up into its place; past the last row, focus goes up one.
  function dropRow(row) {
    const i = rows.indexOf(row);
    rows.splice(i, 1);
    track.removeChild(row.el);
    if (i < rowIndex || rowIndex >= rows.length) rowIndex = Math.max(0, rowIndex - 1);
    layoutRows();
    renderRows();
    if (rows.length) onFocusItem(heroOf(rows[rowIndex]));
    else setText(empty, EMPTY);
  }

  async function load() {
    const server = session.server;
    const user = userKey();
    const id = ++loads;
    loadedAt = Date.now();
    // Only the newest load may paint, and only for the server and user it was made for.
    const stale = () => !alive || id !== loads || session.server !== server || userKey() !== user;
    try {
      const [sections, hubs] = await Promise.all([server.sections(), server.hubs()]);
      if (stale()) return;
      topnav.setSections(sections);
      setHubs(hubs);
      store.set('homeCache', { server: server.id, user, sections, hubs: hubs.map(slimHub) });
    } catch (e) {
      if (stale()) return;
      error('home load failed', e);
      if (!rows.length) {
        show(skeleton, false);
        setText(empty, 'Couldn\'t load from ' + server.name + '. Press OK to retry.');
      }
    }
  }

  // First launch on this server and profile: the shapes of Home until the hubs arrive.
  function buildSkeleton() {
    const line = (parent, cls, w) => { h('div', 'skel ' + cls, parent).style.width = w + 'px'; };
    line(skeleton, 'skel-title', 420);
    line(skeleton, 'skel-meta', 360);
    line(skeleton, 'skel-sum1', 700);
    line(skeleton, 'skel-sum2', 540);
    line(skeleton, 'skel-head', 300);
    for (let i = 0; i < 4; i++) {
      const tile = h('div', 'skel-tile', skeleton);
      tile.style.left = (96 + i * 468) + 'px';
      line(tile, 'skel-frame', 432);
      line(tile, 'skel-cap', 220);
    }
  }

  const cached = store.get('homeCache');
  if (cached && session.server && cached.server === session.server.id && cached.user === userKey()) {
    show(skeleton, false);
    topnav.setSections(cached.sections || []);
    setHubs(cached.hubs || []);
  } else {
    buildSkeleton();
    topnav.setSections([]);
  }
  load();

  return {
    el,
    name: 'home',
    onShow() {
      ambience.restore();
      topnav.render();
      // Coming back from playback: progress and Continue Watching changed.
      if (Date.now() - loadedAt > 5000) load();
    },
    onKey(action) {
      if (menu.isOpen) return menu.onKey(action);
      if (zone === 'nav') {
        if (topnav.onKey(action)) return true;
        if (action === 'down' && rows.length) { setZone('rows'); renderRows(); return true; }
        if (action === 'back') return false;
        return true;
      }
      const row = rows[rowIndex];
      if (!row) {
        if (action === 'up') { setZone('nav'); return true; }
        if (action === 'enter') { load(); return true; }
        return false;
      }
      switch (action) {
        case 'left': row.move(-1); return true;
        case 'right': row.move(1); return true;
        case 'up':
          if (rowIndex === 0) { setZone('nav'); renderRows(); return true; }
          rowIndex--; renderRows(); onFocusItem(heroOf(rows[rowIndex])); return true;
        case 'down':
          if (rowIndex < rows.length - 1) { rowIndex++; renderRows(); onFocusItem(heroOf(rows[rowIndex])); }
          return true;
        case 'enter': row.select(); return true;
        case 'hold': {
          const it = row.current();
          if (it && !it.seeAll) {
            const hubId = row.hubId;
            openItemMenu(menu, it, {
              changed: () => load(),
              remove: isContinue(hubId) ? item => removeContinue(hubId, item) : null,
            });
          }
          return true;
        }
        case 'play': case 'playpause': {
          const it = row.current();
          if (it && !it.seeAll) playItem(it);
          return true;
        }
        case 'back':
          // Back from deep in the rows returns to the top first.
          if (rowIndex > 0 || row.index > 0) {
            rowIndex = 0; rows.forEach(r => r.focusIndex(0)); renderRows(); onFocusItem(heroOf(rows[0]));
            return true;
          }
          return false;
      }
      return false;
    },
    destroy() {
      alive = false;
      clearTimeout(heroTimer);
      clearTimeout(artTimer);
      clearTimeout(badgeTimer);
    },
  };
}
