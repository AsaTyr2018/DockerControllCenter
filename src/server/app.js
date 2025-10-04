import express from 'express';
import cors from 'cors';
import { createAppsRouter } from './routes/apps.js';
import { createTemplatesRouter } from './routes/templates.js';
import { createTelemetryRouter } from './routes/telemetry.js';
import { createErrorHandler, createNotFoundHandler } from './errorHandler.js';
import { createAppLifecycleManager } from '../framework/appLifecycleManager.js';
import { createDockerOrchestrator } from '../framework/dockerOrchestrator.js';

export function createApiServer({
  prisma,
  logger = console,
  lifecycleManager,
  orchestrator,
  corsOrigin = '*'
} = {}) {
  if (!prisma) {
    throw new Error('Prisma client instance is required.');
  }

  const app = express();
  const lifecycle =
    lifecycleManager ??
    createAppLifecycleManager({
      prisma,
      logger
    });
  const dockerOrchestrator =
    orchestrator ??
    createDockerOrchestrator({
      prisma,
      logger
    });

  app.disable('x-powered-by');
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/healthz', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(
    '/apps',
    createAppsRouter({ prisma, lifecycleManager: lifecycle, orchestrator: dockerOrchestrator })
  );
  app.use('/templates', createTemplatesRouter({ prisma }));
  app.use('/telemetry', createTelemetryRouter({ orchestrator: dockerOrchestrator }));

  app.use(createNotFoundHandler());
  app.use(createErrorHandler(logger));

  return { app, lifecycleManager: lifecycle, orchestrator: dockerOrchestrator };
}
