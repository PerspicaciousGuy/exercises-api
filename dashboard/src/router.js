import { createRouter, createWebHistory } from 'vue-router';

import { session } from './stores/session.js';
import KeysView from './views/KeysView.vue';
import LoginView from './views/LoginView.vue';
import OverviewView from './views/OverviewView.vue';
import RegisterView from './views/RegisterView.vue';
import SettingsView from './views/SettingsView.vue';
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
  }
];

export const router = createRouter({
  history: createWebHistory(),
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
