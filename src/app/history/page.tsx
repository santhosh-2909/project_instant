import type { Metadata } from 'next';
import { HistoryTable } from './HistoryTable';

export const metadata: Metadata = {
  title: 'Verification history',
  description: 'Every claim you have checked, with its verdict, confidence and timestamp.',
};

export default function HistoryPage() {
  return (
    <div className="container section-sm">
      <header className="stack stack-3" style={{ marginBottom: 'var(--space-10)' }}>
        <span className="eyebrow">Archive</span>
        <h1 className="title-lg">Verification history</h1>
        <p className="lead">
          Every claim checked under your account, with the verdict and confidence recorded at the time.
        </p>
      </header>

      <HistoryTable />
    </div>
  );
}
