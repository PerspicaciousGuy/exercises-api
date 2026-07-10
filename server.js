import { createApp } from './src/app.js';
import { env } from './src/config/env.js';
import {
  SHUTDOWN_SIGNALS,
  SHUTDOWN_TIMEOUT_MS
} from './src/constants/server.js';
import { logger } from './src/logging/logger.js';

const FATAL_EXIT_CODE = 1;

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info(
    { port: env.port, nodeEnv: env.nodeEnv, logLevel: env.logLevel },
    'server started'
  );
});

let isShuttingDown = false;

/**
 * A platform sends SIGTERM and then kills the process. Closing the server stops
 * new connections while in-flight requests finish, so a deploy does not sever a
 * response mid-write. The timer is the backstop: a hung request must not hold
 * the deploy open forever.
 */
function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, 'shutdown signal received');

  const forceExit = setTimeout(() => {
    logger.error(
      { timeoutMs: SHUTDOWN_TIMEOUT_MS },
      'forced shutdown, in-flight requests did not drain'
    );
    process.exit(FATAL_EXIT_CODE);
  }, SHUTDOWN_TIMEOUT_MS);

  // Do not keep the event loop alive purely for the backstop timer.
  forceExit.unref();

  server.close((error) => {
    clearTimeout(forceExit);

    if (error) {
      logger.error({ err: error }, 'error during shutdown');
      process.exit(FATAL_EXIT_CODE);
    }

    logger.info('graceful shutdown complete');
    process.exit(0);
  });
}

for (const signal of SHUTDOWN_SIGNALS) {
  process.on(signal, () => shutdown(signal));
}

// Without these, a rejected promise or a throw outside a request dies with a
// bare stack on stderr and no structured record of it.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandled promise rejection');
  process.exit(FATAL_EXIT_CODE);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception');
  process.exit(FATAL_EXIT_CODE);
});
