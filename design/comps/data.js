// Real library data for the comps, through design/serve.mjs -> tools/preview.mjs.
// Packaged into a TV build, the comps use the app's stored server and token instead.
const tv = (() => { try { return JSON.parse(localStorage.getItem('ss.server') || 'null'); } catch (e) { return null; } })();
const BASE = tv ? tv.uri : '/pms';
const withToken = u => tv && tv.token ? u + (u.includes('?') ? '&' : '?') + 'X-Plex-Token=' + encodeURIComponent(tv.token) : u;
if (tv) {
  const f = window.fetch.bind(window);
  window.fetch = (u, o) => f(typeof u === 'string' && u.startsWith('/pms') ? withToken(BASE + u.slice(4)) : u, o);
}
// Back (Esc on desktop, the remote's Back on the TV) returns to the comp index.
addEventListener('keydown', e => { if (e.key === 'Escape' || e.keyCode === 10009) history.back(); });
const J = { headers: { Accept: 'application/json' } };
const get = async (p) => (await (await fetch('/pms' + p, J)).json()).MediaContainer;

const HUB_TYPES = { movie: 1, show: 1, episode: 1, season: 1, mixed: 1, clip: 1 };

// Same codec table as app/js/screens/player.js: what plays without the server touching it.
const DIRECT = {
  container: { mp4: 1, m4v: 1, mov: 1, mkv: 1, webm: 1, ts: 1, mpegts: 1, avi: 1 },
  video: { h264: 1, hevc: 1, vp9: 1, av1: 1, mpeg4: 1, mpeg2video: 1, vc1: 1 },
  audio: { aac: 1, ac3: 1, eac3: 1, mp3: 1, mp2: 1, flac: 1, opus: 1, vorbis: 1, pcm: 1 },
};

export function img(path, w, h, format = 'jpeg') {
  if (!path) return '';
  return withToken(BASE + '/photo/:/transcode?' + new URLSearchParams({ width: w, height: h, minSize: 1, upscale: 1, quality: 85, format, url: path }));
}

export async function load() {
  const [sec, hubs] = await Promise.all([
    get('/library/sections'),
    get('/hubs?count=24&includeExternalMedia=0'),
  ]);
  const sections = (sec.Directory || []).filter(d => d.type === 'movie' || d.type === 'show');
  const rows = (hubs.Hub || []).filter(h => h.size > 0 && HUB_TYPES[h.type] && h.Metadata);
  return { sections, rows };
}

const details = new Map();
export async function detail(item) {
  if (!details.has(item.ratingKey)) details.set(item.ratingKey, get('/library/metadata/' + item.ratingKey).then(m => m.Metadata[0]));
  return details.get(item.ratingKey);
}

// Format facts for the focused title, from the item's first media and its streams.
export function formats(item, full) {
  const m = ((full || item).Media || [])[0];
  if (!m) return null;
  const streams = (m.Part && m.Part[0] && m.Part[0].Stream) || [];
  const v = streams.find(s => s.streamType === 1) || {};
  const res = { '4k': '4K', 1080: '1080p', 720: '720p', 480: 'SD', sd: 'SD' }[m.videoResolution] || '';
  return {
    res,
    uhd: m.videoResolution === '4k',
    hdr: v.colorTrc === 'smpte2084' || v.colorTrc === 'arib-std-b67',
    dv: !!v.DOVIPresent,
    atmos: /atmos/i.test(m.audioProfile || '') || streams.some(s => s.streamType === 2 && /atmos/i.test(s.displayTitle || '')),
    channels: { 1: '1.0', 2: '2.0', 6: '5.1', 8: '7.1' }[m.audioChannels] || '',
    direct: !!(DIRECT.container[m.container] && DIRECT.video[m.videoCodec] && DIRECT.audio[m.audioCodec]),
  };
}

export const heroArt = (it) => (it.type === 'episode' || it.type === 'season') ? (it.grandparentArt || it.art) : it.art;
export const posterArt = (it) => it.type === 'episode' ? (it.grandparentThumb || it.parentThumb || it.thumb) : it.type === 'season' ? (it.thumb || it.parentThumb) : it.thumb;
export const wideArt = (it) => it.type === 'episode' ? (it.thumb || it.art) : (it.art || it.thumb);
export const clearLogo = (it) => ((it.Image || []).find(i => i.type === 'clearLogo') || {}).url || '';
export const showTitle = (it) => it.type === 'episode' ? it.grandparentTitle : it.title;
export const progress = (it) => (it.viewOffset && it.duration) ? Math.min(1, it.viewOffset / it.duration) : 0;
export const epCode = (it) => it.type === 'episode' ? 'S' + it.parentIndex + ' E' + it.index : '';

export function runtime(ms) {
  if (!ms) return '';
  const m = Math.round(ms / 60000);
  return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm';
}

export function left(it) {
  if (!it.viewOffset || !it.duration) return '';
  const m = Math.round((it.duration - it.viewOffset) / 60000);
  return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm left' : m + 'm left';
}

export function year(it) {
  return it.type === 'episode' ? (it.originallyAvailableAt || '').slice(0, 4) : (it.year || '');
}

export const h = (tag, cls, parent, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  if (parent) parent.appendChild(el);
  return el;
};

// Minimal d-pad for the comps: Left/Right in the focused row, Up/Down between rows.
export function dpad(state, render) {
  addEventListener('keydown', e => {
    const r = state.rows[state.row];
    if (e.key === 'ArrowRight' && state.col < r.Metadata.length - 1) state.col++;
    else if (e.key === 'ArrowLeft' && state.col > 0) state.col--;
    else if (e.key === 'ArrowDown' && state.row < state.rows.length - 1) { state.row++; state.col = 0; }
    else if (e.key === 'ArrowUp' && state.row > 0) { state.row--; state.col = 0; }
    else return;
    e.preventDefault();
    render();
  });
}
