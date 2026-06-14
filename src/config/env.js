import { config } from 'dotenv';
import { z } from 'zod';

import {
  API_VERSION,
  DEFAULT_PORT,
  SERVICE_NAME
} from '../constants/service.js';

config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  SERVICE_NAME: z.string().min(1).default(SERVICE_NAME),
  API_VERSION: z.string().min(1).default(API_VERSION)
});

export function parseEnv(source) {
  const parsed = envSchema.parse(source);

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    serviceName: parsed.SERVICE_NAME,
    apiVersion: parsed.API_VERSION
  };
}

export const env = parseEnv(process.env);
