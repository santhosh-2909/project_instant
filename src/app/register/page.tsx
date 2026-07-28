import type { Metadata } from 'next';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Create a VeritasGuard account to save your verification history.',
};

export default function RegisterPage() {
  return (
    <div className="container-narrow section-sm" style={{ maxWidth: 640 }}>
      <header className="stack stack-3" style={{ marginBottom: 'var(--space-8)' }}>
        <h1 className="title">Create your account</h1>
        <p className="text-sm muted">
          Verification works without an account. Registering saves your history and unlocks the dashboard.
        </p>
      </header>

      <RegisterForm />
    </div>
  );
}
