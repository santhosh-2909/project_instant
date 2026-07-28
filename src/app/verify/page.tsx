import type { Metadata } from 'next';
import { VerifyWorkspace } from '@/components/verify/VerifyWorkspace';

export const metadata: Metadata = {
  title: 'Verify a claim',
  description:
    'Check a forwarded message, headline or article against professional fact-checks and independent reporting.',
};

export default function VerifyPage() {
  return (
    <div className="container section-sm">
      <header className="stack stack-3" style={{ marginBottom: 'var(--space-10)' }}>
        <span className="eyebrow">Verification</span>
        <h1 className="title-lg">Check a claim against the evidence</h1>
        <p className="lead">
          VeritasGuard searches professional fact-checks and independent news archives, then shows you every
          source behind the verdict — including the ones that disagree.
        </p>
      </header>

      <VerifyWorkspace />
    </div>
  );
}
