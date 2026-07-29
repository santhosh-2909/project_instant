'use client';

import * as React from 'react';
import { Alert, Button, Card, CardBody } from '@/client/components/ui';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('[app] unhandled error:', error);
  }, [error]);

  return (
    <div className="container-narrow section">
      <Card>
        <CardBody>
          <div className="stack stack-5">
            <Alert tone="error" title="Something went wrong">
              This page could not be displayed. The error has been logged.
              {error.digest && (
                <>
                  {' '}
                  Reference: <code className="mono">{error.digest}</code>
                </>
              )}
            </Alert>

            <div className="row">
              <Button onClick={reset}>Try again</Button>
              <a href="/">
                <Button variant="secondary">Back to home</Button>
              </a>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
