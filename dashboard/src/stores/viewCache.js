/**
 * Remembers the last data each dashboard page loaded, so switching tabs shows
 * it at once and refreshes quietly behind it instead of blanking the page to a
 * spinner every time. Nothing is persisted: it lives only as long as the open
 * page, and it is emptied whenever the signed-in person changes.
 */
const entries = new Map();

export const viewCache = {
  get: (key) => entries.get(key),
  set: (key, value) => {
    entries.set(key, value);
  },
  clear: () => entries.clear()
};
