import test from 'node:test';
import assert from 'node:assert/strict';
import { DockerOrchestrator } from '../src/framework/dockerOrchestrator.js';
import { createPrismaDouble } from './helpers/prismaDouble.js';

function createCommandRunner({ psOutput = '', statsOutput = '', inspectOutputs = [] }) {
  let inspectIndex = 0;
  const calls = [];

  const runner = async (cmd, args) => {
    calls.push({ cmd, args });
    const subcommand = args[0];

    if (subcommand === 'ps') {
      return { stdout: psOutput, stderr: '' };
    }

    if (subcommand === 'stats') {
      return { stdout: statsOutput, stderr: '' };
    }

    if (subcommand === 'inspect') {
      const result = inspectOutputs[inspectIndex++];
      if (!result) {
        throw new Error('Unexpected docker inspect call.');
      }
      return { stdout: result, stderr: '' };
    }

    throw new Error(`Unsupported docker command: docker ${args.join(' ')}`);
  };

  return { runner, calls };
}

test('collectTelemetry persists container state and metrics', async () => {
  const prisma = createPrismaDouble({
    apps: [
      {
        id: 'app-1',
        name: 'Demo',
        workspaceSlug: 'demo',
        port: 8080,
        status: 'STOPPED'
      }
    ]
  });

  const { runner } = createCommandRunner({
    psOutput: `${JSON.stringify({
      ID: 'abcdef',
      Names: 'dcc-demo',
      State: 'running',
      Status: 'Up 5 minutes'
    })}\n`,
    statsOutput: `${JSON.stringify({
      Name: 'dcc-demo',
      CPUPerc: '12.5%',
      MemUsage: '100MiB / 2GiB',
      MemPerc: '5.0%',
      NetIO: '1kB / 2kB',
      BlockIO: '0B / 0B',
      PIDs: '5'
    })}\n`,
    inspectOutputs: [
      JSON.stringify([
        {
          Id: 'abcdef',
          Name: 'dcc-demo',
          State: {
            Status: 'running',
            Running: true,
            Health: { Status: 'healthy' }
          }
        }
      ])
    ]
  });

  const orchestrator = new DockerOrchestrator({ prisma, commandRunner: runner, pollIntervalMs: 50, logger: { warn() {}, error() {}, debug() {} } });

  const results = await orchestrator.collectTelemetry();

  assert.equal(results.length, 1);
  assert.equal(results[0].status, 'RUNNING');
  assert.equal(results[0].health, 'HEALTHY');
  assert.equal(results[0].metrics.cpuPercent, 12.5);

  const stateRecord = prisma.state.containerStates.find((entry) => entry.appId === 'app-1');
  assert.ok(stateRecord, 'container state should be stored');
  assert.equal(stateRecord.status, 'RUNNING');
  assert.equal(stateRecord.health, 'HEALTHY');
  assert.equal(stateRecord.metrics.cpuPercent, 12.5);

  const appRecord = prisma.state.apps.find((entry) => entry.id === 'app-1');
  assert.equal(appRecord.status, 'RUNNING');
  assert.ok(appRecord.lastSeenAt instanceof Date);
});

test('collectTelemetry marks missing containers as failed', async () => {
  const prisma = createPrismaDouble({
    apps: [
      {
        id: 'app-2',
        name: 'Missing',
        workspaceSlug: 'missing',
        status: 'RUNNING'
      }
    ]
  });

  const { runner } = createCommandRunner({ psOutput: '\n', statsOutput: '\n', inspectOutputs: [] });

  const orchestrator = new DockerOrchestrator({ prisma, commandRunner: runner, logger: { warn() {}, error() {}, debug() {} } });

  const results = await orchestrator.collectTelemetry();

  assert.equal(results.length, 1);
  assert.equal(results[0].status, 'MISSING');

  const stateRecord = prisma.state.containerStates.find((entry) => entry.appId === 'app-2');
  assert.ok(stateRecord);
  assert.equal(stateRecord.status, 'MISSING');

  const appRecord = prisma.state.apps.find((entry) => entry.id === 'app-2');
  assert.equal(appRecord.status, 'FAILED');
});

test('updateOpenAppBaseUrl persists settings and buildOpenAppUrl composes links', async () => {
  const prisma = createPrismaDouble({
    apps: [
      {
        id: 'app-3',
        name: 'Linker',
        workspaceSlug: 'linker',
        port: 7000,
        status: 'STOPPED'
      }
    ]
  });

  const orchestrator = new DockerOrchestrator({ prisma, commandRunner: async () => ({ stdout: '', stderr: '' }), logger: { warn() {}, error() {}, debug() {} } });

  const updated = await orchestrator.updateOpenAppBaseUrl('app-3', 'http://10.0.0.5');

  assert.equal(updated.openAppBaseUrl, 'http://10.0.0.5');

  const settingsRecord = prisma.state.appSettings.find((entry) => entry.appId === 'app-3');
  assert.ok(settingsRecord);
  assert.equal(settingsRecord.openAppBaseUrl, 'http://10.0.0.5');

  const appWithSettings = prisma.state.apps.find((entry) => entry.id === 'app-3');
  assert.equal(appWithSettings.openAppBaseUrl, 'http://10.0.0.5');

  const link = orchestrator.buildOpenAppUrl({ ...appWithSettings, port: 7000 });
  assert.equal(link, 'http://10.0.0.5:7000');
});
