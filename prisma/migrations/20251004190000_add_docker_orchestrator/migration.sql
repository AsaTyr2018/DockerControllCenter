-- AlterTable
ALTER TABLE "App" ADD COLUMN "openAppBaseUrl" TEXT;

-- CreateTable
CREATE TABLE "AppSettings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "appId" TEXT NOT NULL,
  "openAppBaseUrl" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppSettings_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DockerContainerState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "appId" TEXT NOT NULL,
  "containerId" TEXT NOT NULL,
  "containerName" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "health" TEXT,
  "state" TEXT,
  "metrics" TEXT,
  "lastObservedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DockerContainerState_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_appId_key" ON "AppSettings"("appId");
CREATE UNIQUE INDEX "DockerContainerState_containerId_key" ON "DockerContainerState"("containerId");
CREATE UNIQUE INDEX "DockerContainerState_appId_key" ON "DockerContainerState"("appId");
CREATE INDEX "DockerContainerState_appId_updatedAt_idx" ON "DockerContainerState"("appId", "updatedAt");
