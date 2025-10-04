# Docker Control Center Architecture Overview

## System Goals
- Provide a self-service platform for deploying GPU-enabled AI applications such as Stable Diffusion.
- Standardize runtime environments using a curated NVIDIA Tensor container image.
- Keep the operator dashboard responsive via push or light polling without full page reloads.
- Maintain reproducible application workspaces under `/opt/dockerstore/<appname>` for traceability.

## High-Level Workflow
1. **Application Registration**
   - User submits the onboarding form containing:
     - `name`: unique identifier for the application.
     - `repository`: Git URL to clone.
     - `requirements_file`: optional override of the Python dependencies file name.
     - `start_command`: shell command executed inside the container at boot.
     - `port`: HTTP port exposed by the application.
   - Validation ensures name uniqueness and mandatory fields.

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
   - Support basic lifecycle actions: restart, stop, remove.

## Component Responsibilities
| Component | Responsibility |
| --- | --- |
| Web Frontend | Responsive UI for onboarding, status, and lifecycle actions. Employs real-time updates without constant refreshes. |
| API / Backend | Validates submissions, manages Git interactions, renders Compose templates, and tracks container lifecycle. |
| Worker / Runner | Executes repository cloning, dependency installation, and compose orchestration with GPU support. |
| Storage Layer | Hosts `/opt/dockerstore` directories and durable metadata (database or flat files). |

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
