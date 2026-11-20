// Actions for one item, opened in the screen's side Menu by holding OK on it.
import * as icons from './icons.js';
import { session } from '../session.js';
import { episodeLabel } from '../util/format.js';
import { playItem } from '../nav.js';
import { error } from '../util/log.js';

export const isWatched = it => (it.type === 'show' || it.type === 'season')
  ? it.viewedLeafCount >= it.leafCount : !!it.viewCount;

// Marks it watched, or unwatched if it already is. A show or season covers all its episodes.
export async function toggleWatched(it) {
  const server = session.server;
  if (isWatched(it)) await server.unscrobble(it.ratingKey);
  else await server.scrobble(it.ratingKey);
  server.invalidate();
}

// Plex keeps the progress; the item returns to Continue Watching once it is played again.
export function removeFromContinueWatching(it) {
  return session.server.put('/actions/removeFromContinueWatching', { ratingKey: it.ratingKey });
}

function subtitle(it) {
  if (it.type === 'episode') return (it.grandparentTitle ? it.grandparentTitle + '  ·  ' : '') + episodeLabel(it);
  if (it.type === 'season') return it.parentTitle || '';
  return it.year ? String(it.year) : '';
}

// changed(item) runs once the watched state has changed, so the screen can refresh it.
// play: false leaves Play out where OK on the item already plays it.
// remove(item), given only where the item sits in Continue Watching, adds the action to take
// it out; the screen owns the call so the item can leave its row at once.
export function openItemMenu(menu, item, { changed, remove, sub, play = true } = {}) {
  if (!item) return;
  const watched = isWatched(item);
  const items = [];
  if (play) items.push({ icon: icons.play, label: 'Play', run: () => playItem(item) });
  items.push({
    icon: watched ? icons.uncheck : icons.check,
    label: watched ? 'Mark as unwatched' : 'Mark as watched',
    run: () => toggleWatched(item).then(() => changed && changed(item), e => error('mark watched failed', e)),
  });
  if (remove) items.push({ icon: icons.remove, label: 'Remove from Continue Watching', run: () => remove(item) });
  menu.open({ title: item.title, sub: sub != null ? sub : subtitle(item), items });
}
