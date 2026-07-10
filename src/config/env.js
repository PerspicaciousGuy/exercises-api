import { config } from 'dotenv';
import { z } from 'zod';

import { DEFAULT_LOG_LEVEL, LOG_LEVELS } from '../constants/logging.js';
import {
  API_VERSION,
  DEFAULT_DASHBOARD_ORIGINS,
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
  API_VERSION: z.string().min(1).default(API_VERSION),
  DASHBOARD_ORIGINS: z.string().min(1).default(DEFAULT_DASHBOARD_ORIGINS),
  LOG_LEVEL: z.enum(LOG_LEVELS).default(DEFAULT_LOG_LEVEL)
});

export function parseEnv(source) {
  const parsed = envSchema.parse(source);

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    serviceName: parsed.SERVICE_NAME,
    apiVersion: parsed.API_VERSION,
    dashboardOrigins: splitOrigins(parsed.DASHBOARD_ORIGINS),
    logLevel: parsed.LOG_LEVEL
  };
}

function splitOrigins(value) {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const env = parseEnv(process.env);
