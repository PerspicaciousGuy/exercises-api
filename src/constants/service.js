export const SERVICE_NAME = 'exercisedb-api';
export const API_VERSION = '0.1.0';
export const DEFAULT_PORT = 3000;

/**
 * Stable base URI for RFC 9457 `type` members. RFC 9457 does not require it to
 * resolve, but it points at the docs site so a page per error code can be
 * published there later. Changing it after consumers integrate is a breaking
 * change to the error contract.
 */
export const ERROR_TYPE_BASE_URL = 'https://docs.harshitbishnoi.dev/errors';

/** Vite's dev server. Overridden by DASHBOARD_ORIGINS in every deployment. */
export const DEFAULT_DASHBOARD_ORIGINS = 'http://localhost:5173';
