import {
  SESSION_TTL_SECONDS,
  USER_AGENT_MAX_LENGTH
} from '../constants/sessions.js';
import { AppError } from '../errors/AppError.js';
import {
  generateSessionToken,
  hashSessionToken
} from '../security/sessions.js';

export function createSessionService({
  sessionRepository,
  authRepository,
  now = () => new Date()
}) {
  return {
    async createSession({ userId, userAgent }) {
      const token = generateSessionToken();
      const expiresAt = new Date(
        now().getTime() + SESSION_TTL_SECONDS * 1000
      ).toISOString();

      await sessionRepository.createSession({
        userId,
        tokenHash: hashSessionToken(token),
        userAgent: truncateUserAgent(userAgent),
        expiresAt
      });

      return { token, expiresAt };
    },

    /**
     * Resolves a session cookie to its owner. Unlike API key authentication
     * this consumes no daily quota: the dashboard is not an API consumer, and
     * charging a developer for viewing their own usage page would be absurd.
     */
    async authenticateSession(token) {
      if (typeof token !== 'string' || token.length === 0) {
        throwInvalidSession();
      }

      const session = await sessionRepository.findSessionByHash(
        hashSessionToken(token)
      );

      if (!session || session.revokedAt) {
        throwInvalidSession();
      }

      if (new Date(session.expiresAt) <= now()) {
        throwExpiredSession();
      }

      const user = await authRepository.findUserById(session.userId);

      if (!user) {
        throwInvalidSession();
      }

      if (!user.isActive) {
        throw new AppError({
          statusCode: 403,
          code: 'ACCOUNT_INACTIVE',
          message: 'Developer account is inactive'
        });
      }

      await sessionRepository.markSessionSeen({
        sessionId: session.id,
        seenAt: now().toISOString()
      });

      return { user: serializeUser(user), session: { id: session.id } };
    },

    async revokeSession(token) {
      if (typeof token !== 'string' || token.length === 0) {
        return;
      }

      await sessionRepository.revokeSession({
        tokenHash: hashSessionToken(token),
        revokedAt: now().toISOString()
      });
    },

    async revokeAllSessions(userId) {
      await sessionRepository.revokeSessionsForUser({
        userId,
        revokedAt: now().toISOString()
      });
    }
  };
}

function truncateUserAgent(userAgent) {
  if (typeof userAgent !== 'string' || userAgent.length === 0) {
    return null;
  }

  return userAgent.slice(0, USER_AGENT_MAX_LENGTH);
}

function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    tier: user.tier,
    isAdmin: user.isAdmin,
    isActive: user.isActive,
    createdAt: user.createdAt
  };
}

function throwInvalidSession() {
  throw new AppError({
    statusCode: 401,
    code: 'SESSION_INVALID',
    message: 'Session is invalid'
  });
}

function throwExpiredSession() {
  throw new AppError({
    statusCode: 401,
    code: 'SESSION_EXPIRED',
    message: 'Session has expired'
  });
}
