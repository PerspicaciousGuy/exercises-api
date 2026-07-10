<script setup>
import { computed, ref } from 'vue';

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
  <h1 class="page-title">Overview</h1>
  <p class="page-subtitle">Your account and current plan.</p>

  <div v-if="user" class="card">
    <h2 class="card__title">Account</h2>
    <div class="stat-grid">
      <div>
        <div class="stat__label">Email</div>
        <div class="mono">{{ user.email }}</div>
      </div>
      <div>
        <div class="stat__label">Tier</div>
        <div class="stat">{{ user.tier }}</div>
      </div>
      <div>
        <div class="stat__label">Status</div>
        <span
          class="badge"
          :class="user.isActive ? 'badge--active' : 'badge--revoked'"
        >
          {{ user.isActive ? 'active' : 'inactive' }}
        </span>
      </div>
    </div>
  </div>

  <div class="card">
    <h2 class="card__title">Change plan</h2>

    <p v-if="errorMessage" class="alert alert--error">{{ errorMessage }}</p>

    <p class="muted">
      Your tier changes when the payment provider confirms the subscription, not
      when checkout closes. It may take a few seconds to appear here.
    </p>

    <button
      v-for="tier in PURCHASABLE_TIERS"
      :key="tier"
      class="button"
      style="margin-right: var(--ex-space-3)"
      :disabled="Boolean(pendingTier) || user?.tier === tier"
      @click="upgrade(tier)"
    >
      {{ user?.tier === tier ? `Current: ${tier}` : `Upgrade to ${tier}` }}
    </button>
  </div>
</template>
