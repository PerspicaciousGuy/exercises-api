import { Router } from 'express';
import { z } from 'zod';

import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { getSessionToken } from '../middleware/sessionAuth.js';
import {
  buildSessionCookieOptions,
  SESSION_COOKIE_NAME
} from '../security/sessions.js';
import { createAuthService } from '../services/authService.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const createApiKeySchema = z.object({
  label: z.string().trim().min(1).max(100).optional(),
  expiresAt: z.string().datetime({ offset: true }).optional()
});

export function createAuthRouter({
  authRepository,
  authService,
  sessionService,
  consumerMiddleware
}) {
  const router = Router();
  const service = authService ?? createAuthService({ authRepository });

  async function startSession(request, response, userId) {
    const { token } = await sessionService.createSession({
      userId,
      userAgent: request.get('user-agent')
    });

    response.cookie(
      SESSION_COOKIE_NAME,
      token,
      buildSessionCookieOptions({ nodeEnv: env.nodeEnv })
    );
  }

  router.post(
    '/auth/register',
    asyncHandler(async (request, response) => {
      const result = await service.register(
        parseBody(registerSchema, request.body)
      );

      await startSession(request, response, result.user.id);

      response.status(201).json({
        success: true,
        data: result
      });
    })
  );

  router.post(
    '/auth/login',
    asyncHandler(async (request, response) => {
      const result = await service.login(parseBody(loginSchema, request.body));

      await startSession(request, response, result.user.id);

      response.status(200).json({
        success: true,
        data: result
      });
    })
  );

  router.post(
    '/auth/logout',
    asyncHandler(async (request, response) => {
      await sessionService.revokeSession(getSessionToken(request));

      response.clearCookie(
        SESSION_COOKIE_NAME,
        buildSessionCookieOptions({ nodeEnv: env.nodeEnv })
      );
      response.status(200).json({ success: true, data: { loggedOut: true } });
    })
  );

  router.use('/me', consumerMiddleware);

  router.get(
    '/me',
    asyncHandler(async (request, response) => {
      response.status(200).json({
        success: true,
        data: await service.getCurrentUser(request.apiConsumer.user.id)
      });
    })
  );

  router.get(
    '/me/keys',
    asyncHandler(async (request, response) => {
      response.status(200).json({
        success: true,
        data: await service.listApiKeys(request.apiConsumer.user.id)
      });
    })
  );

  router.post(
    '/me/keys',
    asyncHandler(async (request, response) => {
      response.status(201).json({
        success: true,
        data: await service.createApiKey({
          userId: request.apiConsumer.user.id,
          ...parseBody(createApiKeySchema, request.body)
        })
      });
    })
  );

  router.delete(
    '/me/keys/:id',
    asyncHandler(async (request, response) => {
      response.status(200).json({
        success: true,
        data: await service.revokeApiKey({
          userId: request.apiConsumer.user.id,
          keyId: request.params.id
        })
      });
    })
  );

  router.get(
    '/me/usage',
    asyncHandler(async (request, response) => {
      response.status(200).json({
        success: true,
        data: await service.getUsage(request.apiConsumer.user.id)
      });
    })
  );

  return router;
}

function parseBody(schema, body) {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `${issue.path.join('.')} ${formatValidationMessage(issue.message)}`
    });
  }

  return parsed.data;
}

function formatValidationMessage(value) {
  const message = `${value.charAt(0).toLowerCase()}${value.slice(1)}`;

  return message.replace(/^string /, '');
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
