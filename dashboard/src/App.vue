<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { session } from './stores/session.js';

const route = useRoute();
const router = useRouter();

const isAuthPage = computed(() => Boolean(route.meta.public));
const user = computed(() => session.state.user);

async function signOut() {
  await session.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <div v-if="isAuthPage" class="auth-shell">
    <RouterView />
  </div>

  <div v-else class="layout">
    <aside class="sidebar">
      <div class="sidebar__brand">ExerciseDB</div>

      <nav>
        <RouterLink
          v-for="link in [
            { name: 'overview', label: 'Overview' },
            { name: 'keys', label: 'API keys' },
            { name: 'usage', label: 'Usage' }
          ]"
          :key="link.name"
          class="sidebar__link"
          active-class="sidebar__link--active"
          :to="{ name: link.name }"
        >
          {{ link.label }}
        </RouterLink>
      </nav>

      <p v-if="user" class="muted" style="margin-top: var(--ex-space-6)">
        <span class="mono">{{ user.email }}</span>
      </p>
      <button v-if="user" class="button button--ghost" @click="signOut">
        Sign out
      </button>
    </aside>

    <main class="main">
      <RouterView />
    </main>
  </div>
</template>
