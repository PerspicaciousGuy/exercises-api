import { Router } from 'express';

import { createReferenceService } from '../services/referenceService.js';

export function createReferencesRouter({
  referenceRepository,
  referenceService
}) {
  const router = Router();
  const service =
    referenceService ?? createReferenceService({ referenceRepository });

  router.get(
    '/metadata',
    asyncHandler(async (_request, response) => {
      response.status(200).json({
        success: true,
        data: await service.getMetadata()
      });
    })
  );

  router.get(
    '/muscles',
    createListHandler(() => service.listMuscles())
  );
  router.get(
    '/equipment',
    createListHandler(() => service.listEquipment())
  );
  router.get(
    '/categories',
    createListHandler(() => service.listCategories())
  );
  router.get(
    '/exercise-flags',
    createListHandler(() => service.listExerciseFlags())
  );
  router.get(
    '/joint-regions',
    createListHandler(() => service.listJointRegions())
  );

  return router;
}

function createListHandler(loadRows) {
  return asyncHandler(async (_request, response) => {
    response.status(200).json({
      success: true,
      data: await loadRows()
    });
  });
}

function asyncHandler(handler) {
  return async (request, response, next) => {
    try {
      await handler(request, response, next);
    } catch (error) {
      next(error);
    }
  };
}
