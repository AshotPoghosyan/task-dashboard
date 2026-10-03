import type { FilterOptions } from '@mrdash/shared';
import {
  distinctBranches,
  distinctTaskAssignees,
  listGitUsers,
} from '../repositories/filterOptionsRepository.js';
import { listRepositories } from '../repositories/repositoryRepository.js';

export async function getFilterOptions(): Promise<FilterOptions> {
  const [assignees, branches, repositories, users] = await Promise.all([
    distinctTaskAssignees(),
    distinctBranches(),
    listRepositories(),
    listGitUsers(),
  ]);
  return {
    assignees,
    branches,
    repositories: repositories.map(({ id, provider, fullPath }) => ({ id, provider, fullPath })),
    users,
  };
}
