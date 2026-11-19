// plex.tv sign-in (PIN / plex.tv/link), Plex Home profiles and server discovery.
import { request, clientId, PRODUCT, query } from './client.js';
// A namespace import: the preview adds DEV_PLEX_TV (its plex.tv fixtures), but the
// config.js that deploy.sh writes for dev builds has no such export.
import * as config from '../config.js';
import { log, warn } from '../util/log.js';

// Tied to DEV so a stray value can never send a release build's account token elsewhere.
const fixtures = config.DEV && config.DEV_PLEX_TV;
const TV = (fixtures || 'https://plex.tv') + '/api/v2';

// The dev LAN shortcut has no plex.tv account, except in the preview, whose fixtures stand in.
export function hasPlexTv(token) {
  return !!token && (token !== 'lan-dev' || !!fixtures);
}

export async function createPin() {
  // Non-strong PINs are the 4-character codes plex.tv/link accepts.
  return request(TV + '/pins', { method: 'POST', params: { strong: 'false' } });
}

export async function checkPin(id) {
  const pin = await request(TV + '/pins/' + id);
  return pin.authToken || null;
}

// Link that signs this device in from a phone, encoded in the login QR code.
export function authAppUrl(code) {
  return 'https://app.plex.tv/auth#?' + query({
    clientID: clientId,
    code,
    'context[device][product]': PRODUCT,
  });
}

export async function getUser(token) {
  return request(TV + '/user', { token });
}

// Undocumented and drifting: v2 answers { users: [...] }, older shapes were a bare list.
export async function getHomeUsers(token) {
  const res = await request(TV + '/home/users', { token });
  const users = Array.isArray(res) ? res : res.users;
  return Array.isArray(users) ? users : [];
}

// Returns the profile's user object, whose authToken is the profile token.
// A wrong or missing PIN is a 403 (error code 1041).
export function switchHomeUser(token, uuid, pin) {
  return request(TV + '/home/users/' + encodeURIComponent(uuid) + '/switch', { method: 'POST', token, params: { pin } });
}

export async function getServers(token) {
  const resources = await request(TV + '/resources', {
    token, params: { includeHttps: 1, includeRelay: 1, includeIPv6: 0 },
  });
  // forToken lets useServer() refuse a resource listed for a profile that is no longer active.
  return resources.filter(r => (r.provides || '').indexOf('server') !== -1)
    .map(r => Object.assign(r, { forToken: token }));
}

function probe(uri, token, timeout) {
  const started = Date.now();
  return request(uri + '/identity', { token, timeout }).then(() => ({ uri, ms: Date.now() - started }));
}

// Plain HTTP on the LAN is the fastest path on a TV CPU (no TLS), so try that
// first, then the plex.direct HTTPS URLs, then remote, then relay.
export function candidateUris(resource) {
  const conns = resource.connections || [];
  const local = conns.filter(c => c.local && !c.relay);
  const remote = conns.filter(c => !c.local && !c.relay);
  const relay = conns.filter(c => c.relay);
  const tiers = [];
  if (resource.httpsRequired !== true) {
    tiers.push(local.map(c => 'http://' + c.address + ':' + c.port));
  }
  tiers.push(local.map(c => c.uri));
  tiers.push(remote.map(c => c.uri));
  tiers.push(relay.map(c => c.uri));
  return tiers.filter(t => t.length);
}

function firstSuccess(promises) {
  return new Promise((resolve, reject) => {
    let pending = promises.length;
    if (!pending) reject(new Error('no candidates'));
    promises.forEach(p => p.then(resolve, () => { if (--pending === 0) reject(new Error('all failed')); }));
  });
}

export async function connect(resource) {
  const token = resource.accessToken;
  for (const tier of candidateUris(resource)) {
    try {
      const hit = await firstSuccess(tier.map(uri => probe(uri, token, 4000)));
      log('connected to', resource.name, 'via', hit.uri, hit.ms + 'ms');
      return hit.uri;
    } catch (e) {
      warn('connection tier failed', tier.join(', '));
    }
  }
  throw new Error('Could not reach ' + resource.name);
}
