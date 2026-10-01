-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('GITLAB', 'GITHUB');

-- CreateEnum
CREATE TYPE "MrStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_REVIEW', 'MERGED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('FEATURE', 'TASK', 'BUG');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_REVIEW', 'MERGED', 'CLOSED', 'NO_MR');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ReviewerState" AS ENUM ('REQUESTED', 'APPROVED', 'CHANGES_REQUESTED');

-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "fullPath" TEXT NOT NULL,
    "webUrl" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "git_users" (
    "id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "git_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merge_requests" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "MrStatus" NOT NULL,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "sourceBranch" TEXT NOT NULL,
    "targetBranch" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "createdAtRemote" TIMESTAMPTZ(3) NOT NULL,
    "updatedAtRemote" TIMESTAMPTZ(3) NOT NULL,
    "mergedAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "merge_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merge_request_reviewers" (
    "mergeRequestId" TEXT NOT NULL,
    "gitUserId" TEXT NOT NULL,
    "state" "ReviewerState" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "merge_request_reviewers_pkey" PRIMARY KEY ("mergeRequestId","gitUserId")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "TaskType" NOT NULL DEFAULT 'TASK',
    "status" "TaskStatus" NOT NULL DEFAULT 'NO_MR',
    "statusOverride" "TaskStatus",
    "assigneeName" TEXT,
    "targetBranch" TEXT,
    "notes" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_merge_requests" (
    "taskId" TEXT NOT NULL,
    "mergeRequestId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "task_merge_requests_pkey" PRIMARY KEY ("taskId","mergeRequestId")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),
    "error" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "itemsFetched" INTEGER NOT NULL DEFAULT 0,
    "itemsUpserted" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "repositories_provider_externalId_key" ON "repositories"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "git_users_provider_externalId_key" ON "git_users"("provider", "externalId");

-- CreateIndex
CREATE INDEX "merge_requests_status_idx" ON "merge_requests"("status");

-- CreateIndex
CREATE INDEX "merge_requests_targetBranch_idx" ON "merge_requests"("targetBranch");

-- CreateIndex
CREATE INDEX "merge_requests_assigneeId_idx" ON "merge_requests"("assigneeId");

-- CreateIndex
CREATE INDEX "merge_requests_updatedAtRemote_idx" ON "merge_requests"("updatedAtRemote" DESC);

-- CreateIndex
CREATE INDEX "merge_requests_mergedAt_idx" ON "merge_requests"("mergedAt");

-- CreateIndex
CREATE INDEX "merge_requests_title_idx" ON "merge_requests" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "merge_requests_repositoryId_number_key" ON "merge_requests"("repositoryId", "number");

-- CreateIndex
CREATE INDEX "merge_request_reviewers_gitUserId_idx" ON "merge_request_reviewers"("gitUserId");

-- CreateIndex
CREATE INDEX "tasks_parentId_idx" ON "tasks"("parentId");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_targetBranch_idx" ON "tasks"("targetBranch");

-- CreateIndex
CREATE INDEX "tasks_title_idx" ON "tasks" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "task_merge_requests_mergeRequestId_idx" ON "task_merge_requests"("mergeRequestId");

-- CreateIndex
CREATE INDEX "webhook_events_receivedAt_idx" ON "webhook_events"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_deliveryId_key" ON "webhook_events"("provider", "deliveryId");

-- CreateIndex
CREATE INDEX "sync_runs_repositoryId_startedAt_idx" ON "sync_runs"("repositoryId", "startedAt" DESC);

-- AddForeignKey
ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "git_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "git_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merge_request_reviewers" ADD CONSTRAINT "merge_request_reviewers_mergeRequestId_fkey" FOREIGN KEY ("mergeRequestId") REFERENCES "merge_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merge_request_reviewers" ADD CONSTRAINT "merge_request_reviewers_gitUserId_fkey" FOREIGN KEY ("gitUserId") REFERENCES "git_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_merge_requests" ADD CONSTRAINT "task_merge_requests_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_merge_requests" ADD CONSTRAINT "task_merge_requests_mergeRequestId_fkey" FOREIGN KEY ("mergeRequestId") REFERENCES "merge_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
