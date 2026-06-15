import {
  DAILY_REQUEST_LIMITS_BY_TIER,
  PREMIUM_ACCESS_TIERS
} from '../constants/rateLimits.js';
import { AppError } from '../errors/AppError.js';
import {
  generateApiKey,
  hashApiKey,
  isApiKeyFormat
} from '../security/apiKeys.js';
import { hashPassword, verifyPassword } from '../security/passwords.js';

const DEFAULT_KEY_LABEL = 'Default';
const LOGIN_KEY_LABEL = 'Login';

export function createAuthService({ authRepository, now = () => new Date() }) {
  return {
    async register({ email, password, name }) {
      const normalizedEmail = normalizeEmail(email);
      const existingUser =
        await authRepository.findUserByEmail(normalizedEmail);

      if (existingUser) {
        throw new AppError({
          statusCode: 409,
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'Email is already registered'
        });
      }

      const user = await authRepository.createUser({
        email: normalizedEmail,
        name,
        passwordHash: await hashPassword(password)
      });

      return {
        user: serializeUser(user),
        apiKey: await createPlaintextApiKey({
          authRepository,
          userId: user.id,
          label: DEFAULT_KEY_LABEL
        })
      };
    },

    async login({ email, password }) {
      const user = await authRepository.findUserByEmail(normalizeEmail(email));

      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        throwInvalidCredentials();
      }

      if (!user.isActive) {
        throw new AppError({
          statusCode: 403,
          code: 'ACCOUNT_INACTIVE',
          message: 'Developer account is inactive'
        });
      }

      return {
        user: serializeUser(user),
        apiKey: await createPlaintextApiKey({
          authRepository,
          userId: user.id,
          label: LOGIN_KEY_LABEL
        })
      };
    },

    async authenticateApiKey(apiKey) {
      if (!isApiKeyFormat(apiKey)) {
        throwInvalidApiKey();
      }

      const matchedKey = await authRepository.findApiKeyByHash(
        hashApiKey(apiKey)
      );

      if (!matchedKey) {
        throwInvalidApiKey();
      }

      validateMatchedApiKey(matchedKey, now());

      const usageDate = toUsageDate(now());
      const currentUsage = await authRepository.getDailyUsage({
        userId: matchedKey.user.id,
        usageDate
      });
      const limit = getDailyLimit(matchedKey.user.tier);
      const nextRequestCount = (currentUsage?.requestCount ?? 0) + 1;

      if (nextRequestCount > limit) {
        throw new AppError({
          statusCode: 429,
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Daily request limit exceeded'
        });
      }

      await authRepository.upsertDailyUsage({
        userId: matchedKey.user.id,
        usageDate,
        requestCount: nextRequestCount
      });
      await authRepository.markApiKeyUsed({
        keyId: matchedKey.id,
        usedAt: now().toISOString()
      });

      return {
        user: serializeUser(matchedKey.user),
        apiKey: serializeApiKey(matchedKey),
        rateLimit: {
          limit,
          remaining: limit - nextRequestCount,
          resetAt: getNextUsageReset(now()).toISOString()
        }
      };
    },

    async getCurrentUser(userId) {
      const user = await authRepository.findUserById(userId);

      if (!user) {
        throw new AppError({
          statusCode: 404,
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Developer account was not found'
        });
      }

      return serializeUser(user);
    },

    async createApiKey({ userId, label, expiresAt }) {
      return createPlaintextApiKey({
        authRepository,
        userId,
        label,
        expiresAt
      });
    },

    async listApiKeys(userId) {
      return (await authRepository.listApiKeys(userId)).map(serializeApiKey);
    },

    async revokeApiKey({ userId, keyId }) {
      const apiKey = await authRepository.revokeApiKey({ userId, keyId });

      if (!apiKey) {
        throw new AppError({
          statusCode: 404,
          code: 'API_KEY_NOT_FOUND',
          message: 'API key was not found'
        });
      }

      return { id: apiKey.id, isActive: apiKey.isActive };
    },

    async getUsage(userId) {
      const user = await authRepository.findUserById(userId);
      const limit = getDailyLimit(user?.tier ?? 'free');

      return (await authRepository.listUsage(userId)).map((usage) => ({
        date: usage.usageDate,
        requestCount: usage.requestCount,
        limit,
        remaining: Math.max(limit - usage.requestCount, 0)
      }));
    },

    async logUsage(input) {
      await authRepository.logUsage(input);
    },

    canAccessPremium(user) {
      return PREMIUM_ACCESS_TIERS.has(user.tier);
    }
  };
}

async function createPlaintextApiKey({
  authRepository,
  userId,
  label,
  expiresAt
}) {
  const key = generateApiKey();
  const apiKey = await authRepository.createApiKey({
    userId,
    keyHash: hashApiKey(key),
    label,
    expiresAt
  });

  return {
    ...serializeApiKey(apiKey),
    key
  };
}

function validateMatchedApiKey(apiKey, currentTime) {
  if (!apiKey.isActive) {
    throw new AppError({
      statusCode: 401,
      code: 'API_KEY_REVOKED',
      message: 'API key is inactive'
    });
  }

  if (apiKey.expiresAt && new Date(apiKey.expiresAt) <= currentTime) {
    throw new AppError({
      statusCode: 401,
      code: 'API_KEY_EXPIRED',
      message: 'API key has expired'
    });
  }

  if (!apiKey.user?.isActive) {
    throw new AppError({
      statusCode: 403,
      code: 'ACCOUNT_INACTIVE',
      message: 'Developer account is inactive'
    });
  }
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

function serializeApiKey(apiKey) {
  return {
    id: apiKey.id,
    label: apiKey.label,
    isActive: apiKey.isActive,
    lastUsedAt: apiKey.lastUsedAt,
    expiresAt: apiKey.expiresAt,
    createdAt: apiKey.createdAt
  };
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function throwInvalidCredentials() {
  throw new AppError({
    statusCode: 401,
    code: 'INVALID_CREDENTIALS',
    message: 'Email or password is invalid'
  });
}

function throwInvalidApiKey() {
  throw new AppError({
    statusCode: 401,
    code: 'API_KEY_INVALID',
    message: 'API key is invalid'
  });
}

function getDailyLimit(tier) {
  return (
    DAILY_REQUEST_LIMITS_BY_TIER[tier] ?? DAILY_REQUEST_LIMITS_BY_TIER.free
  );
}

function toUsageDate(date) {
  return date.toISOString().slice(0, 10);
}

function getNextUsageReset(date) {
  const resetAt = new Date(date);
  resetAt.setUTCHours(24, 0, 0, 0);
  return resetAt;
}
