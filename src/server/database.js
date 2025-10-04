import { env as processEnv } from 'node:process';

const FALLBACK_DATABASE_URL = new URL('../../prisma/dev.db', import.meta.url).toString();

function isEmpty(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

export function resolveDatabaseUrl({ env = processEnv } = {}) {
  if (!isEmpty(env.DATABASE_URL)) {
    return env.DATABASE_URL;
  }

  return FALLBACK_DATABASE_URL;
}

export function ensureDatabaseUrl({ env = processEnv, logger = console } = {}) {
  const url = resolveDatabaseUrl({ env });

  if (isEmpty(env.DATABASE_URL)) {
    env.DATABASE_URL = url;

    logger?.warn?.(
      `DATABASE_URL was not provided. Falling back to embedded SQLite database at ${url}.`
    );
  }

  return url;
}

export { FALLBACK_DATABASE_URL };
