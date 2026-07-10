import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import { readCookie } from '../src/security/sessions.js';

describe('readCookie', () => {
  it('reads a named cookie from a multi-cookie header', () => {
    expect(readCookie('a=1; exdb_session=abc; b=2', 'exdb_session')).toBe(
      'abc'
    );
  });

  it('does not match a cookie whose name is a suffix of another', () => {
    expect(readCookie('other_exdb_session=abc', 'exdb_session')).toBeNull();
  });

  it('url-decodes the value', () => {
    expect(readCookie('exdb_session=a%20b', 'exdb_session')).toBe('a b');
  });

  it('returns null when the header is absent', () => {
    expect(readCookie(undefined, 'exdb_session')).toBeNull();
  });
});

describe('session or API key authentication', () => {
  it('authenticates /me with a session cookie and no API key', async () => {
    const authService = { getCurrentUser: vi.fn(async () => createUser()) };
    const sessionService = {
      authenticateSession: vi.fn(async () => ({
        user: createUser(),
        session: { id: 'session-1' }
      }))
    };
    const app = createApp({ authService, sessionService });

    const response = await request(app)
      .get('/me')
      .set('cookie', 'exdb_session=token')
      .expect(200);

    expect(sessionService.authenticateSession).toHaveBeenCalledWith('token');
    expect(response.body.data.id).toBe('user-1');
  });

  it('does not attach an apiKey to a session consumer', async () => {
    let observed;
    const app = createApp({
      authService: {
        getCurrentUser: vi.fn(async function capture() {
          return createUser();
        })
      },
      sessionService: {
        authenticateSession: vi.fn(async () => ({
          user: createUser(),
          session: { id: 'session-1' }
        }))
      },
      apiKeyMiddleware: vi.fn((_request, _response, next) => {
        observed = 'api-key-path';
        next();
      })
    });

    await request(app)
      .get('/me')
      .set('cookie', 'exdb_session=token')
      .expect(200);

    // The API key middleware is what charges daily quota. A dashboard request
    // must never reach it.
    expect(observed).toBeUndefined();
  });

  it('falls back to the API key when no session cookie is present', async () => {
    const apiKeyMiddleware = vi.fn((request, _response, next) => {
      request.apiConsumer = { user: { id: 'user-1' }, apiKey: { id: 'key-1' } };
      next();
    });
    const app = createApp({
      authService: { getCurrentUser: vi.fn(async () => createUser()) },
      apiKeyMiddleware
    });

    await request(app).get('/me').set('x-api-key', 'exdb_key').expect(200);

    expect(apiKeyMiddleware).toHaveBeenCalled();
  });

  it('rejects /me with neither credential', async () => {
    const app = createApp({ authService: {} });

    const response = await request(app).get('/me').expect(401);

    expect(response.headers['content-type']).toContain(
      'application/problem+json'
    );
    expect(response.body.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('surfaces an expired session as a problem+json 401', async () => {
    const app = createApp({
      authService: {},
      sessionService: {
        authenticateSession: vi.fn(async () => {
          const error = new Error('Session has expired');
          error.statusCode = 401;
          error.code = 'SESSION_EXPIRED';
          error.isOperational = true;
          throw error;
        })
      }
    });

    const response = await request(app)
      .get('/me')
      .set('cookie', 'exdb_session=token')
      .expect(401);

    expect(response.body.code).toBe('SESSION_EXPIRED');
  });
});

function createUser() {
  return {
    id: 'user-1',
    email: 'dev@example.com',
    name: 'Dev User',
    tier: 'free',
    isAdmin: false,
    isActive: true,
    createdAt: '2026-06-15T10:00:00.000Z'
  };
}
