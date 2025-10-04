# Setup Automation

The Docker Control Center repository ships with a Node.js setup utility that provisions runtime
prerequisites, builds the placeholder UX, deploys the artifacts under `/opt/dcc`, mirrors the Git
checkout (including `.git`) for future updates, initialises the SQLite database through Prisma,
and launches the bundled dashboard server.

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
4. Gracefully stops any previously launched dashboard server and snapshots the existing `/opt/dcc` deployment.
5. Copies the freshly built assets into `/opt/dcc/app`.
6. Creates `/opt/dcc/data` and `/opt/dcc/logs` for runtime use and audit trails.
7. Executes `prisma generate`, `prisma migrate deploy`, and `prisma db seed` with `DATABASE_URL` defaulting to `file:/opt/dcc/data/dcc.sqlite` unless you override it.
8. Mirrors the Git checkout into `/opt/dcc/repo` (including `.git`) so `git pull` can fetch updates in-place.
9. Launches the static dashboard server from the mirrored repository on `DCC_DASHBOARD_PORT` (default: 8080).
10. Writes an install state file for rollback (including server PID, log path, and database metadata).

Set `DCC_INSTALL_DIR=/custom/path` to override the default target directory.

## Rollback
```bash
node scripts/setup.js --rollback
```

Rollback restores the previous `/opt/dcc` snapshot (when one existed), stops the running dashboard
server, removes files that the installer created, and uninstalls Docker components that the
installer added. If no installation state file is present the command aborts without making changes.
