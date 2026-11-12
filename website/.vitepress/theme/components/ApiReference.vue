<script setup>
import { ApiReference as ScalarApiReference } from '@scalar/api-reference';
import '@scalar/api-reference/style.css';
import { useData } from 'vitepress';
import { computed } from 'vue';

/**
 * Renders the spec that `scripts/sync-spec.js` copies into `public/` from
 * `docs/openapi.yaml`. Fetched over HTTP at runtime rather than bundled, so the
 * reference always matches the spec the site was built from.
 *
 * Mounted client-side only — Scalar touches `window` on import and cannot be
 * server-rendered. See `theme/index.js`.
 *
 * Scalar's own light/dark toggle is hidden and its mode follows the site's,
 * so the reference never disagrees with the page around it. Its colours are
 * mapped onto the design system in `custom.css`.
 */
const { isDark } = useData();

const configuration = computed(() => ({
  url: '/openapi.yaml',
  hideDarkModeToggle: true,
  forceDarkModeState: isDark.value ? 'dark' : 'light',
  withDefaultFonts: false
}));
</script>

<template>
  <ScalarApiReference :configuration="configuration" />
</template>
