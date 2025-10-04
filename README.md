# Docker Control Center (DCC)

A lightweight control plane for hosting GPU-accelerated AI applications on demand.

## Features
- Interactive "Add App" dialog that saves onboarding metadata as reusable marketplace templates in the browser until the backend API is connected.
- Marketplace dialog with local templates that can be deployed (green play), edited (blue **E**), or terminated (red **X**) before backend persistence arrives.
- Telemetry orchestrator that normalizes Docker runtime state, stores it in Prisma (`DockerContainerState`), and keeps marketplace entries plus container health entirely in the database.
- Application fleet table with open-app quick links, start/stop/reinstall/deinstall controls, and traffic-light health signals (red/offline, yellow/installing, green/online/port reachable).
- Mini settings tab persisted via `AppSettings` so operators can store custom Open App base URLs (e.g., `http://my-host`) without editing environment files.
- Isolated `/opt/dockerstore/<app>` workspaces mounted into containers at `/app`.
- Node.js installer that verifies Docker, runs Prisma migrations/seeding, builds the deluxe dashboard preview, mirrors the Git checkout (including `.git`) to `/opt/dcc`, and launches the bundled dashboard server.
- App lifecycle framework that validates onboarding payloads, derives deterministic workspace slugs, syncs Git repositories, renders Docker Compose definitions, and drives `docker compose up -d` to install workloads.

## Quick Start
```bash
# Clone the repository and move into it
git clone https://github.com/example/DockerControllCenter.git
cd DockerControllCenter

# Install dependencies and set up the database + deluxe dashboard preview
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run build

# Start the backend API (new terminal recommended)
npm run api:start

# Launch the dashboard preview (separate terminal)
npm start
```

## Backend API
- Express-based service exposing lifecycle, telemetry, and marketplace endpoints under `http://localhost:${DCC_API_PORT:-4000}`.
- Returns normalized Prisma records with parsed telemetry metrics and derived `openAppUrl` helpers.
- Provides lifecycle helpers (`/apps/:id/install|start|stop|restart|reinstall`), settings updates, template CRUD, and `/telemetry/collect` for on-demand Docker polling.

Refer to [`docs/api.md`](docs/api.md) for detailed request/response examples and error semantics.

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
| `DCC_API_PORT` | `4000` | HTTP port for the Express backend API. |
| `DCC_API_CORS_ORIGIN` | `*` | Allowed origin(s) for API CORS requests. |
| `DCC_API_AUTOSTART_TELEMETRY` | `false` | Set to `true` to launch periodic Docker telemetry polling on boot. |
| `DCC_REFRESH_INTERVAL` | `auto` | Frontend polling/streaming strategy; must avoid full page refresh loops. |
| `DCC_INSTALL_DIR` | `/opt/dcc` | Target directory used by the setup automation for deploying build artifacts. |

> Document additional environment variables in `/docs/configuration.md` as they are introduced.

## Usage
1. Open the dashboard and use **Add App** to capture app metadata; entries persist in browser storage and populate the marketplace dialog instantly.
2. Launch saved templates with the green **Deploy** action, edit them via the blue **E**, or remove them with the red **X**. Deployed templates now populate the fleet table to simulate an install until the backend arrives.
3. Once the API is available, submitting the form will trigger repository cloning into `/opt/dockerstore/<appname>` and Compose generation.
4. Monitor build progress and container readiness directly in the dashboard. Lifecycle controls (Start, Stop, Restart, Reinstall, Deinstall) now invoke the backend `AppLifecycleManager`, which shells out to Docker to operate on each app's Compose stack while status lamps track progress (green = reachable).
5. Promote successful installs into the marketplace dialog for future reuse.

### Programmatic API

The `AppLifecycleManager` encapsulates the documented workflow for registering and installing applications.

```js
import { AppLifecycleManager } from 'docker-control-center';

const manager = new AppLifecycleManager({ prisma });

const app = await manager.registerApp({
  name: 'My GPU App',
  repositoryUrl: 'https://github.com/example/gpu-app.git',
  startCommand: 'python launch.py --listen',
  port: 7860
});

await manager.installApp(app.id);

// Manage the stack in response to dashboard actions
await manager.startApp(app.id);
await manager.restartApp(app.id);
await manager.stopApp(app.id);
await manager.reinstallApp(app.id);
await manager.deinstallApp(app.id);
```

The manager enforces validation rules, derives a sanitized `workspaceSlug`, writes a GPU-ready Compose file under `/opt/dockerstore/<slug>/docker-compose.yaml`, and executes `docker compose up -d` to provision the service.

The `DockerOrchestrator` keeps the dashboard informed without additional configuration files by persisting telemetry snapshots to Prisma and managing Open App links.

```js
import { DockerOrchestrator } from 'docker-control-center';

const orchestrator = new DockerOrchestrator({ prisma });

await orchestrator.collectTelemetry();
await orchestrator.updateOpenAppBaseUrl(app.id, 'http://edge-gateway');
```

`collectTelemetry()` polls Docker (`ps`, `inspect`, `stats`) and stores normalized results in the `DockerContainerState` table while updating app statuses. `updateOpenAppBaseUrl()` persists operator-provided hosts so the UI can build `http://host:port` launch links purely from database data.

### Database

- Prisma schema lives in `prisma/schema.prisma` and targets SQLite by default.
- Docker telemetry snapshots (`state`, `metrics`) are stored as JSON-encoded text to keep SQLite compatibility; parse before using them downstream.
- Seed routine (`prisma/seed.js`) now removes legacy demo entries so you always start from a clean slate before onboarding your own apps.
- Override the `DATABASE_URL` environment variable to point at production-grade storage. The setup automation falls back to `file:/opt/dcc/data/dcc.sqlite` when none is provided.

Detailed lifecycle and automation guidance lives in [`docs/architecture-overview.md`](docs/architecture-overview.md).

## Development
- Run `npm run build` to regenerate the deluxe placeholder UI assets in `dist/`.
- Execute `npm test` to exercise the lifecycle manager workflow using in-memory Prisma doubles.
- Align UI work with the responsive dashboard requirements outlined in the architecture overview.
- Add integration tests around compose generation and container health checks once implementation lands.
- Keep documentation updated alongside feature work.

## Changelog
See [`Changelog/Changelog.md`](Changelog/Changelog.md).

## License
TBD.
