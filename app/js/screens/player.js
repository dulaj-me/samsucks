// Playback. Direct play whenever the TV can decode the file (hardware, zero
// server load); otherwise ask Plex for HLS with the video passed through and
// only the audio/container converted. Seeking previews locally and only
// commits once the user stops pressing, because AVPlay seeks are slow.
import { DEV } from '../config.js';
import { h, setText, setTransform, toggleClass, show } from '../util/dom.js';
import { createPlayer } from '../platform/player.js';
import { setScreenSaver, supports4K } from '../platform/tizen.js';
import { session } from '../session.js';
import { clock, episodeCode, duration as runtime, uuid } from '../util/format.js';
import * as icons from '../ui/icons.js';
import * as router from '../router.js';
import { log, warn, error } from '../util/log.js';
import { request } from '../plex/client.js';
import { parseSubtitles, CueTrack } from '../player/subtitles.js';
import { load as loadImage } from '../ui/images.js';
import * as store from '../util/store.js';
import { Menu } from '../ui/menu.js';
import { toast } from '../ui/toast.js';
import { clearLogo } from './home.js';

// What a 2022 Samsung (Tizen 6.5) decodes natively. No DTS on 2018+ models.
const DIRECT = {
  container: { mp4: 1, m4v: 1, mov: 1, mkv: 1, webm: 1, ts: 1, mpegts: 1, avi: 1 },
  video: { h264: 1, hevc: 1, vp9: 1, av1: 1, mpeg4: 1, mpeg2video: 1, vc1: 1 },
  audio: { aac: 1, ac3: 1, eac3: 1, mp3: 1, mp2: 1, flac: 1, opus: 1, vorbis: 1, pcm: 1 },
};
const TEXT_SUBS = { srt: 1, subrip: 1, ass: 1, ssa: 1, mov_text: 1, vtt: 1, webvtt: 1, smi: 1 };

const OSD_HIDE_MS = 4000;
const SEEK_COMMIT_MS = 900;
const TIMELINE_MS = 10000;
const UPNEXT_ART_W = 480;
const UPNEXT_ART_H = 270;
const PLAY = 1; // the play/pause button's place in the controls

function streamsOf(part, type) {
  return (part && part.Stream || []).filter(s => s.streamType === type);
}

function isEmbeddedText(sub) {
  return !!sub && sub.index != null && !sub.key && !!TEXT_SUBS[sub.codec];
}

// External .srt/.ass/.vtt files: we fetch and draw these ourselves.
function isSidecarText(sub) {
  return !!sub && !!sub.key && !!TEXT_SUBS[sub.codec];
}

// An external text file matching an embedded text subtitle (same language, same SDH/forced
// flags), e.g. one extracted next to the MKV. Plex can't hand embedded subs out on their own,
// so over HLS the only other way to show them is burning in, which re-encodes the video.
function sidecarTwin(part, sub) {
  const same = s => isSidecarText(s) && s.languageCode === sub.languageCode && !!s.forced === !!sub.forced;
  const candidates = streamsOf(part, 3).filter(same);
  return candidates.find(s => !!s.hearingImpaired === !!sub.hearingImpaired) || candidates[0] || null;
}

function subtitleLabel(s) {
  const title = s.displayTitle && s.displayTitle !== 'Unknown' ? s.displayTitle : (s.language || '');
  const kind = (s.codec || '').toUpperCase() + (s.key ? ' · external' : '');
  return title ? title + (s.key ? ' · external' : '') : kind || 'Subtitle';
}

// Settings owns the prefs object; a missing key means its default.
function autoplayNext() {
  const prefs = store.get('prefs', null);
  return !(prefs && prefs.autoplayNext === false);
}

function upnextSeconds() {
  const prefs = store.get('prefs', null);
  return (prefs && prefs.upnextSeconds) || 10;
}

function button(parent, icon, label) {
  const b = h('div', 'btn', parent);
  b.innerHTML = icon;
  h('span', '', b).textContent = label;
  return b;
}

function cleanSubtitle(text) {
  return String(text || '')
    .replace(/\{\\[^}]*\}/g, '')        // ASS override tags
    .replace(/<[^>]+>/g, '')            // <i>, <font> ...
    .replace(/\\N/g, '\n');
}

export function PlayerScreen(initial, { offset = null } = {}) {
  const el = h('div', 'screen player');
  const stage = h('div', 'player-stage', el);
  const subs = h('div', 'subs', el);
  const spinner = h('div', 'spinner', el);
  const pauseBig = h('div', 'pause-big', el);
  pauseBig.innerHTML = icons.pause;

  const osd = h('div', 'osd', el);
  h('img', 'osd-scrim-top', osd).src = 'img/scrim-top.png';
  h('img', 'osd-scrim-bottom', osd).src = 'img/scrim-bottom.png';
  const osdTitle = h('div', 'osd-title', osd);
  const logoBox = h('div', 'osd-logo-box', osdTitle);
  const osdLogo = h('img', 'osd-logo', logoBox);
  const osdName = h('div', 'osd-name', logoBox);
  const osdSub = h('div', 'osd-sub', osdTitle);
  const bar = h('div', 'osd-bar', osd);
  const barFill = h('div', 'osd-fill', bar);
  const knob = h('div', 'osd-knob', bar);
  const seekLabel = h('div', 'osd-seek', knob);
  const times = h('div', 'osd-times', osd);
  const tNow = h('span', 'osd-now', times);
  const tInfo = h('span', 'osd-info', times);
  const tLeft = h('span', 'osd-left', times);
  const controls = h('div', 'osd-controls', osd);

  const menu = new Menu(el);
  const upnext = h('div', 'upnext hidden', el);
  const skipBtn = h('div', 'btn skip hidden', el);
  const errorEl = h('div', 'player-error hidden', el);

  let item = initial;
  let media = null;
  let part = null;
  let mode = 'direct';
  let triedFallback = false;
  let base = 0;             // HLS restarts at an offset; AVPlay time is relative to it
  let position = offset || 0;
  let duration = initial.duration || 0;
  let paused = false;
  let started = false;
  let alive = true;
  let audioStream = null;
  let subStream = null;
  let seekTarget = null;
  let seekCount = 0;
  let lastSeekAt = 0;
  let seekTimer = 0;
  let osdTimer = 0;
  let timelineTimer = 0;
  let subTimer = 0;
  let lastText = 0;
  let upnextTimer = 0;
  // 'credits': the card sits over the still-playing credits. 'end': the file is done.
  let upnextMode = null;
  let ending = false; // the file is done; only Back and Stop apply until the next screen
  let nextItem = null;
  let cueTrack = null;
  let cueTimer = 0;
  let cueFor = null;
  let markers = [];
  let creditsMarker = null;
  let skipFor = null;
  let nextLookup = null;
  let switching = false;
  // Focus inside the OSD: the seek bar, or the button row under it.
  let zone = 'bar';
  let btnIndex = 0;
  let upnextIndex = 0;
  let upnextButtons = [];
  let upnextLabel = null;
  let upnextCd = null;
  let skipLabel = '';
  const playSession = uuid();

  // Back 10s, play/pause, forward 10s, then Audio and subtitles and Next episode at the right.
  const fwd = h('div', 'btn osd-fwd');
  h('span', '', fwd).textContent = '10s';
  fwd.insertAdjacentHTML('beforeend', icons.restart);
  const buttons = [
    { el: button(controls, icons.restart, '10s'), run: () => seekBy(-1, 10000) },
    { el: h('div', 'btn osd-play', controls), run: togglePause },
    { el: controls.appendChild(fwd), run: () => seekBy(1, 10000) },
    { el: button(controls, icons.subtitles, 'Audio and subtitles'), run: () => { if (part) openPanel(); } },
  ];
  buttons[3].el.classList.add('osd-tracks');
  if (initial.type === 'episode') {
    buttons.push({ el: button(controls, icons.next, 'Next episode'), run: () => jumpEpisode(1) });
  }
  const playBtn = buttons[PLAY].el;
  playBtn.innerHTML = icons.pause;
  playBtn._paused = false;
  btnIndex = PLAY;
  setSkip('Skip intro');

  const player = createPlayer(stage, {
    onTime(ms) {
      if (!started) return;
      position = base + ms;
      if (seekTarget == null) {
        renderProgress(position);
        updateSkip(position);
      }
    },
    onBuffering(on) { toggleClass(spinner, 'on', on); },
    onEnd() { finished(); },
    onError(msg) { failed(msg); },
    onSubtitle(text, ms) {
      clearTimeout(subTimer);
      setText(subs, cleanSubtitle(text));
      if (ms > 0) subTimer = setTimeout(() => setText(subs, ''), ms);
    },
  });

  // --- OSD --------------------------------------------------------------

  function renderProgress(ms) {
    const p = duration ? Math.max(0, Math.min(1, ms / duration)) : 0;
    setTransform(barFill, 'scaleX(' + p.toFixed(4) + ')');
    setTransform(knob, 'translateX(' + Math.round(p * 1728) + 'px)');
    const now = Date.now();
    if (now - lastText > 900 || seekTarget != null) {
      lastText = now;
      setText(tNow, clock(ms));
      setText(tLeft, '−' + clock(duration - ms));
      const ends = new Date(now + (duration - ms));
      let hh = ends.getHours();
      const ampm = hh >= 12 ? 'PM' : 'AM';
      hh = hh % 12 || 12;
      const mm = ends.getMinutes();
      setText(tInfo, 'Ends at ' + hh + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ampm);
    }
  }

  // from: the zone to focus when this reveals a hidden OSD.
  function showOsd(sticky, from) {
    // The OSD and the credits card never share the screen; the card returns only when the credits are entered again.
    if (upnextMode === 'credits') hideUpNext();
    if (!el.classList.contains('osd-on')) {
      zone = from || 'bar';
      renderFocus();
    }
    toggleClass(el, 'osd-on', true);
    clearTimeout(osdTimer);
    if (!sticky && !paused) osdTimer = setTimeout(hideOsd, OSD_HIDE_MS);
  }

  function setZone(z) {
    if (zone === z) return;
    zone = z;
    renderFocus();
  }

  function renderFocus() {
    buttons.forEach((b, i) => toggleClass(b.el, 'focus', zone === 'buttons' && i === btnIndex));
    toggleClass(el, 'osd-buttons', zone === 'buttons');
  }

  function setPaused(p) {
    paused = p;
    toggleClass(el, 'paused', p);
    if (playBtn._paused === p) return;
    playBtn._paused = p;
    playBtn.innerHTML = p ? icons.play : icons.pause;
  }

  function hideOsd() {
    clearTimeout(osdTimer);
    toggleClass(el, 'osd-on', false);
  }

  // The show's or movie's clear logo, else its name; the tile's item has no logo until the
  // full metadata arrives.
  function renderTitles() {
    const logoPath = clearLogo(item);
    show(osdLogo, !!logoPath);
    show(osdName, !logoPath);
    if (logoPath) {
      const url = session.server.image(logoPath, 320, 96, { format: 'png' });
      if (osdLogo.getAttribute('src') !== url) osdLogo.src = url;
    } else {
      setText(osdName, item.type === 'episode' ? item.grandparentTitle : item.title);
    }
    setText(osdSub, item.type === 'episode' ? episodeCode(item) + '  ·  ' + item.title : (item.year || ''));
  }

  function setSkip(label) {
    if (label === skipLabel) return;
    skipLabel = label;
    skipBtn.innerHTML = label === 'Skip intro' ? icons.next : icons.check;
    h('span', '', skipBtn).textContent = label;
  }

  function flashHint(msg) {
    toast(msg);
    showOsd();
  }

  // --- Timeline ---------------------------------------------------------

  function report(state) {
    if (!item.ratingKey) return;
    if (DEV && window.__ss && window.__ss.muteTimeline) return;
    session.server.timeline({
      ratingKey: item.ratingKey,
      key: '/library/metadata/' + item.ratingKey,
      state,
      time: Math.floor(position),
      duration: Math.floor(duration),
      'X-Plex-Session-Identifier': playSession,
    });
  }

  function startTimeline() {
    clearInterval(timelineTimer);
    timelineTimer = setInterval(() => report(paused ? 'paused' : 'playing'), TIMELINE_MS);
  }

  // --- Opening ----------------------------------------------------------

  function decideMode() {
    const directOk = DIRECT.container[media.container] && DIRECT.video[media.videoCodec] &&
      (!audioStream || DIRECT.audio[audioStream.codec]);
    const subsOk = !subStream || isEmbeddedText(subStream) || isSidecarText(subStream);
    return directOk && subsOk ? 'direct' : 'hls';
  }

  async function open(atMs) {
    const server = session.server;
    const t0 = Date.now();
    started = false;
    toggleClass(spinner, 'on', true);
    let url;
    if (mode === 'direct') {
      base = 0;
      url = server.url(part.key);
    } else {
      base = atMs;
      if (isEmbeddedText(subStream)) {
        const twin = sidecarTwin(part, subStream);
        if (twin) {
          log('using external twin of embedded subtitle:', twin.displayTitle);
          subStream = twin;
        }
      }
      // Burn in only what we can't draw ourselves (image subs, embedded text).
      const burn = subStream && !isSidecarText(subStream);
      const build = (withSubs) => server.transcodeUrl(item, {
        session: playSession, offsetMs: atMs,
        audioStreamID: audioStream && audioStream.id,
        subtitleStreamID: withSubs ? subStream.id : undefined,
      });
      // PMS 1.42+ rejects start.m3u8 unless a decision was made for the session first.
      const decide = async () => (await request(url.replace('/start.m3u8', '/decision'))).MediaContainer || {};
      url = build(burn);
      let mc = await decide();
      // Burning subtitles means re-encoding the video. A server that can only remux refuses
      // that, so play without the subtitle rather than not at all.
      if (burn && mc.generalDecisionCode >= 2000) {
        warn('server cannot burn in subtitles, playing without them:', mc.transcodeDecisionText);
        url = build(false);
        mc = await decide();
      }
      if (mc.generalDecisionCode && mc.generalDecisionCode >= 2000) throw new Error(mc.generalDecisionText || 'Server refused to convert this file');
    }
    log('play', mode, item.title, media.container + '/' + media.videoCodec + '/' + (audioStream && audioStream.codec), 'at', clock(atMs));
    player.open(url, { uhd: media.videoResolution === '4k' && supports4K() });
    await player.prepare();
    if (!alive) return;
    if (mode === 'direct') {
      applyTracks();
      if (atMs > 0) await player.seek(atMs);
    }
    syncSidecar();
    player.play();
    setPaused(false);
    started = true;
    position = atMs;
    toggleClass(spinner, 'on', false);
    log('playing after ' + (Date.now() - t0) + 'ms (' + mode + ')');
    report('playing');
    startTimeline();
  }

  // Map Plex's chosen streams onto AVPlay's track list (same file order).
  function applyTracks() {
    const t = player.tracks();
    if (audioStream && t.audio.length > 1) {
      const pos = streamsOf(part, 2).indexOf(audioStream);
      if (pos >= 0 && t.audio[pos] != null) player.selectAudio(t.audio[pos]);
    }
    if (isEmbeddedText(subStream)) {
      const pos = streamsOf(part, 3).filter(isEmbeddedText).indexOf(subStream);
      if (pos >= 0 && t.text[pos] != null) player.selectText(t.text[pos]);
    } else {
      player.selectText(null);
      setText(subs, '');
    }
  }

  // Start/stop drawing an external subtitle file for the current selection.
  function syncSidecar() {
    if (!isSidecarText(subStream)) {
      cueTrack = null;
      cueFor = null;
      clearInterval(cueTimer);
      if (!isEmbeddedText(subStream)) setText(subs, '');
      return;
    }
    if (cueFor === subStream) return;
    cueFor = subStream;
    const stream = subStream;
    cueTrack = null;
    fetch(session.server.url(stream.key, { encoding: 'utf-8' }))
      .then(r => r.text())
      .then(text => {
        if (cueFor !== stream || !alive) return;
        cueTrack = new CueTrack(parseSubtitles(text, stream.codec));
        log('subtitles loaded', stream.displayTitle, cueTrack.cues.length + ' cues');
      })
      .catch(e => warn('subtitle fetch failed', e.message));
    clearInterval(cueTimer);
    cueTimer = setInterval(() => {
      if (cueTrack && started) setText(subs, cueTrack.at(base + player.time()));
    }, 120);
  }

  async function start() {
    try {
      const full = await session.server.metadata(item.ratingKey);
      if (!alive) return;
      item = full;
      duration = item.duration || duration;
      // Only the credits that run to the end; earlier ones can precede a post-credits scene.
      const credits = (item.Marker || []).filter(m => m.type === 'credits');
      creditsMarker = credits.find(m => m.final) || credits[credits.length - 1] || null;
      markers = (item.Marker || []).filter(m => m.type === 'intro').concat(creditsMarker || []);
      media = (item.Media || [])[0];
      part = media && media.Part && media.Part[0];
      if (!part) throw new Error('No playable media');
      const audios = streamsOf(part, 2);
      audioStream = audios.find(s => s.selected) || audios[0] || null;
      subStream = streamsOf(part, 3).find(s => s.selected) || null;
      renderTitles();
      mode = decideMode();
      if (offset == null) offset = item.viewOffset || 0;
      position = offset;
      renderProgress(position);
      showOsd();
      await open(offset);
    } catch (e) {
      failed(e.message || String(e));
    }
  }

  function failed(msg) {
    if (!alive) return;
    if (mode === 'direct' && !triedFallback && media) {
      // The file looked direct-playable but the TV choked: let Plex convert it.
      warn('direct play failed (' + msg + '), falling back to HLS');
      triedFallback = true;
      mode = 'hls';
      open(position).catch(e => failed(e.message));
      return;
    }
    error('playback failed', msg);
    toggleClass(spinner, 'on', false);
    errorEl.classList.remove('hidden');
    setText(errorEl, 'Playback failed: ' + msg);
  }

  // --- Controls ---------------------------------------------------------

  function togglePause() {
    if (!started) return;
    if (paused) {
      player.play();
      setPaused(false);
      showOsd();
    } else {
      player.pause();
      setPaused(true);
      showOsd(true);
    }
    report(paused ? 'paused' : 'playing');
  }

  // fixed: a 10s pill's step, which leaves focus on the pill. Arrows speed up and focus the bar.
  function seekBy(dir, fixed) {
    if (!started) return;
    const now = Date.now();
    seekCount = now - lastSeekAt < 700 ? seekCount + 1 : 0;
    lastSeekAt = now;
    const step = fixed || (seekCount < 3 ? 10000 : seekCount < 8 ? 30000 : seekCount < 16 ? 60000 : 180000);
    const from = seekTarget == null ? position : seekTarget;
    seekTarget = Math.max(0, Math.min(duration - 3000, from + dir * step));
    toggleClass(el, 'seeking', true);
    setText(seekLabel, clock(seekTarget));
    renderProgress(seekTarget);
    showOsd(true);
    if (!fixed) setZone('bar');
    clearTimeout(seekTimer);
    seekTimer = setTimeout(commitSeek, SEEK_COMMIT_MS);
  }

  async function commitSeek() {
    clearTimeout(seekTimer);
    if (seekTarget == null) return;
    const target = seekTarget;
    seekTarget = null;
    toggleClass(el, 'seeking', false);
    showOsd();
    position = target;
    try {
      if (mode === 'direct') {
        toggleClass(spinner, 'on', true);
        await player.seek(target);
        toggleClass(spinner, 'on', false);
        if (paused) togglePause();
      } else {
        await open(target);
      }
    } catch (e) {
      warn('seek failed, reopening', e.message);
      open(target).catch(err => failed(err.message));
    }
  }

  // --- Skip intro / credits ---------------------------------------------

  function updateSkip(ms) {
    // Hide a second early so the button doesn't flash up right as the marker ends.
    const m = markers.find(x => !x.dismissed && ms >= x.startTimeOffset && ms < x.endTimeOffset - 1000) || null;
    if (m === skipFor) return;
    // The card outlasts the file's final credits, but not credits a post-credits scene follows,
    // and never a position before the credits (a seek can land there with the card up).
    if (upnextMode === 'credits' && !(creditsMarker.final && ms >= creditsMarker.startTimeOffset)) hideUpNext();
    skipFor = m;
    // An episode's credits get the up-next card instead, once the next episode is known.
    const episodeCredits = !!m && m.type === 'credits' && item.type === 'episode';
    toggleClass(skipBtn, 'hidden', !m || episodeCredits);
    if (!m) return;
    if (m.type === 'intro') { setSkip('Skip intro'); return; }
    if (!episodeCredits) { setSkip('Mark watched'); return; }
    lookupNext().then(ep => {
      if (skipFor !== m || ending || !alive) return;
      // Not while the viewer is seeking, paused, away, or in the controls or track panel; the
      // next timeupdate decides again.
      const busy = seekTarget != null || paused || document.hidden ||
        el.classList.contains('osd-on') || menu.isOpen;
      if (busy) { skipFor = null; return; }
      if (ep) { nextItem = ep; showUpNext('credits'); return; }
      setSkip('Mark watched');
      toggleClass(skipBtn, 'hidden', false);
    });
  }

  function skip() {
    const m = skipFor;
    m.dismissed = true;
    updateSkip(position);
    if (m.type === 'credits') { doneAndNext(); return; }
    seekTarget = Math.min(m.endTimeOffset, duration - 3000);
    commitSeek();
  }

  async function doneAndNext() {
    ending = true;
    started = false;
    clearTimeout(seekTimer);
    seekTarget = null;
    clearInterval(timelineTimer);
    player.close();
    position = duration;
    report('stopped');
    session.server.scrobble(item.ratingKey).catch(e => warn('scrobble failed', e.message));
    toggleClass(spinner, 'on', true);
    const ep = await lookupNext();
    if (!alive) return;
    if (ep) router.replace(PlayerScreen(ep, { offset: 0 }));
    else exit();
  }

  // --- Audio / subtitle picker ------------------------------------------

  function openPanel() {
    const audios = streamsOf(part, 2);
    const texts = streamsOf(part, 3);
    const audio = audios.map(s => ({ label: s.displayTitle || s.language || 'Track', current: s === audioStream, run: () => choose(0, s) }));
    const subtitles = [{ label: 'Off', current: !subStream, run: () => choose(1, null) }]
      .concat(texts.map(s => ({ label: subtitleLabel(s), current: s === subStream, run: () => choose(1, s) })));
    menu.open({
      title: 'Audio and subtitles',
      sub: item.type === 'episode' ? episodeCode(item) + '  ·  ' + item.title : item.title,
      items: (audio.length ? [{ heading: 'Audio' }].concat(audio) : []).concat([{ heading: 'Subtitles' }], subtitles),
    });
    hideOsd();
  }

  async function choose(col, stream) {
    const server = session.server;
    if (col === 0) audioStream = stream;
    else subStream = stream;
    server.selectStreams(part.id, {
      audioStreamID: audioStream ? audioStream.id : undefined,
      subtitleStreamID: subStream ? subStream.id : 0,
    });
    const wanted = decideMode();
    if (wanted === 'direct' && mode === 'direct') {
      applyTracks();
      syncSidecar();
    } else if (mode === 'hls' && wanted === 'hls' && col === 1 && isSidecarText(subStream)) {
      syncSidecar();
    } else {
      mode = wanted;
      triedFallback = false;
      await open(position).catch(e => failed(e.message));
    }
  }

  // --- Ending -----------------------------------------------------------

  // dir: 1 = next, -1 = previous, crossing season boundaries.
  async function siblingEpisode(dir) {
    const server = session.server;
    const eps = await server.children(item.parentRatingKey);
    const i = eps.findIndex(e => e.ratingKey === item.ratingKey);
    if (i >= 0 && eps[i + dir]) return eps[i + dir];
    const seasons = (await server.children(item.grandparentRatingKey)).filter(s => s.type === 'season');
    const si = seasons.findIndex(s => s.ratingKey === item.parentRatingKey);
    const season = si >= 0 && seasons[si + dir];
    if (!season) return null;
    const list = await server.children(season.ratingKey);
    return (dir > 0 ? list[0] : list[list.length - 1]) || null;
  }

  // Shared by the credits button and the end-of-file up-next card. Failures aren't cached.
  function lookupNext() {
    if (item.type !== 'episode') return Promise.resolve(null);
    if (!nextLookup) nextLookup = siblingEpisode(1).catch(e => { nextLookup = null; warn('next episode lookup failed', e.message); return null; });
    return nextLookup;
  }

  async function jumpEpisode(dir) {
    if (item.type !== 'episode' || switching) return;
    switching = true;
    toggleClass(spinner, 'on', true);
    let ep = null;
    try { ep = dir > 0 ? await lookupNext() : await siblingEpisode(dir); } catch (e) { warn('episode lookup failed', e.message); }
    switching = false;
    if (!alive) return;
    if (!ep) {
      toggleClass(spinner, 'on', !started);
      flashHint(dir > 0 ? 'No next episode' : 'No previous episode');
      return;
    }
    router.replace(PlayerScreen(ep, { offset: 0 }));
  }

  async function finished() {
    if (ending) return; // Play now already reported stopped and is opening the next episode
    ending = true;
    started = false;
    // A seek still waiting to commit would reopen the closed player and end it twice.
    clearTimeout(seekTimer);
    seekTarget = null;
    position = duration;
    report('stopped');
    clearInterval(timelineTimer);
    player.close();
    hideOsd();
    if (item.type !== 'episode') { exit(); return; }
    // The credits card stays as it is, countdown and focus included; only Watch credits no longer applies.
    if (upnextMode === 'credits') {
      upnextMode = 'end';
      upnextButtons[1].lastChild.textContent = 'Close';
      toggleClass(el, 'ended', true);
      return;
    }
    nextItem = await lookupNext();
    if (!alive) return;
    if (!nextItem) { exit(); return; }
    showUpNext('end');
  }

  function showUpNext(mode) {
    stopCountdown();
    upnextMode = mode;
    hideOsd();
    if (menu.isOpen) menu.close();
    upnext.innerHTML = '';
    const art = h('div', 'tile-frame upnext-art', upnext);
    loadImage(h('img', 'tile-img', art), session.server.image(nextItem.thumb || nextItem.art, UPNEXT_ART_W, UPNEXT_ART_H));
    h('div', 'upnext-title', upnext).textContent = (nextItem.index != null ? nextItem.index + '. ' : '') + nextItem.title;
    h('div', 'upnext-meta', upnext).textContent = [episodeCode(nextItem), runtime(nextItem.duration)].filter(Boolean).join('  ·  ');
    const actions = h('div', 'upnext-actions', upnext);
    upnextButtons = [button(actions, icons.play, 'Play now'), button(actions, '', mode === 'credits' ? 'Watch credits' : 'Close')];
    upnextLabel = upnextButtons[0].lastChild;
    upnextIndex = 0;
    renderUpnextFocus();
    toggleClass(el, 'ended', mode === 'end');
    toggleClass(el, 'upnext-on', true);
    upnext.classList.remove('hidden');
    // Credits that a scene follows get no countdown, or autoplay would skip the scene.
    const countdown = autoplayNext() && (mode === 'end' || creditsMarker.final);
    if (!countdown) return;
    let left = upnextSeconds();
    setText(upnextLabel, 'Play in ' + left + 's');
    // What is left of it, a layer in the Play button that shrinks on the compositor.
    upnextCd = h('i', 'upnext-cd');
    upnextCd.style.animationDuration = left + 's';
    upnextButtons[0].insertBefore(upnextCd, upnextButtons[0].firstChild);
    upnextTimer = setInterval(() => {
      left--;
      if (left <= 0) playNext();
      else setText(upnextLabel, 'Play in ' + left + 's');
    }, 1000);
  }

  function renderUpnextFocus() {
    upnextButtons.forEach((b, i) => toggleClass(b, 'focus', i === upnextIndex));
  }

  function stopCountdown() {
    if (!upnextTimer) return;
    clearInterval(upnextTimer);
    upnextTimer = 0;
    setText(upnextLabel, 'Play now');
    if (upnextCd) upnextCd.remove();
    upnextCd = null;
  }

  function hideUpNext() {
    stopCountdown();
    upnextMode = null;
    upnext.classList.add('hidden');
    toggleClass(el, 'upnext-on', false);
  }

  // For the rest of this file: seeking back into the credits doesn't bring the card back.
  function watchCredits() {
    creditsMarker.dismissed = true;
    hideUpNext();
    updateSkip(position);
  }

  // An arrow means the viewer has taken over, so the countdown stops.
  function upnextKey(action) {
    const credits = upnextMode === 'credits';
    switch (action) {
      case 'left': case 'right':
        stopCountdown();
        upnextIndex = action === 'left' ? 0 : 1;
        renderUpnextFocus();
        return true;
      case 'up': if (credits) showOsd(); return true;
      case 'down': if (credits) stopCountdown(); return true;
      case 'rw': case 'ff': if (credits) seekBy(action === 'ff' ? 1 : -1); return true;
      case 'enter':
        if (upnextIndex === 0) playNext();
        else if (credits) watchCredits();
        else exit();
        return true;
      case 'play': playNext(); return true;
      // Over the credits, play/pause still pauses; togglePause opens the OSD, which hides the card.
      case 'playpause': if (credits) togglePause(); else playNext(); return true;
      case 'pause': if (credits) togglePause(); return true;
      case 'info': if (credits) showOsd(); return true;
      case 'back': if (credits) watchCredits(); else exit(); return true;
      case 'stop': exit(); return true;
    }
    return true;
  }

  function playNext() {
    clearInterval(upnextTimer);
    upnextTimer = 0;
    if (!alive) return;
    if (upnextMode === 'credits') {
      hideUpNext();
      doneAndNext();
    } else {
      router.replace(PlayerScreen(nextItem, { offset: 0 }));
    }
  }

  function exit() {
    router.back();
  }

  function teardown() {
    if (!alive) return;
    alive = false;
    if (started && position < duration) report('stopped');
    [seekTimer, osdTimer, subTimer].forEach(clearTimeout);
    clearInterval(timelineTimer);
    clearInterval(upnextTimer);
    clearInterval(cueTimer);
    player.destroy();
    if (mode === 'hls') session.server.stopTranscode(playSession);
    document.documentElement.classList.remove('playing');
    setScreenSaver(true);
    document.removeEventListener('visibilitychange', onVisibility);
  }

  function onVisibility() {
    if (document.hidden) {
      // Autoplay must not open the next episode while another app is in front.
      stopCountdown();
      if (started && !paused) togglePause();
      player.suspend();
    } else {
      player.restore();
    }
  }

  return {
    el,
    name: 'player',
    onShow() {
      document.documentElement.classList.add('playing');
      setScreenSaver(false);
      document.addEventListener('visibilitychange', onVisibility);
      renderTitles();
      if (!started) start();
    },
    onKey(action) {
      if (!upnext.classList.contains('hidden')) return upnextKey(action);
      if (ending) {
        if (action === 'back' || action === 'stop') exit();
        return true;
      }
      if (menu.isOpen) {
        menu.onKey(action);
        // Back returns to the button that opened it.
        if (!menu.isOpen && action === 'back') showOsd(false, 'buttons');
        return true;
      }
      if (zone === 'buttons' && el.classList.contains('osd-on')) {
        switch (action) {
          case 'left': case 'right':
            btnIndex = Math.max(0, Math.min(buttons.length - 1, btnIndex + (action === 'left' ? -1 : 1)));
            renderFocus();
            showOsd();
            return true;
          case 'up': case 'back': setZone('bar'); showOsd(); return true;
          case 'down': showOsd(); return true;
          case 'enter': buttons[btnIndex].run(); return true;
        }
      }
      if (skipFor && seekTarget == null && !skipBtn.classList.contains('hidden')) {
        if (action === 'enter') { skip(); return true; }
        if (action === 'back' && !el.classList.contains('osd-on')) {
          skipFor.dismissed = true;
          updateSkip(position);
          return true;
        }
      }
      switch (action) {
        case 'pageup': jumpEpisode(1); return true;
        case 'pagedown': jumpEpisode(-1); return true;
        case 'enter':
          if (seekTarget != null) commitSeek();
          else if (el.classList.contains('osd-on') || paused) togglePause();
          else showOsd();
          return true;
        case 'playpause': if (seekTarget != null) commitSeek(); else togglePause(); return true;
        case 'play': if (paused) togglePause(); return true;
        case 'pause': if (!paused) togglePause(); return true;
        case 'left': case 'rw': seekBy(-1); return true;
        case 'right': case 'ff': seekBy(1); return true;
        case 'up':
          if (el.classList.contains('osd-on') && !paused && seekTarget == null) hideOsd();
          else showOsd();
          return true;
        case 'info': showOsd(); return true;
        case 'down':
          // The controls open on play/pause.
          if (!el.classList.contains('osd-on')) btnIndex = PLAY;
          showOsd(false, 'buttons');
          setZone('buttons');
          return true;
        case 'stop': exit(); return true;
        case 'back':
          if (seekTarget != null) { seekTarget = null; toggleClass(el, 'seeking', false); renderProgress(position); showOsd(); return true; }
          if (el.classList.contains('osd-on') && !paused) { hideOsd(); return true; }
          exit();
          return true;
      }
      return true;
    },
    onHide() {},
    destroy: teardown,
  };
}
