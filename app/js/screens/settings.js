import { DEV, VERSION } from '../config.js';
import { h, setText, toggleClass } from '../util/dom.js';
import * as store from '../util/store.js';
import { session, signOut, useServer, profileToken, hasProfiles, onUsersChange } from '../session.js';
import { getServers, connect } from '../plex/auth.js';
import { setHud, hudEnabled } from '../ui/hud.js';
import * as router from '../router.js';
import { ServerPicker } from './login.js';
import { openProfiles } from '../nav.js';
import { error } from '../util/log.js';
import * as icons from '../ui/icons.js';
import { useAmbience, setLegacyGradients, legacyGradients } from '../ui/backdrop.js';

// Device-wide preferences. The player reads store 'prefs' directly, so a missing key
// must mean its default there too.
const PREF_DEFAULTS = { autoplayNext: true, upnextSeconds: 10 };
const COUNTDOWNS = [5, 10, 15, 30];

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

// Groups on the left; the current group's rows on the right. Left and Right move between them.
export function SettingsScreen() {
  const el = h('div', 'screen settings');
  const ambience = useAmbience();
  h('h1', 'settings-title', el).textContent = 'Settings';
  const groupList = h('div', 'settings-groups', el);

  let alive = true;
  let visible = false;
  let zone = 'groups'; // 'groups' | 'rows'
  let gi = 0;
  let ri = 0;

  const who = () => (session.user ? session.user.title : '—');
  const accountRows = () => (hasProfiles()
    ? [
      { label: 'Switch profile', value: who, run: () => openProfiles() },
      { label: 'Sign out', sub: 'Every profile on this TV signs out with it.', run: doSignOut },
    ]
    : [{ label: 'Sign out', value: who, run: doSignOut }]);

  const groups = [
    { label: 'Profile and account', icon: icons.user, rows: accountRows(), profiles: hasProfiles() },
    {
      label: 'Server', icon: icons.server, rows: [
        { label: 'Switch server', value: () => (session.server ? session.server.name : '—'), run: switchServer },
      ],
    },
    {
      label: 'Playback', icon: icons.play, note: 'Audio and subtitle choices follow your Plex account settings.', rows: [
        {
          label: 'Autoplay next episode', sub: 'The next episode starts after a short countdown.',
          value: () => onOff(prefs().autoplayNext), run: () => setPref('autoplayNext', !prefs().autoplayNext),
        },
        {
          label: 'Up next countdown', value: () => prefs().upnextSeconds + ' seconds',
          run: () => setPref('upnextSeconds', COUNTDOWNS[(COUNTDOWNS.indexOf(prefs().upnextSeconds) + 1) % COUNTDOWNS.length]),
        },
      ],
    },
    // Nothing to act on: focus stays on the group.
    { label: 'About', icon: icons.info, rows: [] },
    {
      label: 'Advanced', icon: icons.sliders, rows: [
        { label: 'Performance overlay', value: () => onOff(hudEnabled()), run: () => setHud(!hudEnabled()) },
        // For before/after recordings: brings back the full-screen gradients that took ~2s per repaint.
        {
          label: 'Demo: original slow renderer', sub: 'The old full-screen gradients, for comparison videos.',
          value: () => onOff(legacyGradients()), run: () => setLegacyGradients(!legacyGradients()),
        },
        // Host and port only: a plex.direct host is long enough that the ellipsis would hide the port.
        { label: 'Server address', value: () => (session.server ? serverAddress(session.server.uri) : '—') },
      ],
    },
  ];

  // Every pane is built once and stacked; changing group only swaps which one is visible.
  for (const g of groups) {
    g.el = h('div', 'menu-opt settings-group', groupList);
    g.el.innerHTML = g.icon;
    h('span', '', g.el).textContent = g.label;
    g.pane = h('div', 'settings-pane', el);
    fill(g);
  }

  // After a first sign-in the profile list can land while this screen is open.
  const offUsers = onUsersChange(() => {
    const g = groups[0];
    if (g.profiles === hasProfiles()) return;
    g.profiles = hasProfiles();
    g.rows = accountRows();
    fill(g);
    ri = Math.min(ri, g.rows.length - 1);
    render();
  });

  function fill(g) {
    g.pane.innerHTML = '';
    if (!g.rows.length) about(g.pane);
    for (const it of g.rows) {
      it.el = h('div', it.sub ? 'setting setting-two' : 'setting', g.pane);
      const label = h('span', 'setting-label', it.el);
      label.textContent = it.label;
      if (it.sub) h('small', '', label).textContent = it.sub;
      it.valueEl = h('span', 'setting-value', it.el);
      refresh(it);
    }
    if (g.note) h('p', 'settings-note', g.pane).textContent = g.note;
  }

  function about(pane) {
    const lockup = h('div', 'settings-lockup', pane);
    lockup.innerHTML = icons.mark;
    h('span', '', lockup).textContent = 'kinescope';
    h('div', 'settings-version', pane).textContent = 'Version ' + VERSION + (DEV ? ' (dev)' : '');
    const body = h('p', 'settings-body', pane);
    h('span', '', body).textContent = 'Based on SamSUCKS by rfaile313.';
    h('span', '', body).textContent = 'Free software under the GNU General Public License 3.0.';
    h('span', '', body).textContent = 'It comes with no warranty.';
    h('h2', 'settings-credits-title', pane).textContent = 'Credits';
    const list = h('div', 'settings-credits', pane);
    for (const [what, licence] of [['Mona Sans by GitHub', 'SIL Open Font License 1.1'], ['qrcode-generator by Kazuhiko Arase', 'MIT License']]) {
      const row = h('div', 'settings-credit', list);
      h('span', '', row).textContent = what;
      h('span', '', row).textContent = licence;
    }
  }

  // status, while set, stands in for the value: loading and error text for the row's action.
  function refresh(it) {
    const value = typeof it.value === 'function' ? it.value() : it.value;
    setText(it.valueEl, it.status || value);
  }

  function setStatus(it, text) {
    it.status = text;
    refresh(it);
  }

  // Class swaps only: the panes and rows are fixed sizes, so a key press lays nothing out.
  function render() {
    groups.forEach((g, i) => {
      const cur = i === gi;
      toggleClass(g.el, 'focus', cur && zone === 'groups');
      toggleClass(g.el, 'current', cur && zone === 'rows');
      toggleClass(g.pane, 'on', cur);
      g.rows.forEach((it, j) => toggleClass(it.el, 'focus', cur && zone === 'rows' && j === ri));
    });
  }

  function groupsKey(action) {
    switch (action) {
      case 'up': if (gi > 0) { gi--; render(); } return true;
      case 'down': if (gi < groups.length - 1) { gi++; render(); } return true;
      case 'right': case 'enter':
        if (groups[gi].rows.length) { zone = 'rows'; ri = 0; render(); }
        return true;
    }
    return false;
  }

  function rowsKey(action) {
    const rows = groups[gi].rows;
    switch (action) {
      case 'up': if (ri > 0) { ri--; render(); } return true;
      case 'down': if (ri < rows.length - 1) { ri++; render(); } return true;
      case 'left': case 'back': zone = 'groups'; render(); return true;
      case 'right': return true;
      case 'enter': activate(rows[ri]); return true;
    }
    return false;
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

  // Signing out leaves the whole Plex account, not just the profile.
  function doSignOut() {
    signOut();
    restart();
  }

  function restart() {
    // Rebuild from scratch: app.js decides between login and home.
    window.dispatchEvent(new Event('samsucks:restart'));
  }

  render();

  return {
    el,
    name: 'settings',
    onShow() {
      visible = true;
      ambience.restore();
      groups.forEach(g => g.rows.forEach(refresh));
    },
    onHide() { visible = false; },
    onKey(action) {
      return zone === 'rows' ? rowsKey(action) : groupsKey(action);
    },
    destroy() { alive = false; offUsers(); },
  };
}
