import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import request from 'supertest';
import { AppLifecycleManager } from '../src/framework/appLifecycleManager.js';
import { createApiServer } from '../src/server/app.js';
import { createPrismaDouble } from './helpers/prismaDouble.js';

class StubOrchestrator {
  constructor(prisma) {
    this.prisma = prisma;
    this.collectCount = 0;
  }

  async collectTelemetry() {
    this.collectCount += 1;
    return [{ appId: 'demo', containerName: 'demo', status: 'RUNNING', health: 'HEALTHY', metrics: null, state: null }];
  }

  async updateOpenAppBaseUrl(appId, openAppBaseUrl) {
    const sanitized = openAppBaseUrl?.trim() || null;

    await this.prisma.app.update({
      where: { id: appId },
      data: { openAppBaseUrl: sanitized }
    });

    await this.prisma.appSettings.upsert({
      where: { appId },
      update: { openAppBaseUrl: sanitized },
      create: { appId, openAppBaseUrl: sanitized }
    });

    return this.prisma.app.findUnique({
      where: { id: appId },
      select: { id: true, port: true, openAppBaseUrl: true }
    });
  }

  buildOpenAppUrl(app) {
    if (!app) {
      return null;
    }

    const base = app.openAppBaseUrl ?? app.settings?.openAppBaseUrl ?? null;

    if (!base) {
      return null;
    }

    if (!app.port) {
      return base;
    }

    const sanitized = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${sanitized}:${app.port}`;
  }

  stop() {}
}

const silentLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {}
};

async function createServerContext({ apps = [], templates = [] } = {}) {
  const prisma = createPrismaDouble({ apps, templates });
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dcc-api-'));
  const commands = [];

  const lifecycleManager = new AppLifecycleManager({
    prisma,
    workspaceRoot,
    fileSystem: fs,
    commandRunner: async (cmd, args) => {
      commands.push({ cmd, args });
      return { stdout: '', stderr: '' };
    },
    logger: silentLogger
  });

  const orchestrator = new StubOrchestrator(prisma);
  const { app } = createApiServer({
    prisma,
    lifecycleManager,
    orchestrator,
    logger: silentLogger,
    corsOrigin: '*'
  });

  return {
    app,
    prisma,
    commands,
    orchestrator,
    lifecycleManager,
    async cleanup() {
      await fs.rm(workspaceRoot, { recursive: true, force: true });
    }
  };
}

test('GET /healthz returns ok status payload', async (t) => {
  const ctx = await createServerContext();
  t.after(() => ctx.cleanup());

  const response = await request(ctx.app).get('/healthz');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
});

test('POST /apps registers a new application record', async (t) => {
  const ctx = await createServerContext();
  t.after(() => ctx.cleanup());

  const payload = {
    name: 'Stable Diffusion',
    repositoryUrl: 'https://example.com/sd.git',
    port: 7860,
    startCommand: 'python launch.py --listen'
  };

  const response = await request(ctx.app).post('/apps').send(payload);

  assert.equal(response.status, 201);
  assert.equal(response.body.data.name, 'Stable Diffusion');
  assert.equal(response.body.data.port, 7860);
  assert.match(response.body.data.workspaceSlug, /^stable-diffusion/);

  const created = ctx.prisma.state.apps.find((app) => app.name === 'Stable Diffusion');
  assert.ok(created, 'app should be stored');
});

test('POST /apps/:id/install provisions the workspace and updates status', async (t) => {
  const ctx = await createServerContext();
  t.after(() => ctx.cleanup());

  const created = await request(ctx.app)
    .post('/apps')
    .send({ name: 'Installable App', repositoryUrl: null, port: 9000, startCommand: 'npm start' });

  const installResponse = await request(ctx.app)
    .post(`/apps/${created.body.data.id}/install`)
    .send({ skipClone: true });

  assert.equal(installResponse.status, 200);
  assert.equal(installResponse.body.data.status, 'RUNNING');
  assert.equal(ctx.commands.length, 2);
  assert.equal(ctx.commands[0].cmd, 'docker');
  assert.deepEqual(ctx.commands[0].args, ['pull', 'nvcr.io/nvidia/pytorch:latest']);
  assert.equal(ctx.commands[1].cmd, 'docker');
  assert.equal(ctx.commands[1].args[0], 'compose');
  assert.deepEqual(ctx.commands[1].args.slice(-2), ['up', '-d']);
});

test('PATCH /apps/:id/settings stores the Open App base URL and returns derived link', async (t) => {
  const ctx = await createServerContext({
    apps: [
      {
        id: 'app-1',
        name: 'Settings Demo',
        workspaceSlug: 'settings-demo',
        port: 7000,
        status: 'STOPPED'
      }
    ]
  });
  t.after(() => ctx.cleanup());

  const response = await request(ctx.app)
    .patch('/apps/app-1/settings')
    .send({ openAppBaseUrl: 'http://edge-gateway/' });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.openAppBaseUrl, 'http://edge-gateway/');
  assert.equal(response.body.data.openAppUrl, 'http://edge-gateway:7000');
});

test('POST /telemetry/collect invokes orchestrator and returns results', async (t) => {
  const ctx = await createServerContext();
  t.after(() => ctx.cleanup());

  const response = await request(ctx.app).post('/telemetry/collect');
  assert.equal(response.status, 200);
  assert.equal(ctx.orchestrator.collectCount, 1);
  assert.equal(Array.isArray(response.body.data), true);
});

test('GET /templates returns marketplace templates', async (t) => {
  const ctx = await createServerContext({
    templates: [
      { id: 'tpl-1', name: 'Stable Diffusion', summary: 'GPU image' },
      { id: 'tpl-2', name: 'Dreambooth', summary: 'Training pipeline' }
    ]
  });
  t.after(() => ctx.cleanup());

  const response = await request(ctx.app).get('/templates');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 2);
});
