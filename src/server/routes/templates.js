import { Router } from 'express';
import { asyncHandler } from '../utils.js';

export function createTemplatesRouter({ prisma }) {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const templates = await prisma.marketplaceTemplate.findMany();
      res.json({ data: templates });
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const template = await prisma.marketplaceTemplate.findUnique({
        where: { id: req.params.id }
      });

      if (!template) {
        res.status(404).json({
          error: {
            code: 'not_found',
            message: 'Marketplace template not found.',
            details: { id: req.params.id }
          }
        });
        return;
      }

      res.json({ data: template });
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const payload = req.body ?? {};
      const template = await prisma.marketplaceTemplate.create({ data: payload });
      res.status(201).json({ data: template });
    })
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const existing = await prisma.marketplaceTemplate.findUnique({
        where: { id: req.params.id }
      });

      if (!existing) {
        res.status(404).json({
          error: {
            code: 'not_found',
            message: 'Marketplace template not found.',
            details: { id: req.params.id }
          }
        });
        return;
      }

      const template = await prisma.marketplaceTemplate.update({
        where: { id: req.params.id },
        data: req.body ?? {}
      });
      res.json({ data: template });
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const existing = await prisma.marketplaceTemplate.findUnique({
        where: { id: req.params.id }
      });

      if (!existing) {
        res.status(404).json({
          error: {
            code: 'not_found',
            message: 'Marketplace template not found.',
            details: { id: req.params.id }
          }
        });
        return;
      }

      await prisma.marketplaceTemplate.delete({ where: { id: req.params.id } });
      res.status(204).end();
    })
  );

  return router;
}
