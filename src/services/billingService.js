import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  BILLING_PROVIDER_NAME,
  FREE_TIER,
  PURCHASABLE_TIERS,
  SUBSCRIPTION_LIFECYCLE_EVENTS
} from '../constants/billing.js';
import { AppError } from '../errors/AppError.js';

export function createBillingService({
  billingRepository,
  billingProvider,
  now = () => new Date()
}) {
  return {
    async createCheckout({ user, tier }) {
      if (!PURCHASABLE_TIERS.includes(tier)) {
        throw new AppError({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: `tier must be one of ${PURCHASABLE_TIERS.join(', ')}`
        });
      }

      return {
        tier,
        checkoutUrl: await billingProvider.createCheckout({
          userId: user.id,
          email: user.email,
          tier
        })
      };
    },

    /**
     * Verifies, deduplicates, and applies a provider webhook. Deliveries that
     * cannot be mapped to a user are still recorded and acknowledged, so the
     * provider does not retry them forever.
     */
    async handleWebhookEvent({ rawBody, signature }) {
      if (!billingProvider.verifySignature(rawBody, signature)) {
        throw new AppError({
          statusCode: 401,
          code: 'WEBHOOK_SIGNATURE_INVALID',
          message: 'Webhook signature could not be verified'
        });
      }

      const event = billingProvider.parseWebhookEvent(rawBody);
      const recordedEvent = await billingRepository.recordWebhookEvent({
        provider: BILLING_PROVIDER_NAME,
        eventName: event.eventName,
        eventKey: event.eventKey,
        payload: event.payload
      });

      if (!recordedEvent) {
        return { duplicate: true, applied: false };
      }

      const applied = await applySubscriptionEvent({
        billingRepository,
        billingProvider,
        event
      });

      await billingRepository.markWebhookEventProcessed({
        eventId: recordedEvent.id,
        processedAt: now().toISOString()
      });

      return { duplicate: false, applied };
    }
  };
}

async function applySubscriptionEvent({
  billingRepository,
  billingProvider,
  event
}) {
  if (!SUBSCRIPTION_LIFECYCLE_EVENTS.has(event.eventName) || !event.userId) {
    return false;
  }

  const { subscription } = event;

  await billingRepository.updateUserSubscription({
    userId: event.userId,
    tier: resolveTier({ billingProvider, subscription }),
    provider: BILLING_PROVIDER_NAME,
    customerId: subscription.customerId,
    subscriptionId: subscription.id,
    status: subscription.status,
    renewsAt: subscription.renewsAt,
    endsAt: subscription.endsAt
  });

  return true;
}

/**
 * A cancelled, expired, paused, or unpaid subscription drops the account to the
 * free tier immediately rather than at period end.
 */
function resolveTier({ billingProvider, subscription }) {
  if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    return FREE_TIER;
  }

  return billingProvider.tierForVariantId(subscription.variantId) ?? FREE_TIER;
}
