/** The person using the dashboard, as a git user. */
export interface Me {
  id: string;
  username: string;
  displayName: string;
}

/** Mine = I am the author, assignee or a reviewer. */
export function isMyMergeRequest(
  mr: {
    author: { id: string };
    assignee: { id: string } | null;
    reviewers: readonly { user: { id: string } }[];
  },
  me: Pick<Me, 'id'>,
): boolean {
  return (
    mr.author.id === me.id ||
    mr.assignee?.id === me.id ||
    mr.reviewers.some((r) => r.user.id === me.id)
  );
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Mine = assigned to my username or display name (any case), or one of its linked MRs is mine. */
export function isMyTask(
  task: { assigneeName: string | null; linkedMergeRequestsMine?: boolean },
  me: Pick<Me, 'username' | 'displayName'>,
): boolean {
  if (task.linkedMergeRequestsMine) return true;
  const name = task.assigneeName;
  return !!name && (same(name, me.username) || same(name, me.displayName));
}
