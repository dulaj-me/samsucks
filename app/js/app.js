// Boot: restore the session and go straight to Home, as the last profile, when we can;
// otherwise sign in.
import { DEV, DEV_HOST, DEV_PLEX_URL, VERSION } from './config.js';
import * as router from './router.js';
import { isTizen, registerKeys } from './platform/tizen.js';
import { session, reconnect, signOut, refreshUsers } from './session.js';
import { HomeScreen } from './screens/home.js';
import { LoginScreen } from './screens/login.js';
import { ProfilesScreen } from './screens/profiles.js';
import { initHud } from './ui/hud.js';
import { log, warn } from './util/log.js';
import * as nav from './nav.js';
import * as store from './util/store.js';

// The home-user list waits until Home has loaded: its TLS handshake with plex.tv costs
// the TV's CPU.
const USERS_DELAY = 3000;

let usersTimer = 0;

function goHome() {
  router.reset(HomeScreen());
  clearTimeout(usersTimer);
  usersTimer = setTimeout(() => refreshUsers().catch(e => warn('home users refresh failed', e.message)), USERS_DELAY);
}

function goLogin() {
  router.reset(LoginScreen({ onDone: goHome }));
}

async function verify() {
  // Home already painted from cache; make sure the saved connection still works.
  try {
    await session.server.get('/identity');
    return;
  } catch (e) {
    warn('saved server failed, re-resolving', e.message);
  }
  // Re-resolving also derives a fresh server token from the profile token.
  try {
    await reconnect();
    goHome();
  } catch (err) {
    if (err.status === 401) profileRejected();
  }
}

// A rejected profile token means picking the profile again, with the account token. When
// the profile is the account's own, the account token is the one plex.tv rejected.
function profileRejected() {
  if (session.user && session.user.token) {
    router.reset(ProfilesScreen({ rejected: true }));
  } else {
    signOut();
    goLogin();
  }
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
