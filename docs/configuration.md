# Configuration Reference

The Docker Control Center (DCC) relies on environment variables to orchestrate GPU-ready application containers. Configure these values through your deployment platform (e.g., systemd unit, Docker Compose, Kubernetes secrets).

| Variable | Purpose | Notes |
| --- | --- | --- |
| `DCC_STORAGE_ROOT` | Directory hosting application workspaces (`/opt/dockerstore` by default). | Must be writable by the DCC runtime and large enough to store cloned repositories and generated artifacts. |
| `DCC_INSTALL_DIR` | Target directory for setup automation deployments (`/opt/dcc` by default). | Override when `/opt` is restricted or to stage multiple environments. |
| `DCC_BASE_IMAGE` | NVIDIA-enabled Docker image tag for generated services. | Use images compatible with the NVIDIA Container Toolkit and target CUDA version. |
| `DCC_DASHBOARD_PORT` | Exposed HTTP port for the operator dashboard. | Configure reverse proxy if public access is required. |
| `DCC_REFRESH_INTERVAL` | Controls UI update cadence (e.g., websocket, SSE, polling). | Favor streaming mechanisms to avoid full page reloads. |
| `DCC_ALLOWED_REPOS` | Optional allowlist of Git hosts or orgs. | Enforce compliance and security policies. |
| `DCC_LOG_LEVEL` | Logging verbosity (`info`, `debug`, etc.). | Increase temporarily for troubleshooting. |

## File System Layout
```
/opt/dockerstore/
  <app-name>/
    requirements.txt (or custom name)
    docker-compose.yml (generated)
    metadata.json
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
- Emit metrics for container lifecycle events, GPU usage, and onboarding errors.
