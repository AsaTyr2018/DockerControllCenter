-- CreateTable
CREATE TABLE "App" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "repositoryUrl" TEXT,
    "port" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'STOPPED',
    "healthEndpoint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "MarketplaceTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "repositoryUrl" TEXT,
    "defaultPort" INTEGER,
    "preferredGpu" TEXT,
    "onboardingHints" TEXT,
    "sourceAppId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketplaceTemplate_sourceAppId_fkey" FOREIGN KEY ("sourceAppId") REFERENCES "App" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "App_name_key" ON "App"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceTemplate_name_key" ON "MarketplaceTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceTemplate_sourceAppId_key" ON "MarketplaceTemplate"("sourceAppId");
