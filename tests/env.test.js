import { describe, expect, it } from 'vitest';

import { parseEnv } from '../src/config/env.js';

describe('parseEnv', () => {
  it('returns defaults for optional server settings', () => {
    const env = parseEnv({});

    expect(env).toEqual({
      nodeEnv: 'development',
      port: 3000,
      serviceName: 'exercisedb-api',
      apiVersion: '0.1.0'
    });
  });

  it('parses explicit server settings', () => {
    const env = parseEnv({
      NODE_ENV: 'test',
      PORT: '4000',
      SERVICE_NAME: 'exercise-service',
      API_VERSION: '1.2.3'
    });

    expect(env).toEqual({
      nodeEnv: 'test',
      port: 4000,
      serviceName: 'exercise-service',
      apiVersion: '1.2.3'
    });
  });
});
