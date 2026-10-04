import type { Task, TaskCounts, TaskFilters } from '@mrdash/shared';
import type { Prisma } from '@prisma/client';
import {
  countTasksByStatus,
  findGitUser,
  listTopLevelTasks,
} from '../repositories/taskRepository.js';
import { decodeCursor, paginate } from '../utils/cursor.js';
import { AppError } from '../utils/errors.js';
import { escapeLike } from '../utils/search.js';
import { mineWhere } from './mergeRequestService.js';
import { toTask } from './mappers.js';

const SORT_COLUMNS = {
  updatedAt: 'updatedAt',
  createdAt: 'createdAt',
  sortOrder: 'sortOrder',
} as const;

/** Mine = assigned to my username or display name (any case), or a linked MR is mine. */
async function mineCondition(me: string): Promise<Prisma.TaskWhereInput> {
  const user = await findGitUser(me);
  const byMr: Prisma.TaskWhereInput = { mergeRequests: { some: { mergeRequest: mineWhere(me) } } };
  if (!user) return byMr;
  const name = (v: string): Prisma.TaskWhereInput => ({
    assigneeName: { equals: v.trim(), mode: 'insensitive' },
  });
  return { OR: [name(user.username), name(user.displayName), byMr] };
}

async function filterConditions(f: TaskFilters): Promise<Prisma.TaskWhereInput[]> {
  const conds: Prisma.TaskWhereInput[] = [];
  if (f.status) conds.push({ status: { in: f.status } });
  if (f.assignee) conds.push({ assigneeName: { in: f.assignee } });
  if (f.targetBranch) conds.push({ targetBranch: { in: f.targetBranch } });
  if (f.type) conds.push({ type: { in: f.type } });
  if (f.q) conds.push({ title: { contains: escapeLike(f.q), mode: 'insensitive' } });
  if (f.mine && f.me) conds.push(await mineCondition(f.me));
  return conds;
}

/**
 * A top-level task is listed when it, or any of its sub-bugs, matches every filter;
 * it is always returned with all of its sub-bugs.
 */
export async function buildTaskWhere(f: TaskFilters): Promise<Prisma.TaskWhereInput> {
  const conds = await filterConditions(f);
  if (conds.length === 0) return { parentId: null };
  const match: Prisma.TaskWhereInput = { AND: conds };
  return { parentId: null, OR: [match, { children: { some: match } }] };
}

export async function listTasks(
  f: TaskFilters,
): Promise<{ items: Task[]; nextCursor: string | null }> {
  const column = SORT_COLUMNS[f.sort];
  const cmp = f.order === 'desc' ? 'lt' : 'gt';
  const clauses: Prisma.TaskWhereInput[] = [await buildTaskWhere(f)];

  if (f.cursor) {
    const { v, id } = decodeCursor(f.cursor);
    const value = column === 'sortOrder' ? v : new Date(String(v));
    const invalid =
      column === 'sortOrder'
        ? typeof v !== 'number'
        : typeof v !== 'string' || Number.isNaN((value as Date).getTime());
    if (invalid) throw AppError.badRequest('INVALID_CURSOR', 'Invalid pagination cursor');
    clauses.push({
      OR: [{ [column]: { [cmp]: value } }, { [column]: value, id: { [cmp]: id } }],
    });
  }

  const rows = await listTopLevelTasks(
    { AND: clauses },
    [{ [column]: f.order }, { id: f.order }],
    f.limit + 1,
  );
  const page = paginate(rows, f.limit, (r) => ({
    v: column === 'sortOrder' ? r.sortOrder : r[column].toISOString(),
    id: r.id,
  }));
  return { items: page.items.map(toTask), nextCursor: page.nextCursor };
}

/** Tab badges: the filters apply, but the status filter does not (each tab is a status). */
export async function getTaskCounts(f: TaskFilters): Promise<TaskCounts> {
  const byStatus = await countTasksByStatus(await buildTaskWhere({ ...f, status: undefined }));
  const n = (s: keyof typeof byStatus) => byStatus[s] ?? 0;
  return {
    all: Object.values(byStatus).reduce((a, b) => a + b, 0),
    open: n('OPEN'),
    inReview: n('IN_REVIEW'),
    draft: n('DRAFT'),
    merged: n('MERGED'),
    closed: n('CLOSED'),
    noMr: n('NO_MR'),
  };
}
