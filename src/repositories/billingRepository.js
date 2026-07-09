import { parseSupabaseScriptEnv } from '../config/supabaseEnv.js';
import { SupabaseRestClient } from '../supabase/restClient.js';

const WEBHOOK_EVENT_COLUMNS =
  'id,provider,event_name,event_key,received_at,processed_at';
const USER_BILLING_COLUMNS =
  'id,email,tier,billing_provider,billing_customer_id,billing_subscription_id,subscription_status,subscription_renews_at,subscription_ends_at';

export function createDefaultBillingRepository() {
  const env = parseSupabaseScriptEnv(process.env);
  const client = new SupabaseRestClient(env);

  return createBillingRepository({ client });
}

export function createLazyDefaultBillingRepository() {
  let repository;

  function getRepository() {
    repository ??= createDefaultBillingRepository();
    return repository;
  }

  return {
    recordWebhookEvent(input) {
      return getRepository().recordWebhookEvent(input);
    },
    markWebhookEventProcessed(input) {
      return getRepository().markWebhookEventProcessed(input);
    },
    updateUserSubscription(input) {
      return getRepository().updateUserSubscription(input);
    }
  };
}

export function createBillingRepository({ client }) {
  return {
    /**
     * Returns null when this exact delivery was already stored, which is how
     * duplicate webhook deliveries are detected.
     */
    async recordWebhookEvent({ provider, eventName, eventKey, payload }) {
      const rows = await client.upsert(
        'billing_webhook_events',
        [
          {
            provider,
            event_name: eventName,
            event_key: eventKey,
            payload
          }
        ],
        {
          onConflict: 'provider,event_key',
          ignoreDuplicates: true,
          select: WEBHOOK_EVENT_COLUMNS
        }
      );

      return rows[0] ? mapWebhookEvent(rows[0]) : null;
    },

    async markWebhookEventProcessed({ eventId, processedAt }) {
      await client.update(
        'billing_webhook_events',
        { processed_at: processedAt },
        {
          filters: { id: `eq.${eventId}` },
          select: 'id'
        }
      );
    },

    async updateUserSubscription({
      userId,
      tier,
      provider,
      customerId,
      subscriptionId,
      status,
      renewsAt,
      endsAt
    }) {
      const rows = await client.update(
        'api_users',
        {
          tier,
          billing_provider: provider,
          billing_customer_id: customerId,
          billing_subscription_id: subscriptionId,
          subscription_status: status,
          subscription_renews_at: renewsAt,
          subscription_ends_at: endsAt
        },
        {
          filters: { id: `eq.${userId}` },
          select: USER_BILLING_COLUMNS
        }
      );

      return rows[0] ? mapUserBilling(rows[0]) : null;
    }
  };
}

function mapWebhookEvent(row) {
  return {
    id: row.id,
    provider: row.provider,
    eventName: row.event_name,
    eventKey: row.event_key,
    receivedAt: row.received_at,
    processedAt: row.processed_at
  };
}

function mapUserBilling(row) {
  return {
    id: row.id,
    email: row.email,
    tier: row.tier,
    billingProvider: row.billing_provider,
    billingCustomerId: row.billing_customer_id,
    billingSubscriptionId: row.billing_subscription_id,
    subscriptionStatus: row.subscription_status,
    subscriptionRenewsAt: row.subscription_renews_at,
    subscriptionEndsAt: row.subscription_ends_at
  };
}
