<script setup>
import { onMounted, ref } from 'vue';

import { api } from '../api/client.js';

const keys = ref([]);
const label = ref('');
const issuedKey = ref('');
const errorMessage = ref('');
const isLoading = ref(true);
const isCreating = ref(false);

async function load() {
  isLoading.value = true;

  try {
    keys.value = await api.listApiKeys();
  } catch (error) {
    errorMessage.value = error.detail ?? 'Could not load API keys.';
  } finally {
    isLoading.value = false;
  }
}

async function create() {
  errorMessage.value = '';
  issuedKey.value = '';
  isCreating.value = true;

  try {
    const created = await api.createApiKey({
      label: label.value || undefined
    });
    issuedKey.value = created.key;
    label.value = '';
    await load();
  } catch (error) {
    errorMessage.value = error.detail ?? 'Could not create the key.';
  } finally {
    isCreating.value = false;
  }
}

async function revoke(id) {
  errorMessage.value = '';

  try {
    await api.revokeApiKey(id);
    await load();
  } catch (error) {
    errorMessage.value = error.detail ?? 'Could not revoke the key.';
  }
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

onMounted(load);
</script>

<template>
  <h1 class="page-title">API keys</h1>
  <p class="page-subtitle">
    Keys authenticate your app. Revoking one takes effect immediately.
  </p>

  <p v-if="errorMessage" class="alert alert--error">{{ errorMessage }}</p>

  <div v-if="issuedKey" class="card">
    <h2 class="card__title">Your new key</h2>
    <p class="alert alert--warning">
      Copy it now. This is the only time it is shown.
    </p>
    <p class="token-reveal mono">{{ issuedKey }}</p>
  </div>

  <div class="card">
    <h2 class="card__title">Create a key</h2>
    <form @submit.prevent="create">
      <div class="field">
        <label class="field__label" for="label">Label</label>
        <input
          id="label"
          v-model="label"
          class="input"
          type="text"
          placeholder="Mobile app"
          maxlength="100"
        />
      </div>
      <button class="button" type="submit" :disabled="isCreating">
        {{ isCreating ? 'Creating…' : 'Create key' }}
      </button>
    </form>
  </div>

  <div class="card">
    <h2 class="card__title">Your keys</h2>

    <p v-if="isLoading" class="muted">Loading…</p>
    <p v-else-if="keys.length === 0" class="muted">No keys yet.</p>

    <table v-else class="table">
      <thead>
        <tr>
          <th>Label</th>
          <th>Status</th>
          <th>Last used</th>
          <th>Created</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="key in keys" :key="key.id">
          <td>{{ key.label ?? '—' }}</td>
          <td>
            <span
              class="badge"
              :class="key.isActive ? 'badge--active' : 'badge--revoked'"
            >
              {{ key.isActive ? 'active' : 'revoked' }}
            </span>
          </td>
          <td>{{ formatDate(key.lastUsedAt) }}</td>
          <td>{{ formatDate(key.createdAt) }}</td>
          <td>
            <button
              v-if="key.isActive"
              class="button button--danger"
              @click="revoke(key.id)"
            >
              Revoke
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
