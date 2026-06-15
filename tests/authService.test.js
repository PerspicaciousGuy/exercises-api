import { describe, expect, it, vi } from 'vitest';

import { createAuthService } from '../src/services/authService.js';

describe('createAuthService', () => {
  it('registers a user with a hashed password and hashed API key', async () => {
    const authRepository = createRepository();
    const service = createAuthService({ authRepository });

    const result = await service.register({
      email: 'DEV@EXAMPLE.COM',
      password: 'strong-password',
      name: 'Dev User'
    });

    expect(authRepository.createUser).toHaveBeenCalledWith({
      email: 'dev@example.com',
      name: 'Dev User',
      passwordHash: expect.not.stringContaining('strong-password')
    });
    expect(authRepository.createApiKey).toHaveBeenCalledWith({
      userId: 'user-1',
      keyHash: expect.any(String),
      label: 'Default',
      expiresAt: undefined
    });
    expect(result.user.email).toBe('dev@example.com');
    expect(result.apiKey.key).toMatch(/^exdb_/);
  });

  it('rejects invalid login credentials', async () => {
    const authRepository = createRepository({
      findUserByEmail: vi.fn(async () => null)
    });
    const service = createAuthService({ authRepository });

    await expect(
      service.login({
        email: 'missing@example.com',
        password: 'strong-password'
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS'
    });
  });

  it('authenticates API keys and increments usage within tier limits', async () => {
    const authRepository = createRepository({
      findApiKeyByHash: vi.fn(async () => ({
        id: 'key-1',
        userId: 'user-1',
        isActive: true,
        expiresAt: null,
        user: {
          id: 'user-1',
          email: 'dev@example.com',
          tier: 'free',
          isActive: true
        }
      })),
      getDailyUsage: vi.fn(async () => ({
        userId: 'user-1',
        usageDate: '2026-06-15',
        requestCount: 12
      }))
    });
    const service = createAuthService({
      authRepository,
      now: () => new Date('2026-06-15T08:00:00.000Z')
    });

    const result = await service.authenticateApiKey('exdb_valid_key');

    expect(authRepository.upsertDailyUsage).toHaveBeenCalledWith({
      userId: 'user-1',
      usageDate: '2026-06-15',
      requestCount: 13
    });
    expect(result.rateLimit).toEqual({
      limit: 1000,
      remaining: 987,
      resetAt: '2026-06-16T00:00:00.000Z'
    });
  });

  it('rejects revoked, expired, and exhausted API keys', async () => {
    const inactiveService = createAuthService({
      authRepository: createRepository({
        findApiKeyByHash: vi.fn(async () => ({
          id: 'key-1',
          userId: 'user-1',
          isActive: false,
          expiresAt: null,
          user: { id: 'user-1', isActive: true, tier: 'free' }
        }))
      })
    });
    const expiredService = createAuthService({
      authRepository: createRepository({
        findApiKeyByHash: vi.fn(async () => ({
          id: 'key-1',
          userId: 'user-1',
          isActive: true,
          expiresAt: '2026-06-14T00:00:00.000Z',
          user: { id: 'user-1', isActive: true, tier: 'free' }
        }))
      }),
      now: () => new Date('2026-06-15T00:00:00.000Z')
    });
    const exhaustedService = createAuthService({
      authRepository: createRepository({
        findApiKeyByHash: vi.fn(async () => ({
          id: 'key-1',
          userId: 'user-1',
          isActive: true,
          expiresAt: null,
          user: { id: 'user-1', isActive: true, tier: 'free' }
        })),
        getDailyUsage: vi.fn(async () => ({
          userId: 'user-1',
          usageDate: '2026-06-15',
          requestCount: 1000
        }))
      }),
      now: () => new Date('2026-06-15T00:00:00.000Z')
    });

    await expect(
      inactiveService.authenticateApiKey('exdb_key')
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'API_KEY_REVOKED'
    });
    await expect(
      expiredService.authenticateApiKey('exdb_key')
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'API_KEY_EXPIRED'
    });
    await expect(
      exhaustedService.authenticateApiKey('exdb_key')
    ).rejects.toMatchObject({
      statusCode: 429,
      code: 'RATE_LIMIT_EXCEEDED'
    });
  });
});

function createRepository(overrides = {}) {
  return {
    findUserByEmail: vi.fn(async () => null),
    createUser: vi.fn(async () => createUserRow()),
    createApiKey: vi.fn(async () => createKeyRow()),
    findApiKeyByHash: vi.fn(async () => null),
    getDailyUsage: vi.fn(async () => null),
    upsertDailyUsage: vi.fn(async () => {}),
    markApiKeyUsed: vi.fn(async () => {}),
    ...overrides
  };
}

function createUserRow() {
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

function createKeyRow() {
  return {
    id: 'key-1',
    label: 'Default',
    isActive: true,
    expiresAt: null,
    createdAt: '2026-06-15T10:00:00.000Z'
  };
}
