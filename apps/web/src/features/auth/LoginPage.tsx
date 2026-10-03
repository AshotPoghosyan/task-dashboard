import { useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { useAuthProviders, useLogin, useSession } from '../../api/auth';
import { ProviderIcon } from '../../components/data/ProviderIcon';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

const CALLBACK_ERRORS: Record<string, string> = {
  state: 'That sign-in link expired or was not started here. Please try again.',
  provider: 'The provider did not complete the sign-in. Please try again.',
};

function PasswordForm() {
  const login = useLogin();
  const [password, setPassword] = useState('');
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(password);
  };
  const error =
    login.error instanceof ApiError && login.error.status === 401
      ? 'Incorrect password.'
      : login.error
        ? 'Could not sign in. Try again.'
        : null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label htmlFor="password" className="text-sm text-fg-secondary">
        Password
      </label>
      <Input
        id="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'login-error' : undefined}
      />
      {error ? (
        <p id="login-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={!password || login.isPending}>
        Sign in
      </Button>
    </form>
  );
}

export function LoginPage() {
  const session = useSession();
  const providers = useAuthProviders();
  const [params] = useSearchParams();

  if (session.data?.authenticated) return <Navigate to="/" replace />;

  const callbackError = CALLBACK_ERRORS[params.get('error') ?? ''];
  const data = providers.data;
  // While the options load, show the password form: it is the original behaviour.
  const showPassword = data ? data.password : true;
  const buttons = data?.providers ?? [];

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <Card className="flex w-full max-w-sm flex-col gap-4">
        <div>
          <h1 className="text-lg font-semibold text-fg">MR &amp; Task Dashboard</h1>
          <p className="mt-1 text-sm text-fg-secondary">
            {buttons.length > 0
              ? 'Sign in with your team account to see merge requests and tasks.'
              : 'Enter the team password to continue.'}
          </p>
        </div>
        {callbackError ? (
          <p role="alert" className="text-sm text-danger">
            {callbackError}
          </p>
        ) : null}
        {buttons.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {buttons.map((p) => (
              <li key={p.id}>
                {/* A full navigation: the API redirects on to the provider. */}
                <a
                  href={`/api/auth/login/${p.id.toLowerCase()}`}
                  className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-control border border-border bg-raised px-3 text-sm font-medium text-fg hover:bg-surface"
                >
                  <span aria-hidden="true">
                    <ProviderIcon provider={p.id} />
                  </span>
                  Continue with {p.name}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {buttons.length > 0 && showPassword ? (
          <p className="text-center text-xs text-fg-muted">or use the shared password</p>
        ) : null}
        {showPassword ? <PasswordForm /> : null}
      </Card>
    </main>
  );
}
