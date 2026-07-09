import { z } from 'zod';

const DEFAULT_LEMON_SQUEEZY_API_URL = 'https://api.lemonsqueezy.com/v1';

const billingEnvSchema = z.object({
  LEMON_SQUEEZY_API_KEY: z.string().min(1),
  LEMON_SQUEEZY_STORE_ID: z.string().min(1),
  LEMON_SQUEEZY_WEBHOOK_SECRET: z.string().min(1),
  LEMON_SQUEEZY_VARIANT_ID_BASIC: z.string().min(1),
  LEMON_SQUEEZY_VARIANT_ID_PRO: z.string().min(1),
  LEMON_SQUEEZY_VARIANT_ID_ENTERPRISE: z.string().min(1),
  LEMON_SQUEEZY_API_URL: z.string().url().default(DEFAULT_LEMON_SQUEEZY_API_URL)
});

/**
 * Billing configuration is parsed lazily rather than at startup so the API can
 * boot, serve the catalog, and run tests without Lemon Squeezy credentials.
 */
export function parseBillingEnv(source) {
  const parsed = billingEnvSchema.safeParse(source);

  if (!parsed.success) {
    throw new Error(
      `Lemon Squeezy billing environment is incomplete: ${parsed.error.message}`
    );
  }

  const variantIdsByTier = {
    basic: parsed.data.LEMON_SQUEEZY_VARIANT_ID_BASIC,
    pro: parsed.data.LEMON_SQUEEZY_VARIANT_ID_PRO,
    enterprise: parsed.data.LEMON_SQUEEZY_VARIANT_ID_ENTERPRISE
  };

  return {
    apiKey: parsed.data.LEMON_SQUEEZY_API_KEY,
    apiUrl: parsed.data.LEMON_SQUEEZY_API_URL,
    storeId: parsed.data.LEMON_SQUEEZY_STORE_ID,
    webhookSecret: parsed.data.LEMON_SQUEEZY_WEBHOOK_SECRET,
    variantIdsByTier,
    tiersByVariantId: invert(variantIdsByTier)
  };
}

function invert(record) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [value, key])
  );
}
