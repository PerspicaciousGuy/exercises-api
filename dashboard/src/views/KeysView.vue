<script setup>
import { onMounted, ref } from 'vue';

import AppIcon from '../components/AppIcon.vue';
import { api } from '../api/client.js';

const keys = ref([]);
const label = ref('');
const issuedKey = ref('');
const errorMessage = ref('');
const isLoading = ref(true);
const isCreating = ref(false);
const copied = ref(false);

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
  copied.value = false;
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

async function copyKey() {
  try {
    await navigator.clipboard.writeText(issuedKey.value);
    copied.value = true;
  } catch {
    copied.value = false;
  }
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

onMounted(load);
</script>

<template>
  <header class="page-header">
    <h1 class="page-title">API keys</h1>
    <p class="page-subtitle">
      Keys authenticate your app. Revoking one takes effect immediately.
    </p>
  </header>

  <p v-if="errorMessage" class="alert alert--error">
    <AppIcon class="alert__icon" name="alert" />
    <span>{{ errorMessage }}</span>
  </p>

  <div v-if="issuedKey" class="card">
    <div class="card__header">
      <h2 class="card__title">Your new key</h2>
    </div>
    <p class="alert alert--warning">
      <AppIcon class="alert__icon" name="alert" />
      <span>Copy it now. This is the only time it is shown.</span>
    </p>
    <div class="token-reveal">
      <span class="token-reveal__value mono">{{ issuedKey }}</span>
      <button class="button button--ghost button--sm" type="button" @click="copyKey">
        <AppIcon class="sidebar__icon" :name="copied ? 'check' : 'copy'" />
        {{ copied ? 'Copied' : 'Copy' }}
      </button>
    </div>
  </div>

  <div class="card">
    <div class="card__header">
      <h2 class="card__title">Create a key</h2>
    </div>
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
        <p class="field__hint">A name to help you recognise this key later.</p>
      </div>
      <button class="button" type="submit" :disabled="isCreating">
        {{ isCreating ? 'Creating…' : 'Create key' }}
      </button>
    </form>
  </div>

  <div class="card">
    <div class="card__header">
      <h2 class="card__title">Your keys</h2>
    </div>

    <div v-if="isLoading" class="state">
      <span class="spinner" aria-hidden="true"></span>
      <span>Loading your keys…</span>
    </div>

    <div v-else-if="keys.length === 0" class="state">
      <AppIcon class="state__icon" name="keys" />
      <span>No keys yet. Create one above to start calling the API.</span>
    </div>

    <div v-else class="table-wrap">
    <table class="table">
      <thead>
        <tr>
          <th>Label</th>
          <th>Status</th>
          <th>Last used</th>
          <th>Created</th>
          <th class="table__actions"></th>
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
              {{ key.isActive ? 'Active' : 'Revoked' }}
            </span>
          </td>
          <td>{{ formatDate(key.lastUsedAt) }}</td>
          <td>{{ formatDate(key.createdAt) }}</td>
          <td class="table__actions">
            <button
              v-if="key.isActive"
              class="button button--danger button--sm"
              @click="revoke(key.id)"
            >
              Revoke
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    </div>
  </div>
</template>
