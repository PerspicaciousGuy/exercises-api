import { createHash, randomBytes } from 'node:crypto';

const API_KEY_PREFIX = 'exdb_';
const API_KEY_BYTES = 32;
const API_KEY_HASH_ALGORITHM = 'sha256';

export function generateApiKey() {
  return `${API_KEY_PREFIX}${randomBytes(API_KEY_BYTES).toString('base64url')}`;
}

export function hashApiKey(apiKey) {
  return createHash(API_KEY_HASH_ALGORITHM).update(apiKey).digest('hex');
}

export function isApiKeyFormat(apiKey) {
  return typeof apiKey === 'string' && apiKey.startsWith(API_KEY_PREFIX);
}
