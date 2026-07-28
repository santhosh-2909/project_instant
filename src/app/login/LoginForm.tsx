'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, CardBody, CardHeader, Field, Input } from '@/components/ui';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [locked, setLocked] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLocked(false);
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? 'Sign-in failed.');
        setLocked(Boolean(data.locked));
        return;
      }

      router.push('/history');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card elevated>
      <CardHeader title="Sign in" description="Access your saved verification history." />
      <CardBody>
        <form onSubmit={submit} className="stack stack-5">
          {error && (
            <Alert tone="error" title={locked ? 'Account locked' : 'Could not sign in'}>
              {error}
              {locked && (
                <>
                  {' '}
                  <Link href="/forgot-password">Reset your password</Link> to unlock it.
                </>
              )}
            </Alert>
          )}

          <Field label="Email address" required>
            {(props) => (
              <Input
                {...props}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            )}
          </Field>

          <Field label="Password" required>
            {(props) => (
              <Input
                {...props}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            )}
          </Field>

          <Button type="submit" size="lg" fullWidth loading={submitting}>
            Sign in
          </Button>

          <div className="row-between text-sm">
            <Link href="/forgot-password">Forgot password?</Link>
            <Link href="/register">Create an account</Link>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
