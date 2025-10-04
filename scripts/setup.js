#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const DEFAULT_INSTALL_DIR = '/opt/dcc';
const INSTALL_DIR = process.env.DCC_INSTALL_DIR || DEFAULT_INSTALL_DIR;
const STATE_FILE = path.join(INSTALL_DIR, '.dcc-install-state.json');
const DASHBOARD_PORT = parseInt(process.env.DCC_DASHBOARD_PORT || '8080', 10);

function usage() {
  console.log(`Docker Control Center setup\n\n` +
    `Usage:\n  node scripts/setup.js --install\n  node scripts/setup.js --rollback\n\n` +
    `Environment:\n  DCC_INSTALL_DIR  Override target directory (default: ${DEFAULT_INSTALL_DIR})\n`);
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
    ...options
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const joined = [command, ...args].join(' ');
    throw new Error(`Command failed (${result.status}): ${joined}`);
  }
}

function commandExists(binary) {
  const result = spawnSync('which', [binary], { stdio: 'pipe' });
  return result.status === 0;
}

function ensureDockerAvailability(state) {
  const dockerPresent = commandExists('docker');
  const composePresent = spawnSync('docker', ['compose', 'version'], { stdio: 'pipe' }).status === 0;

  if (dockerPresent && composePresent) {
    console.log('✓ Docker and docker compose plugin detected.');
    state.installedDocker = false;
    state.installedComposePlugin = false;
    return;
  }

  const distro = detectDistro();
  if (distro !== 'debian') {
    throw new Error('Automatic Docker installation is only supported on Debian/Ubuntu hosts.');
  }

  console.log('⚙️  Installing Docker engine and compose plugin (requires sudo privileges)...');
  runCommand('apt-get', ['update']);
  runCommand('apt-get', ['install', '-y', 'docker.io', 'docker-compose-plugin']);

  state.installedDocker = !dockerPresent;
  state.installedComposePlugin = !composePresent;

  const postCheck = spawnSync('docker', ['--version'], { stdio: 'pipe' });
  if (postCheck.status !== 0) {
    throw new Error('Docker installation appears to have failed.');
  }
  console.log('✓ Docker engine ready.');
}

function detectDistro() {
  if (fs.existsSync('/etc/os-release')) {
    const contents = fs.readFileSync('/etc/os-release', 'utf8');
    if (/ID=debian|ID=ubuntu/.test(contents)) {
      return 'debian';
    }
  }
  return 'unknown';
}

function runBuildPipeline() {
  console.log('⚙️  Installing Node dependencies...');
  runCommand('npm', ['install'], { cwd: projectRoot });
  console.log('⚙️  Running build...');
  runCommand('npm', ['run', 'build'], { cwd: projectRoot });
}

function getProjectVersion() {
  const pkgPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return 'unknown';
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || 'unknown';
  } catch (error) {
    console.warn('⚠️  Unable to read package version:', error.message);
    return 'unknown';
  }
}

function backupExistingInstall(state) {
  if (!fs.existsSync(INSTALL_DIR)) {
    state.createdInstallDir = true;
    fs.mkdirSync(INSTALL_DIR, { recursive: true });
    return;
  }

  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dcc-backup-'));
  console.log(`⚠️  Existing install detected. Taking backup snapshot at ${backupRoot}`);
  copyRecursive(INSTALL_DIR, backupRoot);
  state.previousInstallBackup = backupRoot;
}

function copyRecursive(source, destination, options = {}) {
  const { shouldSkip } = options;
  fs.mkdirSync(destination, { recursive: true });
  const entries = fs.readdirSync(source, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldSkip && shouldSkip(source, entry)) {
      continue;
    }
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath, options);
    } else if (entry.isSymbolicLink()) {
      const link = fs.readlinkSync(srcPath);
      fs.symlinkSync(link, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function deployArtifacts() {
  const distDir = path.join(projectRoot, 'dist');
  if (!fs.existsSync(distDir)) {
    throw new Error('Build artifacts not found. Ensure npm run build succeeded.');
  }

  const targetDir = path.join(INSTALL_DIR, 'app');
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  copyRecursive(distDir, targetDir);
  console.log(`✓ Deployed build artifacts to ${targetDir}`);
}

function syncRepositoryMirror() {
  const repoTarget = path.join(INSTALL_DIR, 'repo');
  if (fs.existsSync(repoTarget)) {
    fs.rmSync(repoTarget, { recursive: true, force: true });
  }

  const skipNames = new Set(['node_modules', 'dist']);
  copyRecursive(projectRoot, repoTarget, {
    shouldSkip: (_source, entry) => skipNames.has(entry.name)
  });

  console.log(`✓ Repository mirror (including .git) synced to ${repoTarget}`);
  return repoTarget;
}

function ensureRuntimeDirectories() {
  const dataDir = path.join(INSTALL_DIR, 'data');
  const logDir = path.join(INSTALL_DIR, 'logs');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });
  console.log(`✓ Runtime directories ready under ${INSTALL_DIR}`);
  return { dataDir, logDir };
}

function startDashboardServer(state, repoDir, logDir) {
  const serverScript = path.join(repoDir, 'scripts', 'serve.js');
  if (!fs.existsSync(serverScript)) {
    throw new Error('Dashboard server script not found. Expected scripts/serve.js in repo mirror.');
  }

  const logPath = path.join(logDir, 'dashboard.log');
  const out = fs.openSync(logPath, 'a');
  const err = fs.openSync(logPath, 'a');

  const child = spawn('node', [serverScript, '--root', path.join(INSTALL_DIR, 'app'), '--port', String(DASHBOARD_PORT)], {
    cwd: repoDir,
    detached: true,
    stdio: ['ignore', out, err],
    env: {
      ...process.env,
      DCC_INSTALL_DIR: INSTALL_DIR,
      DCC_DASHBOARD_PORT: String(DASHBOARD_PORT)
    }
  });

  child.unref();
  fs.closeSync(out);
  fs.closeSync(err);
  state.serverPid = child.pid;
  state.serverPort = DASHBOARD_PORT;
  state.serverLog = logPath;
  console.log(`✓ Dashboard server started on port ${DASHBOARD_PORT} (PID ${child.pid}).`);
}

function stopExistingServer() {
  if (!fs.existsSync(STATE_FILE)) {
    return;
  }

  try {
    const previous = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (previous.serverPid) {
      process.kill(previous.serverPid, 'SIGTERM');
      console.log(`↩️  Stopped previous dashboard server (PID ${previous.serverPid}).`);
    }
  } catch (error) {
    console.warn('⚠️  Unable to stop previous server:', error.message);
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function readState() {
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error('No install state found. Nothing to roll back.');
  }
  const raw = fs.readFileSync(STATE_FILE, 'utf8');
  return JSON.parse(raw);
}

function rollback() {
  console.log('🔄 Starting rollback...');
  const state = readState();

  if (state.serverPid) {
    try {
      process.kill(state.serverPid, 'SIGTERM');
      console.log(`🛑 Dashboard server process ${state.serverPid} terminated.`);
    } catch (error) {
      console.warn(`⚠️  Failed to terminate dashboard server ${state.serverPid}: ${error.message}`);
    }
  }

  if (state.installDir && state.installDir !== INSTALL_DIR) {
    console.warn(`⚠️  Install directory mismatch. State references ${state.installDir} but current configuration targets ${INSTALL_DIR}. Proceeding with current target.`);
  }

  if (state.previousInstallBackup) {
    console.log('↩️  Restoring previous install snapshot...');
    if (fs.existsSync(INSTALL_DIR)) {
      fs.rmSync(INSTALL_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(path.dirname(INSTALL_DIR), { recursive: true });
    copyRecursive(state.previousInstallBackup, INSTALL_DIR);
    console.log('✓ Previous install restored.');
    fs.rmSync(state.previousInstallBackup, { recursive: true, force: true });
  } else if (state.createdInstallDir && fs.existsSync(INSTALL_DIR)) {
    console.log('🧹 Removing installation directory...');
    fs.rmSync(INSTALL_DIR, { recursive: true, force: true });
  }

  if (state.installedDocker || state.installedComposePlugin) {
    console.log('🧼 Removing Docker components that were installed by setup...');
    runCommand('apt-get', ['remove', '-y', 'docker.io', 'docker-compose-plugin']);
  }

  fs.rmSync(STATE_FILE, { force: true });
  console.log('✓ Rollback complete.');
}

function install() {
  const state = {
    timestamp: new Date().toISOString(),
    installedDocker: false,
    installedComposePlugin: false,
    createdInstallDir: false,
    installDir: INSTALL_DIR,
    projectVersion: getProjectVersion()
  };

  ensureDockerAvailability(state);
  runBuildPipeline();
  stopExistingServer();
  backupExistingInstall(state);
  deployArtifacts();
  const repoDir = syncRepositoryMirror();
  const runtimeDirs = ensureRuntimeDirectories();
  state.repoDir = repoDir;
  state.dataDir = runtimeDirs.dataDir;
  state.logDir = runtimeDirs.logDir;
  try {
    startDashboardServer(state, repoDir, runtimeDirs.logDir);
  } catch (error) {
    console.warn(`⚠️  Dashboard server failed to start: ${error.message}`);
  }
  writeState(state);
  console.log('✓ Install completed successfully.');
  console.log(`ℹ️  Installation directory: ${INSTALL_DIR}`);
  console.log('Run `node scripts/setup.js --rollback` to revert.');
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--install')) {
    install();
    return;
  }

  if (args.includes('--rollback')) {
    rollback();
    return;
  }

  usage();
  process.exitCode = 1;
}

main();
