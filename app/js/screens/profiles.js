// "Who's watching?": the Plex Home's profiles, a PIN pad for protected ones, and a choice
// of server when the picked profile can't use the current one.
import { h, setText, toggleClass, show } from '../util/dom.js';
import { session, refreshUsers, resolveProfile, useProfile, signOut } from '../session.js';
import { connect, getUser } from '../plex/auth.js';
import * as router from '../router.js';
import { useAmbience } from '../ui/backdrop.js';
import { avatar } from '../ui/avatar.js';
import * as icons from '../ui/icons.js';
import { error, warn } from '../util/log.js';

const FACE = 200;
// Six 200px faces a line; a Plex Home of 13 to 15 takes eight 150px faces a line (.compact),
// so the picker never needs a third line. A second line raises the block by half its pitch.
const NORMAL = { face: FACE, perLine: 6, shift: 173 };
const COMPACT = { face: 150, perLine: 8, shift: 148 };
const COMPACT_FROM = 13;
const PICKER_TOP = 290;
const PIN_LENGTH = 4;
// The pad row by row; '' is the empty slot left of 0, which never takes focus.
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
const COLS = 3;

function restart() {
  // app.js rebuilds the stack from Home, so no screen of the old profile survives.
  window.dispatchEvent(new Event('samsucks:restart'));
}

// rejected: plex.tv turned the active profile's token down, so it has to be picked again.
export function ProfilesScreen({ rejected = false } = {}) {
  const el = h('div', 'screen profiles');
  const ambience = useAmbience();
  h('div', 'profiles-veil', el);

  const picker = h('div', 'profiles-picker', el);
  const title = h('h1', 'profiles-title', picker);
  const people = h('div', 'profiles-people', picker);
  const list = h('div', 'profiles-servers', picker);
  const status = h('div', 'profiles-status', picker);

  const pinEl = h('div', 'pin', el);
  const who = h('div', 'pin-who', pinEl);
  const pad = h('div', 'pin-pad', pinEl);
  h('h1', 'pin-title', pad).textContent = 'Enter PIN';
  const dots = h('div', 'pin-dots', pad);
  for (let i = 0; i < PIN_LENGTH; i++) h('i', '', dots);
  const msg = h('div', 'pin-msg', pad);
  const keypad = h('div', 'pin-keys', pad);
  const keyEls = KEYS.map(k => {
    const b = h('div', k ? 'pin-key' : 'pin-key pin-blank', keypad);
    if (k === 'del') b.innerHTML = icons.del;
    else b.textContent = k;
    return b;
  });

  let mode = 'users';   // 'users' | 'pin' | 'servers'
  let options = [];     // faces or servers: { el, run }
  let index = 0;
  let layout = NORMAL;
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
    show(picker, m !== 'pin');
    show(people, m === 'users');
    show(list, m === 'servers');
    show(pinEl, m === 'pin');
  }

  function renderOptions() {
    options.forEach((o, i) => toggleClass(o.el, 'focus', i === index));
  }

  function showUsers() {
    setMode('users', 'Who’s watching?');
    const users = session.users || [];
    const me = session.user && session.user.uuid;
    layout = users.length >= COMPACT_FROM ? COMPACT : NORMAL;
    toggleClass(people, 'compact', layout === COMPACT);
    people.innerHTML = '';
    options = users.map(u => {
      const p = h('div', 'profile', people);
      // The lift and ring are layers of their own, faded in; only the face scales.
      const face = h('div', 'profile-face', p);
      h('i', 'profile-lift', face);
      avatar(face, u, layout.face);
      h('i', 'profile-ring', face);
      h('div', 'profile-name', p).textContent = u.title;
      const lock = h('div', 'profile-lock', p);
      if (u.protected) lock.innerHTML = icons.lock;
      return { el: p, run: () => pick(u) };
    });
    const lines = Math.max(1, Math.ceil(users.length / layout.perLine));
    picker.style.top = (PICKER_TOP - (lines - 1) * layout.shift) + 'px';
    index = Math.max(0, users.findIndex(u => u.uuid === me));
    renderOptions();
    if (!users.length) setText(status, 'Loading profiles…');
  }

  function showPin(u) {
    picked = u;
    setMode('pin', '');
    who.innerHTML = '';
    avatar(who, u, FACE);
    h('div', 'profile-name', who).textContent = u.title;
    pin = '';
    keyIndex = 0;
    setMsg('');
    renderPin();
  }

  function setMsg(text, isError) {
    setText(msg, text);
    toggleClass(msg, 'error', !!isError);
  }

  function renderPin() {
    for (let i = 0; i < PIN_LENGTH; i++) toggleClass(dots.children[i], 'on', i < pin.length);
    keyEls.forEach((b, i) => toggleClass(b, 'focus', i === keyIndex));
  }

  function showServers(u, res) {
    const here = session.server ? session.server.name : 'this server';
    setMode('servers', u.title + ' can’t use ' + here);
    picker.style.top = PICKER_TOP + 'px';
    list.innerHTML = '';
    options = res.servers.map(s => {
      const b = h('div', 'btn btn-wide', list);
      h('span', '', b).textContent = s.name;
      h('small', '', b).textContent = s.owned ? 'Your server' : 'Shared by ' + (s.sourceTitle || 'a friend');
      return { el: b, run: () => chooseServer(res.profile, s) };
    });
    index = 0;
    renderOptions();
    setText(status, res.servers.length ? 'Pick a server for ' + u.title + '.' : u.title + ' has no Plex servers. Press Back to pick another profile.');
  }

  // Progress and errors go under the dots while the pad is up, else under the faces.
  function say(text, isError) {
    if (mode === 'pin') setMsg(text, isError);
    else setText(status, text);
  }

  async function pick(u, withPin) {
    if (busy) return;
    if (withPin === undefined) {
      if (!rejected && session.user && u.uuid === session.user.uuid) { router.back(); return; }
      if (u.protected) { showPin(u); return; }
    }
    busy = true;
    const mine = attempt;
    say('Switching to ' + u.title + '…');
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
          setMsg('That PIN didn’t match. Try again.', true);
        } else {
          showPin(u);
        }
      } else {
        error('profile switch failed', e);
        if (mode === 'pin') { pin = ''; renderPin(); }
        say('Can’t reach plex.tv right now.' + (session.user ? ' ' + session.user.title + ' is still watching.' : ''), true);
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
    if (!pin) setMsg('');
    pin += d;
    renderPin();
    if (pin.length === PIN_LENGTH) pick(picked, pin);
  }

  // Moves within the 3-column pad; the empty slot and the edges stop it.
  function moveKey(next) {
    if (next < 0 || next >= KEYS.length || !KEYS[next]) return;
    keyIndex = next;
    renderPin();
  }

  function pinKey(action) {
    if (/^[0-9]$/.test(action)) { typeDigit(action); return true; }
    switch (action) {
      case 'left': if (keyIndex % COLS > 0) moveKey(keyIndex - 1); return true;
      case 'right': if (keyIndex % COLS < COLS - 1) moveKey(keyIndex + 1); return true;
      case 'up': moveKey(keyIndex - COLS); return true;
      case 'down': moveKey(keyIndex + COLS); return true;
      case 'enter':
        if (KEYS[keyIndex] !== 'del') typeDigit(KEYS[keyIndex]);
        else if (!busy) { pin = pin.slice(0, -1); renderPin(); }
        return true;
      case 'back': showUsers(); return true;
    }
    return false;
  }

  function move(delta) {
    const next = index + delta;
    if (next < 0 || next >= options.length) return;
    index = next;
    renderOptions();
  }

  // Lines fill left to right and the short last one is centred, so ▲ and ▼ match faces by
  // their offset from the centre, landing on the nearest face in the next line.
  function moveLine(dir) {
    const per = layout.perLine;
    const line = Math.floor(index / per) + dir;
    if (line < 0 || line * per >= options.length) return;
    const count = l => Math.min(per, options.length - l * per);
    const offset = index % per - (count(line - dir) - 1) / 2;
    const col = Math.round(offset + (count(line) - 1) / 2);
    move(line * per + Math.max(0, Math.min(count(line) - 1, col)) - index);
  }

  function usersKey(action) {
    switch (action) {
      case 'left': move(-1); return true;
      case 'right': move(1); return true;
      case 'up': moveLine(-1); return true;
      case 'down': moveLine(1); return true;
      case 'enter': if (options[index]) options[index].run(); return true;
    }
    return false;
  }

  function serversKey(action) {
    switch (action) {
      case 'up': move(-1); return true;
      case 'down': move(1); return true;
      case 'enter': if (options[index]) options[index].run(); return true;
      case 'back': showUsers(); return true;
    }
    return false;
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
      if (mode === 'servers') return serversKey(action);
      return usersKey(action);
    },
    destroy() { alive = false; },
  };
}
