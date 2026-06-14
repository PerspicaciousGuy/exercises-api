import { Router } from 'express';

import { env } from '../config/env.js';

export function createHealthRouter() {
  const router = Router();

  router.get('/health', (_request, response) => {
    response.status(200).json({
      success: true,
      data: {
        status: 'ok',
        service: env.serviceName,
        version: env.apiVersion,
        environment: env.nodeEnv
      }
    });
  });

  return router;
}
