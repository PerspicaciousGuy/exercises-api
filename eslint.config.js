import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.vitest
      }
    },
    rules: {
      'no-console': ['warn', { allow: ['info', 'warn', 'error'] }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    // The docs site and the dashboard are separate Vite/Vue projects with
    // their own toolchains, their own dependencies, and browser globals.
    ignores: ['coverage/', 'node_modules/', 'website/', 'dashboard/']
  }
];
