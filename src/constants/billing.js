export const BILLING_PROVIDER_NAME = 'lemon_squeezy';

export const FREE_TIER = 'free';

/** Tiers a developer can buy. `free` is the default and is never purchased. */
export const PURCHASABLE_TIERS = ['basic', 'pro', 'enterprise'];

/** Subscription statuses that grant the paid tier. Everything else downgrades. */
export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'on_trial']);

/**
 * Lifecycle events whose payload carries a subscription status on
 * `data.attributes.status`. Payment events carry an invoice instead and are
 * recorded without changing the tier.
 */
export const SUBSCRIPTION_LIFECYCLE_EVENTS = new Set([
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_expired',
  'subscription_paused',
  'subscription_unpaused',
  'subscription_resumed'
]);

export const WEBHOOK_MAX_BODY_SIZE = '64kb';

export const PROVIDER_REQUEST_TIMEOUT_MS = 10_000;
