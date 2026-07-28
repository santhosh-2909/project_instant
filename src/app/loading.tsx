import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="container section-sm" aria-busy="true">
      <div className="stack stack-4" style={{ marginBottom: 'var(--space-10)' }}>
        <Skeleton width={120} height={14} />
        <Skeleton width="60%" height={38} radius={8} />
        <Skeleton width="80%" height={20} />
      </div>

      <div className="stack stack-4">
        <Skeleton height={200} radius={16} />
        <Skeleton height={120} radius={16} />
      </div>
    </div>
  );
}
