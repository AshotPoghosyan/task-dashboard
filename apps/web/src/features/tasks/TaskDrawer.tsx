import { STATUS_DISPLAY, TASK_STATUSES, type TaskStatus } from '@mrdash/shared';
import { ExternalLink, Pencil, Plus, Unlink } from 'lucide-react';
import { useLinkMr, useUnlinkMr, useUpdateTask } from '../../api/tasks';
import { StatusBadge } from '../../components/data/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Drawer, DrawerContent } from '../../components/ui/Dialog';
import { Select } from '../../components/ui/Select';
import { formatDateTime } from '../../lib/datetime';
import { MrPicker } from './MrPicker';
import { hasChildren, type TaskNode } from './rows';
import { TaskNotes } from './TaskNotes';

interface Props {
  task: TaskNode | undefined;
  onClose: () => void;
  onEdit: (task: TaskNode) => void;
  onAddSubBug: (task: TaskNode) => void;
}

const AUTO = 'AUTO';
const OVERRIDE_OPTIONS = [
  { value: AUTO, label: 'Automatic (from linked MRs)' },
  ...TASK_STATUSES.map((s) => ({ value: s, label: STATUS_DISPLAY[s].label })),
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="text-fg-secondary">{label}</dt>
      <dd className="min-w-0 truncate text-fg">{children}</dd>
    </div>
  );
}

export function TaskDrawer({ task, onClose, onEdit, onAddSubBug }: Props) {
  const update = useUpdateTask();
  const link = useLinkMr();
  const unlink = useUnlinkMr();

  return (
    <Drawer open={Boolean(task)} onOpenChange={(open) => !open && onClose()}>
      {task ? (
        <DrawerContent title={task.title} description={`${task.type.toLowerCase()} details`}>
          <div className="flex flex-col gap-5">
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onEdit(task)}>
                <Pencil size={14} aria-hidden="true" /> Edit
              </Button>
              {task.parentId === null ? (
                <Button size="sm" onClick={() => onAddSubBug(task)}>
                  <Plus size={14} aria-hidden="true" /> Add sub-bug
                </Button>
              ) : null}
            </div>

            <dl className="flex flex-col gap-2">
              <Row label="Status">
                <StatusBadge status={task.status} />
              </Row>
              <Row label="Type">{task.type.toLowerCase()}</Row>
              <Row label="Assignee">{task.assigneeName ?? 'Unassigned'}</Row>
              <Row label="Target branch">{task.targetBranch ?? '–'}</Row>
              <Row label="Created">{formatDateTime(task.createdAt)}</Row>
              {hasChildren(task) ? <Row label="Sub-bugs">{task.children.length}</Row> : null}
            </dl>

            <div className="flex flex-col gap-1">
              <span id="override-label" className="text-xs font-medium text-fg-secondary">
                Status override
              </span>
              <Select
                aria-label="Status override"
                value={task.statusOverride ?? AUTO}
                options={OVERRIDE_OPTIONS}
                onValueChange={(v) =>
                  update.mutate({
                    id: task.id,
                    changes: { statusOverride: v === AUTO ? null : (v as TaskStatus) },
                  })
                }
              />
            </div>

            <section aria-labelledby="linked-mrs" className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 id="linked-mrs" className="text-xs font-medium text-fg-secondary">
                  Linked merge requests
                </h3>
                <MrPicker
                  linkedIds={task.mergeRequests.map((m) => m.id)}
                  onPick={(mr) => link.mutate({ taskId: task.id, mr })}
                />
              </div>
              {task.mergeRequests.length === 0 ? (
                <p className="text-sm text-fg-muted">No merge requests linked.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {task.mergeRequests.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 text-sm">
                      <StatusBadge status={m.status} />
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-w-0 flex-1 items-center gap-1 truncate hover:underline"
                      >
                        <span className="tabular text-fg-secondary">
                          {m.provider === 'GITLAB' ? '!' : '#'}
                          {m.number}
                        </span>
                        <span className="truncate">{m.title}</span>
                        <ExternalLink size={12} aria-hidden="true" />
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Unlink ${m.title}`}
                        onClick={() => unlink.mutate({ taskId: task.id, mrId: m.id })}
                      >
                        <Unlink size={14} aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <TaskNotes key={task.id} taskId={task.id} saved={task.notes} />
          </div>
        </DrawerContent>
      ) : null}
    </Drawer>
  );
}
