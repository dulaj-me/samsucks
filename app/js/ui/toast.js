// One line of feedback at the bottom of the screen, over every screen and the video.
// A sticky message (the server is unreachable) stays until cleared; a short toast shows
// over it and hands back to it when it fades.
import { h, setText, toggleClass } from '../util/dom.js';

let el = null;
let timer = 0;
let sticky = '';

function show(text) {
  if (!el) {
    el = h('div', 'btn toast', document.body);
    el.getBoundingClientRect(); // so the first show fades in instead of appearing
  }
  // Fading out keeps the old text.
  if (text) setText(el, text);
  toggleClass(el, 'on', !!text);
}

export function toast(text, ms = 3000) {
  clearTimeout(timer);
  timer = setTimeout(() => { timer = 0; show(sticky); }, ms);
  show(text);
}

// '' clears it.
export function setSticky(text) {
  sticky = text;
  if (!timer) show(text);
}
