import { defineClientComponent } from 'vitepress';
import DefaultTheme from 'vitepress/theme';

import './design-system.css';

/**
 * Scalar reads `window` at import time, so it must never run during the static
 * build. `defineClientComponent` defers the import to the browser.
 */
const ApiReference = defineClientComponent(
  () => import('./components/ApiReference.vue')
);

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ApiReference', ApiReference);
  }
};
