import { Router } from 'express';
import { mapAppRecord, asyncHandler } from '../utils.js';

function toBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  return Boolean(value);
}

export function createAppsRouter({ prisma, lifecycleManager, orchestrator }) {
  const router = Router();

  async function fetchApp(id) {
    return prisma.app.findUnique({
      where: { id },
      include: {
        containerStates: true,
        settings: true
      }
    });
  }

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const apps = await prisma.app.findMany({
        include: {
          containerStates: true,
          settings: true
        }
      });

      res.json({ data: apps.map((app) => mapAppRecord(app, orchestrator)) });
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const app = await fetchApp(req.params.id);

      if (!app) {
        res.status(404).json({
          error: {
            code: 'not_found',
            message: 'Application not found.',
            details: { id: req.params.id }
          }
        });
        return;
      }

      res.json({ data: mapAppRecord(app, orchestrator) });
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { install, skipClone, ...payload } = req.body ?? {};

      const record = await lifecycleManager.registerApp(payload);

      if (install) {
        await lifecycleManager.installApp(record.id, {
          skipClone: toBoolean(skipClone)
        });
      }

      const app = await fetchApp(record.id);
      res.status(201).json({ data: mapAppRecord(app, orchestrator) });
    })
  );

  router.post(
    '/:id/install',
    asyncHandler(async (req, res) => {
      await lifecycleManager.installApp(req.params.id, {
        skipClone: toBoolean(req.body?.skipClone)
      });

      const app = await fetchApp(req.params.id);
      res.json({ data: mapAppRecord(app, orchestrator) });
    })
  );

  router.post(
    '/:id/start',
    asyncHandler(async (req, res) => {
      await lifecycleManager.startApp(req.params.id);
      const app = await fetchApp(req.params.id);
      res.json({ data: mapAppRecord(app, orchestrator) });
    })
  );

  router.post(
    '/:id/stop',
    asyncHandler(async (req, res) => {
      await lifecycleManager.stopApp(req.params.id, {
        removeVolumes: toBoolean(req.body?.removeVolumes)
      });
      const app = await fetchApp(req.params.id);
      res.json({ data: mapAppRecord(app, orchestrator) });
    })
  );

  router.post(
    '/:id/restart',
    asyncHandler(async (req, res) => {
      await lifecycleManager.restartApp(req.params.id);
      const app = await fetchApp(req.params.id);
      res.json({ data: mapAppRecord(app, orchestrator) });
    })
  );

  router.post(
    '/:id/reinstall',
    asyncHandler(async (req, res) => {
      await lifecycleManager.reinstallApp(req.params.id, {
        skipClone: toBoolean(req.body?.skipClone)
      });
      const app = await fetchApp(req.params.id);
      res.json({ data: mapAppRecord(app, orchestrator) });
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      await lifecycleManager.deinstallApp(req.params.id, {
        removeVolumes: req.body?.removeVolumes === undefined
          ? true
          : toBoolean(req.body.removeVolumes)
      });
      const app = await fetchApp(req.params.id);
      res.json({ data: mapAppRecord(app, orchestrator) });
    })
  );

  router.patch(
    '/:id/settings',
    asyncHandler(async (req, res) => {
      await orchestrator.updateOpenAppBaseUrl(req.params.id, req.body?.openAppBaseUrl ?? null);
      const app = await fetchApp(req.params.id);
      res.json({ data: mapAppRecord(app, orchestrator) });
    })
  );

  return router;
}
