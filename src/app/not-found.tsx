import Link from 'next/link';
import { Button, EmptyState } from '@/client/components/ui';

export default function NotFound() {
  return (
    <div className="container-narrow section">
      <EmptyState
        icon="◍"
        title="Page not found"
        description="The page you were looking for does not exist, or has moved."
        action={
          <Link href="/">
            <Button>Back to home</Button>
          </Link>
        }
      />
    </div>
  );
}
