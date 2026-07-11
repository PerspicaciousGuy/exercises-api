<script setup>
import { computed, onMounted, ref } from 'vue';

import AppIcon from '../components/AppIcon.vue';
import { api } from '../api/client.js';

const WARNING_THRESHOLD = 75;
const DANGER_THRESHOLD = 90;

const usage = ref([]);
const errorMessage = ref('');
const isLoading = ref(true);

const today = computed(() => usage.value[0] ?? null);

const todayPercent = computed(() =>
  today.value ? percentUsed(today.value) : 0
);

const meterModifier = computed(() => {
  if (todayPercent.value >= DANGER_THRESHOLD) return 'meter__fill--danger';
  if (todayPercent.value >= WARNING_THRESHOLD) return 'meter__fill--warning';
  return '';
});

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
  <header class="page-header">
    <h1 class="page-title">Usage</h1>
    <p class="page-subtitle">
      Requests are counted per API key and reset at midnight UTC.
    </p>
  </header>

  <p v-if="errorMessage" class="alert alert--error">
    <AppIcon class="alert__icon" name="alert" />
    <span>{{ errorMessage }}</span>
  </p>

  <div v-else-if="isLoading" class="card">
    <div class="state">
      <span class="spinner" aria-hidden="true"></span>
      <span>Loading usage…</span>
    </div>
  </div>

  <template v-else>
    <div v-if="today" class="card">
      <div class="card__header">
        <h2 class="card__title">Today</h2>
        <span class="card__hint">{{ todayPercent }}% of daily limit used</span>
      </div>

      <div class="meter mb-5">
        <div
          class="meter__fill"
          :class="meterModifier"
          :style="{ width: `${Math.min(todayPercent, 100)}%` }"
        ></div>
      </div>

      <div class="stat-grid">
        <div class="metric">
          <div class="metric__label">Requests used</div>
          <div class="metric__value">{{ today.requestCount }}</div>
        </div>
        <div class="metric">
          <div class="metric__label">Remaining</div>
          <div class="metric__value">{{ today.remaining }}</div>
        </div>
        <div class="metric">
          <div class="metric__label">Daily limit</div>
          <div class="metric__value">{{ today.limit }}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card__header">
        <h2 class="card__title">Last 30 days</h2>
      </div>

      <div v-if="usage.length === 0" class="state">
        <AppIcon class="state__icon" name="usage" />
        <span>
          No requests recorded yet. Usage appears here once you call the API with
          one of your keys.
        </span>
      </div>

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
