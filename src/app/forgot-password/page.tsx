import type { Metadata } from 'next';
import { ResetForm } from './ResetForm';

export const metadata: Metadata = {
  title: 'Reset password',
  description: 'Reset your VeritasGuard password using your security question.',
};

export default function ForgotPasswordPage() {
  return (
    <div className="container-narrow section-sm" style={{ maxWidth: 460 }}>
      <header className="stack stack-3" style={{ marginBottom: 'var(--space-8)', textAlign: 'center' }}>
        <h1 className="title">Reset your password</h1>
        <p className="text-sm muted">
          Answer your security question to set a new password. This also unlocks a locked account.
        </p>
      </header>

      <ResetForm />
    </div>
  );
}
