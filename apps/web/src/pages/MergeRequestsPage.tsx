import { EmptyState } from '../components/ui/EmptyState';

export default function MergeRequestsPage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Merge Requests</h1>
      <EmptyState
        title="Merge requests are coming soon"
        description="This page will list merge requests across your repositories. Check Sync to see repository status."
      />
    </>
  );
}
