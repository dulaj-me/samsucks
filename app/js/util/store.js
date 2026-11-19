// localStorage wrapper. Tizen keeps it across app restarts; it can throw when full.
const PREFIX = 'ss.';

export function get(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

export function set(key, value) {
  try {
    if (value === undefined) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) { /* quota */ }
}

// Removes every key that starts with keyPrefix, e.g. one entry per profile.
export function removeAll(keyPrefix) {
  try {
    const full = PREFIX + keyPrefix;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(full)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch (e) { /* storage unavailable */ }
}
