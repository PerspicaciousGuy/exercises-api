import { describe, expect, it, vi } from 'vitest';

import { SupabaseRestClient } from '../src/supabase/restClient.js';

const BASE = { supabaseUrl: 'https://db.example.com', serviceRoleKey: 'srk' };

function jsonOk(body = []) {
  return { ok: true, status: 200, json: async () => body };
}

function httpError(status) {
  return {
    ok: false,
    status,
    json: async () => ({ message: 'upstream failed' })
  };
}

function createClient(fetchImpl, overrides = {}) {
  return new SupabaseRestClient({
    ...BASE,
    fetchImpl,
    sleep: vi.fn(async () => undefined),
    ...overrides
  });
}

describe('SupabaseRestClient retries', () => {
  it('retries a GET after a network error and succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonOk([{ id: 'a' }]));
    const client = createClient(fetchImpl);

    await expect(client.select('exercises')).resolves.toEqual([{ id: 'a' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries a GET on a 503 and succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(httpError(503))
      .mockResolvedValueOnce(jsonOk([]));
    const client = createClient(fetchImpl);

    await expect(client.select('exercises')).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('gives up after maxAttempts and throws the last error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const client = createClient(fetchImpl, { maxAttempts: 3 });

    await expect(client.select('exercises')).rejects.toThrow('fetch failed');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('never replays an insert after a network error', async () => {
    // The request may have reached Postgres and committed before the socket
    // died. Retrying would insert the row twice.
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const client = createClient(fetchImpl);

    await expect(
      client.insert('api_usage_log', [{ endpoint: '/x' }])
    ).rejects.toThrow('fetch failed');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('never replays an insert after a 500', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(httpError(500));
    const client = createClient(fetchImpl);

    await expect(
      client.insert('api_users', [{ email: 'a@b.c' }])
    ).rejects.toThrow('status 500');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries an insert on a 429, which is refused before any work happens', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(httpError(429))
      .mockResolvedValueOnce(jsonOk([{ id: 'a' }]));
    const client = createClient(fetchImpl);

    await expect(
      client.insert('api_users', [{ email: 'a@b.c' }])
    ).resolves.toEqual([{ id: 'a' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 400, which will fail identically forever', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(httpError(400));
    const client = createClient(fetchImpl);

    await expect(client.select('exercises')).rejects.toThrow('status 400');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 409 conflict', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(httpError(409));
    const client = createClient(fetchImpl);

    await expect(client.select('exercises')).rejects.toThrow('status 409');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('backs off between attempts with a bounded delay', async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonOk([]));
    const client = createClient(fetchImpl, { sleep });

    await client.select('exercises');

    expect(sleep).toHaveBeenCalledTimes(2);
    for (const [delayMs] of sleep.mock.calls) {
      expect(delayMs).toBeGreaterThanOrEqual(0);
      expect(delayMs).toBeLessThanOrEqual(1000);
    }
  });

  it('preserves the status on the thrown error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(httpError(404));
    const client = createClient(fetchImpl);

    await expect(client.select('exercises')).rejects.toMatchObject({
      status: 404
    });
  });
});
