import { createTaskSchema, updateTaskSchema, type TaskType } from '@mrdash/shared';
import { useState, type FormEvent } from 'react';
import { useCreateTask, useUpdateTask } from '../../api/tasks';
import { Button } from '../../components/ui/Button';
import { Dialog, DialogContent } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { TYPE_OPTIONS } from './filters';
import type { TaskNode } from './rows';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this task; omit to create a new one. */
  task?: TaskNode;
  /** Create the task as a sub-bug of this task. */
  parentId?: string;
}

type Errors = Partial<Record<string, string>>;

const blankToNull = (v: FormDataEntryValue | null) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '' ? null : s;
};

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-fg-secondary">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const fieldClass = 'h-8 w-full rounded-control border border-border bg-bg px-2 text-sm text-fg';

export function TaskFormDialog({ open, onOpenChange, task, parentId }: Props) {
  const create = useCreateTask();
  const update = useUpdateTask();
  const [errors, setErrors] = useState<Errors>({});
  const editing = Boolean(task);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const values = {
      title: String(data.get('title') ?? ''),
      type: data.get('type') as TaskType,
      assigneeName: blankToNull(data.get('assigneeName')),
      targetBranch: blankToNull(data.get('targetBranch')),
    };
    const parsed = task
      ? updateTaskSchema.safeParse(values)
      : createTaskSchema.safeParse({ ...values, parentId: parentId ?? null });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'title');
        next[key] ??= key === 'title' ? 'Title is required (max 500 characters)' : issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    const done = () => onOpenChange(false);
    if (task)
      update.mutate({ id: task.id, changes: updateTaskSchema.parse(values) }, { onSuccess: done });
    else
      create.mutate(createTaskSchema.parse({ ...values, parentId: parentId ?? null }), {
        onSuccess: done,
      });
  }

  const pending = create.isPending || update.isPending;
  const err = (k: string) =>
    errors[k] ? { 'aria-invalid': true, 'aria-describedby': `${k}-error` } : {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={editing ? 'Edit task' : parentId ? 'New sub-bug' : 'New task'}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
          <Field id="title" label="Title" error={errors.title}>
            <Input
              id="title"
              name="title"
              defaultValue={task?.title ?? ''}
              autoFocus
              {...err('title')}
            />
          </Field>
          <Field id="type" label="Type" error={errors.type}>
            <select
              id="type"
              name="type"
              defaultValue={task?.type ?? (parentId ? 'BUG' : 'TASK')}
              className={fieldClass}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="assigneeName" label="Assignee" error={errors.assigneeName}>
            <Input
              id="assigneeName"
              name="assigneeName"
              defaultValue={task?.assigneeName ?? ''}
              {...err('assigneeName')}
            />
          </Field>
          <Field id="targetBranch" label="Target branch" error={errors.targetBranch}>
            <Input
              id="targetBranch"
              name="targetBranch"
              defaultValue={task?.targetBranch ?? ''}
              {...err('targetBranch')}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {editing ? 'Save' : 'Create task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
