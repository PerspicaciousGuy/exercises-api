import pino from 'pino';

import { env } from '../config/env.js';
import { getRequestId } from './requestContext.js';

const DEVELOPMENT = 'development';
const TEST = 'test';
const SILENT = 'silent';

/**
 * Paths scrubbed from every log line. Credentials must never reach a log,
 * including in debug mode: logs are shipped, indexed, and read by people who
 * are not entitled to the secret.
 */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["x-signature"]',
  'password',
  'apiKey',
  'key',
  'token',
  'tokenHash',
  '*.password',
  '*.apiKey',
  '*.key',
  '*.token'
];

function resolveLevel() {
  // Tests assert on behaviour, not on stdout. A running suite that prints a
  // hundred JSON lines hides the failures.
  return env.nodeEnv === TEST ? SILENT : env.logLevel;
}

function resolveTransport() {
  if (env.nodeEnv !== DEVELOPMENT) {
    return undefined;
  }

  return {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss.l',
      ignore: 'pid,hostname'
    }
  };
}

export const logger = pino({
  level: resolveLevel(),
  redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
  base: { service: env.serviceName },
  // Every line inside a request carries its id without the caller passing it.
  mixin() {
    const requestId = getRequestId();

    return requestId ? { requestId } : {};
  },
  transport: resolveTransport()
});
