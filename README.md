# Docker Control Center (DCC)

A lightweight control plane for hosting GPU-accelerated AI applications on demand.

## Features
- Guided "Add App" dialog prepared for validating metadata and provisioning GPU-ready Docker Compose stacks.
- Marketplace dialog that surfaces previously installed apps as reusable templates stored in Prisma + SQLite.
- Application fleet table with start/stop/reinstall/deinstall controls and traffic-light health signals (red/offline, yellow/installing, green/online/port reachable).
- Isolated `/opt/dockerstore/<app>` workspaces mounted into containers at `/app`.
- Node.js installer that verifies Docker, runs Prisma migrations/seeding, builds the deluxe dashboard preview, mirrors the Git checkout (including `.git`) to `/opt/dcc`, and launches the bundled dashboard server.

## Quick Start
```bash
# Clone the repository and move into it
git clone https://github.com/example/DockerControllCenter.git
cd DockerControllCenter

# Prepare environment variables for Prisma
cp .env.example .env

# Install dependencies and set up the database + deluxe dashboard preview
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run build
npm start
```

Need to undo the setup? Execute `node scripts/setup.js --rollback` to restore the previous state. The installer creates `/opt/dcc/app` for the built dashboard, `/opt/dcc/repo` with the full Git clone (ready for `git pull`), `/opt/dcc/data` for runtime files (including `dcc.sqlite`), runs Prisma migrations/seeding automatically, and starts the static dashboard server on `http://localhost:${DCC_DASHBOARD_PORT:-8080}`.

## Setup Automation
The installer orchestrates prerequisite checks, Docker package installation (via `apt-get` when
missing), build execution, and artifact deployment. It records its actions to support a full
rollback flow that removes files and Docker packages it introduced. Configure the destination with
`DCC_INSTALL_DIR` or accept the default `/opt/dcc`. Detailed guidance lives in
[`docs/setup.md`](docs/setup.md).

## Configuration
| Variable | Default | Description |
| --- | --- | --- |
| `DCC_STORAGE_ROOT` | `/opt/dockerstore` | Root directory for application checkouts mounted into containers. |
| `DCC_BASE_IMAGE` | `nvcr.io/nvidia/pytorch:latest` | GPU-enabled base image used in generated Docker Compose files. |
| `DCC_DASHBOARD_PORT` | `8080` | HTTP port for serving the control center dashboard. |
| `DCC_REFRESH_INTERVAL` | `auto` | Frontend polling/streaming strategy; must avoid full page refresh loops. |
| `DCC_INSTALL_DIR` | `/opt/dcc` | Target directory used by the setup automation for deploying build artifacts. |

> Document additional environment variables in `/docs/configuration.md` as they are introduced.

## Usage
1. Open the dashboard and choose **Add App** to launch the registration dialog.
2. Provide the application name, Git repository URL, container start command, and service port. Attach or reuse a marketplace template to speed up provisioning.
3. Submit the form to trigger repository cloning into `/opt/dockerstore/<appname>` and Compose generation.
4. Monitor build progress and container readiness directly in the dashboard. Status lamps turn green once the configured port responds.
5. Promote successful installs into the marketplace dialog for future reuse.

### Database

- Prisma schema lives in `prisma/schema.prisma` and targets SQLite by default.
- Seed data (`prisma/seed.js`) provisions a **Stable Diffusion Demo** entry so the marketplace and fleet table render meaningful placeholders.
- Override the `DATABASE_URL` environment variable to point at production-grade storage. The setup automation falls back to `file:/opt/dcc/data/dcc.sqlite` when none is provided.

Detailed lifecycle and automation guidance lives in [`docs/architecture-overview.md`](docs/architecture-overview.md).

## Development
- Run `npm run build` to regenerate the deluxe placeholder UI assets in `dist/`.
- Align UI work with the responsive dashboard requirements outlined in the architecture overview.
- Add integration tests around compose generation and container health checks once implementation lands.
- Keep documentation updated alongside feature work.

## Changelog
See [`Changelog/Changelog.md`](Changelog/Changelog.md).

## License
TBD.
