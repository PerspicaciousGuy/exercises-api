import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { createLazyDefaultExerciseRepository } from './repositories/exerciseRepository.js';
import { createLazyDefaultReferenceRepository } from './repositories/referenceRepository.js';
import { createExercisesRouter } from './routes/exercises.js';
import { createHealthRouter } from './routes/health.js';
import { createReferencesRouter } from './routes/references.js';
import { createExerciseService } from './services/exerciseService.js';
import { createReferenceService } from './services/referenceService.js';

export function createApp({
  exerciseRepository = createLazyDefaultExerciseRepository(),
  referenceRepository = createLazyDefaultReferenceRepository(),
  exerciseService = createExerciseService({ exerciseRepository }),
  referenceService = createReferenceService({ referenceRepository })
} = {}) {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use(createHealthRouter());
  app.use(createReferencesRouter({ referenceService, referenceRepository }));
  app.use(createExercisesRouter({ exerciseService, exerciseRepository }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
