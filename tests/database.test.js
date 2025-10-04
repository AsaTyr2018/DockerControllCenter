import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureDatabaseUrl,
  resolveDatabaseUrl,
  FALLBACK_DATABASE_URL
} from '../src/server/database.js';

test('resolveDatabaseUrl returns provided DATABASE_URL env value', () => {
  const env = { DATABASE_URL: 'postgresql://example' };
  const url = resolveDatabaseUrl({ env });

  assert.equal(url, 'postgresql://example');
});

test('resolveDatabaseUrl falls back to bundled SQLite path when unset', () => {
  const env = {};
  const url = resolveDatabaseUrl({ env });

  assert.equal(url, FALLBACK_DATABASE_URL);
});

test('ensureDatabaseUrl injects fallback value and logs a warning when missing', () => {
  const env = {};
  const warnings = [];
  const logger = { warn: (message) => warnings.push(message) };

  const url = ensureDatabaseUrl({ env, logger });

  assert.equal(url, FALLBACK_DATABASE_URL);
  assert.equal(env.DATABASE_URL, FALLBACK_DATABASE_URL);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Falling back to embedded SQLite database/);
});

test('ensureDatabaseUrl preserves preconfigured DATABASE_URL and avoids warnings', () => {
  const env = { DATABASE_URL: 'file:./custom.db' };
  const warnings = [];
  const logger = { warn: (message) => warnings.push(message) };

  const url = ensureDatabaseUrl({ env, logger });

  assert.equal(url, 'file:./custom.db');
  assert.equal(env.DATABASE_URL, 'file:./custom.db');
  assert.equal(warnings.length, 0);
});
