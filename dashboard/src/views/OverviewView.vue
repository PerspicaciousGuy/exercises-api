<script setup>
import { computed, ref } from 'vue';

import AppIcon from '../components/AppIcon.vue';
import { api } from '../api/client.js';
import { session } from '../stores/session.js';

const PURCHASABLE_TIERS = ['basic', 'pro', 'enterprise'];

const user = computed(() => session.state.user);
const errorMessage = ref('');
const pendingTier = ref('');

async function upgrade(tier) {
  errorMessage.value = '';
  pendingTier.value = tier;

  try {
    const checkout = await api.createCheckout(tier);
    window.location.href = checkout.checkoutUrl;
  } catch (error) {
    errorMessage.value = error.detail ?? 'Could not start checkout.';
    pendingTier.value = '';
  }
}
</script>

<template>
  <header class="page-header">
    <h1 class="page-title">Overview</h1>
    <p class="page-subtitle">Your account and current plan.</p>
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
    <div class="stat-grid">
      <div class="metric">
        <div class="metric__label">Email</div>
        <div class="metric__value metric__value--mono">{{ user.email }}</div>
      </div>
      <div class="metric">
        <div class="metric__label">Current tier</div>
        <div class="metric__value capitalize">{{ user.tier }}</div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card__header">
      <h2 class="card__title">Change plan</h2>
    </div>

    <p v-if="errorMessage" class="alert alert--error">
      <AppIcon class="alert__icon" name="alert" />
      <span>{{ errorMessage }}</span>
    </p>

    <p class="card__hint mb-5">
      Your tier changes when the payment provider confirms the subscription, not
      when checkout closes. It may take a few seconds to appear here.
    </p>

    <div class="plan-grid">
      <div
        v-for="tier in PURCHASABLE_TIERS"
        :key="tier"
        class="plan"
        :class="{ 'plan--current': user?.tier === tier }"
      >
        <div class="row row--between mt-0">
          <span class="plan__name">{{ tier }}</span>
          <span v-if="user?.tier === tier" class="plan__tag">Current plan</span>
        </div>
        <button
          class="button button--block"
          :class="{ 'button--ghost': user?.tier === tier }"
          :disabled="Boolean(pendingTier) || user?.tier === tier"
          @click="upgrade(tier)"
        >
          <template v-if="pendingTier === tier">Redirecting…</template>
          <template v-else-if="user?.tier === tier">Active</template>
          <template v-else>Upgrade</template>
        </button>
      </div>
    </div>
  </div>
</template>
