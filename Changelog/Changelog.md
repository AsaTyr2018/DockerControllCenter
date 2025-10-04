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
