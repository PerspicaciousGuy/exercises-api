import { parseSupabaseScriptEnv } from '../config/supabaseEnv.js';
import { SupabaseRestClient } from '../supabase/restClient.js';

const SESSION_COLUMNS =
  'id,user_id,token_hash,user_agent,expires_at,revoked_at,last_seen_at,created_at';

export function createDefaultSessionRepository() {
  const env = parseSupabaseScriptEnv(process.env);
  const client = new SupabaseRestClient(env);

  return createSessionRepository({ client });
}

export function createLazyDefaultSessionRepository() {
  let repository;

  function getRepository() {
    repository ??= createDefaultSessionRepository();
    return repository;
  }

  return {
    createSession(input) {
      return getRepository().createSession(input);
    },
    findSessionByHash(tokenHash) {
      return getRepository().findSessionByHash(tokenHash);
    },
    revokeSession(input) {
      return getRepository().revokeSession(input);
    },
    revokeSessionsForUser(userId) {
      return getRepository().revokeSessionsForUser(userId);
    },
    markSessionSeen(input) {
      return getRepository().markSessionSeen(input);
    }
  };
}

export function createSessionRepository({ client }) {
  return {
    async createSession({ userId, tokenHash, userAgent, expiresAt }) {
      const rows = await client.insert(
        'api_sessions',
        [
          {
            user_id: userId,
            token_hash: tokenHash,
            user_agent: userAgent,
            expires_at: expiresAt
          }
        ],
        { select: SESSION_COLUMNS }
      );

      return mapSession(rows[0]);
    },

    async findSessionByHash(tokenHash) {
      const rows = await client.select('api_sessions', {
        columns: SESSION_COLUMNS,
        filters: {
          token_hash: `eq.${tokenHash}`,
          limit: '1'
        }
      });

      return rows[0] ? mapSession(rows[0]) : null;
    },

    async revokeSession({ tokenHash, revokedAt }) {
      const rows = await client.update(
        'api_sessions',
        { revoked_at: revokedAt },
        {
          filters: {
            token_hash: `eq.${tokenHash}`,
            revoked_at: 'is.null'
          },
          select: 'id'
        }
      );

      return rows[0] ?? null;
    },

    async revokeSessionsForUser({ userId, revokedAt }) {
      await client.update(
        'api_sessions',
        { revoked_at: revokedAt },
        {
          filters: {
            user_id: `eq.${userId}`,
            revoked_at: 'is.null'
          },
          select: 'id'
        }
      );
    },

    async markSessionSeen({ sessionId, seenAt }) {
      await client.update(
        'api_sessions',
        { last_seen_at: seenAt },
        {
          filters: { id: `eq.${sessionId}` },
          select: 'id'
        }
      );
    }
  };
}

function mapSession(row) {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    userAgent: row.user_agent,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at
  };
}
