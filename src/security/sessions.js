import { createHash, randomBytes } from 'node:crypto';

import {
  SESSION_COOKIE_PATH,
  SESSION_COOKIE_SAME_SITE,
  SESSION_TTL_SECONDS
} from '../constants/sessions.js';

const SESSION_TOKEN_BYTES = 32;
const SESSION_TOKEN_HASH_ALGORITHM = 'sha256';
const PRODUCTION = 'production';
const MILLISECONDS_PER_SECOND = 1000;

export const SESSION_COOKIE_NAME = 'exdb_session';

/**
 * `Secure` is required in production and impossible on plain-HTTP localhost —
 * a Secure cookie is silently dropped there, which looks exactly like a broken
 * login. It is therefore tied to NODE_ENV rather than hardcoded.
 */
export function buildSessionCookieOptions({ nodeEnv }) {
  return {
    httpOnly: true,
    secure: nodeEnv === PRODUCTION,
    sameSite: SESSION_COOKIE_SAME_SITE,
    path: SESSION_COOKIE_PATH,
    maxAge: SESSION_TTL_SECONDS * MILLISECONDS_PER_SECOND
  };
}

export function generateSessionToken() {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

export function hashSessionToken(token) {
  return createHash(SESSION_TOKEN_HASH_ALGORITHM).update(token).digest('hex');
}

/**
 * Parses a raw `Cookie` header. Express 4 does not parse cookies without
 * `cookie-parser`; this reads one named cookie and nothing else, which is all
 * the session layer needs.
 */
export function readCookie(cookieHeader, name) {
  if (typeof cookieHeader !== 'string') {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const separatorIndex = part.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    if (part.slice(0, separatorIndex).trim() === name) {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }
  }

  return null;
}
