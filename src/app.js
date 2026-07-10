import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { createLazyDefaultBillingProvider } from './billing/lemonSqueezyProvider.js';
import { env } from './config/env.js';
import { createApiKeyMiddleware } from './middleware/apiKeyAuth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { requestLogger } from './middleware/requestLogger.js';
import { createSessionOrApiKeyMiddleware } from './middleware/sessionAuth.js';
import { createLazyDefaultAuthRepository } from './repositories/authRepository.js';
import { createLazyDefaultBillingRepository } from './repositories/billingRepository.js';
import { createLazyDefaultExerciseRepository } from './repositories/exerciseRepository.js';
import { createLazyDefaultReferenceRepository } from './repositories/referenceRepository.js';
import { createLazyDefaultSessionRepository } from './repositories/sessionRepository.js';
import { createLazyDefaultSyncRepository } from './repositories/syncRepository.js';
import { createAuthRouter } from './routes/auth.js';
import { createBillingRouter } from './routes/billing.js';
import { createExercisesRouter } from './routes/exercises.js';
import { createHealthRouter } from './routes/health.js';
import { createReferencesRouter } from './routes/references.js';
import { createSyncRouter } from './routes/sync.js';
import { createWebhooksRouter } from './routes/webhooks.js';
import { createAuthService } from './services/authService.js';
import { createBillingService } from './services/billingService.js';
import { createExerciseService } from './services/exerciseService.js';
import { createReferenceService } from './services/referenceService.js';
import { createSessionService } from './services/sessionService.js';
import { createSyncService } from './services/syncService.js';

// Paths where the browser sends a session cookie. Everything else is a public,
// key-authenticated API that any origin may call.
const CREDENTIALED_PATH_PREFIXES = ['/auth', '/me', '/billing'];

export function createApp({
  authRepository = createLazyDefaultAuthRepository(),
  billingRepository = createLazyDefaultBillingRepository(),
  exerciseRepository = createLazyDefaultExerciseRepository(),
  referenceRepository = createLazyDefaultReferenceRepository(),
  sessionRepository = createLazyDefaultSessionRepository(),
  syncRepository = createLazyDefaultSyncRepository(),
  billingProvider = createLazyDefaultBillingProvider(),
  authService = createAuthService({ authRepository }),
  billingService = createBillingService({ billingRepository, billingProvider }),
  exerciseService = createExerciseService({ exerciseRepository }),
  referenceService = createReferenceService({ referenceRepository }),
  sessionService = createSessionService({ sessionRepository, authRepository }),
  syncService = createSyncService({ syncRepository }),
  apiKeyMiddleware = createApiKeyMiddleware({ authService }),
  consumerMiddleware = createSessionOrApiKeyMiddleware({
    sessionService,
    apiKeyMiddleware
  })
} = {}) {
  const app = express();

  // First: every subsequent middleware, including the webhook raw-body parser
  // and anything that throws, must run inside a request context so its logs
  // and its error response carry the same request id.
  app.use(requestLogger);

  app.use(helmet());
  app.use(cors(corsOptionsFor));

  // Before express.json() so the raw body survives HMAC verification, and
  // before apiKeyMiddleware because the provider authenticates by signature.
  app.use(createWebhooksRouter({ billingService }));

  app.use(express.json());

  app.use(createHealthRouter());
  app.use(
    createAuthRouter({
      authService,
      authRepository,
      sessionService,
      consumerMiddleware
    })
  );
  // Checkout is reachable by session or API key: the dashboard buys a plan
  // with a cookie, a script may do it with a key. Mounted ahead of the global
  // API-key middleware so a session is not asked for a key it cannot have.
  app.use('/billing', consumerMiddleware);
  app.use(createBillingRouter({ billingService }));

  app.use(apiKeyMiddleware);
  app.use(createSyncRouter({ syncService, syncRepository }));
  app.use(createReferencesRouter({ referenceService, referenceRepository }));
  app.use(createExercisesRouter({ exerciseService, exerciseRepository }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

/**
 * The catalog is a public API called from anywhere with a key in a header, so
 * it stays open. Session-cookie paths cannot be: `Access-Control-Allow-Origin:
 * *` is invalid alongside credentials, and reflecting an arbitrary origin there
 * would let any site drive a logged-in developer's dashboard.
 */
function corsOptionsFor(request, callback) {
  if (isCredentialedPath(request.path)) {
    callback(null, { origin: env.dashboardOrigins, credentials: true });
    return;
  }

  callback(null, { origin: '*' });
}

function isCredentialedPath(path) {
  return CREDENTIALED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}
