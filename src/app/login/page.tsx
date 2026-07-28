import type { Metadata } from 'next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to VeritasGuard to access your saved verification history.',
};

export default function LoginPage() {
  return (
    <div className="container-narrow section-sm" style={{ maxWidth: 460 }}>
      <header className="stack stack-3" style={{ marginBottom: 'var(--space-8)', textAlign: 'center' }}>
        <h1 className="title">Welcome back</h1>
        <p className="text-sm muted">
          You can verify claims without an account — signing in saves your history.
        </p>
      </header>

      <LoginForm />
    </div>
  );
}
