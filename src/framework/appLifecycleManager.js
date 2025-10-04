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
    const app = await this.prisma.app.findUnique({ where: { id: appId } });

    if (!app) {
      throw new AppValidationError('Application not found.', {
        field: 'appId',
        reason: 'not-found'
      });
    }

    const workspaceSlug = app.workspaceSlug ?? deriveWorkspaceSlug(app.name);
    const workspacePath = path.join(this.workspaceRoot, workspaceSlug);
    const composePath = path.join(workspacePath, 'docker-compose.yaml');

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
