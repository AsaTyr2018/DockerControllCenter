import { AppValidationError, InstallationError } from '../framework/errors.js';

export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function parseJson(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function mapContainerState(state) {
  if (!state) {
    return null;
  }

  return {
    ...state,
    metrics: parseJson(state.metrics ?? null),
    state: parseJson(state.state ?? null)
  };
}

export function mapAppRecord(app, orchestrator) {
  if (!app) {
    return null;
  }

  const containerStates = Array.isArray(app.containerStates)
    ? app.containerStates.map((entry) => mapContainerState(entry))
    : [];

  const openAppUrl = orchestrator?.buildOpenAppUrl?.(app) ?? null;

  return {
    ...app,
    containerStates,
    openAppUrl
  };
}

export function mapErrorToHttp(error) {
  if (error instanceof AppValidationError) {
    const status = error.details?.reason === 'not-found' ? 404 : 400;
    return {
      status,
      body: {
        error: {
          code: 'validation_error',
          message: error.message,
          details: error.details ?? null
        }
      }
    };
  }

  if (error instanceof InstallationError) {
    return {
      status: 409,
      body: {
        error: {
          code: 'installation_error',
          message: error.message,
          details: error.details ?? null
        }
      }
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'internal_error',
        message: 'Unexpected server error.',
        details: null
      }
    }
  };
}
