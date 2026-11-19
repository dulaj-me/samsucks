// Who is signed in, which Plex Home profile is active and which server we're talking to.
// Persisted so a restart goes straight to the home screen.
import * as store from './util/store.js';
import { Server } from './plex/server.js';
import { getServers, connect, getHomeUsers, switchHomeUser, hasPlexTv } from './plex/auth.js';
import { log } from './util/log.js';

// token: the account token from sign-in, used only for plex.tv account calls.
// user: the active profile. user.token is the profile token; a stored user without one
// (every install from before profiles) is the account's own profile.
// users: the Plex Home's profiles, without tokens, so the nav and picker paint at once.
// Only the active profile's token is ever stored: keeping the others would skip their PINs.
export const session = {
  token: store.get('token'),
  user: store.get('user'),
  server: null,
  users: store.get('homeUsers') || null,
};

const saved = store.get('server');
if (saved) session.server = new Server(saved);

export function profileToken() {
  return (session.user && session.user.token) || session.token;
}

export function hasProfiles() {
  return !!session.users && session.users.length > 1;
}

const usersListeners = [];
export function onUsersChange(fn) {
  usersListeners.push(fn);
}

export function signIn(token, user) {
  session.token = token;
  session.user = { title: user.title || user.username, thumb: user.thumb, uuid: user.uuid };
  store.set('token', token);
  store.set('user', session.user);
}

export function useServer(resource, uri) {
  session.server = new Server({ uri, token: resource.accessToken, name: resource.name, id: resource.clientIdentifier });
  store.set('server', { uri, token: resource.accessToken, name: resource.name, id: resource.clientIdentifier });
}

export function signOut() {
  session.token = null;
  session.user = null;
  session.server = null;
  session.users = null;
  store.set('token', undefined);
  store.set('user', undefined);
  store.set('server', undefined);
  store.set('homeCache', undefined);
  store.set('homeUsers', undefined);
}

// The saved URI can go stale (DHCP, remote vs. home). Re-resolve it from plex.tv.
export async function reconnect() {
  const servers = await getServers(profileToken());
  const current = session.server && servers.find(s => s.clientIdentifier === session.server.id);
  const resource = current || servers[0];
  if (!resource) throw new Error('No Plex servers on this account');
  const uri = await connect(resource);
  useServer(resource, uri);
  log('reconnected', resource.name, uri);
  return session.server;
}

// Resolves true when the list changed.
export async function refreshUsers() {
  if (!hasPlexTv(session.token)) return false;
  const users = (await getHomeUsers(session.token)).map(u => ({
    uuid: u.uuid,
    title: u.title || u.username || u.friendlyName || '',
    thumb: u.thumb || '',
    admin: !!u.admin,
    restricted: !!u.restricted,
    protected: !!u.protected,
  }));
  if (JSON.stringify(users) === JSON.stringify(session.users)) return false;
  session.users = users;
  store.set('homeUsers', users);
  usersListeners.forEach(fn => fn());
  return true;
}

// Switches on plex.tv without touching the session, so a cancelled switch leaves nothing
// behind. current is the profile's resource for the server in use, if it can reach it.
export async function resolveProfile(homeUser, pin) {
  const u = await switchHomeUser(session.token, homeUser.uuid, pin);
  if (!u.authToken) throw new Error('plex.tv sent no token for ' + homeUser.title);
  const profile = { title: u.title || homeUser.title, thumb: u.thumb || homeUser.thumb, uuid: u.uuid || homeUser.uuid, token: u.authToken };
  const servers = await getServers(profile.token);
  const current = session.server && servers.find(s => s.clientIdentifier === session.server.id);
  return { profile, servers, current };
}

// Profile and server change together: Home keys its cache and stale checks on both.
export function useProfile(profile, resource, uri) {
  session.user = profile;
  store.set('user', profile);
  useServer(resource, uri);
  store.set('homeCache', undefined);
  log('profile', profile.title, 'on', resource.name);
}
