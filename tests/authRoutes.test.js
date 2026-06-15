import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';

describe('auth routes', () => {
  it('registers a developer account and returns a one-time API key', async () => {
    const authService = {
      register: vi.fn(async () => ({
        user: createUser(),
        apiKey: {
          id: 'key-1',
          label: 'Default',
          key: 'exdb_test_key',
          expiresAt: null
        }
      }))
    };
    const app = createApp({ authService, apiKeyMiddleware: allowApiKey });

    const response = await request(app)
      .post('/auth/register')
      .send({
        email: 'dev@example.com',
        password: 'strong-password',
        name: 'Dev User'
      })
      .expect(201);

    expect(authService.register).toHaveBeenCalledWith({
      email: 'dev@example.com',
      password: 'strong-password',
      name: 'Dev User'
    });
    expect(response.body).toEqual({
      success: true,
      data: {
        user: createUser(),
        apiKey: {
          id: 'key-1',
          label: 'Default',
          key: 'exdb_test_key',
          expiresAt: null
        }
      }
    });
  });

  it('logs in a developer and returns a fresh one-time API key', async () => {
    const authService = {
      login: vi.fn(async () => ({
        user: createUser(),
        apiKey: {
          id: 'key-2',
          label: 'Login',
          key: 'exdb_login_key',
          expiresAt: null
        }
      }))
    };
    const app = createApp({ authService, apiKeyMiddleware: allowApiKey });

    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'dev@example.com',
        password: 'strong-password'
      })
      .expect(200);

    expect(authService.login).toHaveBeenCalledWith({
      email: 'dev@example.com',
      password: 'strong-password'
    });
    expect(response.body.data.apiKey.key).toBe('exdb_login_key');
  });

  it('returns the current developer account', async () => {
    const authService = {
      getCurrentUser: vi.fn(async () => createUser())
    };
    const app = createApp({
      authService,
      apiKeyMiddleware: attachApiConsumer
    });

    const response = await request(app)
      .get('/me')
      .set('x-api-key', 'exdb_test_key')
      .expect(200);

    expect(authService.getCurrentUser).toHaveBeenCalledWith('user-1');
    expect(response.body).toEqual({
      success: true,
      data: createUser()
    });
  });

  it('creates and lists developer API keys', async () => {
    const authService = {
      createApiKey: vi.fn(async () => ({
        id: 'key-3',
        label: 'Mobile app',
        key: 'exdb_new_key',
        expiresAt: null
      })),
      listApiKeys: vi.fn(async () => [
        {
          id: 'key-1',
          label: 'Default',
          isActive: true,
          lastUsedAt: null,
          expiresAt: null,
          createdAt: '2026-06-15T10:00:00.000Z'
        }
      ])
    };
    const app = createApp({
      authService,
      apiKeyMiddleware: attachApiConsumer
    });

    const createResponse = await request(app)
      .post('/me/keys')
      .set('x-api-key', 'exdb_test_key')
      .send({ label: 'Mobile app' })
      .expect(201);
    const listResponse = await request(app)
      .get('/me/keys')
      .set('x-api-key', 'exdb_test_key')
      .expect(200);

    expect(authService.createApiKey).toHaveBeenCalledWith({
      userId: 'user-1',
      label: 'Mobile app',
      expiresAt: undefined
    });
    expect(authService.listApiKeys).toHaveBeenCalledWith('user-1');
    expect(createResponse.body.data.key).toBe('exdb_new_key');
    expect(listResponse.body.data).toEqual([
      {
        id: 'key-1',
        label: 'Default',
        isActive: true,
        lastUsedAt: null,
        expiresAt: null,
        createdAt: '2026-06-15T10:00:00.000Z'
      }
    ]);
  });

  it('revokes keys and returns developer usage', async () => {
    const authService = {
      revokeApiKey: vi.fn(async () => ({ id: 'key-1', isActive: false })),
      getUsage: vi.fn(async () => [
        {
          date: '2026-06-15',
          requestCount: 12,
          limit: 1000,
          remaining: 988
        }
      ])
    };
    const app = createApp({
      authService,
      apiKeyMiddleware: attachApiConsumer
    });

    const revokeResponse = await request(app)
      .delete('/me/keys/key-1')
      .set('x-api-key', 'exdb_test_key')
      .expect(200);
    const usageResponse = await request(app)
      .get('/me/usage')
      .set('x-api-key', 'exdb_test_key')
      .expect(200);

    expect(authService.revokeApiKey).toHaveBeenCalledWith({
      userId: 'user-1',
      keyId: 'key-1'
    });
    expect(revokeResponse.body.data).toEqual({ id: 'key-1', isActive: false });
    expect(usageResponse.body.data).toEqual([
      {
        date: '2026-06-15',
        requestCount: 12,
        limit: 1000,
        remaining: 988
      }
    ]);
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

function attachApiConsumer(request, _response, next) {
  request.apiConsumer = {
    user: { id: 'user-1', tier: 'free' },
    apiKey: { id: 'key-1' }
  };
  next();
}

function allowApiKey(_request, _response, next) {
  next();
}
