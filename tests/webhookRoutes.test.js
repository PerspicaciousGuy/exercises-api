import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';

describe('POST /webhooks/lemon-squeezy', () => {
  it('accepts a verified delivery without an API key', async () => {
    const billingService = createBillingService();
    const app = createApp({ billingService, apiKeyMiddleware: rejectAllKeys });

    const response = await request(app)
      .post('/webhooks/lemon-squeezy')
      .set('content-type', 'application/json')
      .set('x-signature', 'a-valid-signature')
      .send('{"meta":{"event_name":"subscription_created"}}')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: { duplicate: false, applied: true }
    });
  });

  it('passes the unparsed raw body to the service for HMAC verification', async () => {
    const billingService = createBillingService();
    const app = createApp({ billingService, apiKeyMiddleware: rejectAllKeys });
    const body = '{"meta":{"event_name":"subscription_created"}}';

    await request(app)
      .post('/webhooks/lemon-squeezy')
      .set('content-type', 'application/json')
      .set('x-signature', 'a-valid-signature')
      .send(body)
      .expect(200);

    const [call] = billingService.handleWebhookEvent.mock.calls;
    expect(Buffer.isBuffer(call[0].rawBody)).toBe(true);
    expect(call[0].rawBody.toString('utf8')).toBe(body);
    expect(call[0].signature).toBe('a-valid-signature');
  });

  it('returns a problem+json 401 when the signature does not verify', async () => {
    const billingService = createBillingService({
      handleWebhookEvent: vi.fn(async () => {
        const error = new Error('Webhook signature could not be verified');
        error.statusCode = 401;
        error.code = 'WEBHOOK_SIGNATURE_INVALID';
        throw error;
      })
    });
    const app = createApp({ billingService, apiKeyMiddleware: rejectAllKeys });

    const response = await request(app)
      .post('/webhooks/lemon-squeezy')
      .set('content-type', 'application/json')
      .set('x-signature', 'forged')
      .send('{"meta":{"event_name":"subscription_created"}}')
      .expect(401);

    expect(response.headers['content-type']).toContain(
      'application/problem+json'
    );
    expect(response.body).toMatchObject({
      code: 'WEBHOOK_SIGNATURE_INVALID',
      status: 401
    });
  });

  it('acknowledges a duplicate delivery with 200', async () => {
    const billingService = createBillingService({
      handleWebhookEvent: vi.fn(async () => ({
        duplicate: true,
        applied: false
      }))
    });
    const app = createApp({ billingService, apiKeyMiddleware: rejectAllKeys });

    const response = await request(app)
      .post('/webhooks/lemon-squeezy')
      .set('content-type', 'application/json')
      .set('x-signature', 'a-valid-signature')
      .send('{"meta":{"event_name":"subscription_created"}}')
      .expect(200);

    expect(response.body.data).toEqual({ duplicate: true, applied: false });
  });
});

describe('POST /billing/checkout', () => {
  it('returns 201 with the checkout url and a Location header', async () => {
    const billingService = createBillingService();
    const app = createApp({
      billingService,
      apiKeyMiddleware: attachProConsumer
    });

    const response = await request(app)
      .post('/billing/checkout')
      .set('x-api-key', 'exdb_key')
      .send({ tier: 'pro' })
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      data: { tier: 'pro', checkoutUrl: 'https://store.test/checkout/abc' }
    });
    expect(response.headers.location).toBe('https://store.test/checkout/abc');
  });

  it('rejects an unknown tier with a validation error', async () => {
    const app = createApp({
      billingService: createBillingService(),
      apiKeyMiddleware: attachProConsumer
    });

    const response = await request(app)
      .post('/billing/checkout')
      .set('x-api-key', 'exdb_key')
      .send({ tier: 'platinum' })
      .expect(400);

    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('requires an API key', async () => {
    const app = createApp({
      billingService: createBillingService(),
      apiKeyMiddleware: rejectAllKeys
    });

    await request(app)
      .post('/billing/checkout')
      .send({ tier: 'pro' })
      .expect(401);
  });
});

function createBillingService(overrides = {}) {
  return {
    handleWebhookEvent: vi.fn(async () => ({
      duplicate: false,
      applied: true
    })),
    createCheckout: vi.fn(async ({ tier }) => ({
      tier,
      checkoutUrl: 'https://store.test/checkout/abc'
    })),
    ...overrides
  };
}

function attachProConsumer(request, _response, next) {
  request.apiConsumer = {
    user: { id: 'user-1', email: 'alice@example.com', tier: 'pro' },
    apiKey: { id: 'key-1' }
  };
  next();
}

function rejectAllKeys(_request, _response, next) {
  const error = new Error('API key is required');
  error.statusCode = 401;
  error.code = 'API_KEY_REQUIRED';
  next(error);
}
