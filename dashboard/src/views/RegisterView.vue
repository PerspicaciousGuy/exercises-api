<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import AppIcon from '../components/AppIcon.vue';
import { session } from '../stores/session.js';

const router = useRouter();

const email = ref('');
const password = ref('');
const name = ref('');
const errorMessage = ref('');
const isSubmitting = ref(false);
const copied = ref(false);

// Shown once. The API returns the plaintext key only at creation and stores
// only its hash, so if this is lost the key can never be recovered.
const issuedKey = ref('');

async function submit() {
  errorMessage.value = '';
  isSubmitting.value = true;

  try {
    const apiKey = await session.register({
      email: email.value,
      password: password.value,
      name: name.value || undefined
    });
    issuedKey.value = apiKey.key;
  } catch (error) {
    errorMessage.value = error.detail ?? 'Could not create the account.';
  } finally {
    isSubmitting.value = false;
  }
}

async function copyKey() {
  try {
    await navigator.clipboard.writeText(issuedKey.value);
    copied.value = true;
  } catch {
    copied.value = false;
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

      <div v-if="issuedKey" class="card">
        <div class="card__header">
          <h1 class="card__title">Save your API key</h1>
        </div>

        <p class="alert alert--warning">
          <AppIcon class="alert__icon" name="alert" />
          <span>
            This is the only time this key is shown. The server stores a hash of
            it and cannot show it again.
          </span>
        </p>

        <div class="token-reveal">
          <span class="token-reveal__value mono">{{ issuedKey }}</span>
          <button
            class="button button--ghost button--sm"
            type="button"
            @click="copyKey"
          >
            <AppIcon class="sidebar__icon" :name="copied ? 'check' : 'copy'" />
            {{ copied ? 'Copied' : 'Copy' }}
          </button>
        </div>

        <button
          class="button button--block mt-4"
          @click="router.push({ name: 'overview' })"
        >
          I have saved it
        </button>
      </div>

      <form v-else class="card" @submit.prevent="submit">
        <div class="card__header">
          <h1 class="card__title">Create an account</h1>
        </div>

        <p v-if="errorMessage" class="alert alert--error">
          <AppIcon class="alert__icon" name="alert" />
          <span>{{ errorMessage }}</span>
        </p>

        <div class="field">
          <label class="field__label" for="name">Name</label>
          <input
            id="name"
            v-model="name"
            class="input"
            type="text"
            autocomplete="name"
          />
        </div>

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
            autocomplete="new-password"
            minlength="8"
            required
          />
          <p class="field__hint">At least 8 characters.</p>
        </div>

        <button class="button button--block" type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? 'Creating…' : 'Create account' }}
        </button>
      </form>

      <p v-if="!issuedKey" class="auth-footer">
        Already registered?
        <RouterLink :to="{ name: 'login' }">Sign in</RouterLink>
      </p>
    </div>
  </div>
</template>
