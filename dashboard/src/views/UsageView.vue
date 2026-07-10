<script setup>
import { computed, onMounted, ref } from 'vue';

import { api } from '../api/client.js';

const usage = ref([]);
const errorMessage = ref('');
const isLoading = ref(true);

const today = computed(() => usage.value[0] ?? null);

async function load() {
  try {
    usage.value = await api.getUsage();
  } catch (error) {
    errorMessage.value = error.detail ?? 'Could not load usage.';
  } finally {
    isLoading.value = false;
  }
}

function percentUsed(row) {
  return row.limit === 0 ? 0 : Math.round((row.requestCount / row.limit) * 100);
}

onMounted(load);
</script>

<template>
  <h1 class="page-title">Usage</h1>
  <p class="page-subtitle">
    Requests are counted per API key and reset at midnight UTC.
  </p>

  <p v-if="errorMessage" class="alert alert--error">{{ errorMessage }}</p>
  <p v-else-if="isLoading" class="muted">Loading…</p>

  <template v-else>
    <div v-if="today" class="card">
      <h2 class="card__title">Today</h2>
      <div class="stat-grid">
        <div>
          <div class="stat">{{ today.requestCount }}</div>
          <div class="stat__label">Requests used</div>
        </div>
        <div>
          <div class="stat">{{ today.remaining }}</div>
          <div class="stat__label">Remaining</div>
        </div>
        <div>
          <div class="stat">{{ percentUsed(today) }}%</div>
          <div class="stat__label">Of your {{ today.limit }} daily limit</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2 class="card__title">Last 30 days</h2>

      <p v-if="usage.length === 0" class="muted">
        No requests recorded yet. Usage appears here once you call the API with
        one of your keys.
      </p>

      <table v-else class="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Requests</th>
            <th>Limit</th>
            <th>Remaining</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in usage" :key="row.date">
            <td>{{ row.date }}</td>
            <td>{{ row.requestCount }}</td>
            <td>{{ row.limit }}</td>
            <td>{{ row.remaining }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
