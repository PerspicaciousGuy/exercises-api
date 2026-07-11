<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import AppIcon from './components/AppIcon.vue';
import { session } from './stores/session.js';

const route = useRoute();

const isAuthPage = computed(() => Boolean(route.meta.public));
const user = computed(() => session.state.user);

const NAV_LINKS = [
  { name: 'overview', label: 'Overview', icon: 'overview' },
  { name: 'keys', label: 'API keys', icon: 'keys' },
  { name: 'usage', label: 'Usage', icon: 'usage' },
  { name: 'settings', label: 'Settings', icon: 'settings' }
];

const initial = computed(() => user.value?.email?.[0] ?? '?');
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

      <RouterLink
        v-if="user"
        class="sidebar__account"
        :to="{ name: 'settings' }"
      >
        <span class="sidebar__avatar" aria-hidden="true">{{ initial }}</span>
        <span class="sidebar__email">{{ user.email }}</span>
      </RouterLink>
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
