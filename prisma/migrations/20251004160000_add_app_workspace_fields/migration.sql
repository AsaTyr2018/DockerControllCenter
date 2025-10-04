-- AlterTable
ALTER TABLE "App" ADD COLUMN "workspaceSlug" TEXT;
ALTER TABLE "App" ADD COLUMN "startCommand" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "App_workspaceSlug_key" ON "App"("workspaceSlug");
