export const SESSION_TTL_DAYS = 14;
export const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;

// Sessions authenticate a human in a browser, so the cookie must survive a
// page reload, must not be readable by scripts, and must be sent on same-site
// requests from the dashboard origin.
export const SESSION_COOKIE_SAME_SITE = 'lax';
export const SESSION_COOKIE_PATH = '/';

export const USER_AGENT_MAX_LENGTH = 255;
