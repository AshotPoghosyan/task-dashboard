import { EmptyState } from '../components/ui/EmptyState';

export default function TasksPage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Tasks</h1>
      <EmptyState
        title="Tasks arrive in the next phase"
        description="The task table is built in Phase 8."
      />
    </>
  );
}
