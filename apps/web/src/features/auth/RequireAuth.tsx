import { Navigate } from 'react-router-dom';
import { useSession } from '../../api/auth';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';

/** Route guard: renders the shell once the session is known to be authenticated. */
export function RequireAuth() {
  const { data, isPending, isError, refetch } = useSession();
  if (isPending) return <Skeleton className="m-4 h-8 w-48" />;
  if (isError) {
    return (
      <EmptyState
        title="Could not reach the server"
        action={<Button onClick={() => void refetch()}>Retry</Button>}
      />
    );
  }
  if (!data.authenticated) return <Navigate to="/login" replace />;
  return <AppShell showLogout={data.required} />;
}
