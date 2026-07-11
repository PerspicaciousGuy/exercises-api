<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import AppIcon from '../components/AppIcon.vue';
import { session } from '../stores/session.js';

const route = useRoute();
const router = useRouter();

const email = ref('');
const password = ref('');
const errorMessage = ref('');
const isSubmitting = ref(false);

async function submit() {
  errorMessage.value = '';
  isSubmitting.value = true;

  try {
    await session.login({ email: email.value, password: password.value });
    router.push(route.query.next ?? { name: 'overview' });
  } catch (error) {
    errorMessage.value = error.detail ?? 'Could not sign in.';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="auth-shell">
    <div class="auth-card">
      <div class="auth-brand">
        <span class="sidebar__brand-mark" aria-hidden="true">E</span>
        ExerciseDB
      </div>

      <form class="card" @submit.prevent="submit">
        <div class="card__header">
          <h1 class="card__title">Sign in</h1>
        </div>

        <p v-if="errorMessage" class="alert alert--error">
          <AppIcon class="alert__icon" name="alert" />
          <span>{{ errorMessage }}</span>
        </p>

        <div class="field">
          <label class="field__label" for="email">Email</label>
          <input
            id="email"
            v-model="email"
            class="input"
            type="email"
            autocomplete="email"
            required
          />
        </div>

        <div class="field">
          <label class="field__label" for="password">Password</label>
          <input
            id="password"
            v-model="password"
            class="input"
            type="password"
            autocomplete="current-password"
            required
          />
        </div>

        <button class="button button--block" type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

      <p class="auth-footer">
        No account?
        <RouterLink :to="{ name: 'register' }">Create one</RouterLink>
      </p>
    </div>
  </div>
</template>
