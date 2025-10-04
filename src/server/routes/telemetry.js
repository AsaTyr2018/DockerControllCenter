import { Router } from 'express';
import { asyncHandler } from '../utils.js';

export function createTelemetryRouter({ orchestrator }) {
  const router = Router();

  router.post(
    '/collect',
    asyncHandler(async (req, res) => {
      const results = await orchestrator.collectTelemetry();
      res.json({ data: results });
    })
  );

  return router;
}
