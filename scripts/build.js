#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

function ensureDist() {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
}

function writePlaceholderAssets() {
  const apiBaseUrl =
    process.env.DCC_API_BASE_URL || `http://localhost:${process.env.DCC_API_PORT || 4000}`;
  const scriptPath = path.join(__dirname, 'assets', 'dashboard.js');
  const rawScript = fs.readFileSync(scriptPath, 'utf8');
  const scriptContent = rawScript.replace(/__DCC_API_BASE_URL__/g, JSON.stringify(apiBaseUrl));

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Docker Control Center</title>
    <style>
      :root {
        color-scheme: dark light;
        --bg-primary: #0d1117;
        --bg-panel: rgba(22, 27, 34, 0.9);
        --bg-surface: rgba(13, 17, 23, 0.8);
        --border-subtle: rgba(110, 118, 129, 0.3);
        --accent: #58a6ff;
        --accent-soft: rgba(56, 139, 253, 0.15);
        --text-primary: #f0f6fc;
        --text-muted: rgba(240, 246, 252, 0.7);
        --success: #2ea043;
        --warning: #d29922;
        --error: #f85149;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: radial-gradient(circle at top, #161b22, #010409);
        color: var(--text-primary);
      }

      body[data-loading] {
        cursor: progress;
      }

      body[data-loading] button {
        pointer-events: none;
        opacity: 0.7;
      }

      .app-shell {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2.5rem clamp(1.5rem, 4vw, 3rem) 4rem;
        display: flex;
        flex-direction: column;
        gap: 2.5rem;
      }

      .top-bar {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1.5rem;
      }

      .top-bar__heading h1 {
        margin: 0 0 0.5rem;
        font-size: clamp(2.25rem, 5vw, 3.2rem);
      }

      .top-bar__heading p {
        margin: 0;
        max-width: 52ch;
        color: var(--text-muted);
        line-height: 1.6;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.45rem 1.1rem;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 0.75rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        font-weight: 600;
      }

      .top-bar__actions {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        flex-wrap: wrap;
      }

      button {
        font: inherit;
        border: 1px solid transparent;
        border-radius: 0.75rem;
        padding: 0.65rem 1.4rem;
        cursor: pointer;
        transition: transform 120ms ease, box-shadow 120ms ease, border 120ms ease;
        background: var(--accent);
        color: #010409;
        font-weight: 600;
      }

      button.secondary {
        background: transparent;
        color: var(--accent);
        border-color: var(--accent-soft);
      }

      button:hover {
        transform: translateY(-1px);
        box-shadow: 0 12px 30px rgba(56, 139, 253, 0.25);
      }

      fieldset {
        border: 0;
        margin: 0;
        padding: 0;
        min-inline-size: auto;
      }

      fieldset[disabled] {
        opacity: 0.6;
      }

      .dialog__note {
        margin: 0;
        color: var(--text-muted);
        font-size: 0.9rem;
      }

      .layout-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.5rem;
      }

      .panel {
        background: var(--bg-panel);
        border: 1px solid var(--border-subtle);
        border-radius: 1.25rem;
        padding: 1.75rem;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        box-shadow: 0 30px 60px rgba(1, 4, 9, 0.4);
      }

      .panel h2,
      .panel h3 {
        margin: 0;
        font-size: 1.25rem;
      }

      .stat-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 1rem;
      }

      .stat-card {
        padding: 1rem;
        border-radius: 1rem;
        background: rgba(88, 166, 255, 0.08);
        border: 1px solid rgba(88, 166, 255, 0.1);
      }

      .stat-card .label {
        display: block;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-muted);
        margin-bottom: 0.5rem;
      }

      .stat-card .value {
        font-size: 1.8rem;
        font-weight: 700;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        background: var(--bg-surface);
        border-radius: 1rem;
        overflow: hidden;
        border: 1px solid var(--border-subtle);
      }

      thead {
        background: rgba(88, 166, 255, 0.08);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-size: 0.75rem;
      }

      th,
      td {
        padding: 0.85rem 1rem;
        text-align: left;
        border-bottom: 1px solid rgba(240, 246, 252, 0.06);
      }

      tbody tr:last-child td {
        border-bottom: none;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.35rem 0.85rem;
        border-radius: 999px;
        font-size: 0.85rem;
        font-weight: 600;
      }

      .status-dot {
        width: 0.75rem;
        height: 0.75rem;
        border-radius: 50%;
        box-shadow: 0 0 12px currentColor;
      }

      .status-pill[data-status='RUNNING'] {
        background: rgba(46, 160, 67, 0.18);
        color: var(--success);
      }

      .status-pill[data-status='STARTING'] {
        background: rgba(210, 153, 34, 0.18);
        color: var(--warning);
      }

      .status-pill[data-status='STOPPED'] {
        background: rgba(248, 81, 73, 0.18);
        color: var(--error);
      }

      .table-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .table-actions button {
        padding: 0.35rem 0.85rem;
        border-radius: 999px;
        font-size: 0.75rem;
        background: transparent;
        color: var(--text-primary);
        border-color: rgba(240, 246, 252, 0.2);
      }

      .table-actions button.primary {
        background: var(--accent);
        color: #010409;
      }

      .table-hint {
        margin: 0;
        font-size: 0.85rem;
        color: var(--text-muted);
      }

      .timeline {
        display: grid;
        gap: 1rem;
      }

      .timeline__item {
        display: grid;
        gap: 0.25rem;
        padding: 0.75rem 1rem;
        border-radius: 1rem;
        background: rgba(240, 246, 252, 0.04);
        border: 1px dashed rgba(240, 246, 252, 0.08);
      }

      dialog {
        border: none;
        border-radius: 1.25rem;
        padding: 0;
        background: transparent;
      }

      .dialog__card {
        min-width: min(520px, 90vw);
        background: var(--bg-panel);
        border: 1px solid var(--border-subtle);
        border-radius: 1.25rem;
        padding: 2rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        box-shadow: 0 40px 100px rgba(1, 4, 9, 0.6);
      }

      .dialog__header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
      }

      .dialog__header h2 {
        margin: 0;
        font-size: 1.4rem;
      }

      .form-grid {
        display: grid;
        gap: 1rem;
      }

      .form-grid label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.9rem;
      }

      input,
      textarea,
      select {
        font: inherit;
        background: rgba(1, 4, 9, 0.6);
        border: 1px solid rgba(240, 246, 252, 0.2);
        border-radius: 0.75rem;
        padding: 0.6rem 0.8rem;
        color: var(--text-primary);
        resize: vertical;
      }

      textarea {
        min-height: 100px;
      }

      .dialog__footer {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }

      .marketplace-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1rem;
      }

      .marketplace-card {
        border: 1px solid rgba(240, 246, 252, 0.08);
        border-radius: 1rem;
        padding: 1.25rem;
        display: grid;
        gap: 0.75rem;
        background: rgba(1, 4, 9, 0.45);
      }

      .marketplace-card h3 {
        margin: 0;
        font-size: 1.1rem;
      }

      .marketplace-actions {
        display: flex;
        gap: 0.5rem;
      }

      .marketplace-actions button {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        border-radius: 999px;
        border: 1px solid transparent;
        background: rgba(240, 246, 252, 0.12);
        color: inherit;
        padding: 0.45rem 0.6rem;
        cursor: pointer;
      }

      .marketplace-actions button:hover {
        background: rgba(240, 246, 252, 0.2);
      }

      .marketplace-actions button[data-action='edit'] {
        border-color: rgba(68, 174, 255, 0.5);
        color: rgb(68, 174, 255);
      }

      .marketplace-actions button[data-action='terminate'] {
        border-color: rgba(255, 68, 68, 0.5);
        color: rgb(255, 107, 107);
      }

      .marketplace-actions svg {
        width: 0.75rem;
        height: 0.75rem;
      }

      .tag-list {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .tag-list span {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 0.35rem 0.6rem;
        border-radius: 999px;
        background: rgba(240, 246, 252, 0.08);
      }

      .empty-row td {
        padding: 2rem 1rem;
        text-align: center;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
      }

      .empty-state strong {
        font-size: 1rem;
      }

      button[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
      }

      footer {
        text-align: center;
        color: rgba(240, 246, 252, 0.4);
        font-size: 0.8rem;
      }

      @media (max-width: 720px) {
        .top-bar__actions {
          width: 100%;
          justify-content: flex-start;
        }

        button {
          width: 100%;
        }

        .dialog__footer {
          flex-direction: column-reverse;
        }
      }
    </style>
  </head>
  <body>
    <div class="app-shell">
      <header class="top-bar">
        <div class="top-bar__heading">
          <span class="pill">Dashboard Preview</span>
          <h1>Docker Control Center</h1>
          <p>
            Planned operator cockpit for orchestrating GPU-first workloads. The layout showcases dialogs for registering
            applications, a reusable marketplace backed by Prisma + SQLite, and lifecycle controls surfaced from the
            orchestration backend.
          </p>
        </div>
        <div class="top-bar__actions">
          <button data-dialog-target="add-app">Add App</button>
          <button class="secondary" data-dialog-target="marketplace">Open Marketplace</button>
        </div>
      </header>

      <section class="layout-grid">
        <article class="panel">
          <h2>Runtime Overview</h2>
          <div class="stat-grid">
            <div class="stat-card">
              <span class="label">Running</span>
              <span class="value" data-stat="running">0</span>
            </div>
            <div class="stat-card">
              <span class="label">Starting</span>
              <span class="value" data-stat="starting">0</span>
            </div>
            <div class="stat-card">
              <span class="label">Stopped</span>
              <span class="value" data-stat="stopped">0</span>
            </div>
            <div class="stat-card">
              <span class="label">Marketplace Templates</span>
              <span class="value" data-stat="templates">0</span>
            </div>
          </div>
        </article>

        <article class="panel">
          <h2>Lifecycle Timeline</h2>
          <div class="timeline">
            <div class="timeline__item">
              <strong>Port reachability check</strong>
              <span class="table-hint">Every 30 seconds the agent polls registered ports and updates the signal lamp accordingly.</span>
            </div>
            <div class="timeline__item">
              <strong>Image pull &amp; compose deploy</strong>
              <span class="table-hint">Triggered immediately after submitting the onboarding dialog.</span>
            </div>
            <div class="timeline__item">
              <strong>Marketplace sync</strong>
              <span class="table-hint">Completed installs are converted into reusable templates with a single click.</span>
            </div>
          </div>
        </article>
      </section>

      <section class="panel">
        <div>
          <h2>Application Fleet</h2>
          <p class="table-hint">Lifecycle actions will call the Docker engine via the backend service.</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Application</th>
              <th>Status</th>
              <th>Port</th>
              <th>Last Seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody data-fleet-body>
            <tr class="empty-row" data-empty-row>
              <td colspan="5">
                <div class="empty-state">
                  <strong>No applications registered yet.</strong>
                  <p class="table-hint">Use Add App or promote a marketplace template to see entries here.</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="table-hint">Green = port reachable, Yellow = probing/compose deploy, Red = offline.</p>
      </section>

      <footer>
        Prisma models persist fleet metadata and marketplace templates in SQLite. Replace this preview once the production UI ships.
      </footer>
    </div>

    <dialog data-dialog-id="add-app">
      <form class="dialog__card">
        <div class="dialog__header">
          <div>
            <h2>Register Application</h2>
            <p class="table-hint">Send launch metadata to the backend so templates stay reusable and deployable.</p>
          </div>
          <button value="cancel" class="secondary">Close</button>
        </div>
        <fieldset class="form-grid">
          <label>
            App Name
            <input name="name" placeholder="e.g. Stable Diffusion" required />
          </label>
          <label>
            Git Repository URL
            <input name="repository" type="url" placeholder="https://github.com/org/repo.git" required />
          </label>
          <label>
            Container Start Command
            <textarea name="startCommand" placeholder="python launch.py --api --listen"></textarea>
          </label>
          <label>
            Service Port
            <input name="port" type="number" min="1" max="65535" placeholder="7860" />
          </label>
          <label>
            Marketplace Template
            <select name="template">
              <option value="">Create new template</option>
            </select>
          </label>
        </fieldset>
        <div class="dialog__footer">
          <button class="secondary" value="cancel">Cancel</button>
          <button type="submit">Save to Marketplace</button>
        </div>
      </form>
    </dialog>

    <dialog data-dialog-id="marketplace">
      <form method="dialog" class="dialog__card">
        <div class="dialog__header">
          <div>
            <h2>App Marketplace</h2>
            <p class="table-hint">Templates persist in the backend and deploy through the lifecycle API.</p>
          </div>
          <button value="cancel" class="secondary">Close</button>
        </div>
        <div class="marketplace-grid" data-marketplace-grid>
          <div class="marketplace-card" data-empty-state>
            <div class="tag-list">
              <span>Empty</span>
            </div>
            <h3>No templates yet</h3>
            <p class="table-hint">Use Add App to publish launch settings to the backend marketplace.</p>
            <button type="button" disabled>Deploy Template</button>
          </div>
        </div>
        <div class="dialog__footer">
          <button class="secondary" value="cancel">Close</button>
        </div>
      </form>
    </dialog>

    <script>
${scriptContent}
    </script>
  </body>
</html>
`;

  fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml, 'utf8');
}

function main() {
  ensureDist();
  writePlaceholderAssets();
  console.log('✓ Generated deluxe placeholder UI in dist/.');
}

main();
