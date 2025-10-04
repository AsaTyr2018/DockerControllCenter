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
