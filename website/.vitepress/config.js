import { defineConfig } from 'vitepress';

const SITE_TITLE = 'ExerciseDB API';
const SITE_DESCRIPTION =
  'A public exercise catalog API for fitness app developers. Browse, search, and sync a curated exercise catalog into your own app.';

export default defineConfig({
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  lang: 'en-GB',
  cleanUrls: true,
  lastUpdated: true,

  head: [
    ['meta', { name: 'theme-color', content: '#128269' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: SITE_TITLE }],
    ['meta', { property: 'og:description', content: SITE_DESCRIPTION }]
  ],

  themeConfig: {
    nav: [
      { text: 'Overview', link: '/overview' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'API Reference', link: '/api-reference' }
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Overview', link: '/overview' },
          { text: 'Getting Started', link: '/getting-started' }
        ]
      },
      {
        text: 'Guides',
        items: [
          { text: 'Sync Guide', link: '/sync-guide' },
          { text: 'Examples', link: '/examples' },
          { text: 'Architecture', link: '/architecture' }
        ]
      },
      {
        text: 'Reference',
        items: [{ text: 'API Reference', link: '/api-reference' }]
      }
    ],

    search: { provider: 'local' },

    editLink: {
      pattern:
        'https://github.com/PerspicaciousGuy/exercisedb-api/edit/main/website/:path',
      text: 'Edit this page on GitHub'
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 ExerciseDB API'
    }
  }
});
