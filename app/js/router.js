// Screen stack. Screens below the top stay in the DOM but hidden, so going
// back is instant and keeps its scroll/focus state.
//
// A screen is { el, onKey(action) -> bool?, onShow?(), onHide?(), destroy?() }.
import { setHandler } from './input.js';
import { exitApp } from './platform/tizen.js';
import { toast } from './ui/toast.js';
import { fadeIn, stopFade, roomColor } from './ui/backdrop.js';

// A second Back at the root inside this window exits.
const EXIT_WINDOW = 3000;
// These share the top nav, which stays still as they swap.
const NAV_SCREENS = ['home', 'library'];

const stack = [];
let root = null;
let globalKey = null;
let exitUntil = 0;

export function init(container, onGlobalKey) {
  root = container;
  globalKey = onGlobalKey;
  setHandler(dispatch);
}

function dispatch(action) {
  const top = stack[stack.length - 1];
  if (top && top.onKey && top.onKey(action) === true) return;
  if (globalKey && globalKey(action) === true) return;
  if (action === 'back') back();
  // Screens without a long-press action treat it as a plain OK.
  if (action === 'hold') dispatch('enter');
}

function hide(screen) {
  screen.el.classList.add('hidden');
  if (screen.onHide) screen.onHide();
}

function reveal(screen) {
  screen.el.classList.remove('hidden');
  if (screen.onShow) screen.onShow();
}

// No fade for the first screen (the splash covers it) or into and out of the player, whose
// video plays under the web layer.
function fades(from, to) {
  return !!from && from.name !== 'player' && to.name !== 'player' &&
    !(NAV_SCREENS.includes(from.name) && NAV_SCREENS.includes(to.name));
}

// color is the room's before the new screen shows and restores its own, so the cover starts
// from what was on screen. Called before onShow, so a screen that opens another from onShow
// gets the last word. Other changes let a running fade finish; only the player cuts it.
function settle(from, to, color) {
  if (fades(from, to)) fadeIn(color);
  else if (to.name === 'player') stopFade();
}

function enter(screen, from, color) {
  exitUntil = 0; // the exit prompt only counts on the screen that showed it
  const top = stack[stack.length - 1];
  if (top) hide(top);
  stack.push(screen);
  root.appendChild(screen.el);
  settle(from, screen, color);
  reveal(screen);
}

export function push(screen) {
  enter(screen, stack[stack.length - 1], roomColor());
}

export function replace(screen) {
  const color = roomColor();
  const top = stack.pop();
  if (top) destroy(top);
  enter(screen, top, color);
}

// Clear everything and start over from one screen (sign in/out, server switch).
export function reset(screen) {
  const color = roomColor();
  const from = stack[stack.length - 1];
  while (stack.length) destroy(stack.pop());
  enter(screen, from, color);
}

function destroy(screen) {
  if (screen.onHide) screen.onHide();
  if (screen.destroy) screen.destroy();
  if (screen.el.parentNode) screen.el.parentNode.removeChild(screen.el);
}

// Straight back to the bottom of the stack (Home), e.g. from a library's nav.
export function popToRoot() {
  if (stack.length <= 1) return;
  const color = roomColor();
  const from = stack[stack.length - 1];
  while (stack.length > 1) destroy(stack.pop());
  settle(from, stack[0], color);
  reveal(stack[0]);
}

// At the root (Home, the sign-in screen, or the profile picker after a rejected token)
// the first Back only asks, so one stray press never closes the app.
export function back() {
  if (stack.length <= 1) {
    if (Date.now() < exitUntil) {
      exitApp();
      return;
    }
    exitUntil = Date.now() + EXIT_WINDOW;
    toast('Press Back again to exit', EXIT_WINDOW);
    return;
  }
  const color = roomColor();
  const from = stack.pop();
  destroy(from);
  settle(from, stack[stack.length - 1], color);
  reveal(stack[stack.length - 1]);
}

export function top() {
  return stack[stack.length - 1];
}
