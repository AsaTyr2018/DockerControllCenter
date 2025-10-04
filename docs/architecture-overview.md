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

2. **Workspace Provisioning**
   - Clone the Git repository into `/opt/dockerstore/<name>`.
   - Persist metadata (e.g., commit SHA, port, health status) for dashboard queries.
   - Generate a Docker Compose file referencing the default NVIDIA base image and mapping `/opt/dockerstore/<name>` to `/app`.

3. **Container Orchestration**
   - Run `docker compose up -d` for the generated stack.
   - Monitor container logs, GPU resource allocation, and health checks.
   - Expose the configured port on the host, optionally with HTTPS termination upstream.

4. **Dashboard Visibility**
   - Reflect container status changes through websockets or server-sent events to avoid full refreshes.
   - Provide quick links to the hosted application and troubleshooting logs.
   - Support lifecycle actions: start, stop, reinstall, deinstall, restart.
   - Display a traffic-light health indicator using Prisma-tracked status enums (`RUNNING`, `STARTING`, `STOPPED`) combined with periodic port reachability checks.

5. **Marketplace Reuse**
   - Completed installs can promote their metadata into `MarketplaceTemplate` records.
   - The marketplace dialog surfaces seeded templates (including the Stable Diffusion demo) for rapid onboarding.
   - Templates store summaries, repository URLs, default ports, GPU requirements, and refer back to the originating app when available.

## Component Responsibilities
| Component | Responsibility |
| --- | --- |
| Web Frontend | Responsive UI for onboarding dialogs, marketplace browsing, status table, and lifecycle actions. Employs real-time updates without constant refreshes. |
| API / Backend | Validates submissions, manages Git interactions, renders Compose templates, orchestrates lifecycle actions, and surfaces health probes. |
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
