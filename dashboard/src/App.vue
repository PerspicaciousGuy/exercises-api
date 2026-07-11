<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import AppIcon from './components/AppIcon.vue';
import { session } from './stores/session.js';
import { theme, toggleTheme } from './styles/theme.js';

const route = useRoute();
const router = useRouter();

const isAuthPage = computed(() => Boolean(route.meta.public));
const user = computed(() => session.state.user);

const NAV_LINKS = [
  { name: 'overview', label: 'Overview', icon: 'overview' },
  { name: 'keys', label: 'API keys', icon: 'keys' },
  { name: 'usage', label: 'Usage', icon: 'usage' }
];

const initial = computed(() => user.value?.email?.[0] ?? '?');

async function signOut() {
  await session.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <RouterView v-if="isAuthPage" />

  <div v-else class="layout">
    <aside class="sidebar">
      <div class="sidebar__brand">
        <span class="sidebar__brand-mark" aria-hidden="true">E</span>
        ExerciseDB
      </div>

      <nav class="sidebar__nav">
        <RouterLink
          v-for="link in NAV_LINKS"
          :key="link.name"
          class="sidebar__link"
          active-class="sidebar__link--active"
          :to="{ name: link.name }"
        >
          <AppIcon class="sidebar__icon" :name="link.icon" />
          {{ link.label }}
        </RouterLink>
      </nav>

      <div v-if="user" class="sidebar__footer">
        <div class="sidebar__account">
          <span class="sidebar__avatar" aria-hidden="true">{{ initial }}</span>
          <span class="sidebar__email">{{ user.email }}</span>
        </div>
        <div class="row">
          <button
            class="icon-button"
            type="button"
            :aria-label="
              theme.resolved === 'dark'
                ? 'Switch to light theme'
                : 'Switch to dark theme'
            "
            @click="toggleTheme"
          >
            <AppIcon :name="theme.resolved === 'dark' ? 'sun' : 'moon'" />
          </button>
          <button
            class="button button--ghost button--sm"
            type="button"
            @click="signOut"
          >
            <AppIcon class="sidebar__icon" name="logout" />
            Sign out
          </button>
        </div>
      </div>
    </aside>

    <main class="main">
      <RouterView />
    </main>

    <nav class="tabbar" aria-label="Primary">
      <RouterLink
        v-for="link in NAV_LINKS"
        :key="link.name"
        class="tabbar__link"
        active-class="tabbar__link--active"
        :to="{ name: link.name }"
      >
        <AppIcon class="tabbar__icon" :name="link.icon" />
        <span class="tabbar__label">{{ link.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>
