# Setup Automation

The Docker Control Center repository ships with a Node.js setup utility that provisions runtime
prerequisites, builds the placeholder UX, and deploys the artifacts under `/opt/dcc`.

## Prerequisites
- Node.js 18 or newer available on the PATH.
- Root or sudo privileges (required when installing Docker packages or writing to `/opt`).
- Debian/Ubuntu host. Automatic Docker installation is currently limited to apt-based systems.

## Installation
```bash
# Run from the repository root
node scripts/setup.js --install
```

The installer performs the following steps:
1. Verifies that the Docker Engine and the `docker compose` plugin are reachable.
2. Installs `docker.io` and `docker-compose-plugin` through `apt-get` when missing.
3. Installs Node.js dependencies for the repository and runs the build pipeline.
4. Takes a backup of any existing `/opt/dcc` deployment before deploying new assets.
5. Copies the freshly built assets into `/opt/dcc/app` and writes an install state file for rollback.

Set `DCC_INSTALL_DIR=/custom/path` to override the default target directory.

## Rollback
```bash
node scripts/setup.js --rollback
```

Rollback restores the previous `/opt/dcc` snapshot (when one existed), removes files that the
installer created, and uninstalls Docker components that the installer added. If no installation
state file is present the command aborts without making changes.
