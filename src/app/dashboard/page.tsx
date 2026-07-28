import type { Metadata } from 'next';
import { DashboardView } from './DashboardView';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Verification trends, verdict distribution and evidence-provider status.',
};

export default function DashboardPage() {
  return (
    <div className="container section-sm">
      <header className="stack stack-3" style={{ marginBottom: 'var(--space-10)' }}>
        <span className="eyebrow">Analytics</span>
        <h1 className="title-lg">Dashboard</h1>
        <p className="lead">Verification activity, verdict distribution and the health of each evidence source.</p>
      </header>

      <DashboardView />
    </div>
  );
}
