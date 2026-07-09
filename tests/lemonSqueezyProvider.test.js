import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { createLemonSqueezyProvider } from '../src/billing/lemonSqueezyProvider.js';

const WEBHOOK_SECRET = 'whsec_test_secret';

describe('createLemonSqueezyProvider', () => {
  describe('verifySignature', () => {
    it('accepts a signature matching the HMAC of the raw body', () => {
      const provider = createProvider();
      const rawBody = Buffer.from('{"meta":{"event_name":"x"}}');

      expect(provider.verifySignature(rawBody, sign(rawBody))).toBe(true);
    });

    it('rejects a signature computed over a different body', () => {
      const provider = createProvider();
      const signature = sign(Buffer.from('{"tampered":true}'));

      expect(
        provider.verifySignature(Buffer.from('{"real":true}'), signature)
      ).toBe(false);
    });

    it('rejects a signature produced with a different secret', () => {
      const provider = createProvider();
      const rawBody = Buffer.from('{"real":true}');
      const signature = createHmac('sha256', 'wrong-secret')
        .update(rawBody)
        .digest('hex');

      expect(provider.verifySignature(rawBody, signature)).toBe(false);
    });

    it('rejects a missing signature', () => {
      const provider = createProvider();

      expect(provider.verifySignature(Buffer.from('{}'), undefined)).toBe(
        false
      );
    });

    it('rejects a signature of the wrong length without throwing', () => {
      const provider = createProvider();

      expect(provider.verifySignature(Buffer.from('{}'), 'abcd')).toBe(false);
    });
  });

  describe('parseWebhookEvent', () => {
    it('extracts the user id, subscription, and a body-derived event key', () => {
      const provider = createProvider();
      const rawBody = Buffer.from(
        JSON.stringify(
          buildSubscriptionPayload({ status: 'active', variantId: 'var_pro' })
        )
      );

      const event = provider.parseWebhookEvent(rawBody);

      expect(event.eventName).toBe('subscription_created');
      expect(event.userId).toBe('11111111-1111-4111-8111-111111111111');
      expect(event.subscription).toMatchObject({
        id: 'sub_1',
        status: 'active',
        variantId: 'var_pro',
        customerId: '9001'
      });
      expect(event.eventKey).toMatch(/^[0-9a-f]{64}$/);
    });

    it('derives the same event key for a byte-identical redelivery', () => {
      const provider = createProvider();
      const rawBody = Buffer.from(
        JSON.stringify(buildSubscriptionPayload({ status: 'active' }))
      );

      expect(provider.parseWebhookEvent(rawBody).eventKey).toBe(
        provider.parseWebhookEvent(Buffer.from(rawBody)).eventKey
      );
    });

    it('throws when the payload is not valid JSON', () => {
      const provider = createProvider();

      expect(() => provider.parseWebhookEvent(Buffer.from('not json'))).toThrow(
        'Webhook payload was not valid JSON'
      );
    });

    it('throws when the payload is missing required members', () => {
      const provider = createProvider();

      expect(() =>
        provider.parseWebhookEvent(Buffer.from('{"meta":{}}'))
      ).toThrow('Webhook payload did not match the expected shape');
    });
  });

  describe('createCheckout', () => {
    it('returns the checkout url and passes the user id as custom data', async () => {
      const fetchImpl = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: { attributes: { url: 'https://store.test/checkout/abc' } }
        })
      }));
      const provider = createProvider({ fetchImpl });

      const url = await provider.createCheckout({
        userId: 'user-1',
        email: 'alice@example.com',
        tier: 'pro'
      });

      expect(url).toBe('https://store.test/checkout/abc');

      const [requestUrl, options] = fetchImpl.mock.calls[0];
      expect(requestUrl).toBe('https://api.test/v1/checkouts');
      expect(options.headers.Authorization).toBe('Bearer ls_test_key');

      const body = JSON.parse(options.body);
      expect(body.data.attributes.checkout_data.custom).toEqual({
        user_id: 'user-1'
      });
      expect(body.data.relationships.variant.data.id).toBe('var_pro');
      expect(body.data.relationships.store.data.id).toBe('store_1');
    });

    it('throws a 502 when the provider rejects the request', async () => {
      const provider = createProvider({
        fetchImpl: vi.fn(async () => ({ ok: false, json: async () => ({}) }))
      });

      await expect(
        provider.createCheckout({ userId: 'u', email: 'a@b.co', tier: 'pro' })
      ).rejects.toMatchObject({
        statusCode: 502,
        code: 'BILLING_PROVIDER_ERROR'
      });
    });

    it('throws a 502 when the provider returns no checkout url', async () => {
      const provider = createProvider({
        fetchImpl: vi.fn(async () => ({ ok: true, json: async () => ({}) }))
      });

      await expect(
        provider.createCheckout({ userId: 'u', email: 'a@b.co', tier: 'pro' })
      ).rejects.toMatchObject({ statusCode: 502 });
    });

    it('throws a 502 when the provider is unreachable', async () => {
      const provider = createProvider({
        fetchImpl: vi.fn(async () => {
          throw new Error('ECONNREFUSED');
        })
      });

      await expect(
        provider.createCheckout({ userId: 'u', email: 'a@b.co', tier: 'pro' })
      ).rejects.toMatchObject({
        statusCode: 502,
        code: 'BILLING_PROVIDER_UNAVAILABLE'
      });
    });
  });

  describe('tierForVariantId', () => {
    it('maps a configured variant id to its tier', () => {
      expect(createProvider().tierForVariantId('var_enterprise')).toBe(
        'enterprise'
      );
    });

    it('returns undefined for an unknown variant id', () => {
      expect(createProvider().tierForVariantId('var_unknown')).toBeUndefined();
    });
  });
});

function createProvider({ fetchImpl } = {}) {
  return createLemonSqueezyProvider(
    {
      apiKey: 'ls_test_key',
      apiUrl: 'https://api.test/v1',
      storeId: 'store_1',
      webhookSecret: WEBHOOK_SECRET,
      variantIdsByTier: {
        basic: 'var_basic',
        pro: 'var_pro',
        enterprise: 'var_enterprise'
      },
      tiersByVariantId: {
        var_basic: 'basic',
        var_pro: 'pro',
        var_enterprise: 'enterprise'
      }
    },
    fetchImpl ? { fetchImpl } : {}
  );
}

function sign(rawBody) {
  return createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
}

function buildSubscriptionPayload({ status, variantId = 'var_pro' }) {
  return {
    meta: {
      event_name: 'subscription_created',
      custom_data: { user_id: '11111111-1111-4111-8111-111111111111' }
    },
    data: {
      id: 'sub_1',
      attributes: {
        status,
        variant_id: variantId,
        customer_id: 9001,
        renews_at: '2026-08-01T00:00:00.000Z',
        ends_at: null
      }
    }
  };
}
