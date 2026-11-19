// Screen stack. Screens below the top stay in the DOM but hidden, so going
// back is instant and keeps its scroll/focus state.
//
// A screen is { el, onKey(action) -> bool?, onShow?(), onHide?(), destroy?() }.
import { setHandler } from './input.js';
import { exitApp } from './platform/tizen.js';
import { toast } from './ui/toast.js';

// A second Back at the root inside this window exits.
const EXIT_WINDOW = 3000;

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

export function push(screen) {
  const top = stack[stack.length - 1];
  if (top) hide(top);
  stack.push(screen);
  root.appendChild(screen.el);
  reveal(screen);
}

export function replace(screen) {
  const top = stack.pop();
  if (top) destroy(top);
  push(screen);
}

// Clear everything and start over from one screen (sign in/out, server switch).
export function reset(screen) {
  while (stack.length) destroy(stack.pop());
  push(screen);
}

function destroy(screen) {
  if (screen.onHide) screen.onHide();
  if (screen.destroy) screen.destroy();
  if (screen.el.parentNode) screen.el.parentNode.removeChild(screen.el);
}

// Straight back to the bottom of the stack (Home), e.g. from a library's nav.
export function popToRoot() {
  if (stack.length <= 1) return;
  while (stack.length > 1) destroy(stack.pop());
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
  destroy(stack.pop());
  reveal(stack[stack.length - 1]);
}

export function top() {
  return stack[stack.length - 1];
}
