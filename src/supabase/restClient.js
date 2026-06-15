export class SupabaseRestClient {
  constructor({ supabaseUrl, serviceRoleKey, fetchImpl = fetch }) {
    this.supabaseUrl = supabaseUrl.replace(/\/$/, '');
    this.serviceRoleKey = serviceRoleKey;
    this.fetchImpl = fetchImpl;
  }

  async select(table, { columns = '*', filters = {} } = {}) {
    const url = this.buildTableUrl(table, {
      select: columns,
      ...filters
    });

    return this.request(url, { method: 'GET' });
  }

  async upsert(table, rows, { onConflict, select = '*' } = {}) {
    if (rows.length === 0) {
      return [];
    }

    const url = this.buildTableUrl(table, {
      on_conflict: onConflict,
      select
    });

    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(rows),
      prefer: 'resolution=merge-duplicates,return=representation'
    });
  }

  async insert(table, rows, { select = '*' } = {}) {
    if (rows.length === 0) {
      return [];
    }

    const url = this.buildTableUrl(table, { select });

    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(rows),
      prefer: 'return=representation'
    });
  }

  async update(table, values, { filters = {}, select = '*' } = {}) {
    const url = this.buildTableUrl(table, {
      ...filters,
      select
    });

    return this.request(url, {
      method: 'PATCH',
      body: JSON.stringify(values),
      prefer: 'return=representation'
    });
  }

  async request(url, { method, body, prefer }) {
    const response = await this.fetchImpl(url, {
      method,
      headers: this.buildHeaders(prefer),
      body
    });

    if (!response.ok) {
      throw new Error(await buildRequestError(response));
    }

    return response.json();
  }

  buildHeaders(prefer) {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {})
    };
  }

  buildTableUrl(table, query) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        params.set(key, value);
      }
    }

    return `${this.supabaseUrl}/rest/v1/${table}?${params.toString()}`;
  }
}

async function buildRequestError(response) {
  const payload = await readErrorPayload(response);
  const message = payload?.message ?? payload?.error ?? JSON.stringify(payload);

  return `Supabase REST request failed with status ${response.status}: ${message}`;
}

async function readErrorPayload(response) {
  try {
    return await response.json();
  } catch {
    return response.text();
  }
}
