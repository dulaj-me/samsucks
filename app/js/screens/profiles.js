// "Who's watching?": the Plex Home's profiles, a PIN pad for protected ones, and a choice
// of server when the picked profile can't use the current one.
import { h, setText, toggleClass } from '../util/dom.js';
import { session, refreshUsers, resolveProfile, useProfile, signOut } from '../session.js';
import { connect, getUser } from '../plex/auth.js';
import * as router from '../router.js';
import { useAmbience } from '../ui/backdrop.js';
import { error, warn } from '../util/log.js';

const AVATAR = 80;
const PIN_LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'del'];
const COLS = 3;

// Plex avatars are plex.tv URLs; the server's transcoder sizes them like any other image.
// The initial underneath shows for profiles without a picture and when loading fails.
export function avatar(parent, user, size) {
  const box = h('div', 'avatar', parent);
  box.style.width = size + 'px';
  box.style.height = size + 'px';
  h('span', 'avatar-letter', box).textContent = ((user && user.title) || '?').charAt(0).toUpperCase();
  if (user && user.thumb && session.server) {
    const img = h('img', 'avatar-img', box);
    img.onerror = () => img.remove();
    img.src = session.server.image(user.thumb, size, size);
  }
  return box;
}

function restart() {
  // app.js rebuilds the stack from Home, so no screen of the old profile survives.
  window.dispatchEvent(new Event('samsucks:restart'));
}

// rejected: plex.tv turned the active profile's token down, so it has to be picked again.
export function ProfilesScreen({ rejected = false } = {}) {
  const el = h('div', 'screen picker profiles');
  const ambience = useAmbience();
  const title = h('h1', 'picker-title', el);
  const list = h('div', 'picker-list', el);
  const pad = h('div', 'pin-pad', el);
  const cells = h('div', 'pin-cells', pad);
  const keypad = h('div', 'pin-keys', pad);
  const status = h('div', 'login-status', el);

  for (let i = 0; i < PIN_LENGTH; i++) h('div', 'pill pin-cell', cells);
  const keyEls = KEYS.map(k => {
    const b = h('div', 'btn pin-key', keypad);
    b.textContent = k === 'del' ? 'Delete' : k;
    return b;
  });

  let mode = 'users';   // 'users' | 'pin' | 'servers'
  let options = [];     // the list's entries: { el, run }
  let index = 0;
  let picked = null;    // the home user being switched to
  let pin = '';
  let keyIndex = 0;
  let busy = false;
  let alive = true;
  // Bumped on every mode change, so a switch that returns after Back changes nothing.
  let attempt = 0;

  function setMode(m, heading) {
    mode = m;
    attempt++;
    busy = false;
    setText(title, heading);
    setText(status, '');
    toggleClass(list, 'hidden', m === 'pin');
    toggleClass(pad, 'hidden', m !== 'pin');
  }

  function setOptions(entries, focus) {
    list.innerHTML = '';
    options = entries.map(e => {
      const b = h('div', 'btn btn-wide profile-opt', list);
      if (e.user) avatar(b, e.user, AVATAR);
      const text = h('div', 'profile-text', b);
      h('span', '', text).textContent = e.label;
      if (e.sub) h('small', '', text).textContent = e.sub;
      return { el: b, run: e.run };
    });
    index = Math.max(0, Math.min(options.length - 1, focus));
    renderList();
  }

  function renderList() {
    options.forEach((o, i) => toggleClass(o.el, 'focus', i === index));
  }

  function showUsers() {
    setMode('users', 'Who’s watching?');
    const users = session.users || [];
    const me = session.user && session.user.uuid;
    setOptions(users.map(u => ({
      user: u,
      label: u.title,
      sub: [u.uuid === me && 'Watching now', u.restricted && 'Managed', u.protected && 'PIN'].filter(Boolean).join('  ·  '),
      run: () => pick(u),
    })), Math.max(0, users.findIndex(u => u.uuid === me)));
    if (!users.length) setText(status, 'Loading profiles…');
  }

  function showPin(u) {
    picked = u;
    setMode('pin', 'Enter the PIN for ' + u.title);
    pin = '';
    keyIndex = 0;
    renderPin();
  }

  function renderPin() {
    for (let i = 0; i < PIN_LENGTH; i++) {
      const c = cells.children[i];
      setText(c, i < pin.length ? '•' : '–');
      toggleClass(c, 'current', i < pin.length);
    }
    keyEls.forEach((b, i) => toggleClass(b, 'focus', i === keyIndex));
  }

  function showServers(u, res) {
    const here = session.server ? session.server.name : 'this server';
    setMode('servers', u.title + ' can’t use ' + here);
    setOptions(res.servers.map(s => ({
      label: s.name,
      sub: s.owned ? 'Your server' : 'Shared by ' + (s.sourceTitle || 'a friend'),
      run: () => chooseServer(res.profile, s),
    })), 0);
    setText(status, res.servers.length ? 'Pick a server for ' + u.title + '.' : u.title + ' has no Plex servers. Press Back to pick another profile.');
  }

  async function pick(u, withPin) {
    if (busy) return;
    if (withPin === undefined) {
      if (!rejected && session.user && u.uuid === session.user.uuid) { router.back(); return; }
      if (u.protected) { showPin(u); return; }
    }
    busy = true;
    const mine = attempt;
    setText(status, 'Switching to ' + u.title + '…');
    try {
      const res = await resolveProfile(u, withPin);
      if (!alive || mine !== attempt) return;
      if (res.current) {
        useProfile(res.profile, res.current, session.server.uri);
        restart();
        return;
      }
      showServers(u, res);
    } catch (e) {
      if (!alive || mine !== attempt) return;
      // A wrong PIN may come back as 401 too. Sign out only if plex.tv rejects the account itself.
      const accountRejected = e.status === 401 && await getUser(session.token).then(() => false, err => err.status === 401);
      if (!alive || mine !== attempt) return;
      busy = false;
      if (accountRejected) {
        warn('plex.tv rejected the account token');
        signOut();
        restart();
      } else if (e.status === 403 || e.status === 401) {
        // A wrong PIN, or a PIN the list didn't say this profile needs.
        if (mode === 'pin') {
          pin = '';
          renderPin();
          setText(status, 'Wrong PIN. Try again.');
        } else {
          showPin(u);
        }
      } else {
        error('profile switch failed', e);
        if (mode === 'pin') { pin = ''; renderPin(); }
        setText(status, 'Can’t reach plex.tv right now. ' + (session.user ? session.user.title + ' is still watching.' : ''));
      }
    }
  }

  async function chooseServer(profile, s) {
    if (busy) return;
    busy = true;
    const mine = attempt;
    setText(status, 'Connecting to ' + s.name + '…');
    try {
      const uri = await connect(s);
      if (!alive || mine !== attempt) return;
      useProfile(profile, s, uri);
      restart();
    } catch (e) {
      if (!alive || mine !== attempt) return;
      busy = false;
      setText(status, e.message);
    }
  }

  function typeDigit(d) {
    if (busy || pin.length >= PIN_LENGTH) return;
    if (!pin) setText(status, '');
    pin += d;
    renderPin();
    if (pin.length === PIN_LENGTH) pick(picked, pin);
  }

  function pinKey(action) {
    if (/^[0-9]$/.test(action)) { typeDigit(action); return true; }
    switch (action) {
      case 'left': if (keyIndex % COLS > 0) keyIndex--; break;
      case 'right': if (keyIndex % COLS < COLS - 1 && keyIndex + 1 < KEYS.length) keyIndex++; break;
      case 'up': if (keyIndex >= COLS) keyIndex -= COLS; break;
      case 'down': if (keyIndex + COLS < KEYS.length) keyIndex += COLS; break;
      case 'enter':
        if (KEYS[keyIndex] !== 'del') typeDigit(KEYS[keyIndex]);
        else if (!busy) { pin = pin.slice(0, -1); renderPin(); }
        return true;
      case 'back': showUsers(); return true;
      default: return false;
    }
    renderPin();
    return true;
  }

  showUsers();
  refreshUsers().then(changed => {
    if (changed && alive && mode === 'users' && !busy) showUsers();
  }, e => {
    if (!alive) return;
    warn('home users failed', e.message);
    if (e.status === 401) { signOut(); restart(); return; }
    if (mode === 'users' && !options.length) setText(status, 'Can’t reach plex.tv right now.');
  });

  return {
    el,
    name: 'profiles',
    onShow() { ambience.restore(); },
    onKey(action) {
      if (mode === 'pin') return pinKey(action);
      if (action === 'up' || action === 'down') {
        index = Math.max(0, Math.min(options.length - 1, index + (action === 'down' ? 1 : -1)));
        renderList();
        return true;
      }
      if (action === 'enter') {
        if (options[index]) options[index].run();
        return true;
      }
      if (action === 'back' && mode === 'servers') { showUsers(); return true; }
      return false;
    },
    destroy() { alive = false; },
  };
}
