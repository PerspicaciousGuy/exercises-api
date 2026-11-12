<script setup>
import DefaultTheme from 'vitepress/theme';

/**
 * Wraps the default layout for two things the default theme has no option for:
 * a "Get an API key" button at the end of the top bar, and a missing-page
 * screen in the site's own voice. Everything else about the bar is restyled in
 * custom.css.
 */
const { Layout } = DefaultTheme;

const REGISTER_URL = 'https://app.harshitbishnoi.dev/register';
</script>

<template>
  <Layout>
    <template #nav-bar-content-after>
      <a class="ex-nav-cta" :href="REGISTER_URL">Get an API key</a>
    </template>

    <template #not-found>
      <div class="ex-missing">
        <p class="ex-type">404 · page not found</p>
        <h1 class="ex-missing__title">That page is not in the book.</h1>
        <p class="ex-missing__body">
          The address may have a typo, or the page may have moved. Try one of
          these instead.
        </p>
        <p class="ex-hand ex-missing__note">start here →</p>
        <div class="ex-missing__links">
          <a class="ex-missing__button ex-missing__button--primary" href="/getting-started">
            Getting started
          </a>
          <a class="ex-missing__button" href="/api-reference">API reference</a>
          <a class="ex-missing__button" href="/">Home</a>
        </div>
      </div>
    </template>
  </Layout>
</template>
