import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { buildProblemDetails } from '../src/errors/problemDetails.js';
import { createApiKeyMiddleware } from '../src/middleware/apiKeyAuth.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import {
  requestLogger,
  resolveRequestId
} from '../src/middleware/requestLogger.js';
import {
  getRequestId,
  runWithRequestContext
} from '../src/logging/requestContext.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createApp(handler) {
  const app = express();
  app.use(requestLogger);
  app.get('/probe', handler);
  app.use(errorHandler);
  return app;
}

describe('requestLogger', () => {
  it('generates a uuid request id and echoes it', async () => {
    const app = createApp((_request, response) => response.json({ ok: true }));

    const response = await request(app).get('/probe').expect(200);

    expect(response.headers['x-request-id']).toMatch(UUID_PATTERN);
  });

  it('honours a client supplied request id so traces span services', async () => {
    const app = createApp((_request, response) => response.json({ ok: true }));

    const response = await request(app)
      .get('/probe')
      .set('x-request-id', 'trace-abc.123')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('trace-abc.123');
  });

  it('caps an over-long id', async () => {
    const app = createApp((_request, response) => response.json({ ok: true }));

    const response = await request(app)
      .get('/probe')
      .set('x-request-id', 'a'.repeat(500))
      .expect(200);

    expect(response.headers['x-request-id']).toHaveLength(128);
  });

  it('puts the same id in the response header and the problem body', async () => {
    const app = createApp(() => {
      throw Object.assign(new Error('boom'), {
        statusCode: 400,
        code: 'VALIDATION_ERROR'
      });
    });

    const response = await request(app)
      .get('/probe')
      .set('x-request-id', 'trace-1')
      .expect(400);

    expect(response.headers['x-request-id']).toBe('trace-1');
    expect(response.body.requestId).toBe('trace-1');
  });

  it('still returns a request id on a 500, whose detail is generic', async () => {
    const app = createApp(() => {
      throw new Error('database exploded');
    });

    const response = await request(app).get('/probe').expect(500);

    expect(response.body.detail).toBe('An unexpected error occurred');
    expect(response.body.detail).not.toContain('database');
    expect(response.body.requestId).toMatch(UUID_PATTERN);
  });
});

describe('usage logging failures', () => {
  it('does not reject when logUsage fails after the response is sent', async () => {
    const rejections = [];
    const capture = (reason) => rejections.push(reason);
    process.on('unhandledRejection', capture);

    const authService = {
      authenticateApiKey: async () => ({
        user: { id: 'user-1', tier: 'free' },
        apiKey: { id: 'key-1' },
        rateLimit: { limit: 1000, remaining: 999, resetAt: 'x' }
      }),
      logUsage: async () => {
        throw new Error('supabase unreachable');
      }
    };

    const app = express();
    app.use(requestLogger);
    app.use(createApiKeyMiddleware({ authService }));
    app.get('/probe', (_request, response) => response.json({ ok: true }));

    await request(app).get('/probe').set('x-api-key', 'exdb_k').expect(200);
    await new Promise((resolve) => setTimeout(resolve, 20));

    process.off('unhandledRejection', capture);
    expect(rejections).toEqual([]);
  });
});

describe('resolveRequestId', () => {
  it('strips CRLF so a forwarded id cannot forge a log line or a header', () => {
    expect(resolveRequestId('abc\r\nInjected: evil')).toBe('abcInjectedevil');
  });

  it('keeps word characters, dots, and hyphens', () => {
    expect(resolveRequestId('trace-abc.123_x')).toBe('trace-abc.123_x');
  });

  it('generates a uuid when the id sanitises to nothing', () => {
    expect(resolveRequestId('!!!')).toMatch(UUID_PATTERN);
  });

  it('generates a uuid when no header is present', () => {
    expect(resolveRequestId(undefined)).toMatch(UUID_PATTERN);
  });

  it('caps the length', () => {
    expect(resolveRequestId('a'.repeat(500))).toHaveLength(128);
  });
});

describe('request context', () => {
  it('propagates the id across await boundaries', async () => {
    const seen = await runWithRequestContext(
      { requestId: 'ctx-1' },
      async () => {
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 1));
        return getRequestId();
      }
    );

    expect(seen).toBe('ctx-1');
  });

  it('returns null outside a request', () => {
    expect(getRequestId()).toBeNull();
  });

  it('omits requestId from a problem built outside a request', () => {
    const problem = buildProblemDetails({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'missing'
    });

    expect(problem.requestId).toBeUndefined();
    expect(problem.code).toBe('NOT_FOUND');
  });
});
