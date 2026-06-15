import { describe, expect, it, vi } from 'vitest';

import { createAuthRepository } from '../src/repositories/authRepository.js';

describe('createAuthRepository', () => {
  it('creates and maps API users', async () => {
    const client = {
      insert: vi.fn(async () => [createUserRow()])
    };
    const repository = createAuthRepository({ client });

    const user = await repository.createUser({
      email: 'dev@example.com',
      name: 'Dev User',
      passwordHash: 'password-hash'
    });

    expect(client.insert).toHaveBeenCalledWith(
      'api_users',
      [
        {
          email: 'dev@example.com',
          name: 'Dev User',
          password_hash: 'password-hash'
        }
      ],
      { select: expect.stringContaining('password_hash') }
    );
    expect(user).toMatchObject({
      id: 'user-1',
      email: 'dev@example.com',
      passwordHash: 'password-hash'
    });
  });

  it('finds API keys with their owner user', async () => {
    const client = {
      select: vi.fn(async (table) => {
        if (table === 'api_keys') {
          return [
            {
              id: 'key-1',
              user_id: 'user-1',
              key_hash: 'hash',
              label: 'Default',
              is_active: true,
              last_used_at: null,
              expires_at: null,
              created_at: '2026-06-15T10:00:00.000Z'
            }
          ];
        }

        return [createUserRow()];
      })
    };
    const repository = createAuthRepository({ client });

    const apiKey = await repository.findApiKeyByHash('hash');

    expect(client.select).toHaveBeenCalledWith('api_keys', {
      columns:
        'id,user_id,key_hash,label,is_active,last_used_at,expires_at,created_at',
      filters: {
        key_hash: 'eq.hash',
        limit: '1'
      }
    });
    expect(apiKey).toMatchObject({
      id: 'key-1',
      userId: 'user-1',
      user: {
        id: 'user-1',
        email: 'dev@example.com'
      }
    });
  });

  it('updates usage rows and logs requests', async () => {
    const client = {
      upsert: vi.fn(async () => []),
      insert: vi.fn(async () => [])
    };
    const repository = createAuthRepository({ client });

    await repository.upsertDailyUsage({
      userId: 'user-1',
      usageDate: '2026-06-15',
      requestCount: 2
    });
    await repository.logUsage({
      userId: 'user-1',
      apiKeyId: 'key-1',
      endpoint: '/exercises',
      method: 'GET',
      statusCode: 200,
      responseTimeMs: 12
    });

    expect(client.upsert).toHaveBeenCalledWith(
      'api_usage_daily',
      [
        {
          user_id: 'user-1',
          usage_date: '2026-06-15',
          request_count: 2
        }
      ],
      {
        onConflict: 'user_id,usage_date',
        select: '*'
      }
    );
    expect(client.insert).toHaveBeenCalledWith('api_usage_log', [
      {
        user_id: 'user-1',
        api_key_id: 'key-1',
        endpoint: '/exercises',
        method: 'GET',
        status_code: 200,
        response_time_ms: 12
      }
    ]);
  });
});

function createUserRow() {
  return {
    id: 'user-1',
    email: 'dev@example.com',
    name: 'Dev User',
    password_hash: 'password-hash',
    tier: 'free',
    is_admin: false,
    is_active: true,
    created_at: '2026-06-15T10:00:00.000Z'
  };
}
