import { DEV, VERSION } from '../config.js';
import { h, setText, setTransform, toggleClass } from '../util/dom.js';
import * as store from '../util/store.js';
import { session, signOut, useServer, profileToken, hasProfiles } from '../session.js';
import { getServers, connect } from '../plex/auth.js';
import { setHud, hudEnabled } from '../ui/hud.js';
import * as router from '../router.js';
import { ServerPicker } from './login.js';
import { openProfiles } from '../nav.js';
import { error } from '../util/log.js';
import { useAmbience, setLegacyGradients, legacyGradients } from '../ui/backdrop.js';

// Device-wide preferences. The player reads store 'prefs' directly, so a missing key
// must mean its default there too.
const PREF_DEFAULTS = { autoplayNext: true };

function prefs() {
  return Object.assign({}, PREF_DEFAULTS, store.get('prefs'));
}

function setPref(key, value) {
  const p = prefs();
  p[key] = value;
  store.set('prefs', p);
}

const onOff = on => (on ? 'On' : 'Off');

// A plex.direct host is "<ip-with-dashes>.<32 hex>.plex.direct"; the IP is the useful part.
function serverAddress(uri) {
  try {
    const u = new URL(uri);
    const direct = u.hostname.match(/^([\d-]+)\.[0-9a-f]+\.plex\.direct$/);
    return (direct ? direct[1].replace(/-/g, '.') : u.hostname) + (u.port ? ':' + u.port : '');
  } catch (e) {
    return uri.replace(/[?&]X-Plex-Token=.*/i, '');
  }
}

export function SettingsScreen() {
  const el = h('div', 'screen settings');
  const ambience = useAmbience();
  h('h1', 'settings-title', el).textContent = 'Settings';
  const clip = h('div', 'settings-clip', el);
  const track = h('div', 'settings-track', clip);

  let alive = true;
  let visible = false;
  let index = 0;
  let maxScroll = 0;
  let viewMid = 0;

  const who = () => (session.user ? session.user.title : '—');
  // Signing out leaves the whole Plex account, not just the profile.
  const account = hasProfiles()
    ? [
      { label: 'Profile', value: who, action: 'Switch', run: () => openProfiles() },
      { label: 'Plex account', value: 'Sign out', run: doSignOut },
    ]
    : [{ label: 'Signed in as', value: who, action: 'Sign out', run: doSignOut }];

  const groups = [
    ['Profile and account', account],
    ['Server', [
      { label: 'Server', value: () => (session.server ? session.server.name : '—'), action: 'Switch', run: switchServer },
    ]],
    ['Playback', [
      { label: 'Autoplay next episode', value: () => onOff(prefs().autoplayNext), run: () => setPref('autoplayNext', !prefs().autoplayNext) },
    ]],
    ['About', [
      { label: 'Version', value: VERSION + (DEV ? ' (dev)' : '') },
      { label: 'Based on', value: 'SamSUCKS by rfaile313' },
      { label: 'License', value: 'GNU GPL v3.0, no warranty' },
      { label: 'Inter font', value: 'SIL Open Font License 1.1' },
      { label: 'Barlow Condensed font', value: 'SIL Open Font License 1.1' },
      { label: 'QR codes', value: 'qrcode-generator by Kazuhiko Arase, MIT License' },
    ]],
    ['Advanced', [
      { label: 'Performance overlay', value: () => onOff(hudEnabled()), run: () => setHud(!hudEnabled()) },
      // For before/after recordings: brings back the full-screen gradients that took ~2s per repaint.
      { label: 'Demo: original slow renderer', value: () => onOff(legacyGradients()), run: () => setLegacyGradients(!legacyGradients()) },
      // Host and port only: a plex.direct host is long enough that the ellipsis would hide the port.
      { label: 'Server address', value: () => (session.server ? serverAddress(session.server.uri) : '—') },
    ]],
  ];

  const items = [];
  for (const [title, rows] of groups) {
    h('div', 'row-title settings-head', track).textContent = title;
    for (const it of rows) {
      it.el = h('div', 'setting', track);
      h('span', 'setting-label', it.el).textContent = it.label;
      it.valueEl = h('span', 'setting-value', it.el);
      refresh(it);
      items.push(it);
    }
  }
  toggleClass(items[0].el, 'focus', true);

  // status, while set, stands in for the value: loading and error text for the row's action.
  function refresh(it) {
    const value = typeof it.value === 'function' ? it.value() : it.value;
    setText(it.valueEl, it.status || (value + (it.action ? '  ·  ' + it.action : '')));
  }

  function setStatus(it, text) {
    it.status = text;
    refresh(it);
  }

  // Read once per show, so a key press only writes a class and a transform.
  function measure() {
    viewMid = clip.offsetHeight / 2;
    maxScroll = Math.max(0, track.offsetHeight - clip.offsetHeight);
    for (const it of items) it.mid = it.el.offsetTop + it.el.offsetHeight / 2;
  }

  // The focused row sits mid-view while the list can scroll. The jump is instant: a
  // sliding list under an instantly moved highlight reads as the screen jumping.
  function place() {
    const y = Math.round(Math.max(0, Math.min(maxScroll, items[index].mid - viewMid)));
    setTransform(track, 'translateY(' + -y + 'px)');
  }

  function move(delta) {
    const next = Math.max(0, Math.min(items.length - 1, index + delta));
    if (next === index) return;
    toggleClass(items[index].el, 'focus', false);
    index = next;
    toggleClass(items[index].el, 'focus', true);
    place();
  }

  function activate(it) {
    if (!it.run) return;
    it.run(it);
    refresh(it);
  }

  async function switchServer(it) {
    if (it.busy) return;
    it.busy = true;
    setStatus(it, 'Looking for servers…');
    try {
      let servers;
      try {
        servers = await getServers(profileToken());
      } catch (e) {
        error('server list failed', e);
        if (alive) setStatus(it, e.status === 401 ? 'Sign-in expired' : "Couldn't reach plex.tv");
        return;
      }
      if (!alive) return;
      if (!visible) { setStatus(it, null); return; }
      if (!servers.length) { setStatus(it, 'No servers on this account'); return; }
      if (servers.length > 1) {
        setStatus(it, null);
        router.push(ServerPicker({ servers, onDone: restart }));
        return;
      }
      setStatus(it, 'Connecting to ' + servers[0].name + '…');
      let uri;
      try {
        uri = await connect(servers[0]);
      } catch (e) {
        error('server connect failed', e);
        if (alive) setStatus(it, e.message);
        return;
      }
      if (!alive) return;
      if (!visible) { setStatus(it, null); return; }
      if (useServer(servers[0], uri)) restart();
      else setStatus(it, 'Profile changed, try again');
    } finally {
      it.busy = false;
    }
  }

  function doSignOut() {
    signOut();
    restart();
  }

  function restart() {
    // Rebuild from scratch: app.js decides between login and home.
    window.dispatchEvent(new Event('samsucks:restart'));
  }

  return {
    el,
    name: 'settings',
    onShow() {
      visible = true;
      ambience.restore();
      items.forEach(refresh);
      measure();
      place();
    },
    onHide() { visible = false; },
    onKey(action) {
      if (action === 'up') { move(-1); return true; }
      if (action === 'down') { move(1); return true; }
      if (action === 'enter') { activate(items[index]); return true; }
      return false;
    },
    destroy() { alive = false; },
  };
}
