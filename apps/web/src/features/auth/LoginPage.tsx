import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { useLogin, useSession } from '../../api/auth';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

export function LoginPage() {
  const session = useSession();
  const login = useLogin();
  const [password, setPassword] = useState('');

  if (session.data?.authenticated) return <Navigate to="/" replace />;

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
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <Card className="w-full max-w-sm">
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <h1 className="text-lg font-semibold text-fg">MR &amp; Task Dashboard</h1>
          <label htmlFor="password" className="text-sm text-fg-secondary">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            autoFocus
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
      </Card>
    </main>
  );
}
