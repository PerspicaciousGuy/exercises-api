import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { createSessionService } from '../src/services/sessionService.js';

const NOW = new Date('2026-06-15T10:00:00.000Z');
const FUTURE = '2026-06-29T10:00:00.000Z';
const PAST = '2026-06-01T10:00:00.000Z';

describe('createSessionService', () => {
  it('stores only a hash of the session token', async () => {
    const sessionRepository = createSessionRepositoryStub();
    const service = createService({ sessionRepository });

    const { token } = await service.createSession({
      userId: 'user-1',
      userAgent: 'Mozilla/5.0'
    });

    const [input] = sessionRepository.createSession.mock.calls[0];
    expect(input.tokenHash).toBe(sha256(token));
    expect(input.tokenHash).not.toBe(token);
    expect(JSON.stringify(input)).not.toContain(token);
  });

  it('truncates an over-long user agent to the column width', async () => {
    const sessionRepository = createSessionRepositoryStub();
    const service = createService({ sessionRepository });

    await service.createSession({
      userId: 'user-1',
      userAgent: 'a'.repeat(400)
    });

    const [input] = sessionRepository.createSession.mock.calls[0];
    expect(input.userAgent).toHaveLength(255);
  });

  it('authenticates a live session and records that it was seen', async () => {
    const sessionRepository = createSessionRepositoryStub();
    const service = createService({ sessionRepository });

    const result = await service.authenticateSession('token');

    expect(result.user.id).toBe('user-1');
    expect(sessionRepository.markSessionSeen).toHaveBeenCalledWith({
      sessionId: 'session-1',
      seenAt: NOW.toISOString()
    });
  });

  it('rejects an expired session', async () => {
    const service = createService({
      sessionRepository: createSessionRepositoryStub({ expiresAt: PAST })
    });

    await expect(service.authenticateSession('token')).rejects.toMatchObject({
      statusCode: 401,
      code: 'SESSION_EXPIRED'
    });
  });

  it('rejects a revoked session', async () => {
    const service = createService({
      sessionRepository: createSessionRepositoryStub({ revokedAt: PAST })
    });

    await expect(service.authenticateSession('token')).rejects.toMatchObject({
      statusCode: 401,
      code: 'SESSION_INVALID'
    });
  });

  it('rejects an unknown token without revealing why', async () => {
    const sessionRepository = createSessionRepositoryStub();
    sessionRepository.findSessionByHash = vi.fn(async () => null);
    const service = createService({ sessionRepository });

    await expect(service.authenticateSession('token')).rejects.toMatchObject({
      statusCode: 401,
      code: 'SESSION_INVALID'
    });
  });

  it('rejects a session belonging to a deactivated account', async () => {
    const service = createService({
      sessionRepository: createSessionRepositoryStub(),
      authRepository: {
        findUserById: vi.fn(async () => ({ ...createUser(), isActive: false }))
      }
    });

    await expect(service.authenticateSession('token')).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCOUNT_INACTIVE'
    });
  });

  it('rejects a missing token before touching the database', async () => {
    const sessionRepository = createSessionRepositoryStub();
    const service = createService({ sessionRepository });

    await expect(service.authenticateSession(undefined)).rejects.toMatchObject({
      code: 'SESSION_INVALID'
    });
    expect(sessionRepository.findSessionByHash).not.toHaveBeenCalled();
  });

  it('revokes a session by token hash', async () => {
    const sessionRepository = createSessionRepositoryStub();
    const service = createService({ sessionRepository });

    await service.revokeSession('token');

    expect(sessionRepository.revokeSession).toHaveBeenCalledWith({
      tokenHash: sha256('token'),
      revokedAt: NOW.toISOString()
    });
  });

  it('ignores a logout with no session cookie', async () => {
    const sessionRepository = createSessionRepositoryStub();
    const service = createService({ sessionRepository });

    await expect(service.revokeSession(null)).resolves.toBeUndefined();
    expect(sessionRepository.revokeSession).not.toHaveBeenCalled();
  });
});

function createService({ sessionRepository, authRepository }) {
  return createSessionService({
    sessionRepository,
    authRepository: authRepository ?? {
      findUserById: vi.fn(async () => createUser())
    },
    now: () => NOW
  });
}

function createSessionRepositoryStub(overrides = {}) {
  return {
    createSession: vi.fn(async () => ({ id: 'session-1' })),
    findSessionByHash: vi.fn(async () => ({
      id: 'session-1',
      userId: 'user-1',
      expiresAt: FUTURE,
      revokedAt: null,
      ...overrides
    })),
    revokeSession: vi.fn(async () => ({ id: 'session-1' })),
    revokeSessionsForUser: vi.fn(async () => undefined),
    markSessionSeen: vi.fn(async () => undefined)
  };
}

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

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
