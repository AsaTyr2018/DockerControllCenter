# Docker Control Center (DCC)

A lightweight control plane for hosting GPU-accelerated AI applications on demand.

## Features
- Register new AI services through a guided web form with validation.
- Provision standardized NVIDIA-enabled Docker Compose stacks per application.
- Mount isolated `/opt/dockerstore/<app>` workspaces into containers at `/app`.
- Surface live container status and launch URLs on a responsive dashboard without manual refresh cycles.

## Quick Start
```bash
# Clone the repository and review the documentation
git clone https://github.com/example/DockerControllCenter.git
cd DockerControllCenter

# Ensure Docker, Docker Compose, and the NVIDIA Container Toolkit are installed.
# Implementation details are tracked in docs/; runtime scripts are pending.
```

## Configuration
| Variable | Default | Description |
| --- | --- | --- |
| `DCC_STORAGE_ROOT` | `/opt/dockerstore` | Root directory for application checkouts mounted into containers. |
| `DCC_BASE_IMAGE` | `nvcr.io/nvidia/pytorch:latest` | GPU-enabled base image used in generated Docker Compose files. |
| `DCC_DASHBOARD_PORT` | `8080` | HTTP port for serving the control center dashboard. |
| `DCC_REFRESH_INTERVAL` | `auto` | Frontend polling/streaming strategy; must avoid full page refresh loops. |

> Document additional environment variables in `/docs/configuration.md` as they are introduced.

## Usage
1. Open the dashboard and choose **Add Application**.
2. Provide the application name, Git repository URL, optional requirements file name, container start command, and service port.
3. Submit the form to trigger repository cloning into `/opt/dockerstore/<appname>` and Compose generation.
4. Monitor build progress and container readiness directly in the dashboard. The service URL is listed once the stack is healthy.

Detailed lifecycle and automation guidance lives in [`docs/architecture-overview.md`](docs/architecture-overview.md).

## Development
- Align UI work with the responsive dashboard requirements outlined in the architecture overview.
- Add integration tests around compose generation and container health checks once implementation lands.
- Keep documentation updated alongside feature work.

## Changelog
See [`Changelog/Changelog.md`](Changelog/Changelog.md).

## License
TBD.
