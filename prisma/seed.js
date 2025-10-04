import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
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
    `✓ Cleared ${removedApps.count} demo app(s) and ${removedTemplates.count} template(s). Database is ready for fresh onboarding.`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Database seeding failed:', error);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
