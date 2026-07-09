import express, { Router } from 'express';

import { WEBHOOK_MAX_BODY_SIZE } from '../constants/billing.js';

const SIGNATURE_HEADER = 'x-signature';

/**
 * Mounted before `express.json()` so the raw body survives for HMAC
 * verification, and before the API key middleware because the billing provider
 * authenticates with a signature rather than an API key.
 */
export function createWebhooksRouter({ billingService }) {
  const router = Router();

  router.post(
    '/webhooks/lemon-squeezy',
    express.raw({ type: 'application/json', limit: WEBHOOK_MAX_BODY_SIZE }),
    asyncHandler(async (request, response) => {
      const result = await billingService.handleWebhookEvent({
        rawBody: request.body,
        signature: request.get(SIGNATURE_HEADER)
      });

      response.status(200).json({
        success: true,
        data: result
      });
    })
  );

  return router;
}

function asyncHandler(handler) {
  return async (request, response, next) => {
    try {
      await handler(request, response, next);
    } catch (error) {
      next(error);
    }
  };
}
