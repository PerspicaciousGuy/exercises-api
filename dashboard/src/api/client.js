const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const PROBLEM_JSON = 'application/problem+json';

/**
 * Thrown for every non-2xx response. `code` is the stable RFC 9457 extension
 * member; branch on it. `detail` is written for humans and may be reworded.
 */
export class ApiError extends Error {
  constructor({ status, code, detail }) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }

  get isUnauthenticated() {
    return this.status === 401;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      // Sends and accepts the session cookie. Without this the browser drops
      // it on every cross-origin call and the dashboard silently logs out.
      credentials: 'include',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      detail: 'Could not reach the API. Is it running?'
    });
  }

  if (response.status === 204) {
    return null;
  }

  const payload = await readBody(response);

  if (!response.ok) {
    throw toApiError(response, payload);
  }

  return payload?.data ?? null;
}

async function readBody(response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('json')) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function toApiError(response, payload) {
  const isProblem = (response.headers.get('content-type') ?? '').includes(
    PROBLEM_JSON
  );

  if (isProblem && payload) {
    return new ApiError({
      status: payload.status ?? response.status,
      code: payload.code ?? 'UNKNOWN_ERROR',
      detail: payload.detail ?? response.statusText
    });
  }

  return new ApiError({
    status: response.status,
    code: 'UNKNOWN_ERROR',
    detail: response.statusText || 'Request failed'
  });
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  getCurrentUser: () => request('/me'),
  listApiKeys: () => request('/me/keys'),
  createApiKey: (body) => request('/me/keys', { method: 'POST', body }),
  revokeApiKey: (id) => request(`/me/keys/${id}`, { method: 'DELETE' }),
  getUsage: () => request('/me/usage'),

  createCheckout: (tier) =>
    request('/billing/checkout', { method: 'POST', body: { tier } })
};
