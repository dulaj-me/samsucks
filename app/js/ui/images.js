// Image loading tuned for a slow TV CPU:
//  - a few downloads at a time, newest request first (what's on screen now
//    matters more than what scrolled past),
//  - requests for nodes that were recycled before loading are dropped,
//  - decode() runs off the main thread before the image is attached, so
//    attaching never stalls a frame.
const MAX_ACTIVE = 6;
const LOADED_MAX = 800;

const queue = [];
let active = 0;
const loaded = new Map(); // url -> true, in insertion order for LRU trimming

function remember(url) {
  loaded.delete(url);
  loaded.set(url, true);
  if (loaded.size > LOADED_MAX) loaded.delete(loaded.keys().next().value);
}

function attach(img, url, instant) {
  img.src = url;
  if (instant) {
    img.classList.add('in', 'now');
  } else {
    img.classList.remove('now');
    img.classList.add('in');
  }
}

function pump() {
  while (active < MAX_ACTIVE && queue.length) {
    const job = queue.pop();
    if (job.img._want !== job.url) continue;
    active++;
    const loader = new Image();
    loader.src = job.url;
    const done = ok => {
      active--;
      if (ok) {
        remember(job.url);
        if (job.img._want === job.url) attach(job.img, job.url, false);
      }
      if (job.done) job.done();
      pump();
    };
    if (loader.decode) loader.decode().then(() => done(true), () => done(false));
    else { loader.onload = () => done(true); loader.onerror = () => done(false); }
  }
}

// Point an <img> at a URL. Empty url clears it.
export function load(img, url) {
  if (img._want === url) return;
  img._want = url;
  if (!url) {
    img.classList.remove('in');
    img.removeAttribute('src');
    return;
  }
  if (loaded.has(url)) {
    attach(img, url, true);
    return;
  }
  img.classList.remove('in');
  queue.push({ img, url });
  if (queue.length > 200) queue.splice(0, queue.length - 200);
  pump();
}

const sink = url => ({ _want: url, classList: { add() {}, remove() {} } });

// Warm the cache without a target element (e.g. the next page of a grid).
export function prefetch(url) {
  if (!url || loaded.has(url)) return;
  queue.unshift({ img: sink(url), url });
  pump();
}

// Decode these first, ahead of everything queued. Resolves once all are in (or failed), or
// after ms, whichever is first; a tile pointed at one then shows it without a fade.
export function warm(urls, ms) {
  const want = urls.filter(url => url && !loaded.has(url));
  if (!want.length) return Promise.resolve();
  return new Promise(resolve => {
    let left = want.length;
    const timer = setTimeout(resolve, ms);
    const done = () => { if (--left === 0) { clearTimeout(timer); resolve(); } };
    for (const url of want) queue.push({ img: sink(url), url, done });
    pump();
  });
}
