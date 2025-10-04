## [2025-10-04 10:18] Document platform architecture
**Change Type:** Standard Change  
**Why:** Provide a shared understanding of the Docker Control Center platform scope and workflows.  
**What changed:** Added a structured README, architecture overview, and configuration reference for the DCC project.  
**Impact:** Documentation only; no runtime impact.  
**Testing:** Not applicable (docs update).  
**Docs:** README and new docs updated.  
**Rollback Plan:** Delete the newly added documentation files.  
**Refs:** N/A

## [2025-10-04 11:45] Add automated setup pipeline
**Change Type:** Normal Change
**Why:** Provide a reproducible Node.js-driven installer with rollback for the Docker Control Center environment.
**What changed:** Added setup and build scripts, initialized the Node project scaffold, delivered a deluxe placeholder UI, and refreshed README plus setup documentation.
**Impact:** Installer may install/remove Docker packages and deploy files under `/opt/dcc`; existing installs are snapshot before changes.
**Testing:** `npm run build`
**Docs:** README, docs/setup.md, docs/configuration.md updated.
**Rollback Plan:** Run `node scripts/setup.js --rollback` or revert this commit.
**Refs:** N/A

## [2025-10-04 13:05] Auto-start dashboard and persist Git mirror
**Change Type:** Normal Change
**Why:** Ensure the setup command provisions a runnable dashboard, retains the Git clone for updates, and creates required runtime directories.
**What changed:** Updated the installer to mirror the repository (including `.git`) into `/opt/dcc`, create runtime/log directories, stop previous servers before deploy, and launch a bundled static server. Added a reusable `serve.js` helper, documented the behavior, and exposed an `npm start` shortcut.
**Impact:** Installations now start a background Node server listening on `DCC_DASHBOARD_PORT`; ensure the port is free before running setup.
**Testing:** `npm run build`
**Docs:** README.md, docs/setup.md updated.
**Rollback Plan:** Run `node scripts/setup.js --rollback` to stop the server and restore the snapshot, or revert the commit.
**Refs:** N/A

## [2025-10-04 14:45] Add marketplace-ready dashboard and Prisma scaffold
**Change Type:** Normal Change  
**Why:** Preview the planned Add App workflow, marketplace reuse, and lifecycle controls while wiring up the persistence layer.  
**What changed:** Replaced the deluxe placeholder UI with a dashboard mock featuring dialogs, fleet tables, and status lamps; introduced Prisma + SQLite schema, seed data, and migrations; taught the installer to run Prisma setup; added demo marketplace data, docs, and configuration updates.  
**Impact:** Adds Node/Prisma dependencies and creates a SQLite database (`dcc.sqlite`) during setup; ensure target hosts allow writing under `/opt/dcc/data`.  
**Testing:** `npm run build`, `npx prisma migrate deploy`, `npm run db:seed`  
**Docs:** README.md, docs/architecture-overview.md, docs/setup.md, docs/configuration.md updated.  
**Rollback Plan:** Revert the commit and delete generated SQLite databases under `prisma/` or `/opt/dcc/data`.  
**Refs:** N/A

## [2025-10-04 16:05] Introduce lifecycle manager for app onboarding
**Change Type:** Normal Change
**Why:** Begin implementing the documented Add App workflow by providing reusable services for validation, provisioning, and installation.
**What changed:** Added an `AppLifecycleManager` with validation helpers, Prisma-driven registration, Git sync, and Compose generation plus Docker orchestration; extended the Prisma schema with workspace slugs and start commands; created unit tests, scripts, and documentation for the new framework.
**Impact:** Node runtime can now register/install apps via the lifecycle manager; Prisma schema changes require running the new migration.
**Testing:** `npm test`
**Docs:** README.md, docs/architecture-overview.md updated.
**Rollback Plan:** Revert the commit and drop the added Prisma migration.
**Refs:** N/A

## [2025-10-04 18:30] Clear demo seed data and add open app control
**Change Type:** Normal Change
**Why:** Allow operators to populate the system with accurate records and expose a quick link to launched apps.
**What changed:** Updated the Prisma seed to delete legacy demo entries without inserting new ones, refreshed the dashboard preview to highlight empty states and the new “Open App” action, and revised docs to reflect the clean-start workflow.
**Impact:** Running the seed now removes the old Stable Diffusion demo; UI previews show zero preloaded apps/templates and surface the Open App control.
**Testing:** `npm test`, `npm run build`
**Docs:** README.md, docs/architecture-overview.md updated.
**Rollback Plan:** Revert the commit and rerun `npm run build` to regenerate placeholder assets.
**Refs:** N/A

## [2025-10-04 19:30] Add Docker orchestrator telemetry and settings persistence
**Change Type:** Normal Change
**Why:** Provide database-backed container telemetry and configurable Open App URLs without relying on environment files.
**What changed:** Introduced a `DockerOrchestrator` service with tests, expanded the Prisma schema (AppSettings, DockerContainerState, openAppBaseUrl), added migrations/seeds, and updated docs plus README to describe telemetry, marketplace persistence, and the mini settings tab.
**Impact:** Requires running the new Prisma migration; telemetry and custom host links now persist in the database.
**Testing:** `npm test`
**Docs:** README.md, docs/architecture-overview.md, docs/configuration.md updated.
**Rollback Plan:** Revert the commit and roll back Prisma migration `20251004190000_add_docker_orchestrator`.
**Refs:** N/A

## [2025-10-04 21:10] Fix SQLite schema JSON validation failure
**Change Type:** Standard Change
**Why:** Prisma install failed because the SQLite connector does not support `Json` columns in the schema.
**What changed:** Aligned `DockerContainerState.state` and `metrics` fields with the existing TEXT columns, added serialization helpers, updated tests, and documented the JSON encoding approach.
**Impact:** No migration required; telemetry payloads continue to persist as JSON strings.
**Testing:** `npm test`
**Docs:** README.md updated.
**Rollback Plan:** Revert this commit.
**Refs:** N/A
