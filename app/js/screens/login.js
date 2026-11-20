// Sign in with a plex.tv/link code (or by scanning the QR code with a phone),
// then pick a server.
import qrcode from '../vendor/qrcode.js';
import { h, setText, show, toggleClass } from '../util/dom.js';
import { createPin, checkPin, authAppUrl, getUser, getServers, connect } from '../plex/auth.js';
import { signIn, useServer, session } from '../session.js';
import * as router from '../router.js';
import { error, log } from '../util/log.js';
import { useAmbience } from '../ui/backdrop.js';
import * as icons from '../ui/icons.js';

export function LoginScreen({ onDone }) {
  // .waiting until the first code arrives, .failed while plex.tv can't be reached.
  const el = h('div', 'screen login waiting');
  const ambience = useAmbience({ topLeft: '6e4a33', topRight: '2c2b33', bottomLeft: '3e2c22', bottomRight: '1c1d26' });
  h('div', 'brand', h('header', 'topbar', el)).innerHTML = icons.mark + 'kinescope';

  const sign = h('div', 'login-sign', el);
  h('h1', 'login-title', sign).textContent = 'Sign in to Plex';
  h('p', 'login-body', sign).innerHTML = 'Go to <b>plex.tv/link</b> on your phone and enter this code.';
  const code = h('div', 'login-code', sign);
  const boxes = [];
  h('div', 'btn focus', sign).textContent = 'New code';
  const status = h('div', 'login-status', sign);
  h('span', '', h('div', 'login-or', el)).textContent = 'or';
  const qr = h('div', 'login-qr', el);
  const qrCard = h('div', 'login-qr-card', qr);
  h('p', 'login-qr-label', qr).textContent = 'Scan with your phone’s camera';

  const fail = h('div', 'login-error', el);
  h('h1', 'login-title', fail).textContent = 'Can’t reach plex.tv';
  const failBody = h('p', 'login-body', fail);
  h('span', '', failBody).textContent = 'Check the TV’s internet connection.';
  h('span', '', failBody).textContent = 'Kinescope keeps trying every few seconds.';
  h('div', 'btn focus', fail).innerHTML = icons.restart + 'Try again';

  let timer = 0;
  let alive = true;
  // Bumped by every start() and by destroy(), so a code, poll or sign-in from an earlier one stops.
  let attempt = 0;
  let finishing = false;

  function setCode(text) {
    while (boxes.length < text.length) boxes.push(h('b', '', code));
    boxes.forEach((b, i) => { show(b, i < text.length); setText(b, text.charAt(i).trim()); });
  }

  async function start() {
    clearTimeout(timer);
    const mine = ++attempt;
    // Empty boxes and no QR while the new code is on its way: the old one is no longer polled.
    toggleClass(el, 'waiting', true);
    setCode('    ');
    try {
      setText(status, '');
      const pin = await createPin();
      if (!alive || mine !== attempt) return;
      toggleClass(el, 'failed', false);
      toggleClass(el, 'waiting', false);
      setCode(pin.code);
      const q = qrcode(0, 'M');
      q.addData(authAppUrl(pin.code));
      q.make();
      qrCard.innerHTML = q.createSvgTag({ cellSize: 6, margin: 0, scalable: true });
      const expires = Date.now() + (pin.expiresIn || 900) * 1000 - 5000;
      const poll = async () => {
        if (!alive || mine !== attempt) return;
        if (Date.now() > expires) { start(); return; }
        let token;
        try {
          token = await checkPin(pin.id);
        } catch (e) {
          error('pin poll failed', e);
        }
        if (!alive || mine !== attempt) return;
        if (token) { finishOnce(token, mine); return; }
        timer = setTimeout(poll, 2000);
      };
      timer = setTimeout(poll, 2000);
    } catch (e) {
      error('createPin failed', e);
      if (!alive || mine !== attempt) return;
      toggleClass(el, 'failed', true);
      timer = setTimeout(start, 4000);
    }
  }

  // The PIN is spent once it has a token: a failure here says so and stops, and OK starts over.
  async function finishOnce(token, mine) {
    finishing = true;
    try {
      await finish(token, () => !alive || mine !== attempt);
    } catch (e) {
      error('sign-in failed', e);
      if (alive && mine === attempt) setText(status, 'Couldn’t finish signing in. Press OK for a new code.');
    } finally {
      finishing = false;
    }
  }

  async function finish(token, stale) {
    setText(status, 'Signed in. Finding your servers…');
    const user = await getUser(token);
    if (stale()) return;
    signIn(token, user);
    log('signed in as', session.user.title);
    const servers = await getServers(token);
    if (stale()) return;
    if (!servers.length) {
      setText(status, 'No Plex Media Servers on this account.');
      return;
    }
    if (servers.length === 1) {
      setText(status, 'Connecting to ' + servers[0].name + '…');
      const uri = await connect(servers[0]);
      if (stale()) return;
      useServer(servers[0], uri);
      onDone();
      return;
    }
    router.replace(ServerPicker({ servers, onDone }));
  }

  start();

  return {
    el,
    name: 'login',
    onShow() { ambience.restore(); },
    onKey(action) {
      // New code, or Try again: either way, ask plex.tv now. Not while a sign-in is finishing.
      if (action === 'enter') { if (!finishing) start(); return true; }
      return false;
    },
    destroy() {
      alive = false;
      attempt++;
      clearTimeout(timer);
    },
  };
}

// After sign-in when the account has several servers, and from Settings.
export function ServerPicker({ servers, onDone }) {
  const el = h('div', 'screen picker');
  const ambience = useAmbience();
  const col = h('div', 'picker-col', el);
  h('h1', 'picker-title', col).textContent = 'Choose a server';
  const list = h('div', 'picker-list', col);
  const status = h('div', 'picker-status', col);
  const buttons = servers.map(s => {
    const b = h('div', 'btn btn-wide', list);
    h('span', '', b).textContent = s.name;
    h('small', '', b).textContent = s.owned ? 'Your server' : 'Shared by ' + (s.sourceTitle || 'a friend');
    return b;
  });
  let index = 0;
  let alive = true;
  // One connection at a time; Back while it runs leaves the server as it was.
  let connecting = false;
  const render = () => buttons.forEach((b, i) => toggleClass(b, 'focus', i === index));
  render();

  return {
    el,
    name: 'picker',
    onShow() { ambience.restore(); },
    onKey(action) {
      if (action === 'up' || action === 'down') {
        index = Math.max(0, Math.min(servers.length - 1, index + (action === 'down' ? 1 : -1)));
        render();
        return true;
      }
      if (action === 'enter') {
        if (connecting) return true;
        connecting = true;
        const s = servers[index];
        setText(status, 'Connecting to ' + s.name + '…');
        connect(s).then(uri => {
          connecting = false;
          if (alive && useServer(s, uri)) onDone();
        }, e => {
          connecting = false;
          if (alive) setText(status, e.message);
        });
        return true;
      }
      return false;
    },
    destroy() { alive = false; },
  };
}
