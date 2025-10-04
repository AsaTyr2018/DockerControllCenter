import { setInterval as createInterval, clearInterval as clearTimer } from 'node:timers';
import { spawn } from 'node:child_process';
import { deriveWorkspaceSlug } from './validation.js';

const DEFAULT_POLL_INTERVAL_MS = 5000;

function parseJsonLines(output) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        const failure = new Error('Failed to parse docker CLI JSON output.');
        failure.cause = error;
        failure.line = line;
        throw failure;
      }
    });
}

function mapStatsByContainerName(statsOutput) {
  if (!statsOutput) {
    return new Map();
  }

  const map = new Map();

  for (const entry of parseJsonLines(statsOutput)) {
    if (entry.Name) {
      map.set(entry.Name, entry);
    }
  }

  return map;
}

function toUpperSafe(value) {
  return typeof value === 'string' ? value.toUpperCase() : value ?? null;
}

async function inspectContainer(commandRunner, containerId) {
  const { stdout } = await commandRunner('docker', ['inspect', containerId]);
  const parsed = JSON.parse(stdout);
  return Array.isArray(parsed) ? parsed[0] ?? null : parsed;
}

function resolveContainerName(app) {
  const slug = app.workspaceSlug ?? deriveWorkspaceSlug(app.name);
  return `dcc-${slug}`;
}

function resolveStatus(inspectData, psSummary) {
  const raw =
    inspectData?.State?.Status ??
    inspectData?.State?.State ??
    psSummary?.State ??
    psSummary?.Status ??
    'unknown';
  return toUpperSafe(raw);
}

function resolveHealth(inspectData, psSummary) {
  const raw = inspectData?.State?.Health?.Status ?? psSummary?.Health;
  return raw ? raw.toUpperCase() : null;
}

function sanitizeMetrics(entry) {
  if (!entry) {
    return null;
  }

  return {
    cpuPercent: entry.CPUPerc ? Number.parseFloat(entry.CPUPerc.replace('%', '')) : null,
    memoryUsage: entry.MemUsage ?? null,
    memoryPercent: entry.MemPerc ? Number.parseFloat(entry.MemPerc.replace('%', '')) : null,
    networkIO: entry.NetIO ?? null,
    blockIO: entry.BlockIO ?? null,
    pids: entry.PIDs ? Number.parseInt(entry.PIDs, 10) : null
  };
}

function createDefaultRunner(logger) {
  return (command, args = [], options = {}) =>
    new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
        logger?.debug?.(data.toString());
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
        logger?.debug?.(data.toString());
      });

      child.on('error', (error) => reject(error));

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          const failure = new Error(`Command failed: ${command}`);
          failure.code = code;
          failure.stderr = stderr;
          reject(failure);
        }
      });
    });
}

export class DockerOrchestrator {
  constructor({
    prisma,
    commandRunner,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    logger = console
  }) {
    if (!prisma) {
      throw new Error('Prisma client instance is required.');
    }

    this.prisma = prisma;
    this.commandRunner = commandRunner ?? createDefaultRunner(logger);
    this.pollIntervalMs = pollIntervalMs;
    this.logger = logger;
    this.timer = null;
  }

  async start() {
    if (this.timer) {
      return;
    }

    await this.collectTelemetry().catch((error) => {
      this.logger.error?.('Initial telemetry collection failed:', error);
    });

    this.timer = createInterval(async () => {
      try {
        await this.collectTelemetry();
      } catch (error) {
        this.logger.error?.('Telemetry polling failed:', error);
      }
    }, this.pollIntervalMs);
  }

  stop() {
    if (!this.timer) {
      return;
    }

    clearTimer(this.timer);
    this.timer = null;
  }

  async collectTelemetry() {
    const apps = await this.prisma.app.findMany({
      include: {
        containerStates: true,
        settings: true
      }
    });

    if (apps.length === 0) {
      return [];
    }

    let psOutput;

    try {
      ({ stdout: psOutput } = await this.commandRunner('docker', [
        'ps',
        '--all',
        '--format',
        '{{json .}}'
      ]));
    } catch (error) {
      this.logger.error?.('docker ps failed, skipping telemetry update.', error);
      return [];
    }

    const statsMap = await this.collectStats();
    const psEntries = parseJsonLines(psOutput);
    const containersByName = new Map(psEntries.map((entry) => [entry.Names, entry]));
    const results = [];

    for (const app of apps) {
      const containerName = resolveContainerName(app);
      const psSummary = containersByName.get(containerName) ?? null;
      const existingState = Array.isArray(app.containerStates)
        ? app.containerStates.find((state) => state.appId === app.id)
        : null;

      if (!psSummary) {
        const missingRecord = {
          containerId: existingState?.containerId ?? containerName,
          containerName,
          status: 'MISSING',
          health: null,
          state: null,
          metrics: null,
          lastObservedAt: new Date()
        };

        await this.prisma.dockerContainerState.upsert({
          where: { appId: app.id },
          update: missingRecord,
          create: {
            appId: app.id,
            ...missingRecord
          }
        });

        await this.prisma.app.update({
          where: { id: app.id },
          data: {
            status: 'FAILED'
          }
        });

        results.push({ appId: app.id, containerName, status: 'MISSING', metrics: null, state: null });
        continue;
      }

      let inspectData = null;

      try {
        inspectData = await inspectContainer(this.commandRunner, psSummary.ID);
      } catch (error) {
        this.logger.error?.(`docker inspect failed for ${containerName}`, error);
      }

      const status = resolveStatus(inspectData, psSummary);
      const health = resolveHealth(inspectData, psSummary);
      const metrics = sanitizeMetrics(statsMap.get(psSummary.Names));
      const record = {
        containerId: inspectData?.Id ?? psSummary.ID,
        containerName,
        status,
        health,
        state: inspectData?.State ?? null,
        metrics,
        lastObservedAt: new Date()
      };

      await this.prisma.dockerContainerState.upsert({
        where: { appId: app.id },
        update: record,
        create: {
          appId: app.id,
          ...record
        }
      });

      if (status === 'RUNNING') {
        await this.prisma.app.update({
          where: { id: app.id },
          data: {
            status: 'RUNNING',
            lastSeenAt: new Date()
          }
        });
      } else if (status === 'EXITED' || status === 'MISSING') {
        await this.prisma.app.update({
          where: { id: app.id },
          data: {
            status: status === 'EXITED' ? 'STOPPED' : 'FAILED'
          }
        });
      }

      results.push({
        appId: app.id,
        containerName,
        status,
        health,
        metrics,
        state: inspectData?.State ?? null
      });
    }

    return results;
  }

  async collectStats() {
    try {
      const { stdout } = await this.commandRunner('docker', [
        'stats',
        '--no-stream',
        '--format',
        '{{json .}}'
      ]);
      return mapStatsByContainerName(stdout);
    } catch (error) {
      this.logger.warn?.('docker stats failed; metrics will be unavailable for this cycle.', error);
      return new Map();
    }
  }

  async updateOpenAppBaseUrl(appId, openAppBaseUrl) {
    if (!appId) {
      throw new Error('appId is required.');
    }

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
      select: {
        id: true,
        name: true,
        openAppBaseUrl: true,
        port: true
      }
    });
  }

  buildOpenAppUrl(app) {
    if (!app) {
      return null;
    }

    const base = app.openAppBaseUrl ?? app.settings?.openAppBaseUrl ?? null;

    if (!base || !app.port) {
      return base ?? null;
    }

    const sanitizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${sanitizedBase}:${app.port}`;
  }
}

export function createDockerOrchestrator(options) {
  return new DockerOrchestrator(options);
}
