// A profile's picture in a circle. Plex avatars are plex.tv URLs; the server's transcoder
// sizes them like any other image. The initial underneath shows for profiles without a
// picture and when loading fails.
import { h } from '../util/dom.js';
import { session } from '../session.js';

// plex.tv sends 80px avatars unless asked for a size, too small for a 200px face.
function sourced(thumb, size) {
  if (!/^https:\/\/plex\.tv\/users\/[^/]+\/avatar/.test(thumb)) return thumb;
  return thumb + (thumb.indexOf('?') >= 0 ? '&' : '?') + 's=' + size * 2;
}

export function avatar(parent, user, size) {
  const box = h('div', 'avatar', parent);
  box.style.width = size + 'px';
  box.style.height = size + 'px';
  box.style.fontSize = Math.round(size * 0.42) + 'px';
  h('span', 'avatar-letter', box).textContent = ((user && user.title) || '?').charAt(0).toUpperCase();
  if (user && user.thumb && session.server) {
    const img = h('img', 'avatar-img', box);
    img.onerror = () => img.remove();
    img.src = session.server.image(sourced(user.thumb, size), size, size);
  }
  return box;
}
