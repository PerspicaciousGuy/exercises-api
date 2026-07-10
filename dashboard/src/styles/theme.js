const DARK_CLASS = 'dark';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * The design system re-points its semantic tokens under a `.dark` class, which
 * VitePress toggles on the docs site. Nothing toggles it here, so the dashboard
 * would render light even for a dark-mode reader. This binds the class to the
 * OS preference instead.
 */
export function followSystemTheme() {
  const query = window.matchMedia(DARK_QUERY);

  const apply = (isDark) => {
    document.documentElement.classList.toggle(DARK_CLASS, isDark);
  };

  apply(query.matches);
  query.addEventListener('change', (event) => apply(event.matches));
}
