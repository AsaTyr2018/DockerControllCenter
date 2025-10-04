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

test('startApp uses existing compose manifest to boot the stack', async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dcc-start-'));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const workspaceSlug = 'start-demo';
  const workspacePath = path.join(tempRoot, workspaceSlug);
  const composePath = path.join(workspacePath, 'docker-compose.yaml');
  await fs.mkdir(workspacePath, { recursive: true });
  await fs.writeFile(composePath, "version: '3.9'\nservices:\n  app:\n    image: demo\n", 'utf8');

  const prisma = createPrismaDouble({
    apps: [
      {
        id: 'app-start',
        name: 'Start Demo',
        workspaceSlug,
        status: 'STOPPED'
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
    },
    logger: { warn() {}, error() {}, debug() {} }
  });

  const result = await manager.startApp('app-start');

  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0].args, ['compose', '-f', composePath, 'up', '-d']);
  assert.equal(commands[0].options.cwd, workspacePath);
  assert.equal(commands[0].options.env.COMPOSE_PROJECT_NAME, 'dcc-start-demo');
  assert.equal(result.composePath, composePath);

  const appRecord = prisma.state.apps.find((entry) => entry.id === 'app-start');
  assert.equal(appRecord.status, 'RUNNING');
  assert.ok(appRecord.lastSeenAt instanceof Date);
});

test('stopApp tears down docker compose and updates telemetry', async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dcc-stop-'));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const workspaceSlug = 'stop-demo';
  const workspacePath = path.join(tempRoot, workspaceSlug);
  const composePath = path.join(workspacePath, 'docker-compose.yaml');
  await fs.mkdir(workspacePath, { recursive: true });
  await fs.writeFile(composePath, "version: '3.9'\nservices:\n  app:\n    image: demo\n", 'utf8');

  const prisma = createPrismaDouble({
    apps: [
      {
        id: 'app-stop',
        name: 'Stop Demo',
        workspaceSlug,
        status: 'RUNNING'
      }
    ],
    containerStates: [
      {
        id: 'state-1',
        appId: 'app-stop',
        containerId: 'container-123',
        containerName: 'dcc-stop-demo',
        status: 'RUNNING',
        metrics: null,
        state: null,
        lastObservedAt: new Date()
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
    },
    logger: { warn() {}, error() {}, debug() {} }
  });

  const result = await manager.stopApp('app-stop');

  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0].args, ['compose', '-f', composePath, 'down', '--remove-orphans']);
  assert.equal(commands[0].options.cwd, workspacePath);
  assert.equal(commands[0].options.env.COMPOSE_PROJECT_NAME, 'dcc-stop-demo');
  assert.equal(result.composePath, composePath);

  const appRecord = prisma.state.apps.find((entry) => entry.id === 'app-stop');
  assert.equal(appRecord.status, 'STOPPED');
  assert.equal(appRecord.lastSeenAt, null);

  const stateRecord = prisma.state.containerStates.find((entry) => entry.appId === 'app-stop');
  assert.equal(stateRecord.status, 'STOPPED');
  assert.equal(stateRecord.containerId, 'container-123');
  assert.equal(stateRecord.metrics, null);
});

test('restartApp restarts containers using docker compose', async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dcc-restart-'));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const workspaceSlug = 'restart-demo';
  const workspacePath = path.join(tempRoot, workspaceSlug);
  const composePath = path.join(workspacePath, 'docker-compose.yaml');
  await fs.mkdir(workspacePath, { recursive: true });
  await fs.writeFile(composePath, "version: '3.9'\nservices:\n  app:\n    image: demo\n", 'utf8');

  const prisma = createPrismaDouble({
    apps: [
      {
        id: 'app-restart',
        name: 'Restart Demo',
        workspaceSlug,
        status: 'RUNNING'
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
    },
    logger: { warn() {}, error() {}, debug() {} }
  });

  await manager.restartApp('app-restart');

  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0].args, ['compose', '-f', composePath, 'restart']);
  assert.equal(commands[0].options.env.COMPOSE_PROJECT_NAME, 'dcc-restart-demo');

  const appRecord = prisma.state.apps.find((entry) => entry.id === 'app-restart');
  assert.equal(appRecord.status, 'RUNNING');
  assert.ok(appRecord.lastSeenAt instanceof Date);
});

test('reinstallApp stops the stack before reinstalling', async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dcc-reinstall-'));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const workspaceSlug = 'reinstall-demo';
  const workspacePath = path.join(tempRoot, workspaceSlug);
  const composePath = path.join(workspacePath, 'docker-compose.yaml');
  await fs.mkdir(workspacePath, { recursive: true });
  await fs.writeFile(composePath, "version: '3.9'\nservices:\n  app:\n    image: demo\n", 'utf8');

  const prisma = createPrismaDouble({
    apps: [
      {
        id: 'app-reinstall',
        name: 'Reinstall Demo',
        workspaceSlug,
        repositoryUrl: null,
        status: 'RUNNING'
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
    },
    logger: { warn() {}, error() {}, debug() {} }
  });

  await manager.reinstallApp('app-reinstall', { skipClone: true });

  assert.equal(commands.length, 2);
  assert.deepEqual(commands[0].args, ['compose', '-f', composePath, 'down', '--remove-orphans']);
  assert.deepEqual(commands[1].args, ['compose', '-f', composePath, 'up', '-d']);

  const appRecord = prisma.state.apps.find((entry) => entry.id === 'app-reinstall');
  assert.equal(appRecord.status, 'RUNNING');
});

test('deinstallApp removes the workspace and container state', async (t) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dcc-deinstall-'));
  t.after(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const workspaceSlug = 'deinstall-demo';
  const workspacePath = path.join(tempRoot, workspaceSlug);
  const composePath = path.join(workspacePath, 'docker-compose.yaml');
  await fs.mkdir(workspacePath, { recursive: true });
  await fs.writeFile(composePath, "version: '3.9'\nservices:\n  app:\n    image: demo\n", 'utf8');

  const prisma = createPrismaDouble({
    apps: [
      {
        id: 'app-deinstall',
        name: 'Deinstall Demo',
        workspaceSlug,
        status: 'RUNNING'
      }
    ],
    containerStates: [
      {
        id: 'state-del',
        appId: 'app-deinstall',
        containerId: 'container-del',
        containerName: 'dcc-deinstall-demo',
        status: 'RUNNING',
        metrics: null,
        state: null,
        lastObservedAt: new Date()
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
    },
    logger: { warn() {}, error() {}, debug() {} }
  });

  await manager.deinstallApp('app-deinstall');

  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0].args, [
    'compose',
    '-f',
    composePath,
    'down',
    '--remove-orphans',
    '--volumes'
  ]);

  await assert.rejects(async () => fs.access(workspacePath));

  const stateRecord = prisma.state.containerStates.find((entry) => entry.appId === 'app-deinstall');
  assert.equal(stateRecord, undefined);

  const appRecord = prisma.state.apps.find((entry) => entry.id === 'app-deinstall');
  assert.equal(appRecord.status, 'STOPPED');
  assert.equal(appRecord.lastSeenAt, null);
});
