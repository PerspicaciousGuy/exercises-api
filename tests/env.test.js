import { describe, expect, it } from 'vitest';

import { parseEnv } from '../src/config/env.js';

describe('parseEnv', () => {
  it('returns defaults for optional server settings', () => {
    const env = parseEnv({});

    expect(env).toEqual({
      nodeEnv: 'development',
      port: 3000,
      serviceName: 'exercisedb-api',
      apiVersion: '0.1.0',
      dashboardOrigins: ['http://localhost:5173'],
      logLevel: 'info'
    });
  });

  it('rejects an unknown log level', () => {
    expect(() => parseEnv({ LOG_LEVEL: 'chatty' })).toThrow();
  });

  it('parses explicit server settings', () => {
    const env = parseEnv({
      NODE_ENV: 'test',
      PORT: '4000',
      SERVICE_NAME: 'exercise-service',
      API_VERSION: '1.2.3',
      DASHBOARD_ORIGINS: 'https://dash.example.com',
      LOG_LEVEL: 'debug'
    });

    expect(env).toEqual({
      nodeEnv: 'test',
      port: 4000,
      serviceName: 'exercise-service',
      apiVersion: '1.2.3',
      dashboardOrigins: ['https://dash.example.com'],
      logLevel: 'debug'
    });
  });

  it('splits and trims a comma separated origin allowlist', () => {
    const env = parseEnv({
      DASHBOARD_ORIGINS: 'https://a.example.com, https://b.example.com'
    });

    expect(env.dashboardOrigins).toEqual([
      'https://a.example.com',
      'https://b.example.com'
    ]);
  });
});
