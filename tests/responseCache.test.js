import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { responseCache } from '../src/middleware/responseCache.js';

function buildApp() {
  const app = express();
  app.set('etag', false);
  app.use(express.json());
  app.use(responseCache());
  app.get('/thing', (_req, res) =>
    res.status(200).json({ success: true, data: { value: 1 } })
  );
  app.get('/boom', (_req, res) =>
    res.status(404).json({ success: false, error: 'nope' })
  );
  app.post('/thing', (_req, res) =>
    res.status(200).json({ success: true, data: { value: 1 } })
  );
  return app;
}

describe('responseCache', () => {
  it('sets a strong ETag and Cache-Control on a 200 GET', async () => {
    const response = await request(buildApp()).get('/thing').expect(200);

    expect(response.headers.etag).toMatch(/^"[a-f0-9]{64}"$/);
    expect(response.headers['cache-control']).toBe('private, must-revalidate');
  });

  it('returns the same ETag for identical bodies', async () => {
    const app = buildApp();
    const first = await request(app).get('/thing');
    const second = await request(app).get('/thing');

    expect(first.headers.etag).toBe(second.headers.etag);
  });

  it('returns 304 with no body when If-None-Match matches', async () => {
    const app = buildApp();
    const { headers } = await request(app).get('/thing');

    const conditional = await request(app)
      .get('/thing')
      .set('If-None-Match', headers.etag)
      .expect(304);

    expect(conditional.text).toBe('');
    // the validators are still present on the 304
    expect(conditional.headers.etag).toBe(headers.etag);
    expect(conditional.headers['cache-control']).toBe(
      'private, must-revalidate'
    );
  });

  it('returns 200 with the body when If-None-Match does not match', async () => {
    const response = await request(buildApp())
      .get('/thing')
      .set('If-None-Match', '"stale-etag"')
      .expect(200);

    expect(response.body).toEqual({ success: true, data: { value: 1 } });
  });

  it('honours the * wildcard in If-None-Match', async () => {
    await request(buildApp())
      .get('/thing')
      .set('If-None-Match', '*')
      .expect(304);
  });

  it('does not tag non-200 responses', async () => {
    const response = await request(buildApp()).get('/boom').expect(404);

    expect(response.headers.etag).toBeUndefined();
    expect(response.headers['cache-control']).toBeUndefined();
  });

  it('does not tag non-GET requests', async () => {
    const response = await request(buildApp()).post('/thing').expect(200);

    expect(response.headers.etag).toBeUndefined();
  });
});
