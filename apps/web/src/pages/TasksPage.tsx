import { EmptyState } from '../components/ui/EmptyState';

export default function TasksPage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Tasks</h1>
      <EmptyState
        title="Tasks are coming soon"
        description="This page will list your tasks and their merge requests. Check Sync to see repository status."
      />
    </>
  );
}
