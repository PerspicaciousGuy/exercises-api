import { parseSupabaseScriptEnv } from '../config/supabaseEnv.js';
import { SupabaseRestClient } from '../supabase/restClient.js';

const USER_COLUMNS =
  'id,email,name,password_hash,tier,is_admin,is_active,created_at';
const KEY_COLUMNS =
  'id,user_id,key_hash,label,is_active,last_used_at,expires_at,created_at';
const USAGE_COLUMNS = 'user_id,usage_date,request_count,created_at,updated_at';

export function createDefaultAuthRepository() {
  const env = parseSupabaseScriptEnv(process.env);
  const client = new SupabaseRestClient(env);

  return createAuthRepository({ client });
}

export function createLazyDefaultAuthRepository() {
  let repository;

  function getRepository() {
    repository ??= createDefaultAuthRepository();
    return repository;
  }

  return {
    createUser(input) {
      return getRepository().createUser(input);
    },
    findUserByEmail(email) {
      return getRepository().findUserByEmail(email);
    },
    findUserById(id) {
      return getRepository().findUserById(id);
    },
    createApiKey(input) {
      return getRepository().createApiKey(input);
    },
    listApiKeys(userId) {
      return getRepository().listApiKeys(userId);
    },
    findApiKeyByHash(keyHash) {
      return getRepository().findApiKeyByHash(keyHash);
    },
    revokeApiKey(input) {
      return getRepository().revokeApiKey(input);
    },
    markApiKeyUsed(input) {
      return getRepository().markApiKeyUsed(input);
    },
    getDailyUsage(input) {
      return getRepository().getDailyUsage(input);
    },
    listUsage(userId) {
      return getRepository().listUsage(userId);
    },
    upsertDailyUsage(input) {
      return getRepository().upsertDailyUsage(input);
    },
    logUsage(input) {
      return getRepository().logUsage(input);
    }
  };
}

export function createAuthRepository({ client }) {
  return {
    async createUser({ email, name, passwordHash }) {
      const rows = await client.insert(
        'api_users',
        [
          {
            email,
            name,
            password_hash: passwordHash
          }
        ],
        { select: USER_COLUMNS }
      );

      return mapUser(rows[0]);
    },

    async findUserByEmail(email) {
      const rows = await client.select('api_users', {
        columns: USER_COLUMNS,
        filters: {
          email: `eq.${email}`,
          limit: '1'
        }
      });

      return rows[0] ? mapUser(rows[0]) : null;
    },

    async findUserById(id) {
      const rows = await client.select('api_users', {
        columns: USER_COLUMNS,
        filters: {
          id: `eq.${id}`,
          limit: '1'
        }
      });

      return rows[0] ? mapUser(rows[0]) : null;
    },

    async createApiKey({ userId, keyHash, label, expiresAt }) {
      const rows = await client.insert(
        'api_keys',
        [
          {
            user_id: userId,
            key_hash: keyHash,
            label,
            expires_at: expiresAt
          }
        ],
        { select: KEY_COLUMNS }
      );

      return mapApiKey(rows[0]);
    },

    async listApiKeys(userId) {
      const rows = await client.select('api_keys', {
        columns: KEY_COLUMNS,
        filters: {
          user_id: `eq.${userId}`,
          order: 'created_at.desc'
        }
      });

      return rows.map(mapApiKey);
    },

    async findApiKeyByHash(keyHash) {
      const rows = await client.select('api_keys', {
        columns: KEY_COLUMNS,
        filters: {
          key_hash: `eq.${keyHash}`,
          limit: '1'
        }
      });

      if (!rows[0]) {
        return null;
      }

      return {
        ...mapApiKey(rows[0]),
        user: await this.findUserById(rows[0].user_id)
      };
    },

    async revokeApiKey({ userId, keyId }) {
      const rows = await client.update(
        'api_keys',
        { is_active: false },
        {
          filters: {
            id: `eq.${keyId}`,
            user_id: `eq.${userId}`
          },
          select: KEY_COLUMNS
        }
      );

      return rows[0] ? mapApiKey(rows[0]) : null;
    },

    async markApiKeyUsed({ keyId, usedAt }) {
      await client.update(
        'api_keys',
        { last_used_at: usedAt },
        {
          filters: { id: `eq.${keyId}` },
          select: 'id'
        }
      );
    },

    async getDailyUsage({ userId, usageDate }) {
      const rows = await client.select('api_usage_daily', {
        columns: USAGE_COLUMNS,
        filters: {
          user_id: `eq.${userId}`,
          usage_date: `eq.${usageDate}`,
          limit: '1'
        }
      });

      return rows[0] ? mapUsage(rows[0]) : null;
    },

    async listUsage(userId) {
      const rows = await client.select('api_usage_daily', {
        columns: USAGE_COLUMNS,
        filters: {
          user_id: `eq.${userId}`,
          order: 'usage_date.desc',
          limit: '30'
        }
      });

      return rows.map(mapUsage);
    },

    async upsertDailyUsage({ userId, usageDate, requestCount }) {
      await client.upsert(
        'api_usage_daily',
        [
          {
            user_id: userId,
            usage_date: usageDate,
            request_count: requestCount
          }
        ],
        {
          onConflict: 'user_id,usage_date',
          select: '*'
        }
      );
    },

    async logUsage(input) {
      await client.insert('api_usage_log', [
        {
          user_id: input.userId,
          api_key_id: input.apiKeyId,
          endpoint: input.endpoint,
          method: input.method,
          status_code: input.statusCode,
          response_time_ms: input.responseTimeMs
        }
      ]);
    }
  };
}

function mapUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    tier: row.tier,
    isAdmin: row.is_admin,
    isActive: row.is_active,
    createdAt: row.created_at
  };
}

function mapApiKey(row) {
  return {
    id: row.id,
    userId: row.user_id,
    keyHash: row.key_hash,
    label: row.label,
    isActive: row.is_active,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at
  };
}

function mapUsage(row) {
  return {
    userId: row.user_id,
    usageDate: row.usage_date,
    requestCount: row.request_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
