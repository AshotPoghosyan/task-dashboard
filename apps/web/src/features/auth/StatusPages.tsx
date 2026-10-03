import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

function Page({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <Card className="flex w-full max-w-md flex-col gap-3">
        <h1 className="text-lg font-semibold text-fg">{title}</h1>
        <div className="flex flex-col gap-2 text-sm text-fg-secondary">{children}</div>
        <div>{action}</div>
      </Card>
    </main>
  );
}

const backToLogin = (
  <Link
    to="/login"
    className="inline-flex h-8 items-center rounded-control bg-accent px-3 text-sm font-medium text-accent-fg hover:opacity-90"
  >
    Back to sign in
  </Link>
);

/** Shown after a sign-in that the allowlist (or an admin) refused. */
export function AccessDeniedPage() {
  return (
    <Page title="Access denied" action={backToLogin}>
      <p>
        Your account is signed in with the provider, but it is not allowed to use this dashboard.
      </p>
      <p>
        Ask a dashboard admin to add you (or your GitHub organisation / GitLab group), then sign in
        again. If you have several accounts, check you chose the right one.
      </p>
    </Page>
  );
}

/** Shown when a session that worked a moment ago is no longer valid. */
export function SessionExpiredPage() {
  return (
    <Page
      title="Your session has ended"
      action={
        <Button variant="primary" onClick={() => window.location.assign('/login')}>
          Sign in again
        </Button>
      }
    >
      <p>
        Sessions last 14 days of activity. You may also have been signed out because an admin
        disabled your account.
      </p>
      <p>Sign in again to continue. If that does not work, ask an admin.</p>
    </Page>
  );
}
