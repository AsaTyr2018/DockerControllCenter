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
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Docker Control Center</title>
    <style>
      :root {
        color-scheme: dark light;
      }
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at top, #0d1117, #020409);
        color: #f0f6fc;
      }
      .wrapper {
        padding: 3rem;
        background: rgba(13, 17, 23, 0.85);
        border-radius: 1.5rem;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
        max-width: 640px;
        text-align: center;
      }
      h1 {
        font-size: clamp(2.5rem, 4vw, 3.5rem);
        margin-bottom: 1rem;
      }
      p {
        font-size: 1.1rem;
        line-height: 1.6;
        opacity: 0.85;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 1rem;
        border-radius: 999px;
        background: rgba(56, 139, 253, 0.15);
        color: #58a6ff;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.75rem;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <span class="badge">UX Deluxe</span>
      <h1>Docker Control Center</h1>
      <p>
        The deluxe control surface for orchestrating GPU-first AI workloads. The production UI
        build pipeline is not wired yet, but this placeholder demonstrates the build artifact
        layout expected by the setup automation.
      </p>
    </div>
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
