# Architecture

See `docs/SPEC.md` section 4 for the layering rules (routes → services → repositories).

## Database ER diagram

```mermaid
erDiagram
  repositories ||--o{ merge_requests : has
  repositories ||--o{ sync_runs : has
  git_users ||--o{ merge_requests : authors
  git_users |o--o{ merge_requests : "assigned to"
  merge_requests ||--o{ merge_request_reviewers : has
  git_users ||--o{ merge_request_reviewers : reviews
  tasks ||--o{ task_merge_requests : links
  merge_requests ||--o{ task_merge_requests : "linked by"
  tasks |o--o{ tasks : "parent of (cascade)"

  repositories {
    string id PK
    Provider provider
    string externalId "UNIQUE with provider"
    string fullPath
    string webUrl
    string defaultBranch
    boolean isActive
    timestamptz lastSyncedAt
  }
  git_users {
    string id PK
    Provider provider
    string externalId "UNIQUE with provider"
    string username
    string displayName
    string avatarUrl
  }
  merge_requests {
    string id PK
    string repositoryId FK
    int number "UNIQUE with repositoryId"
    string title "GIN trigram index"
    MrStatus status
    string targetBranch
    string authorId FK
    string assigneeId FK
    timestamptz updatedAtRemote
    timestamptz mergedAt
  }
  merge_request_reviewers {
    string mergeRequestId PK
    string gitUserId PK
    ReviewerState state
  }
  tasks {
    string id PK
    string title "GIN trigram index"
    TaskType type
    TaskStatus status
    TaskStatus statusOverride
    string parentId FK
    int sortOrder
  }
  task_merge_requests {
    string taskId PK
    string mergeRequestId PK
  }
  webhook_events {
    string id PK
    Provider provider
    string deliveryId "UNIQUE with provider"
    string eventType
    jsonb payload
  }
  sync_runs {
    string id PK
    string repositoryId FK
    SyncStatus status
    timestamptz startedAt
    timestamptz finishedAt
  }
```

Every table also has `createdAt` and `updatedAt` (`timestamptz`, UTC).
