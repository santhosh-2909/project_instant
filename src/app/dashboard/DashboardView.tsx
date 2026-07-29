'use client';

import * as React from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Meter,
  Skeleton,
  Stat,
} from '@/client/components/ui';
import s from './dashboard.module.css';

interface Analytics {
  scope: 'all' | 'self';
  totals: { allTime: number; last30Days: number; avgConfidence: number };
  byVerdict: Record<string, number>;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  trend: Array<{ date: string; count: number }>;
  providers: Record<string, boolean>;
}

const VERDICT_COLOUR: Record<string, string> = {
  Real: 'var(--verdict-real)',
  Fake: 'var(--verdict-fake)',
  Uncertain: 'var(--verdict-uncertain)',
};

const PROVIDER_LABEL: Record<string, string> = {
  googlenews: 'Google News (no key needed)',
  wikipedia: 'Wikipedia (no key needed)',
  wikidata: 'Wikidata (no key needed)',
  factCheck: 'Google Fact Check Tools',
  newsapi: 'NewsAPI',
  groq: 'Reasoning model (Groq)',
  gemini: 'Gemini',
};

function topEntries(record: Record<string, number>, count = 5) {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count);
}

export function DashboardView() {
  const [data, setData] = React.useState<Analytics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [unauthenticated, setUnauthenticated] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    fetch('/api/analytics')
      .then(async (response) => {
        if (response.status === 401) {
          if (!cancelled) setUnauthenticated(true);
          return null;
        }
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'Could not load analytics.');
        return payload as Analytics;
      })
      .then((payload) => {
        if (!cancelled && payload) setData(payload);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (unauthenticated) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon="⌘"
            title="Sign in to view your dashboard"
            description="The dashboard summarises verifications recorded against your account."
            action={
              <a href="/login">
                <Button>Sign in</Button>
              </a>
            }
          />
        </CardBody>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="stack stack-6">
        <div className={s.statRow}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height={96} radius={16} />
          ))}
        </div>
        <Skeleton height={280} radius={16} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert tone="error" title="Could not load the dashboard">
        {error ?? 'No data available.'}
      </Alert>
    );
  }

  const verdictTotal = Object.values(data.byVerdict).reduce((sum, n) => sum + n, 0);
  const maxTrend = Math.max(1, ...data.trend.map((point) => point.count));
  const categories = topEntries(data.byCategory);
  const maxCategory = Math.max(1, ...categories.map(([, n]) => n));

  return (
    <div className="stack stack-6">
      {data.scope === 'self' && (
        <Alert tone="info">
          Showing verifications recorded against your account. Administrators see organisation-wide figures.
        </Alert>
      )}

      <div className={s.statRow}>
        <Stat label="Verifications (all time)" value={data.totals.allTime} />
        <Stat label="Last 30 days" value={data.totals.last30Days} />
        <Stat
          label="Average confidence"
          value={`${data.totals.avgConfidence}%`}
          hint="Across the last 30 days"
        />
        <Stat
          label="Uncertain rate"
          value={verdictTotal > 0 ? `${Math.round(((data.byVerdict.Uncertain ?? 0) / verdictTotal) * 100)}%` : '—'}
          hint="Claims the evidence could not settle"
        />
      </div>

      <div className={s.panels}>
        <Card>
          <CardHeader title="Verification activity" description="Daily checks over the last 30 days" />
          <CardBody>
            {data.totals.last30Days === 0 ? (
              <EmptyState
                icon="◌"
                title="No activity in the last 30 days"
                description="Verify a claim and it will appear here."
                action={
                  <a href="/verify">
                    <Button size="sm">Verify a claim</Button>
                  </a>
                }
              />
            ) : (
              <>
                <div className={s.trend} role="img" aria-label={`Daily verification counts over 30 days, peak ${maxTrend}`}>
                  {data.trend.map((point) => (
                    <div
                      key={point.date}
                      className={s.trendBar}
                      style={{ height: `${(point.count / maxTrend) * 100}%` }}
                      title={`${point.date}: ${point.count}`}
                    />
                  ))}
                </div>
                <div className={s.trendAxis}>
                  <span>{data.trend[0]?.date}</span>
                  <span>peak {maxTrend}/day</span>
                  <span>{data.trend[data.trend.length - 1]?.date}</span>
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Verdict distribution" description="Last 30 days" />
          <CardBody>
            {verdictTotal === 0 ? (
              <p className="text-sm muted">No verdicts recorded yet.</p>
            ) : (
              <div className={s.distribution}>
                <div className={s.distBar} role="img" aria-label="Verdict distribution">
                  {(['Real', 'Uncertain', 'Fake'] as const).map((verdict) => (
                    <span
                      key={verdict}
                      className={s.distSegment}
                      style={{
                        width: `${((data.byVerdict[verdict] ?? 0) / verdictTotal) * 100}%`,
                        background: VERDICT_COLOUR[verdict],
                      }}
                    />
                  ))}
                </div>

                <div className={s.legend}>
                  {(['Real', 'Uncertain', 'Fake'] as const).map((verdict) => (
                    <div key={verdict} className={s.legendRow}>
                      <span className={s.legendSwatch} style={{ background: VERDICT_COLOUR[verdict] }} />
                      <span className={s.legendName}>{verdict}</span>
                      <span className={s.legendCount}>{data.byVerdict[verdict] ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className={s.panels}>
        <Card>
          <CardHeader title="Most checked categories" description="Last 30 days" />
          <CardBody>
            {categories.length === 0 ? (
              <p className="text-sm muted">Nothing to show yet.</p>
            ) : (
              <div className={s.breakdown}>
                {categories.map(([name, count]) => (
                  <Meter key={name} label={name} value={(count / maxCategory) * 100} hint={`${count} checks`} />
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Evidence providers" description="Live configuration status" />
          <CardBody>
            <div className={s.healthList}>
              {(Object.keys(PROVIDER_LABEL) as Array<keyof typeof data.providers>).map((key) => (
                <div key={key} className={s.healthRow}>
                  <span className={s.healthName}>{PROVIDER_LABEL[key]}</span>
                  <Badge tone={data.providers[key] ? 'real' : 'neutral'} dot>
                    {data.providers[key] ? 'Configured' : 'Not configured'}
                  </Badge>
                </div>
              ))}
            </div>

            {!data.providers.factCheck && (
              <Alert tone="info" style={{ marginTop: 'var(--space-4)' }}>
                Live news and reference lookups are running without any key. Adding a free{' '}
                <code className="mono">GOOGLE_FACT_CHECK_API_KEY</code> also brings in published
                fact-checker rulings, which carry the most weight in a verdict.
              </Alert>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
