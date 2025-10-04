# Backend API Reference

The Docker Control Center (DCC) backend API exposes lifecycle automation, telemetry, and marketplace
management over HTTP. The service is a lightweight Express server that wraps the
`AppLifecycleManager` and `DockerOrchestrator` classes.

- **Base URL:** `http://localhost:${DCC_API_PORT:-4000}`
- **Authentication:** Not yet implemented (deploy behind your network perimeter).
- **Content Type:** `application/json`

## Quick Start

```bash
# Start the API (requires DATABASE_URL and Prisma migrations)
npm run api:start

# Register a new application
curl -X POST http://localhost:4000/apps \
  -H "Content-Type: application/json" \
  -d '{
        "name": "Stable Diffusion",
        "repositoryUrl": "https://github.com/example/stable-diffusion.git",
        "port": 7860,
        "startCommand": "python launch.py --listen",
        "install": true,
        "skipClone": true
      }'
```

## Responses and Errors

Successful requests return a `data` payload. Failures return an `error` object with
an RFC-7807 style structure:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Application name already exists.",
    "details": { "field": "name" }
  }
}
```

| Error Code | HTTP Status | Description |
| --- | --- | --- |
| `validation_error` | 400 / 404 | Invalid request payload or missing records. |
| `installation_error` | 409 | Docker/installation failure. |
| `internal_error` | 500 | Unexpected server error. |

## Endpoints

### Health

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/healthz` | Returns `{ "status": "ok" }` for readiness/liveness probes. |

### Applications

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/apps` | List apps with container state, settings, and derived `openAppUrl`. |
| `GET` | `/apps/:id` | Fetch a single app by ID. |
| `POST` | `/apps` | Register a new app. Include `install: true` to immediately install. |
| `POST` | `/apps/:id/install` | Install or reinstall the workspace (`skipClone` optional). |
| `POST` | `/apps/:id/start` | Start the Compose stack. |
| `POST` | `/apps/:id/stop` | Stop the stack (`removeVolumes` optional, default `false`). |
| `POST` | `/apps/:id/restart` | Restart the stack in place. |
| `POST` | `/apps/:id/reinstall` | Stop, recreate, and start the stack (`skipClone` optional). |
| `DELETE` | `/apps/:id` | Tear down containers and clean the workspace (`removeVolumes` optional, default `true`). |
| `PATCH` | `/apps/:id/settings` | Update persisted settings such as `openAppBaseUrl`. |

**Request Body – `POST /apps`**

```json
{
  "name": "Stable Diffusion",
  "repositoryUrl": "https://github.com/example/sd.git",
  "startCommand": "python launch.py --listen",
  "port": 7860,
  "healthEndpoint": "/healthz",
  "notes": "GPU heavy",
  "install": true,
  "skipClone": false
}
```

**Response – `GET /apps/:id`**

```json
{
  "data": {
    "id": "app_123",
    "name": "Stable Diffusion",
    "workspaceSlug": "stable-diffusion",
    "status": "RUNNING",
    "port": 7860,
    "openAppBaseUrl": "http://edge-gateway",
    "openAppUrl": "http://edge-gateway:7860",
    "containerStates": [
      {
        "containerName": "dcc-stable-diffusion",
        "status": "RUNNING",
        "metrics": { "cpuPercent": 12.4 },
        "state": { "Status": "running" }
      }
    ]
  }
}
```

### Marketplace Templates

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/templates` | List marketplace templates. |
| `GET` | `/templates/:id` | Fetch a single template. |
| `POST` | `/templates` | Create a template (`name` required). |
| `PATCH` | `/templates/:id` | Update a template. |
| `DELETE` | `/templates/:id` | Delete a template. |

### Telemetry

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/telemetry/collect` | Trigger a one-off Docker telemetry sweep. |

The server can also auto-start periodic polling when `DCC_API_AUTOSTART_TELEMETRY=true`.

## Derived Fields

- `openAppUrl` combines `openAppBaseUrl` (from `App` or `AppSettings`) with the app port.
- `containerStates[].metrics` and `containerStates[].state` are parsed JSON objects even
  though they are stored as strings in SQLite.

## Operational Notes

- The API reuses the Prisma client; ensure `DATABASE_URL` points to a migrated schema.
- All lifecycle endpoints ultimately shell out to Docker; run the API with the necessary
  permissions (e.g., rootless Docker group membership).
- Wrap the service in an authenticating proxy before exposing it to untrusted networks.
