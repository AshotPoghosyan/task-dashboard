import type { Provider } from '@mrdash/shared';

export interface LinkHints {
  /** `Task: #<taskId>` */
  taskId: string | null;
  /** `Parent: !<n>` (GitLab) or `Parent: #<n>` (GitHub) */
  parentNumber: number | null;
}

const TASK = /\bTask:[ \t]*#([A-Za-z0-9_-]+)/i;
const PARENT: Record<Provider, RegExp> = {
  GITLAB: /\bParent:[ \t]*!(\d+)/i,
  GITHUB: /\bParent:[ \t]*#(\d+)/i,
};

/** Reads the linking directives from a merge request description. */
export function parseLinkHints(description: string | null, provider: Provider): LinkHints {
  const text = description ?? '';
  const parent = PARENT[provider].exec(text)?.[1];
  return {
    taskId: TASK.exec(text)?.[1] ?? null,
    parentNumber: parent ? Number(parent) : null,
  };
}
