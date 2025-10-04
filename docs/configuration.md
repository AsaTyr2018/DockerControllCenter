# Configuration Reference

The Docker Control Center (DCC) relies on environment variables to orchestrate GPU-ready application containers. Configure these values through your deployment platform (e.g., systemd unit, Docker Compose, Kubernetes secrets).

| Variable | Purpose | Notes |
| --- | --- | --- |
| `DCC_STORAGE_ROOT` | Directory hosting application workspaces (`/opt/dockerstore` by default). | Must be writable by the DCC runtime and large enough to store cloned repositories and generated artifacts. |
| `DCC_INSTALL_DIR` | Target directory for setup automation deployments (`/opt/dcc` by default). | Override when `/opt` is restricted or to stage multiple environments. |
| `DCC_BASE_IMAGE` | NVIDIA-enabled Docker image tag for generated services. | Use images compatible with the NVIDIA Container Toolkit and target CUDA version. |
| `DCC_DASHBOARD_PORT` | Exposed HTTP port for the operator dashboard. | Configure reverse proxy if public access is required. |
| `DCC_API_PORT` | HTTP port for the Express API (`4000` default). | Ensure the port is reachable from the dashboard/frontend. |
| `DCC_API_CORS_ORIGIN` | Allowed CORS origin(s) for the API. | Use a comma-separated list or `*` for development. |
| `DCC_API_AUTOSTART_TELEMETRY` | Enables background Docker telemetry polling when `true`. | Defaults to `false`; requires Docker access. |
| `DCC_REFRESH_INTERVAL` | Controls UI update cadence (e.g., websocket, SSE, polling). | Favor streaming mechanisms to avoid full page reloads. |
| `DCC_ALLOWED_REPOS` | Optional allowlist of Git hosts or orgs. | Enforce compliance and security policies. |
| `DCC_LOG_LEVEL` | Logging verbosity (`info`, `debug`, etc.). | Increase temporarily for troubleshooting. |
| `DATABASE_URL` | Prisma connection string. Defaults to SQLite under `/opt/dcc/data/dcc.sqlite`. | Point at PostgreSQL/MySQL for production or keep SQLite for embedded deployments. |

## Database-backed Settings
- Operator-facing preferences such as custom "Open App" hosts are persisted via Prisma (`AppSettings.openAppBaseUrl`).
- Container telemetry snapshots (status, health, resource metrics) live in `DockerContainerState`, allowing the UI to render dashboards without referencing environment files.
- Marketplace templates continue to live in the database (`MarketplaceTemplate`), keeping all runtime metadata centralized.

## File System Layout
```
/opt/dockerstore/
  <app-name>/
    requirements.txt (or custom name)
    docker-compose.yml (generated)
    metadata.json

/opt/dcc/
  app/   # Built dashboard assets served to operators
  repo/  # Mirrored Git clone (with .git) for updates and maintenance
  data/  # Runtime state and uploaded artifacts
    dcc.sqlite  # Default Prisma SQLite database
  logs/  # Dashboard server logs
```

## Networking
- Expose each application port via the generated Compose file.
- Map host ports to avoid collisions; consider dynamic allocation when scaling.
- Secure external access with TLS termination (Traefik, Nginx, etc.).

## GPU Access
- Install the NVIDIA Container Toolkit on the host.
- Validate GPU visibility with `docker run --rm --gpus all nvidia/cuda:11.8.0-base nvidia-smi` before onboarding workloads.

## Secrets Management
- Store credentials (e.g., private Git deploy keys) in a secret manager.
- Mount secrets into the worker runtime rather than checking them into repositories.

## Observability
- Forward container logs to centralized logging (ELK, Loki).
- The `DockerOrchestrator` already polls Docker for lifecycle/health data; surface additional metrics by exporting the `DockerContainerState` table to Prometheus/Grafana if needed.
- Emit metrics for container lifecycle events, GPU usage, and onboarding errors.
