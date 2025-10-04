import { AppValidationError } from './errors.js';

const REPOSITORY_PROTOCOL = /^(https?|git|ssh):/i;

export function normalizeName(name) {
  if (typeof name !== 'string') {
    return '';
  }

  return name.trim();
}

export function deriveWorkspaceSlug(name) {
  const slug = normalizeName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (!slug) {
    throw new AppValidationError('Unable to derive workspace slug from application name.', {
      field: 'name',
      reason: 'slug-empty'
    });
  }

  return slug;
}

function validateRepositoryUrl(repositoryUrl) {
  if (repositoryUrl == null) {
    return null;
  }

  if (typeof repositoryUrl !== 'string') {
    throw new AppValidationError('Repository URL must be a string.', {
      field: 'repositoryUrl',
      reason: 'invalid-type'
    });
  }

  const trimmed = repositoryUrl.trim();

  if (!trimmed) {
    return null;
  }

  if (!REPOSITORY_PROTOCOL.test(trimmed)) {
    throw new AppValidationError('Repository URL must start with https, http, git, or ssh.', {
      field: 'repositoryUrl',
      reason: 'invalid-protocol'
    });
  }

  return trimmed;
}

function validatePort(port) {
  if (port == null) {
    return null;
  }

  const numeric = Number(port);

  if (!Number.isInteger(numeric) || numeric <= 0 || numeric > 65535) {
    throw new AppValidationError('Port must be an integer between 1 and 65535.', {
      field: 'port',
      reason: 'invalid-port'
    });
  }

  return numeric;
}

function optionalTrim(value, fieldName) {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new AppValidationError('Expected string value.', {
      field: fieldName,
      reason: 'invalid-type'
    });
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function validateRegistrationPayload(payload = {}) {
  const name = normalizeName(payload.name);

  if (!name) {
    throw new AppValidationError('Application name is required.', {
      field: 'name',
      reason: 'required'
    });
  }

  const repositoryUrl = validateRepositoryUrl(payload.repositoryUrl);
  const port = validatePort(payload.port);
  const startCommand = optionalTrim(payload.startCommand, 'startCommand');
  const healthEndpoint = optionalTrim(payload.healthEndpoint, 'healthEndpoint');
  const notes = optionalTrim(payload.notes, 'notes');

  return {
    name,
    repositoryUrl,
    port,
    startCommand,
    healthEndpoint,
    notes
  };
}

export function mergeTemplateDefaults(template, payload) {
  if (!template) {
    return payload;
  }

  return {
    ...payload,
    repositoryUrl: payload.repositoryUrl ?? template.repositoryUrl ?? null,
    port: payload.port ?? template.defaultPort ?? null,
    startCommand: payload.startCommand ?? template.startCommand ?? null,
    notes: payload.notes ?? template.onboardingHints ?? null
  };
}
