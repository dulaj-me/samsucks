export function h(tag, className, parent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (parent) parent.appendChild(el);
  return el;
}

// Skip DOM writes when nothing changed; text and style writes are what
// invalidate paint on recycled nodes.
export function setText(el, value) {
  value = value == null ? '' : String(value);
  if (el._text !== value) {
    el._text = value;
    el.textContent = value;
  }
}

export function setTransform(el, value) {
  if (el._tf !== value) {
    el._tf = value;
    el.style.transform = value;
  }
}

export function show(el, visible) {
  const v = visible ? '' : 'none';
  if (el._disp !== v) {
    el._disp = v;
    el.style.display = v;
  }
}

export function toggleClass(el, name, on) {
  if (el.classList.contains(name) !== !!on) el.classList.toggle(name, !!on);
}

// A card's new content: it fades in as it slides the last few px into place. Timing is
// --t-swap on --ease, read once. Instant while a key is held, so a hold never strobes.
let swapTiming = null;
export function swapIn(el, x, y, instant) {
  if (el._swap) { el._swap.cancel(); el._swap = null; }
  if (instant || !el.animate) return;
  if (!swapTiming) {
    const css = getComputedStyle(document.documentElement);
    swapTiming = {
      duration: parseFloat(css.getPropertyValue('--t-swap')) || 120,
      easing: css.getPropertyValue('--ease').trim() || 'ease-out',
    };
  }
  el._swap = el.animate([
    { transform: 'translate(' + x + 'px, ' + y + 'px)', opacity: 0 },
    { transform: 'translate(0, 0)', opacity: 1 },
  ], swapTiming);
}
