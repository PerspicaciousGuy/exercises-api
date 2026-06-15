import { describe, expect, it, vi } from 'vitest';

import { SupabaseRestClient } from '../src/supabase/restClient.js';

describe('SupabaseRestClient', () => {
  it('sends service-role upserts through the REST API', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([{ id: 1, slug: 'chest' }])
    );
    const client = new SupabaseRestClient({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role-key',
      fetchImpl
    });

    const rows = await client.upsert('muscles', [{ slug: 'chest' }], {
      onConflict: 'slug'
    });

    expect(rows).toEqual([{ id: 1, slug: 'chest' }]);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/muscles?on_conflict=slug&select=*',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'service-role-key',
          Authorization: 'Bearer service-role-key',
          Prefer: 'resolution=merge-duplicates,return=representation'
        }),
        body: JSON.stringify([{ slug: 'chest' }])
      })
    );
  });

  it('throws useful errors for failed REST requests', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ message: 'bad request' }, { ok: false, status: 400 })
    );
    const client = new SupabaseRestClient({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role-key',
      fetchImpl
    });

    await expect(
      client.upsert('muscles', [{ slug: 'bad' }], { onConflict: 'slug' })
    ).rejects.toThrow(
      'Supabase REST request failed with status 400: bad request'
    );
  });

  it('sends patch updates through the REST API', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([{ id: 'key-1' }]));
    const client = new SupabaseRestClient({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role-key',
      fetchImpl
    });

    const rows = await client.update(
      'api_keys',
      { is_active: false },
      {
        filters: { id: 'eq.key-1' },
        select: 'id'
      }
    );

    expect(rows).toEqual([{ id: 'key-1' }]);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/api_keys?id=eq.key-1&select=id',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          Prefer: 'return=representation'
        }),
        body: JSON.stringify({ is_active: false })
      })
    );
  });
});

function jsonResponse(body, overrides = {}) {
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    }
  };
}
