import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.dockerContainerState.deleteMany({});
  await prisma.appSettings.deleteMany({});
  const removedTemplates = await prisma.marketplaceTemplate.deleteMany({
    where: {
      name: {
        in: ['Stable Diffusion Demo']
      }
    }
  });

  const removedApps = await prisma.app.deleteMany({
    where: {
      name: {
        in: ['Stable Diffusion Demo']
      }
    }
  });

  console.log(
    `✓ Cleared ${removedApps.count} demo app(s), ${removedTemplates.count} template(s), and reset orchestrator state.`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Database seeding failed:', error);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
