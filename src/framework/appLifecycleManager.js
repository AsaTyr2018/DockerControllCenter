import path from 'path';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { AppValidationError, InstallationError } from './errors.js';
import {
  deriveWorkspaceSlug,
  mergeTemplateDefaults,
  validateRegistrationPayload
} from './validation.js';

const DEFAULT_WORKSPACE_ROOT = process.env.DCC_STORAGE_ROOT || '/opt/dockerstore';
const DEFAULT_BASE_IMAGE = process.env.DCC_BASE_IMAGE || 'nvcr.io/nvidia/pytorch:latest';

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

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          const failure = new InstallationError(`Command failed: ${command}`, {
            code,
            stderr
          });
          reject(failure);
        }
      });
    });
}

async function pathExists(fileSystem, targetPath) {
  try {
    await fileSystem.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectoryEmpty(fileSystem, targetPath) {
  try {
    const contents = await fileSystem.readdir(targetPath);
    return contents.length === 0;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return true;
    }

    throw error;
  }
}

function escapeForVolumeMount(workspacePath) {
  return JSON.stringify(`${workspacePath}:/app`);
}

function generateComposeFile({ app, workspacePath, baseImage }) {
  const slug = app.workspaceSlug ?? deriveWorkspaceSlug(app.name);
  const portsBlock = app.port
    ? `    ports:\n      - \"${app.port}:${app.port}\"\n`
    : '';
  const commandBlock = app.startCommand
    ? `    command: [\"bash\", \"-lc\", ${JSON.stringify(app.startCommand)}]\n`
    : '';

  return `version: '3.9'\nservices:\n  app:\n    image: ${baseImage}\n    container_name: dcc-${slug}\n    restart: unless-stopped\n    working_dir: /app\n    volumes:\n      - ${escapeForVolumeMount(workspacePath)}\n${portsBlock}${commandBlock}    deploy:\n      resources:\n        reservations:\n          devices:\n            - driver: nvidia\n              capabilities: [gpu]\n`;
}

function resolveWorkspacePaths(workspaceRoot, app) {
  const workspaceSlug = app.workspaceSlug ?? deriveWorkspaceSlug(app.name);
  const workspacePath = path.join(workspaceRoot, workspaceSlug);
  const composePath = path.join(workspacePath, 'docker-compose.yaml');

  return { workspaceSlug, workspacePath, composePath };
}

function resolveContainerName(app) {
  const slug = app.workspaceSlug ?? deriveWorkspaceSlug(app.name);
  return `dcc-${slug}`;
}

async function fetchAppOrThrow(prisma, appId) {
  const app = await prisma.app.findUnique({ where: { id: appId } });

  if (!app) {
    throw new AppValidationError('Application not found.', {
      field: 'appId',
      reason: 'not-found'
    });
  }

  return app;
}

export class AppLifecycleManager {
  constructor({
    prisma,
    workspaceRoot = DEFAULT_WORKSPACE_ROOT,
    baseImage = DEFAULT_BASE_IMAGE,
    commandRunner,
    fileSystem = fs,
    logger = console
  }) {
    if (!prisma) {
      throw new Error('Prisma client instance is required.');
    }

    this.prisma = prisma;
    this.workspaceRoot = workspaceRoot;
    this.baseImage = baseImage;
    this.commandRunner = commandRunner ?? createDefaultRunner(logger);
    this.fs = fileSystem;
    this.logger = logger;
  }

  async registerApp(input) {
    const validated = validateRegistrationPayload(input);
    const workspaceSlug = deriveWorkspaceSlug(validated.name);

    const [nameConflict, slugConflict] = await Promise.all([
      this.prisma.app.findUnique({ where: { name: validated.name } }),
      this.prisma.app.findUnique({ where: { workspaceSlug } })
    ]);

    if (nameConflict) {
      throw new AppValidationError('Application name already exists.', {
        field: 'name',
        reason: 'duplicate'
      });
    }

    if (slugConflict) {
      throw new AppValidationError('Derived workspace slug already exists. Choose a different name.', {
        field: 'name',
        reason: 'workspace-conflict',
        workspaceSlug
      });
    }

    let template = null;

    if (input?.templateId) {
      template = await this.prisma.marketplaceTemplate.findUnique({
        where: { id: input.templateId }
      });

      if (!template) {
        throw new AppValidationError('Marketplace template not found.', {
          field: 'templateId',
          reason: 'not-found'
        });
      }
    } else if (input?.templateName) {
      template = await this.prisma.marketplaceTemplate.findUnique({
        where: { name: input.templateName }
      });

      if (!template) {
        throw new AppValidationError('Marketplace template not found.', {
          field: 'templateName',
          reason: 'not-found'
        });
      }
    }

    const merged = mergeTemplateDefaults(template, validated);

    const record = await this.prisma.app.create({
      data: {
        name: merged.name,
        workspaceSlug,
        repositoryUrl: merged.repositoryUrl,
        port: merged.port,
        status: 'STOPPED',
        healthEndpoint: merged.healthEndpoint,
        startCommand: merged.startCommand,
        notes: merged.notes
      }
    });

    return record;
  }

  async installApp(appId, { skipClone = false } = {}) {
    const app = await fetchAppOrThrow(this.prisma, appId);
    const { workspaceSlug, workspacePath, composePath } = resolveWorkspacePaths(
      this.workspaceRoot,
      app
    );

    await this.fs.mkdir(this.workspaceRoot, { recursive: true });
    await this.prisma.app.update({
      where: { id: app.id },
      data: {
        status: 'INSTALLING',
        workspaceSlug
      }
    });

    try {
      if (!skipClone && app.repositoryUrl) {
        await this.syncRepository(app.repositoryUrl, workspacePath);
      } else {
        await this.fs.mkdir(workspacePath, { recursive: true });
      }

      const composeContent = generateComposeFile({
        app: { ...app, workspaceSlug },
        workspacePath,
        baseImage: this.baseImage
      });

      await this.fs.writeFile(composePath, composeContent, 'utf8');

      await this.commandRunner('docker', ['pull', this.baseImage]);

      await this.commandRunner('docker', ['compose', '-f', composePath, 'up', '-d'], {
        cwd: workspacePath,
        env: {
          ...process.env,
          COMPOSE_PROJECT_NAME: `dcc-${workspaceSlug}`
        }
      });

      await this.prisma.app.update({
        where: { id: app.id },
        data: {
          status: 'RUNNING',
          lastSeenAt: new Date(),
          workspaceSlug
        }
      });

      return {
        workspacePath,
        composePath
      };
    } catch (error) {
      await this.prisma.app.update({
        where: { id: app.id },
        data: {
          status: 'FAILED'
        }
      });

      throw new InstallationError('Failed to install application.', {
        cause: error
      });
    }
  }

  async startApp(appId) {
    const app = await fetchAppOrThrow(this.prisma, appId);
    const { workspaceSlug, workspacePath, composePath } = resolveWorkspacePaths(
      this.workspaceRoot,
      app
    );

    const composeExists = await pathExists(this.fs, composePath);

    if (!composeExists) {
      throw new InstallationError('Docker Compose manifest not found.', {
        composePath
      });
    }

    const appWithSlug = { ...app, workspaceSlug };
    const containerName = resolveContainerName(appWithSlug);

    await this.commandRunner('docker', ['compose', '-f', composePath, 'up', '-d'], {
      cwd: workspacePath,
      env: {
        ...process.env,
        COMPOSE_PROJECT_NAME: containerName
      }
    });

    await this.prisma.app.update({
      where: { id: app.id },
      data: {
        status: 'RUNNING',
        lastSeenAt: new Date(),
        workspaceSlug
      }
    });

    return { workspacePath, composePath };
  }

  async stopApp(appId, { removeVolumes = false } = {}) {
    const app = await fetchAppOrThrow(this.prisma, appId);
    const { workspaceSlug, workspacePath, composePath } = resolveWorkspacePaths(
      this.workspaceRoot,
      app
    );

    const composeExists = await pathExists(this.fs, composePath);
    const appWithSlug = { ...app, workspaceSlug };
    const containerName = resolveContainerName(appWithSlug);

    if (composeExists) {
      const args = ['compose', '-f', composePath, 'down', '--remove-orphans'];
      if (removeVolumes) {
        args.push('--volumes');
      }

      try {
        await this.commandRunner('docker', args, {
          cwd: workspacePath,
          env: {
            ...process.env,
            COMPOSE_PROJECT_NAME: containerName
          }
        });
      } catch (error) {
        throw new InstallationError('Failed to stop application.', {
          cause: error
        });
      }
    } else {
      this.logger?.warn?.(
        `Compose manifest missing for ${app.name}; skipping docker compose down.`
      );
    }

    await this.prisma.app.update({
      where: { id: app.id },
      data: {
        status: 'STOPPED',
        lastSeenAt: null,
        workspaceSlug
      }
    });

    if (this.prisma?.dockerContainerState?.upsert) {
      await this.prisma.dockerContainerState.upsert({
        where: { appId: app.id },
        update: {
          containerName,
          status: 'STOPPED',
          health: null,
          state: null,
          metrics: null,
          lastObservedAt: new Date()
        },
        create: {
          appId: app.id,
          containerId: containerName,
          containerName,
          status: 'STOPPED',
          health: null,
          state: null,
          metrics: null,
          lastObservedAt: new Date()
        }
      });
    }

    return { workspacePath, composePath };
  }

  async restartApp(appId) {
    const app = await fetchAppOrThrow(this.prisma, appId);
    const { workspaceSlug, workspacePath, composePath } = resolveWorkspacePaths(
      this.workspaceRoot,
      app
    );

    const composeExists = await pathExists(this.fs, composePath);

    if (!composeExists) {
      throw new InstallationError('Docker Compose manifest not found.', {
        composePath
      });
    }

    const appWithSlug = { ...app, workspaceSlug };
    const containerName = resolveContainerName(appWithSlug);

    await this.commandRunner('docker', ['compose', '-f', composePath, 'restart'], {
      cwd: workspacePath,
      env: {
        ...process.env,
        COMPOSE_PROJECT_NAME: containerName
      }
    });

    await this.prisma.app.update({
      where: { id: app.id },
      data: {
        status: 'RUNNING',
        lastSeenAt: new Date(),
        workspaceSlug
      }
    });

    return { workspacePath, composePath };
  }

  async reinstallApp(appId, { skipClone = false } = {}) {
    try {
      await this.stopApp(appId);
    } catch (error) {
      this.logger?.warn?.(`Failed to stop app ${appId} before reinstall.`, error);
    }

    return this.installApp(appId, { skipClone });
  }

  async deinstallApp(appId, { removeVolumes = true } = {}) {
    const app = await fetchAppOrThrow(this.prisma, appId);
    const { workspaceSlug, workspacePath, composePath } = resolveWorkspacePaths(
      this.workspaceRoot,
      app
    );

    try {
      await this.stopApp(appId, { removeVolumes });
    } catch (error) {
      this.logger?.warn?.(`Failed to stop app ${appId} during deinstall.`, error);
    }

    if (this.prisma?.dockerContainerState?.delete) {
      try {
        await this.prisma.dockerContainerState.delete({ where: { appId: app.id } });
      } catch (error) {
        this.logger?.debug?.(
          `No container state to delete for app ${app.id}; continuing.`,
          error
        );
      }
    }

    await this.fs.rm(workspacePath, { recursive: true, force: true });

    await this.prisma.app.update({
      where: { id: app.id },
      data: {
        status: 'STOPPED',
        lastSeenAt: null,
        workspaceSlug
      }
    });

    return { workspacePath, composePath };
  }

  async syncRepository(repositoryUrl, workspacePath) {
    const gitFolder = path.join(workspacePath, '.git');
    const gitExists = await pathExists(this.fs, gitFolder);

    if (gitExists) {
      await this.commandRunner('git', ['-C', workspacePath, 'fetch', '--all', '--prune']);
      await this.commandRunner('git', ['-C', workspacePath, 'reset', '--hard', 'origin/HEAD']);
      return;
    }

    const directoryIsEmpty = await isDirectoryEmpty(this.fs, workspacePath);

    if (!directoryIsEmpty) {
      throw new InstallationError('Workspace directory is not empty and is not a Git repository.', {
        workspacePath
      });
    }

    const parent = path.dirname(workspacePath);
    await this.fs.mkdir(parent, { recursive: true });

    await this.commandRunner('git', ['clone', repositoryUrl, workspacePath], {
      cwd: parent
    });
  }
}

export function createAppLifecycleManager(options) {
  return new AppLifecycleManager(options);
}
