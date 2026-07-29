'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, CardBody, CardHeader, Field, Input } from '@/client/components/ui';

export function ResetForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [securityAnswer, setSecurityAnswer] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const tooShort = newPassword.length > 0 && newPassword.length < 8;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (mismatch) {
      setError('The two passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, securityAnswer, newPassword }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? 'Password reset failed.');
        return;
      }

      setDone(true);
      setTimeout(() => router.push('/login'), 1800);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Card elevated>
        <CardBody>
          <Alert tone="success" title="Password changed">
            You can now sign in with your new password. Redirecting…
          </Alert>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card elevated>
      <CardHeader title="Password reset" description="Verified with your security question." />
      <CardBody>
        <form onSubmit={submit} className="stack stack-5">
          {error && (
            <Alert tone="error" title="Could not reset your password">
              {error}
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
              />
            )}
          </Field>

          <Field label="Answer to your security question" required>
            {(props) => (
              <Input
                {...props}
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                required
              />
            )}
          </Field>

          <Field
            label="New password"
            hint="At least 8 characters."
            error={tooShort ? 'Must be at least 8 characters.' : undefined}
            required
          >
            {(props) => (
              <Input
                {...props}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                invalid={tooShort}
                required
              />
            )}
          </Field>

          <Field label="Confirm new password" error={mismatch ? 'Passwords do not match.' : undefined} required>
            {(props) => (
              <Input
                {...props}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                invalid={mismatch}
                required
              />
            )}
          </Field>

          <Button type="submit" size="lg" fullWidth loading={submitting}>
            Set new password
          </Button>

          <p className="text-sm muted" style={{ textAlign: 'center' }}>
            <Link href="/login">Back to sign in</Link>
          </p>
        </form>
      </CardBody>
    </Card>
  );
}
