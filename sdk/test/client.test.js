import { describe, expect, it, vi } from 'vitest';

import { ExerciseDBError, createClient } from '../index.js';

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

function mockFetch(impl) {
  return vi.fn(impl);
}

const API_KEY = 'exdb_test_key';

describe('createClient', () => {
  it('requires an apiKey', () => {
    expect(() => createClient({ fetch: mockFetch() })).toThrow(/apiKey/);
  });

  it('sends the api key header and unwraps the data envelope', async () => {
    const fetch = mockFetch(async () =>
      jsonResponse({ success: true, data: { id: 'e1', slug: 'push-up' } })
    );
    const client = createClient({ apiKey: API_KEY, fetch });

    const exercise = await client.exercises.getBySlug('push-up');

    expect(exercise).toEqual({ id: 'e1', slug: 'push-up' });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toContain('/exercises/slug/push-up');
    expect(init.headers['x-api-key']).toBe(API_KEY);
  });

  it('returns exercises and pagination from list', async () => {
    const fetch = mockFetch(async () =>
      jsonResponse({
        success: true,
        data: [{ id: 'e1', slug: 'push-up' }],
        pagination: { limit: 20, offset: 0 }
      })
    );
    const client = createClient({ apiKey: API_KEY, fetch });

    const page = await client.exercises.list({ muscle: 'chest' });

    expect(page.exercises).toHaveLength(1);
    expect(page.pagination).toEqual({ limit: 20, offset: 0 });
    // filter is mapped to the snake_case query param the API expects
    expect(fetch.mock.calls[0][0]).toContain('muscle=chest');
  });

  it('maps includeDeprecated to the include_deprecated query param', async () => {
    const fetch = mockFetch(async () =>
      jsonResponse({
        success: true,
        data: [],
        pagination: { limit: 20, offset: 0 }
      })
    );
    const client = createClient({ apiKey: API_KEY, fetch });

    await client.exercises.list({
      includeDeprecated: true,
      updatedSince: '2026-01-01T00:00:00Z'
    });

    const url = fetch.mock.calls[0][0];
    expect(url).toContain('include_deprecated=true');
    expect(url).toContain('updated_since=');
  });

  it('throws ExerciseDBError with problem details on non-2xx', async () => {
    const fetch = mockFetch(async () =>
      jsonResponse(
        {
          type: 'https://docs.example/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'Exercise was not found',
          code: 'EXERCISE_NOT_FOUND',
          requestId: 'req-123'
        },
        { ok: false, status: 404 }
      )
    );
    const client = createClient({ apiKey: API_KEY, fetch });

    await expect(client.exercises.get('ghost')).rejects.toMatchObject({
      name: 'ExerciseDBError',
      status: 404,
      code: 'EXERCISE_NOT_FOUND',
      requestId: 'req-123',
      message: 'Exercise was not found'
    });
  });

  it('pages transparently through listAll', async () => {
    let call = 0;
    const fetch = mockFetch(async () => {
      call += 1;
      // first page full (2 of limit 2), second page short -> stop
      const data = call === 1 ? [{ id: 'a' }, { id: 'b' }] : [{ id: 'c' }];
      return jsonResponse({
        success: true,
        data,
        pagination: { limit: 2, offset: 0 }
      });
    });
    const client = createClient({ apiKey: API_KEY, fetch });

    const ids = [];
    for await (const exercise of client.exercises.listAll({ limit: 2 })) {
      ids.push(exercise.id);
    }

    expect(ids).toEqual(['a', 'b', 'c']);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('omits the equipment param when no equipment is given to substitutes', async () => {
    const fetch = mockFetch(async () =>
      jsonResponse({ success: true, data: [] })
    );
    const client = createClient({ apiKey: API_KEY, fetch });

    await client.exercises.substitutes('e1');
    expect(fetch.mock.calls[0][0]).not.toContain('equipment=');

    await client.exercises.substitutes('e1', {
      equipment: ['dumbbell', 'bench']
    });
    expect(fetch.mock.calls[1][0]).toContain('equipment=dumbbell%2Cbench');
  });

  it('posts exerciseIds to coverage and returns the report', async () => {
    const fetch = mockFetch(async () =>
      jsonResponse({
        success: true,
        data: { exerciseCount: 2, unknownExerciseIds: [] }
      })
    );
    const client = createClient({ apiKey: API_KEY, fetch });

    const report = await client.analyze.coverage(['e1', 'e2']);

    expect(report.exerciseCount).toBe(2);
    const [, init] = fetch.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ exerciseIds: ['e1', 'e2'] });
  });

  it('exposes ExerciseDBError for instanceof checks', () => {
    const error = new ExerciseDBError({ status: 500, message: 'boom' });
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ExerciseDBError);
  });
});
