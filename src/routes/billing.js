import { Router } from 'express';
import { z } from 'zod';

import { PURCHASABLE_TIERS } from '../constants/billing.js';
import { AppError } from '../errors/AppError.js';

const createCheckoutSchema = z.object({
  tier: z.enum(PURCHASABLE_TIERS)
});

export function createBillingRouter({ billingService }) {
  const router = Router();

  router.post(
    '/billing/checkout',
    asyncHandler(async (request, response) => {
      const { tier } = parseBody(createCheckoutSchema, request.body);
      const checkout = await billingService.createCheckout({
        user: request.apiConsumer.user,
        tier
      });

      response.status(201).location(checkout.checkoutUrl).json({
        success: true,
        data: checkout
      });
    })
  );

  return router;
}

function parseBody(schema, body) {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `${issue.path.join('.')} ${formatValidationMessage(issue.message)}`
    });
  }

  return parsed.data;
}

function formatValidationMessage(value) {
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
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
