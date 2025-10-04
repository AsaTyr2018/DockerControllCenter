import { mapErrorToHttp } from './utils.js';

export function createNotFoundHandler() {
  return (req, res) => {
    res.status(404).json({
      error: {
        code: 'not_found',
        message: 'Route not found.',
        details: {
          method: req.method,
          path: req.path
        }
      }
    });
  };
}

export function createErrorHandler(logger = console) {
  return (error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    logger?.error?.('API request failed', error);
    const { status, body } = mapErrorToHttp(error);
    res.status(status).json(body);
  };
}
