// Poster / landscape tiles. A tile node is created once and re-filled as it is
// recycled; fill() only touches the DOM for fields that changed.
import { h, setText, show, setTransform } from '../util/dom.js';
import { load } from './images.js';
import { session } from '../session.js';
import { progress, episodeLabel, episodeCode, timeLeft, duration, clock } from '../util/format.js';
import * as icons from './icons.js';

// gap: space between tiles in a row. r: corner radius, when not the usual 14px.
// lines: caption lines the title may wrap to before it ellipsises (default 1).
export const KINDS = {
  wide: { w: 432, h: 243, gap: 36 },
  poster: { w: 240, h: 360, gap: 32 },
  grid: { w: 220, h: 330, gap: 30 },
  episode: { w: 432, h: 243, gap: 36 },
  'search-poster': { w: 200, h: 300, gap: 28 },
  'search-wide': { w: 356, h: 200, gap: 28 },
  cast: { w: 200, h: 200, gap: 32, r: 100, lines: 2 },
  extra: { w: 432, h: 243, gap: 36 },
};

const EXTRA_TYPES = {
  trailer: 'Trailer', behindTheScenes: 'Behind the scenes', deletedScene: 'Deleted scene',
  featurette: 'Featurette', interview: 'Interview', sceneOrSample: 'Scene', short: 'Short',
};

export const LIFT = 1.07;
const RADIUS = 14;
const CAP_LINE = 28; // one caption title line: 23px at 1.2, rounded up

// How much taller than one title line a kind's caption block is. Fixed per kind, so a
// list's geometry never depends on the text it shows.
export function captionExtra({ lines = 1 }) {
  return (lines - 1) * CAP_LINE;
}

// The focused tile scales about its centre. The lift covers the scaled rect; the ring is
// that rect grown by 8px a side (a 4px border at a 4px gap), its corners 8px rounder so the
// gap stays even. Offsets are from the tile's top-left at rest; caption is how far the
// caption drops to clear the scaled frame.
export function focusGeometry({ w, h, r = RADIUS }) {
  const ox = (LIFT - 1) / 2 * w;
  const oy = (LIFT - 1) / 2 * h;
  const lr = Math.round(r * LIFT);
  return {
    lift: { x: -Math.round(ox), y: -Math.round(oy), w: Math.round(w * LIFT), h: Math.round(h * LIFT), r: lr },
    ring: { x: -Math.round(ox + 8), y: -Math.round(oy + 8), w: Math.round(w * LIFT + 16), h: Math.round(h * LIFT + 16), r: lr + 8 },
    caption: Math.round(oy),
  };
}

// The lift (static shadow) and ring of a list's focused tile, on one layer that moves
// or fades as a whole. Sits under the tiles.
export function createFocusBox(parent, size, x, y) {
  const g = focusGeometry(size);
  const box = h('div', 'focus-box', parent);
  const place = (el, r) => {
    el.style.left = (x + r.x) + 'px';
    el.style.top = (y + r.y) + 'px';
    el.style.width = r.w + 'px';
    el.style.height = r.h + 'px';
    el.style.borderRadius = r.r + 'px';
  };
  place(h('div', 'lift', box), g.lift);
  place(h('div', 'ring', box), g.ring);
  return box;
}

export function createTile(kind, { caption = false } = {}) {
  const size = KINDS[kind];
  const el = h('div', 'tile tile-' + kind);
  const frame = h('div', 'tile-frame', el);
  frame.style.width = size.w + 'px';
  frame.style.height = size.h + 'px';
  if (size.r) frame.style.borderRadius = size.r + 'px';
  const img = h('img', 'tile-img', frame);
  const ph = h('div', 'tile-ph', frame);
  img.alt = '';
  const count = h('div', 'tile-count', frame);
  const seen = h('div', 'tile-seen', frame);
  seen.innerHTML = icons.check;
  const bar = h('div', 'tile-bar', frame);
  const fill = h('i', '', bar);
  let cap = null;
  let sub = null;
  if (caption) {
    const text = h('div', 'tile-text tile-text-' + kind, el);
    text.style.width = size.w + 'px';
    cap = h('div', 'tile-cap', text);
    if (size.lines > 1) {
      cap.classList.add('tile-cap-wrap');
      cap.style.webkitLineClamp = String(size.lines);
    }
    sub = h('div', 'tile-sub', text);
  }
  return { el, img, ph, count, seen, bar, fill, cap, sub, kind, size, item: null };
}

function artFor(item, kind) {
  // An extra's art is its movie's backdrop; the thumb is its own frame.
  if (kind === 'extra') return item.thumb || item.art;
  if (kind === 'wide' || kind === 'episode' || kind === 'search-wide') {
    if (item.type === 'episode') return item.thumb || item.art;
    return item.art || item.thumb;
  }
  if (item.type === 'episode') return item.grandparentThumb || item.parentThumb || item.thumb;
  if (item.type === 'season') return item.thumb || item.parentThumb;
  return item.thumb;
}

function titleFor(item, kind) {
  if (item.type === 'episode' && kind !== 'episode') return item.grandparentTitle || item.title;
  return item.title;
}

function subFor(item, kind) {
  if (kind === 'cast') return item.role || '';
  if (kind === 'extra') return [EXTRA_TYPES[item.subtype], item.duration ? clock(item.duration) : ''].filter(Boolean).join('  ·  ');
  if (kind === 'wide') {
    if (item.type === 'episode') return [episodeCode(item), timeLeft(item)].filter(Boolean).join('  ·  ');
    return timeLeft(item) || [item.year, duration(item.duration)].filter(Boolean).join('  ·  ');
  }
  if (kind === 'episode') return episodeLabel(item) + (item.duration ? '  ·  ' + Math.round(item.duration / 60000) + 'm' : '');
  if (item.type === 'episode') return episodeLabel(item) + '  ' + item.title;
  if (item.type === 'season') return item.leafCount ? item.leafCount + ' episodes' : '';
  return item.year || '';
}

// A face without a picture shows its initials.
function initials(name) {
  return (name || '').split(/\s+/).filter(Boolean).map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase();
}

export function fillTile(tile, item) {
  if (tile.item === item) return;
  tile.item = item;
  if (!item) {
    load(tile.img, '');
    setText(tile.ph, '');
    show(tile.bar, false);
    show(tile.count, false);
    show(tile.seen, false);
    if (tile.cap) { setText(tile.cap, ''); setText(tile.sub, ''); }
    return;
  }
  const kind = tile.kind;
  const server = session.server;
  const path = artFor(item, kind);
  // The web layer is 1920x1080, so tile size is exactly the pixels we need.
  load(tile.img, server ? server.image(path, tile.size.w, tile.size.h) : '');
  setText(tile.ph, kind === 'cast' ? initials(item.title) : titleFor(item, kind));

  const p = progress(item);
  show(tile.bar, p > 0.01);
  if (p > 0.01) setTransform(tile.fill, 'scaleX(' + p.toFixed(3) + ')');

  // Unwatched episode count on shows and seasons; a check on watched items without progress.
  let left = 0;
  let watched = false;
  if ((item.type === 'show' || item.type === 'season') && item.leafCount) {
    left = item.leafCount - (item.viewedLeafCount || 0);
    watched = left <= 0;
  } else {
    watched = item.type !== 'show' && !!item.viewCount && !item.viewOffset;
  }
  show(tile.count, left > 0);
  if (left > 0) setText(tile.count, left);
  show(tile.seen, watched);

  if (tile.cap) {
    setText(tile.cap, titleFor(item, kind));
    setText(tile.sub, subFor(item, kind));
  }
}
