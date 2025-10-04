import { PrismaClient } from '@prisma/client';
import { loadConfig } from './config.js';
import { createApiServer } from './app.js';
import { ensureDatabaseUrl } from './database.js';

async function main() {
  const config = loadConfig();
  ensureDatabaseUrl({ logger: console });
  const prisma = new PrismaClient();
  await prisma.$connect();

  const { app, orchestrator } = createApiServer({
    prisma,
    corsOrigin: config.corsOrigin
  });

  if (config.autoStartTelemetry) {
    orchestrator
      .start()
      .catch((error) => console.error('Failed to start telemetry polling:', error));
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`DCC API listening on http://0.0.0.0:${config.port}`);
  });

  async function shutdown(signal) {
    console.log(`Received ${signal}. Shutting down DCC API...`);

    try {
      orchestrator.stop();
    } catch (error) {
      console.error('Failed to stop orchestrator:', error);
    }

    await new Promise((resolve) => server.close(resolve));

    try {
      await prisma.$disconnect();
    } catch (error) {
      console.error('Failed to disconnect Prisma client:', error);
    }

    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('Failed to start DCC API:', error);
  process.exit(1);
});
