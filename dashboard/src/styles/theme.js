import { reactive } from 'vue';

const DARK_CLASS = 'dark';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const STORAGE_KEY = 'exdb-theme';

const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';

const query = window.matchMedia(DARK_QUERY);

/**
 * Reactive theme state the UI can bind to. `preference` is what the user chose
 * ('light', 'dark', or 'system'); `resolved` is the theme actually applied,
 * which is what a toggle button should reflect.
 */
export const theme = reactive({
  preference: readStoredPreference(),
  resolved: THEME_LIGHT
});

function readStoredPreference() {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === THEME_LIGHT || stored === THEME_DARK ? stored : 'system';
}

function resolve(preference) {
  if (preference === 'system') {
    return query.matches ? THEME_DARK : THEME_LIGHT;
  }
  return preference;
}

function apply() {
  const resolved = resolve(theme.preference);
  theme.resolved = resolved;
  document.documentElement.classList.toggle(DARK_CLASS, resolved === THEME_DARK);
}

/**
 * The design system re-points its semantic tokens under a `.dark` class. This
 * applies the user's stored preference on load and keeps a 'system' choice in
 * sync with the OS as it changes.
 */
export function initTheme() {
  apply();
  query.addEventListener('change', () => {
    if (theme.preference === 'system') {
      apply();
    }
  });
}

/** Flip between light and dark, persisting the explicit choice. */
export function toggleTheme() {
  setThemePreference(theme.resolved === THEME_DARK ? THEME_LIGHT : THEME_DARK);
}

/**
 * Set the theme explicitly. 'system' clears the stored choice so the theme
 * follows the OS again; 'light'/'dark' persist the override.
 */
export function setThemePreference(preference) {
  theme.preference = preference;
  if (preference === 'system') {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, preference);
  }
  apply();
}
