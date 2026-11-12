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
    ['meta', { name: 'theme-color', content: '#f8f5ec' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    [
      'link',
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }
    ],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&family=Caveat:wght@500;700&family=Special+Elite&family=Geist+Mono:wght@400;500;600&display=swap'
      }
    ],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: SITE_TITLE }],
    ['meta', { property: 'og:description', content: SITE_DESCRIPTION }]
  ],

  themeConfig: {
    nav: [
      { text: 'Overview', link: '/overview' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Guides', link: '/guides/finding-substitutes' },
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
        text: 'Core Concepts',
        items: [
          { text: 'The Relationship Graph', link: '/concepts/relationship-graph' }
        ]
      },
      {
        text: 'Guides',
        items: [
          { text: 'Finding Substitutes', link: '/guides/finding-substitutes' },
          { text: 'Building a Progression', link: '/guides/building-a-progression' },
          { text: 'Analyzing Coverage', link: '/guides/analyzing-coverage' },
          { text: 'Using the SDK', link: '/guides/using-the-sdk' },
          { text: 'Kotlin & Android', link: '/guides/kotlin-android' },
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
        'https://github.com/PerspicaciousGuy/exercises-api/edit/main/website/:path',
      text: 'Edit this page on GitHub'
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 ExerciseDB API'
    }
  }
});
