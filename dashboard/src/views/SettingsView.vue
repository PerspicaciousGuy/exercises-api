<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import AppIcon from '../components/AppIcon.vue';
import { session } from '../stores/session.js';
import { setThemePreference, theme } from '../styles/theme.js';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'usage' }
];

const router = useRouter();
const user = computed(() => session.state.user);

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

async function signOut() {
  await session.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <header class="page-header">
    <h1 class="page-title">Settings</h1>
    <p class="page-subtitle">Your account details and preferences.</p>
  </header>

  <div v-if="user" class="card">
    <div class="card__header">
      <h2 class="card__title">Account</h2>
      <span
        class="badge"
        :class="user.isActive ? 'badge--active' : 'badge--revoked'"
      >
        {{ user.isActive ? 'Active' : 'Inactive' }}
      </span>
    </div>

    <dl class="detail-list">
      <div v-if="user.name" class="detail-list__row">
        <dt class="detail-list__label">Name</dt>
        <dd class="detail-list__value">{{ user.name }}</dd>
      </div>
      <div class="detail-list__row">
        <dt class="detail-list__label">Email</dt>
        <dd class="detail-list__value mono">{{ user.email }}</dd>
      </div>
      <div class="detail-list__row">
        <dt class="detail-list__label">Plan</dt>
        <dd class="detail-list__value capitalize">{{ user.tier }}</dd>
      </div>
      <div class="detail-list__row">
        <dt class="detail-list__label">Member since</dt>
        <dd class="detail-list__value">{{ formatDate(user.createdAt) }}</dd>
      </div>
    </dl>
  </div>

  <div class="card">
    <div class="card__header">
      <h2 class="card__title">Appearance</h2>
    </div>
    <p class="card__hint mb-5">Choose how the dashboard looks.</p>

    <div class="segmented" role="group" aria-label="Theme">
      <button
        v-for="option in THEME_OPTIONS"
        :key="option.value"
        type="button"
        class="segmented__option"
        :class="{ 'segmented__option--active': theme.preference === option.value }"
        :aria-pressed="theme.preference === option.value"
        @click="setThemePreference(option.value)"
      >
        <AppIcon class="sidebar__icon" :name="option.icon" />
        {{ option.label }}
      </button>
    </div>
  </div>

  <div class="card">
    <div class="card__header">
      <h2 class="card__title">Session</h2>
    </div>
    <p class="card__hint mb-5">Sign out of the dashboard on this device.</p>
    <button class="button button--danger" type="button" @click="signOut">
      <AppIcon class="sidebar__icon" name="logout" />
      Sign out
    </button>
  </div>
</template>
