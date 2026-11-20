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
// Its key is one no Plex item has, so a refresh keeps focus on it.
function rowItems(hub) {
  if (!hub.more && !(hub.totalSize > hub.size)) return hub.Metadata;
  return hub.Metadata.concat({ seeAll: true, ratingKey: 'see-all', title: 'See all', hub });
}

// Continue Watching without the titles in `keys`; left empty, it goes too.
function without(hubs, keys) {
  return hubs.map(hb => (isContinue(hb.hubIdentifier)
    ? Object.assign({}, hb, { Metadata: hb.Metadata.filter(m => !keys.has(m.ratingKey)) })
    : hb)).filter(hb => hb.Metadata.length);
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
  // The last hubs Plex sent, and Continue Watching titles whose removal it hasn't answered yet.
  let lastHubs = [];
  const removing = new Set();

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

  function makeRow(hb) {
    const wide = /continue|ondeck/i.test(hb.hubIdentifier);
    const row = new Row({
      title: hb.title, kind: wide ? 'wide' : 'poster', caption: wide, items: rowItems(hb),
      onFocus: (it, r) => onFocusItem(heroOf(r)),
      onSelect: it => (it.seeAll ? openHub(it.hub) : openItem(it)),
    });
    row.hubId = hb.hubIdentifier;
    return row;
  }

  // Rows are kept by hub, so focus stays on the same hub and title when rows come or go.
  // keepKey moves focus in the current row to that title instead.
  function setHubs(raw, keepKey) {
    lastHubs = raw;
    const hubs = removing.size ? without(raw, removing) : raw;
    const cur = rows[rowIndex];
    const focusedKey = keepKey || (cur && cur.current() && cur.current().ratingKey);
    const old = new Map(rows.map(r => [r.hubId, r]));
    rows = hubs.map(hb => {
      const row = old.get(hb.hubIdentifier);
      if (!row) return makeRow(hb);
      old.delete(hb.hubIdentifier);
      row.setItems(rowItems(hb), row === cur ? focusedKey : null);
      return row;
    });
    old.forEach(r => track.removeChild(r.el));
    // Later rows paint over earlier ones, so a row's lift shadow stays under the row below.
    if (rows.some((r, i) => track.children[i] !== r.el)) rows.forEach(r => track.appendChild(r.el));
    const kept = rows.indexOf(cur);
    // A row that left hands its place to the one below; past the last row, focus goes up one.
    rowIndex = kept >= 0 ? kept : Math.min(rowIndex, Math.max(0, rows.length - 1));
    layoutRows();
    renderRows();
    show(skeleton, false);
    setText(empty, rows.length ? '' : EMPTY);
    const item = rows[rowIndex] && heroOf(rows[rowIndex]);
    if (item) showHero(item);
    if (!reportedPaint && rows.length) {
      reportedPaint = true;
      log('home rows ready at ' + Math.round(performance.now()) + 'ms after page start');
    }
  }

  // Out of its row at once, and out of any reload until Plex answers. Focus keeps its slot, on
  // the title that moves into it; at the end, the one before. A failure puts the title back.
  function removeContinue(item) {
    const key = item.ratingKey;
    const row = rows[rowIndex];
    const i = row && isContinue(row.hubId) ? row.items.findIndex(it => it.ratingKey === key) : -1;
    const next = i >= 0 ? row.items[i + 1] : null;
    const near = next && !next.seeAll ? next : i > 0 ? row.items[i - 1] : null;
    removing.add(key);
    setHubs(lastHubs, near && near.ratingKey);
    removeFromContinueWatching(item).then(() => {
      removing.delete(key);
      // Gone for good: a later setHubs from these, before the reload lands, keeps it out.
      lastHubs = without(lastHubs, new Set([key]));
      // In the same tick, so any load already on its way is stale and can't put it back.
      load();
    }, e => {
      error('remove from continue watching failed', e);
      toast('Couldn\'t remove that from Continue Watching.');
      removing.delete(key);
      if (alive) setHubs(lastHubs);
      load();
    });
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
          if (it && it.seeAll) row.select();
          else if (it) {
            openItemMenu(menu, it, {
              changed: () => load(),
              remove: isContinue(row.hubId) ? removeContinue : null,
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
