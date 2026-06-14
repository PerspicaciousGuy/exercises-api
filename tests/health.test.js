import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

describe('GET /health', () => {
  it('returns service status and metadata', async () => {
    const app = createApp();

    const response = await request(app).get('/health').expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        status: 'ok',
        service: 'exercisedb-api',
        version: '0.1.0',
        environment: 'test'
      }
    });
  });
});
