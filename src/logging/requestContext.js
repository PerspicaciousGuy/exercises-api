import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Carries the current request's id across every await boundary, so a service or
 * repository can be logged with its request without threading an id through
 * every function signature.
 */
const storage = new AsyncLocalStorage();

export function runWithRequestContext(context, callback) {
  return storage.run(context, callback);
}

export function getRequestContext() {
  return storage.getStore() ?? null;
}

export function getRequestId() {
  return storage.getStore()?.requestId ?? null;
}
