<script setup>
import { ApiReference as ScalarApiReference } from '@scalar/api-reference';
import '@scalar/api-reference/style.css';

/**
 * Renders the spec that `scripts/sync-spec.js` copies into `public/` from
 * `docs/openapi.yaml`. Fetched over HTTP at runtime rather than bundled, so the
 * reference always matches the spec the site was built from.
 *
 * Mounted client-side only — Scalar touches `window` on import and cannot be
 * server-rendered. See `theme/index.js`.
 */
const configuration = {
  url: '/openapi.yaml'
};
</script>

<template>
  <ScalarApiReference :configuration="configuration" />
</template>
