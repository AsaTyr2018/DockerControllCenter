import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { AppLifecycleManager } from '../src/framework/appLifecycleManager.js';
import { AppValidationError } from '../src/framework/errors.js';
import { createPrismaDouble } from './helpers/prismaDouble.js';

test('registerApp merges marketplace template defaults when provided', async () => {
  const prisma = createPrismaDouble({
    templates: [
      {
        id: 'tpl-1',
        name: 'Stable Diffusion Demo',
        repositoryUrl: 'https://example.com/demo.git',
        defaultPort: 9000,
        onboardingHints: 'GPU required.'
      }
    ]
  });

  const manager = new AppLifecycleManager({ prisma });

  const record = await manager.registerApp({
    name: 'My Demo',
    templateName: 'Stable Diffusion Demo',
    startCommand: 'python app.py'
  });

  assert.equal(record.name, 'My Demo');
  assert.equal(record.repositoryUrl, 'https://example.com/demo.git');
  assert.equal(record.port, 9000);
  assert.equal(record.notes, 'GPU required.');
  assert.equal(record.startCommand, 'python app.py');
  assert.match(record.workspaceSlug, /^my-demo/);
});

test('registerApp throws when workspace slug already exists', async () => {
  const prisma = createPrismaDouble({
    apps: [
      {
        id: 'existing',
        name: 'Test App',
        workspaceSlug: 'test-app',
        status: 'STOPPED'
      }
    ]
  });

  const manager = new AppLifecycleManager({ prisma });

  await assert.rejects(
    () =>
      manager.registerApp({
        name: 'Test-App'
      }),
    (error) => {
      assert.ok(error instanceof AppValidationError);
      assert.equal(error.details.reason, 'workspace-conflict');
      return true;
    }
  );
});

test('installApp writes compose file and triggers docker compose', async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dcc-test-'));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const prisma = createPrismaDouble({
    apps: [
      {
        id: 'app-install',
        name: 'Install Demo',
        workspaceSlug: 'install-demo',
        repositoryUrl: null,
        port: 8080,
        status: 'STOPPED',
        startCommand: 'npm start'
      }
    ]
  });

  const commands = [];

  const manager = new AppLifecycleManager({
    prisma,
    workspaceRoot: tempRoot,
    commandRunner: async (cmd, args, options) => {
      commands.push({ cmd, args, options });
      return { stdout: '', stderr: '' };
    }
  });

  const result = await manager.installApp('app-install', { skipClone: true });

  const composeContent = await fs.readFile(result.composePath, 'utf8');

  assert.match(composeContent, /services:/);
  assert.match(composeContent, /npm start/);
  assert.equal(commands[0].cmd, 'docker');
  assert.deepEqual(commands[0].args, ['compose', '-f', result.composePath, 'up', '-d']);
  assert.equal(commands[0].options.cwd, path.join(tempRoot, 'install-demo'));
  assert.equal(commands[0].options.env.COMPOSE_PROJECT_NAME, 'dcc-install-demo');

  const updatedApp = prisma.state.apps.find((app) => app.id === 'app-install');
  assert.equal(updatedApp.status, 'RUNNING');
  assert.ok(updatedApp.lastSeenAt instanceof Date);
});
