import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const demoApp = await prisma.app.upsert({
    where: { name: 'Stable Diffusion Demo' },
    update: {
      status: 'RUNNING',
      lastSeenAt: new Date(),
      notes: 'Demo workload reachable on the configured port for UI preview.',
      workspaceSlug: 'stable-diffusion-demo',
      startCommand: 'python webui.py --listen'
    },
    create: {
      name: 'Stable Diffusion Demo',
      workspaceSlug: 'stable-diffusion-demo',
      repositoryUrl: 'https://github.com/placeholder/stable-diffusion-demo.git',
      port: 7860,
      status: 'RUNNING',
      healthEndpoint: 'http://localhost:7860/health',
      lastSeenAt: new Date(),
      notes: 'Demo workload reachable on the configured port for UI preview.',
      startCommand: 'python webui.py --listen'
    }
  });

  await prisma.marketplaceTemplate.upsert({
    where: { name: 'Stable Diffusion Demo' },
    update: {
      summary: 'Reusable GPU image synthesis stack with txt2img and img2img presets.',
      repositoryUrl: demoApp.repositoryUrl,
      defaultPort: demoApp.port ?? 7860,
      onboardingHints: 'Requires 8GB VRAM. Uses AUTOMATIC1111 baseline compose template.',
      sourceAppId: demoApp.id
    },
    create: {
      name: 'Stable Diffusion Demo',
      summary: 'Reusable GPU image synthesis stack with txt2img and img2img presets.',
      repositoryUrl: demoApp.repositoryUrl,
      defaultPort: demoApp.port ?? 7860,
      onboardingHints: 'Requires 8GB VRAM. Uses AUTOMATIC1111 baseline compose template.',
      sourceAppId: demoApp.id
    }
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Database seeding failed:', error);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
