#!/usr/bin/env node
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    root: process.cwd(),
    port: parseInt(process.env.DCC_DASHBOARD_PORT || '8080', 10)
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--root') {
      options.root = path.resolve(args[i + 1] || options.root);
      i += 1;
    } else if (arg === '--port') {
      const next = args[i + 1];
      if (!next) continue;
      options.port = parseInt(next, 10);
      i += 1;
    }
  }

  return options;
}

function sendResponse(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Length': Buffer.byteLength(body),
    ...headers
  });
  res.end(body);
}

function createServer(root) {
  return http.createServer((req, res) => {
    try {
      const parsedUrl = url.parse(req.url || '/');
      const sanitizedPath = path.normalize(parsedUrl.pathname || '/').replace(/^\/+/, '');
      let requestedPath = path.join(root, sanitizedPath);

      if (!requestedPath.startsWith(root)) {
        sendResponse(res, 403, 'Forbidden');
        return;
      }

      if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isDirectory()) {
        requestedPath = path.join(requestedPath, 'index.html');
      }

      if (!fs.existsSync(requestedPath)) {
        sendResponse(res, 404, 'Not Found');
        return;
      }

      const stream = fs.createReadStream(requestedPath);
      stream.on('error', (error) => {
        console.error('Failed to stream asset:', error);
        if (!res.headersSent) {
          sendResponse(res, 500, 'Internal Server Error');
        } else {
          res.destroy(error);
        }
      });
      stream.pipe(res);
    } catch (error) {
      console.error('Unhandled server error:', error);
      if (!res.headersSent) {
        sendResponse(res, 500, 'Internal Server Error');
      } else {
        res.destroy(error);
      }
    }
  });
}

function main() {
  const options = parseArgs();
  const root = path.resolve(options.root);
  if (!fs.existsSync(root)) {
    console.error(`Static root ${root} does not exist.`);
    process.exit(1);
  }

  const server = createServer(root);
  server.listen(options.port, () => {
    console.log(`Dashboard server listening on http://0.0.0.0:${options.port}`);
    console.log(`Serving static assets from ${root}`);
  });

  const shutdown = () => {
    server.close(() => {
      console.log('Dashboard server stopped.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main();
