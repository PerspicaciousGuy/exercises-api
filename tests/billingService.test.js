import { describe, expect, it, vi } from 'vitest';

import { createBillingService } from '../src/services/billingService.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const RAW_BODY = Buffer.from('{"any":"body"}');
const VALID_SIGNATURE = 'valid-signature';

describe('createBillingService', () => {
  describe('createCheckout', () => {
    it('returns the checkout url for a purchasable tier', async () => {
      const { service } = createService();

      const result = await service.createCheckout({
        user: { id: USER_ID, email: 'alice@example.com' },
        tier: 'pro'
      });

      expect(result).toEqual({
        tier: 'pro',
        checkoutUrl: 'https://store.test/checkout/abc'
      });
    });

    it('rejects a checkout for the free tier', async () => {
      const { service } = createService();

      await expect(
        service.createCheckout({
          user: { id: USER_ID, email: 'alice@example.com' },
          tier: 'free'
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR'
      });
    });
  });

  describe('handleWebhookEvent', () => {
    it('rejects a delivery whose signature does not verify', async () => {
      const { service, billingRepository } = createService({
        verifySignature: () => false
      });

      await expect(
        service.handleWebhookEvent({
          rawBody: RAW_BODY,
          signature: 'forged'
        })
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'WEBHOOK_SIGNATURE_INVALID'
      });

      expect(billingRepository.recordWebhookEvent).not.toHaveBeenCalled();
    });

    it('upgrades the account to the tier matching the purchased variant', async () => {
      const { service, billingRepository } = createService({
        event: buildEvent({ status: 'active', variantId: 'var_pro' })
      });

      const result = await service.handleWebhookEvent({
        rawBody: RAW_BODY,
        signature: VALID_SIGNATURE
      });

      expect(result).toEqual({ duplicate: false, applied: true });
      expect(billingRepository.updateUserSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          tier: 'pro',
          status: 'active',
          subscriptionId: 'sub_1',
          provider: 'lemon_squeezy'
        })
      );
    });

    it('downgrades to free immediately when a subscription is cancelled', async () => {
      const { service, billingRepository } = createService({
        event: buildEvent({
          eventName: 'subscription_cancelled',
          status: 'cancelled',
          variantId: 'var_pro'
        })
      });

      await service.handleWebhookEvent({
        rawBody: RAW_BODY,
        signature: VALID_SIGNATURE
      });

      expect(billingRepository.updateUserSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ tier: 'free', status: 'cancelled' })
      );
    });

    it.each(['expired', 'paused', 'past_due', 'unpaid'])(
      'downgrades to free when the subscription status is %s',
      async (status) => {
        const { service, billingRepository } = createService({
          event: buildEvent({
            eventName: 'subscription_updated',
            status,
            variantId: 'var_pro'
          })
        });

        await service.handleWebhookEvent({
          rawBody: RAW_BODY,
          signature: VALID_SIGNATURE
        });

        expect(billingRepository.updateUserSubscription).toHaveBeenCalledWith(
          expect.objectContaining({ tier: 'free' })
        );
      }
    );

    it('downgrades to free when the variant is not recognised', async () => {
      const { service, billingRepository } = createService({
        event: buildEvent({ status: 'active', variantId: 'var_unknown' })
      });

      await service.handleWebhookEvent({
        rawBody: RAW_BODY,
        signature: VALID_SIGNATURE
      });

      expect(billingRepository.updateUserSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ tier: 'free' })
      );
    });

    it('ignores a duplicate delivery without touching the account', async () => {
      const { service, billingRepository } = createService({
        recordedEvent: null
      });

      const result = await service.handleWebhookEvent({
        rawBody: RAW_BODY,
        signature: VALID_SIGNATURE
      });

      expect(result).toEqual({ duplicate: true, applied: false });
      expect(billingRepository.updateUserSubscription).not.toHaveBeenCalled();
      expect(
        billingRepository.markWebhookEventProcessed
      ).not.toHaveBeenCalled();
    });

    it('records but does not apply an event with no linked user', async () => {
      const { service, billingRepository } = createService({
        event: buildEvent({ status: 'active', userId: undefined })
      });

      const result = await service.handleWebhookEvent({
        rawBody: RAW_BODY,
        signature: VALID_SIGNATURE
      });

      expect(result).toEqual({ duplicate: false, applied: false });
      expect(billingRepository.updateUserSubscription).not.toHaveBeenCalled();
      expect(billingRepository.markWebhookEventProcessed).toHaveBeenCalled();
    });

    it('records but does not apply a payment event carrying no subscription status', async () => {
      const { service, billingRepository } = createService({
        event: buildEvent({
          eventName: 'subscription_payment_success',
          status: undefined
        })
      });

      const result = await service.handleWebhookEvent({
        rawBody: RAW_BODY,
        signature: VALID_SIGNATURE
      });

      expect(result.applied).toBe(false);
      expect(billingRepository.updateUserSubscription).not.toHaveBeenCalled();
    });

    it('marks the stored event processed after applying it', async () => {
      const { service, billingRepository } = createService({
        event: buildEvent({ status: 'active', variantId: 'var_pro' })
      });

      await service.handleWebhookEvent({
        rawBody: RAW_BODY,
        signature: VALID_SIGNATURE
      });

      expect(billingRepository.markWebhookEventProcessed).toHaveBeenCalledWith({
        eventId: 'event-1',
        processedAt: '2026-07-09T00:00:00.000Z'
      });
    });
  });
});

function createService({
  event = buildEvent({ status: 'active', variantId: 'var_pro' }),
  recordedEvent = { id: 'event-1' },
  verifySignature = () => true
} = {}) {
  const billingRepository = {
    recordWebhookEvent: vi.fn(async () => recordedEvent),
    markWebhookEventProcessed: vi.fn(async () => undefined),
    updateUserSubscription: vi.fn(async () => ({ id: USER_ID }))
  };

  const tiersByVariantId = {
    var_basic: 'basic',
    var_pro: 'pro',
    var_enterprise: 'enterprise'
  };

  const billingProvider = {
    verifySignature: vi.fn(verifySignature),
    parseWebhookEvent: vi.fn(() => event),
    tierForVariantId: (variantId) => tiersByVariantId[variantId],
    createCheckout: vi.fn(async () => 'https://store.test/checkout/abc')
  };

  return {
    billingRepository,
    billingProvider,
    service: createBillingService({
      billingRepository,
      billingProvider,
      now: () => new Date('2026-07-09T00:00:00.000Z')
    })
  };
}

function buildEvent(overrides) {
  const {
    eventName = 'subscription_created',
    status,
    variantId = 'var_pro'
  } = overrides;

  return {
    eventKey: 'a'.repeat(64),
    eventName,
    // An unlinked delivery carries `undefined`, which a default parameter
    // would silently replace.
    userId: Object.hasOwn(overrides, 'userId') ? overrides.userId : USER_ID,
    payload: { meta: { event_name: eventName } },
    subscription: {
      id: 'sub_1',
      status,
      customerId: '9001',
      variantId,
      renewsAt: '2026-08-01T00:00:00.000Z',
      endsAt: null
    }
  };
}
