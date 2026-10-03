-- DropIndex
DROP INDEX "merge_requests_updatedAtRemote_idx";

-- DropIndex
DROP INDEX "tasks_parentId_idx";

-- CreateIndex
CREATE INDEX "merge_requests_authorId_idx" ON "merge_requests"("authorId");

-- CreateIndex
CREATE INDEX "merge_requests_status_updatedAtRemote_idx" ON "merge_requests"("status", "updatedAtRemote" DESC);

-- CreateIndex
CREATE INDEX "merge_requests_repositoryId_updatedAtRemote_idx" ON "merge_requests"("repositoryId", "updatedAtRemote" DESC);

-- CreateIndex
CREATE INDEX "merge_requests_updatedAtRemote_id_idx" ON "merge_requests"("updatedAtRemote" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "tasks_parentId_sortOrder_idx" ON "tasks"("parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "tasks_assigneeName_idx" ON "tasks"("assigneeName");

-- CreateIndex
CREATE INDEX "tasks_type_idx" ON "tasks"("type");
