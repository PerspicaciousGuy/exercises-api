<script setup>
import DefaultTheme from 'vitepress/theme';

/**
 * Wraps the default layout to add one thing the default theme has no option
 * for: a "Get an API key" button at the end of the top bar. Everything else
 * about the bar is restyled in custom.css.
 */
const { Layout } = DefaultTheme;

const REGISTER_URL = 'https://app.harshitbishnoi.dev/register';
</script>

<template>
  <Layout>
    <template #nav-bar-content-after>
      <a class="ex-nav-cta" :href="REGISTER_URL">Get an API key</a>
    </template>
  </Layout>
</template>
