import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

import { parseBillingEnv } from '../config/billingEnv.js';
import {
  BILLING_PROVIDER_NAME,
  PROVIDER_REQUEST_TIMEOUT_MS
} from '../constants/billing.js';
import { AppError } from '../errors/AppError.js';

const SIGNATURE_ALGORITHM = 'sha256';
const SIGNATURE_ENCODING = 'hex';
const CHECKOUTS_PATH = '/checkouts';
const JSON_API_MEDIA_TYPE = 'application/vnd.api+json';

/**
 * Webhook bodies come from a third party and are never trusted. Only the
 * members this integration reads are declared; Lemon Squeezy sends many more.
 */
const webhookPayloadSchema = z.object({
  meta: z.object({
    event_name: z.string().min(1),
    custom_data: z.object({ user_id: z.string().uuid() }).optional()
  }),
  data: z.object({
    id: z.string().min(1),
    attributes: z.object({
      status: z.string().min(1).optional(),
      variant_id: z.union([z.string(), z.number()]).optional(),
      customer_id: z.union([z.string(), z.number()]).optional(),
      renews_at: z.string().nullish(),
      ends_at: z.string().nullish()
    })
  })
});

export function createLemonSqueezyProvider(config, { fetchImpl = fetch } = {}) {
  return {
    name: BILLING_PROVIDER_NAME,

    /**
     * Lemon Squeezy signs the raw request body with HMAC-SHA256 and sends the
     * hex digest in `X-Signature`. It sends no timestamp, so a time-window
     * replay check is impossible; duplicate delivery is handled by idempotency
     * on the body hash instead.
     */
    verifySignature(rawBody, signature) {
      if (typeof signature !== 'string' || signature.length === 0) {
        return false;
      }

      const expected = createHmac(SIGNATURE_ALGORITHM, config.webhookSecret)
        .update(rawBody)
        .digest(SIGNATURE_ENCODING);

      const expectedBuffer = Buffer.from(expected, SIGNATURE_ENCODING);
      const providedBuffer = Buffer.from(signature, SIGNATURE_ENCODING);

      if (expectedBuffer.length !== providedBuffer.length) {
        return false;
      }

      return timingSafeEqual(expectedBuffer, providedBuffer);
    },

    parseWebhookEvent(rawBody) {
      const payload = webhookPayloadSchema.safeParse(readJson(rawBody));

      if (!payload.success) {
        throw new AppError({
          statusCode: 400,
          code: 'WEBHOOK_PAYLOAD_INVALID',
          message: 'Webhook payload did not match the expected shape'
        });
      }

      const { meta, data } = payload.data;

      return {
        eventKey: hashBody(rawBody),
        eventName: meta.event_name,
        userId: meta.custom_data?.user_id,
        payload: payload.data,
        subscription: {
          id: data.id,
          status: data.attributes.status,
          customerId: toOptionalString(data.attributes.customer_id),
          variantId: toOptionalString(data.attributes.variant_id),
          renewsAt: data.attributes.renews_at ?? null,
          endsAt: data.attributes.ends_at ?? null
        }
      };
    },

    tierForVariantId(variantId) {
      return config.tiersByVariantId[variantId];
    },

    async createCheckout({ userId, email, tier }) {
      const response = await requestWithTimeout(fetchImpl, {
        url: `${config.apiUrl}${CHECKOUTS_PATH}`,
        apiKey: config.apiKey,
        body: buildCheckoutBody({
          userId,
          email,
          storeId: config.storeId,
          variantId: config.variantIdsByTier[tier]
        })
      });

      if (!response.ok) {
        throw new AppError({
          statusCode: 502,
          code: 'BILLING_PROVIDER_ERROR',
          message: 'Could not create a checkout with the billing provider'
        });
      }

      const body = await response.json();
      const checkoutUrl = body?.data?.attributes?.url;

      if (typeof checkoutUrl !== 'string') {
        throw new AppError({
          statusCode: 502,
          code: 'BILLING_PROVIDER_ERROR',
          message: 'Billing provider returned no checkout URL'
        });
      }

      return checkoutUrl;
    }
  };
}

export function createLazyDefaultBillingProvider() {
  let provider;

  function getProvider() {
    provider ??= createLemonSqueezyProvider(parseBillingEnv(process.env));
    return provider;
  }

  return {
    name: BILLING_PROVIDER_NAME,
    verifySignature: (rawBody, signature) =>
      getProvider().verifySignature(rawBody, signature),
    parseWebhookEvent: (rawBody) => getProvider().parseWebhookEvent(rawBody),
    tierForVariantId: (variantId) => getProvider().tierForVariantId(variantId),
    createCheckout: (input) => getProvider().createCheckout(input)
  };
}

async function requestWithTimeout(fetchImpl, { url, apiKey, body }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    PROVIDER_REQUEST_TIMEOUT_MS
  );

  try {
    return await fetchImpl(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Accept: JSON_API_MEDIA_TYPE,
        'Content-Type': JSON_API_MEDIA_TYPE,
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new AppError({
      statusCode: 502,
      code: 'BILLING_PROVIDER_UNAVAILABLE',
      message:
        error.name === 'AbortError'
          ? 'Billing provider request timed out'
          : 'Billing provider is unreachable'
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildCheckoutBody({ userId, email, storeId, variantId }) {
  return {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          email,
          custom: { user_id: userId }
        }
      },
      relationships: {
        store: { data: { type: 'stores', id: String(storeId) } },
        variant: { data: { type: 'variants', id: String(variantId) } }
      }
    }
  };
}

function hashBody(rawBody) {
  return createHash(SIGNATURE_ALGORITHM)
    .update(rawBody)
    .digest(SIGNATURE_ENCODING);
}

function readJson(rawBody) {
  try {
    return JSON.parse(Buffer.from(rawBody).toString('utf8'));
  } catch {
    throw new AppError({
      statusCode: 400,
      code: 'WEBHOOK_PAYLOAD_INVALID',
      message: 'Webhook payload was not valid JSON'
    });
  }
}

function toOptionalString(value) {
  return value === undefined || value === null ? undefined : String(value);
}
