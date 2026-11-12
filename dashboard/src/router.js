import { createRouter, createWebHashHistory } from 'vue-router';

import { session } from './stores/session.js';
import KeysView from './views/KeysView.vue';
import LoginView from './views/LoginView.vue';
import OverviewView from './views/OverviewView.vue';
import RegisterView from './views/RegisterView.vue';
import SettingsView from './views/SettingsView.vue';
import NotFoundView from './views/NotFoundView.vue';
import UsageView from './views/UsageView.vue';

const routes = [
  { path: '/', name: 'overview', component: OverviewView },
  { path: '/keys', name: 'keys', component: KeysView },
  { path: '/usage', name: 'usage', component: UsageView },
  { path: '/settings', name: 'settings', component: SettingsView },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { public: true }
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterView,
    meta: { public: true }
  },
  // Must stay last: matches any address no route above claims.
  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView }
];

export const router = createRouter({
  // Hash URLs (/#/register), not real paths. The dashboard is a static site and
  // the host only has a file for `/`, so a real path like /register is a 404
  // unless the host is configured to rewrite it. A hash is never sent to the
  // server, so every page and every refresh works with no host setup.
  history: createWebHashHistory(),
  routes
});

router.beforeEach(async (to) => {
  if (!session.state.isResolved) {
    await session.resolve();
  }

  const isSignedIn = Boolean(session.state.user);

  if (!to.meta.public && !isSignedIn) {
    return { name: 'login', query: { next: to.fullPath } };
  }

  if (to.meta.public && isSignedIn) {
    return { name: 'overview' };
  }

  return true;
});
