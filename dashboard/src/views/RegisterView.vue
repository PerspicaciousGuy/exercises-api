<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { session } from '../stores/session.js';

const router = useRouter();

const email = ref('');
const password = ref('');
const name = ref('');
const errorMessage = ref('');
const isSubmitting = ref(false);

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
</script>

<template>
  <div v-if="issuedKey" class="card">
    <h1 class="card__title">Save your API key</h1>

    <p class="alert alert--warning">
      This is the only time this key is shown. The server stores a hash of it
      and cannot show it again.
    </p>

    <p class="token-reveal mono">{{ issuedKey }}</p>

    <button class="button" @click="router.push({ name: 'overview' })">
      I have saved it
    </button>
  </div>

  <form v-else class="card" @submit.prevent="submit">
    <h1 class="card__title">Create an account</h1>

    <p v-if="errorMessage" class="alert alert--error">{{ errorMessage }}</p>

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
      <p class="muted" style="font-size: var(--ex-text-sm)">
        At least 8 characters.
      </p>
    </div>

    <button class="button" type="submit" :disabled="isSubmitting">
      {{ isSubmitting ? 'Creating…' : 'Create account' }}
    </button>

    <p class="muted" style="margin-bottom: 0">
      Already registered?
      <RouterLink :to="{ name: 'login' }">Sign in</RouterLink>
    </p>
  </form>
</template>
