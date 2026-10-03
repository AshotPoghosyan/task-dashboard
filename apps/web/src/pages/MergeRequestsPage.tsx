import { EmptyState } from '../components/ui/EmptyState';

export default function MergeRequestsPage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Merge Requests</h1>
      <EmptyState
        title="Merge requests arrive in a later phase"
        description="The merge request table is built in Phase 9."
      />
    </>
  );
}
