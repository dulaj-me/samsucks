// Boot: restore the session and go straight to Home, as the last profile, when we can;
// otherwise sign in.
import { DEV, DEV_HOST, DEV_PLEX_URL, VERSION } from './config.js';
import * as router from './router.js';
import { isTizen, registerKeys } from './platform/tizen.js';
import { session, reconnect, signOut, refreshUsers, profileToken, onServerFailure } from './session.js';
import { getUser, hasPlexTv } from './plex/auth.js';
import { HomeScreen } from './screens/home.js';
import { LoginScreen } from './screens/login.js';
import { ProfilesScreen } from './screens/profiles.js';
import { initHud } from './ui/hud.js';
import { toast, setSticky } from './ui/toast.js';
import { log, warn } from './util/log.js';
import * as nav from './nav.js';
import * as store from './util/store.js';

// The home-user list waits until Home has loaded: its TLS handshake with plex.tv costs
// the TV's CPU.
const USERS_DELAY = 3000;
// Retries while the server is unreachable back off from the first to the last.
const RETRY_FIRST = 3000;
const RETRY_LAST = 10000;

let usersTimer = 0;
let checking = false;

function goHome() {
  router.reset(HomeScreen());
  clearTimeout(usersTimer);
  usersTimer = setTimeout(() => refreshUsers().catch(e => warn('home users refresh failed', e.message)), USERS_DELAY);
}

function goLogin() {
  setSticky('');
  router.reset(LoginScreen({ onDone: goHome }));
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// The saved connection, then one re-resolved from plex.tv with a fresh server token. '/'
// needs auth, unlike /identity, so a dead token shows up here.
// Resolves 'ok', 'moved' (a new server is in use), 'rejected' or 'lost'. Without
// resolve, only the saved connection is tried: each plex.tv round costs the TV a TLS handshake.
async function reach(onLost, resolve) {
  try {
    await session.server.get('/');
    return 'ok';
  } catch (e) {
    warn('server check failed', e.message);
    if (e.status !== 401) onLost();
    if (!resolve && e.status !== 401) return 'lost';
  }
  if (!hasPlexTv(session.token)) return 'lost';
  try {
    await reconnect();
  } catch (e) {
    return e.status === 401 ? 'rejected' : 'lost';
  }
  // A fresh token the server still refuses waits for the next retry instead of looping.
  return session.server.get('/').then(() => 'moved', () => 'lost');
}

// While the server is unreachable a message stays up and the ladder retries; the
// app keeps running on whatever is on screen.
async function verify() {
  if (checking) return;
  checking = true;
  let lost = false;
  const setLost = on => {
    if (lost === on) return;
    lost = on;
    setSticky(on ? 'Can’t reach ' + (session.server ? session.server.name : 'your server') + '. Reconnecting…' : '');
  };
  let wait = RETRY_FIRST;
  let tries = 0;
  try {
    while (session.token && session.server) {
      const token = profileToken();
      const result = await reach(() => setLost(true), tries++ % 3 === 0);
      // A switch or sign-out happened meanwhile: start over for the new state.
      if (profileToken() !== token) {
        setLost(false);
        wait = RETRY_FIRST;
        tries = 0;
        continue;
      }
      if (result === 'lost') {
        setLost(true);
        await sleep(wait);
        wait = Math.min(wait * 2, RETRY_LAST);
        continue;
      }
      if (result === 'rejected') {
        await tokenRejected();
      } else if (lost || result === 'moved') {
        // A silent token refresh needs no toast, but Home still rebuilds: it is keyed on the
        // Server instance and has no public reload. Other screens read session.server per request.
        if (lost) toast('Reconnected to ' + session.server.name + '.');
        const top = router.top();
        if (top && top.name === 'home') goHome();
      }
      break;
    }
  } finally {
    setLost(false);
    checking = false;
  }
}

function serverFailed(server, e) {
  if (server !== session.server) return;
  const unreachable = e.name === 'TypeError' || e.name === 'AbortError' || e.status === 502 || e.status === 503 || e.status === 504;
  if (unreachable || e.status === 401) verify();
}

// A rejected profile token means picking the profile again, with the account token.
// Only plex.tv rejecting the account token itself signs out.
async function tokenRejected() {
  const token = session.token;
  if (session.user && session.user.token) {
    const accountOk = await getUser(token).then(() => true, e => e.status !== 401);
    if (session.token !== token) return;
    if (accountOk) {
      router.reset(ProfilesScreen({ rejected: true }));
      toast('Plex needs you to pick your profile again.', 5000);
      return;
    }
  }
  warn('plex.tv rejected the account token');
  signOut();
  goLogin();
  toast('Plex signed this TV out. Sign in again to keep watching.', 5000);
}

// The UI is laid out for the TV's fixed 1920×1080 viewport. In a desktop
// browser, zoom it to fit the window and center it. zoom (not a transform)
// re-renders text and images at the window's real resolution.
function fitWindow() {
  const root = document.documentElement;
  const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  root.style.position = 'relative'; // so the margins below move #app too
  root.style.zoom = s;
  root.style.marginLeft = Math.max(0, (innerWidth - 1920 * s) / 2 / s) + 'px';
  root.style.marginTop = Math.max(0, (innerHeight - 1080 * s) / 2 / s) + 'px';
}

function start() {
  // A release build installed over a dev build must not inherit its LAN shortcut.
  if (!DEV && session.token === 'lan-dev') {
    signOut();
    store.set('hud', undefined);
  }
  if (DEV && DEV_PLEX_URL && !session.token) {
    // Dev shortcut for servers that allow unauthenticated LAN access.
    store.set('token', 'lan-dev');
    store.set('user', { title: 'LAN (dev)' });
    store.set('server', { uri: DEV_PLEX_URL, token: '', name: 'Plex (LAN dev)', id: 'lan-dev' });
    location.reload();
    return;
  }
  if (session.token && session.server) {
    goHome();
    verify();
  } else {
    goLogin();
  }
}

export function boot() {
  if (DEV) window.__ss = { router, session, nav };
  log('boot', VERSION, navigator.userAgent);
  registerKeys();
  if (!isTizen) {
    fitWindow();
    window.addEventListener('resize', fitWindow);
  }
  router.init(document.getElementById('app'));
  onServerFailure(serverFailed);
  initHud(() => (router.top() && router.top().name) || '');
  window.addEventListener('samsucks:restart', start);
  // Dev builds only; release builds don't ship js/dev/.
  if (DEV && DEV_HOST) import('./dev/remote.js').then(m => m.startDevRemote());
  start();
  const splash = document.getElementById('splash');
  setTimeout(() => {
    splash.classList.add('gone');
    setTimeout(() => splash.parentNode && splash.parentNode.removeChild(splash), 400);
  }, 500);
}
