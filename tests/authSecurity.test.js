import { describe, expect, it } from 'vitest';

import {
  generateApiKey,
  hashApiKey,
  isApiKeyFormat
} from '../src/security/apiKeys.js';
import { hashPassword, verifyPassword } from '../src/security/passwords.js';

describe('auth security utilities', () => {
  it('hashes and verifies passwords without storing plaintext', async () => {
    const passwordHash = await hashPassword('strong-password');

    expect(passwordHash).not.toContain('strong-password');
    await expect(verifyPassword('strong-password', passwordHash)).resolves.toBe(
      true
    );
    await expect(verifyPassword('wrong-password', passwordHash)).resolves.toBe(
      false
    );
  });

  it('generates API keys and hashes them deterministically', () => {
    const apiKey = generateApiKey();

    expect(isApiKeyFormat(apiKey)).toBe(true);
    expect(hashApiKey(apiKey)).toBe(hashApiKey(apiKey));
    expect(hashApiKey(apiKey)).not.toContain(apiKey);
  });
});
