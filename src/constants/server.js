/**
 * How long in-flight requests may take to finish before shutdown is forced.
 * Must stay below the platform's own kill timeout — Railway and Render allow
 * roughly 30 seconds after SIGTERM before sending SIGKILL.
 */
export const SHUTDOWN_TIMEOUT_MS = 10_000;

/** SIGINT is Ctrl+C locally; SIGTERM is what a platform sends on deploy. */
export const SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT'];
