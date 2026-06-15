import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { createApiKeyMiddleware } from './middleware/apiKeyAuth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { createLazyDefaultAuthRepository } from './repositories/authRepository.js';
import { createLazyDefaultExerciseRepository } from './repositories/exerciseRepository.js';
import { createLazyDefaultReferenceRepository } from './repositories/referenceRepository.js';
import { createLazyDefaultSyncRepository } from './repositories/syncRepository.js';
import { createAuthRouter } from './routes/auth.js';
import { createExercisesRouter } from './routes/exercises.js';
import { createHealthRouter } from './routes/health.js';
import { createReferencesRouter } from './routes/references.js';
import { createSyncRouter } from './routes/sync.js';
import { createAuthService } from './services/authService.js';
import { createExerciseService } from './services/exerciseService.js';
import { createReferenceService } from './services/referenceService.js';
import { createSyncService } from './services/syncService.js';

export function createApp({
  authRepository = createLazyDefaultAuthRepository(),
  exerciseRepository = createLazyDefaultExerciseRepository(),
  referenceRepository = createLazyDefaultReferenceRepository(),
  syncRepository = createLazyDefaultSyncRepository(),
  authService = createAuthService({ authRepository }),
  exerciseService = createExerciseService({ exerciseRepository }),
  referenceService = createReferenceService({ referenceRepository }),
  syncService = createSyncService({ syncRepository }),
  apiKeyMiddleware = createApiKeyMiddleware({ authService })
} = {}) {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use(createHealthRouter());
  app.use(createAuthRouter({ authService, authRepository, apiKeyMiddleware }));
  app.use(apiKeyMiddleware);
  app.use(createSyncRouter({ syncService, syncRepository }));
  app.use(createReferencesRouter({ referenceService, referenceRepository }));
  app.use(createExercisesRouter({ exerciseService, exerciseRepository }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
