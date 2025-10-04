# Docker Control Center Architecture Overview

## System Goals
- Provide a self-service platform for deploying GPU-enabled AI applications such as Stable Diffusion.
- Standardize runtime environments using a curated NVIDIA Tensor container image.
- Keep the operator dashboard responsive via push or light polling without full page reloads.
- Maintain reproducible application workspaces under `/opt/dockerstore/<appname>` for traceability.

## High-Level Workflow
1. **Application Registration**
   - Operator opens the **Add App** dialog and submits the onboarding form containing:
     - `name`: unique identifier for the application (persisted as `App.name`).
     - `repository`: Git URL to clone.
     - `start_command`: shell command executed inside the container at boot.
     - `port`: HTTP port exposed by the application and probed for reachability.
     - `template`: optional reference to a `MarketplaceTemplate` entry for pre-populated defaults.
   - Validation ensures name uniqueness, required fields, and marketplace template integrity via Prisma.
   - The static dashboard build stores submitted templates in browser storage while the backend API is finalized, allowing operators to refine metadata without touching the database.

2. **Workspace Provisioning**
   - Clone the Git repository into `/opt/dockerstore/<name>`.
   - Persist metadata (e.g., commit SHA, port, health status) for dashboard queries.
   - Generate a Docker Compose file referencing the default NVIDIA base image and mapping `/opt/dockerstore/<name>` to `/app`. The `AppLifecycleManager` encapsulates this logic, ensuring consistent GPU device reservations, restart policies, and deterministic workspace slugs.

3. **Container Orchestration**
   - Run `docker compose up -d` for the generated stack.
   - Monitor container logs, GPU resource allocation, and health checks.
   - Expose the configured port on the host, optionally with HTTPS termination upstream.

4. **Telemetry + Dashboard Visibility**
   - The `DockerOrchestrator` polls `docker ps`, `docker inspect`, and `docker stats` to capture runtime state for each managed container.
   - Telemetry snapshots are persisted through Prisma's `DockerContainerState` model so dashboard consumers read from the central database instead of environment files.
   - App records receive status updates (e.g., `RUNNING`, `FAILED`, `STOPPED`) and `lastSeenAt` timestamps whenever telemetry cycles complete.
   - Provide quick links to the hosted application and troubleshooting logs, including custom “Open App” URLs sourced from the database-backed `AppSettings` model.
   - Support lifecycle actions: start, stop, reinstall, deinstall, restart.
   - Display a traffic-light health indicator using Prisma-tracked status enums (`RUNNING`, `STARTING`, `STOPPED`) combined with periodic port reachability checks and orchestrator health data.

5. **Marketplace Reuse**
- Completed installs can promote their metadata into `MarketplaceTemplate` records.
- The marketplace dialog lists locally captured templates immediately and will transition to Prisma-backed data once lifecycle promotion is wired up.
- Templates store summaries, repository URLs, default ports, GPU requirements, and refer back to the originating app when available.
- The static dashboard preview now lets operators "Deploy" a saved template to simulate an install and visualize the fleet table before the backend is connected.

## Component Responsibilities
| Component | Responsibility |
| --- | --- |
| Web Frontend | Responsive UI for onboarding dialogs, marketplace browsing, status table, and lifecycle actions. Employs real-time updates without constant refreshes. |
| API / Backend | Validates submissions, manages Git interactions, renders Compose templates, orchestrates lifecycle actions, and surfaces health probes. |
| Lifecycle Manager | Node.js service (`AppLifecycleManager`) that validates inputs, derives workspace slugs, syncs Git repositories, writes Compose manifests, and executes `docker compose up -d` while updating Prisma status fields. |
| Telemetry Orchestrator | Background service (`DockerOrchestrator`) that polls Docker, stores normalized telemetry in `DockerContainerState`, and hydrates dashboard-ready payloads including "Open App" URLs from `AppSettings`. |
| Worker / Runner | Executes repository cloning, dependency installation, compose orchestration, and port health checks with GPU support. |
| Storage Layer | Hosts `/opt/dockerstore` directories and durable metadata (Prisma-managed SQLite by default). Stores both active apps and marketplace templates. |

## Security Considerations
- Sanitize user-provided repository URLs and commands to prevent injection.
- Run cloned code with least privilege; leverage dedicated service accounts.
- Restrict filesystem mounts to the application directory to avoid host escape.
- Maintain audit logs for create/update/delete actions.

## Operational Notes
- Use NVIDIA Container Toolkit on host machines to expose GPU resources inside containers.
- Track resource usage (GPU, CPU, memory) per application for capacity planning.
- Implement cleanup routines for orphaned workspaces and stale Compose stacks.
- Provide backups for `/opt/dockerstore` and metadata to support disaster recovery.

## Future Enhancements
- Template override support for applications requiring custom images.
- Integration with authentication providers to limit dashboard access.
- Automated dependency scanning and vulnerability alerts.
- API endpoints for CI/CD-driven onboarding.
