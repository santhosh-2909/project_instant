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
  Tabs,
  VerdictBadge,
} from '@/client/components/ui';
import { evidenceQuality, recommendationFor, type VerificationReport } from '@/shared/types';
import { ConfidenceDial } from './ConfidenceDial';
import { SignalBreakdown } from './SignalBreakdown';
import { EvidenceCard } from './EvidenceCard';
import { downloadReportPdf, downloadReportCsv } from '@/client/lib/exportReport';
import s from './verify.module.css';

const VERDICT_HEADLINE = {
  Real: 'Supported by the available evidence',
  Fake: 'Contradicted by the available evidence',
  Uncertain: 'Not enough evidence to decide',
} as const;

const RECOMMENDATION_STYLE = {
  Real: { background: 'var(--verdict-real-bg)', color: 'var(--verdict-real)' },
  Fake: { background: 'var(--verdict-fake-bg)', color: 'var(--verdict-fake)' },
  Uncertain: { background: 'var(--verdict-uncertain-bg)', color: 'var(--verdict-uncertain)' },
} as const;

export function VerdictReport({ report }: { report: VerificationReport }) {
  const [tab, setTab] = React.useState('evidence');
  const [shareState, setShareState] = React.useState<'idle' | 'copied' | 'failed'>('idle');

  const quality = evidenceQuality(report);
  const recommendation = recommendationFor(report.verdict);
  const supporting = report.evidence.filter((e) => e.stance === 'Supporting');
  const contradicting = report.evidence.filter((e) => e.stance === 'Contradicting');
  const context = report.evidence.filter((e) => e.stance === 'Neutral');

  const analysedAt = new Date(report.analyzedAt);

  const share = async () => {
    const text = `VeritasGuard verdict: ${report.verdict} (${report.confidence}% confidence)\n"${report.claim.title}"\n${report.summary}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'VeritasGuard verification', text });
      } else {
        await navigator.clipboard.writeText(text);
      }
      setShareState('copied');
    } catch {
      setShareState('failed');
    }
    setTimeout(() => setShareState('idle'), 3000);
  };

  const tabs = [
    { id: 'evidence', label: `Evidence (${report.evidence.length})` },
    { id: 'reasoning', label: 'How this was decided' },
    { id: 'method', label: 'Method & limits' },
  ];

  return (
    <div className={`${s.report} animate-in`}>
      {/* ---------------------------------------------------- Verdict panel */}
      <Card elevated>
        <div className={s.verdictPanel}>
          <div>
            <div className={s.verdictHead}>
              <VerdictBadge verdict={report.verdict} />
              <Badge tone="neutral">Evidence: {quality.label}</Badge>
              {report.providers.queried.length === 0 && <Badge tone="uncertain">No live sources</Badge>}
            </div>

            <h2 className={s.verdictTitle}>{VERDICT_HEADLINE[report.verdict]}</h2>
            <p className={s.verdictSummary}>{report.summary}</p>

            <blockquote className={s.claimQuote}>
              <span className={s.claimLabel}>Claim assessed</span>
              {report.claim.title}
              {report.claim.url && (
                <>
                  {' '}
                  <a href={report.claim.url} target="_blank" rel="noopener noreferrer">
                    (source link)
                  </a>
                </>
              )}
            </blockquote>
          </div>

          <ConfidenceDial verdict={report.verdict} confidence={report.confidence} />
        </div>

        {/* Intelligence-report fact strip */}
        <div className={s.factGrid}>
          <div className={s.fact}>
            <span className={s.factLabel}>Sources examined</span>
            <span className={s.factValue}>{report.evidence.length}</span>
          </div>
          <div className={s.fact}>
            <span className={s.factLabel}>Supporting</span>
            <span className={s.factValue}>{supporting.length}</span>
          </div>
          <div className={s.fact}>
            <span className={s.factLabel}>Contradicting</span>
            <span className={s.factValue}>{contradicting.length}</span>
          </div>
          <div className={s.fact}>
            <span className={s.factLabel}>Evidence quality</span>
            <span className={s.factValue}>{quality.score}%</span>
          </div>
          <div className={s.fact}>
            <span className={s.factLabel}>Completed in</span>
            <span className={s.factValue}>{(report.elapsedMs / 1000).toFixed(1)}s</span>
          </div>
          <div className={s.fact}>
            <span className={s.factLabel}>Verified at</span>
            <span className={s.factValue}>
              {analysedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------ Caveats */}
      {report.caveats.length > 0 && (
        <Alert tone="warning" title="Read this verdict with the following limits in mind">
          <ul className={s.caveatList}>
            {report.caveats.map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* ----------------------------------------------- Recommendation */}
      <Card>
        <div className={s.recommendation}>
          <span className={s.recIcon} style={RECOMMENDATION_STYLE[report.verdict]} aria-hidden="true">
            {recommendation.icon}
          </span>
          <div className={s.recBody}>
            <h3>{recommendation.title}</h3>
            <p>{recommendation.body}</p>
          </div>
        </div>
      </Card>

      {/* -------------------------------------------------------- Detail */}
      <Card>
        <CardHeader>
          <Tabs tabs={tabs} active={tab} onChange={setTab} label="Report sections" />
        </CardHeader>

        <CardBody>
          {tab === 'evidence' && (
            <div id="panel-evidence" role="tabpanel" aria-labelledby="tab-evidence">
              {report.evidence.length === 0 ? (
                <EmptyState
                  icon="◌"
                  title="No matching sources found"
                  description="No indexed fact-check or news report matched this claim closely enough to count as evidence. That is not proof either way — it may simply be too recent, too local, or phrased differently from published coverage."
                />
              ) : (
                <div className="stack stack-8">
                  {contradicting.length > 0 && (
                    <section className="stack stack-4">
                      <h3 className="title-sm">Contradicting this claim</h3>
                      <div className={s.evidenceList}>
                        {contradicting.map((item) => (
                          <EvidenceCard key={item.url} evidence={item} claim={report.claim.title} />
                        ))}
                      </div>
                    </section>
                  )}

                  {supporting.length > 0 && (
                    <section className="stack stack-4">
                      <h3 className="title-sm">Supporting this claim</h3>
                      <div className={s.evidenceList}>
                        {supporting.map((item) => (
                          <EvidenceCard key={item.url} evidence={item} claim={report.claim.title} />
                        ))}
                      </div>
                    </section>
                  )}

                  {context.length > 0 && (
                    <section className="stack stack-4">
                      <h3 className="title-sm">Related context</h3>
                      <div className={s.evidenceList}>
                        {context.map((item) => (
                          <EvidenceCard key={item.url} evidence={item} claim={report.claim.title} />
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'reasoning' && (
            <div id="panel-reasoning" role="tabpanel" aria-labelledby="tab-reasoning" className="stack stack-6">
              <p className="text-sm muted measure">
                Each signal below was scored independently, then combined by weight. Bars to the left
                contradict the claim; bars to the right support it.
              </p>
              <SignalBreakdown signals={report.signals} />
            </div>
          )}

          {tab === 'method' && (
            <div id="panel-method" role="tabpanel" aria-labelledby="tab-method" className="stack stack-6">
              <section className="stack stack-3">
                <h3 className="title-sm">Layers that ran</h3>
                <ul className="stack stack-2 text-sm muted">
                  <li>
                    {report.layers.linguistic ? '✓' : '—'} Language analysis — how the claim is written
                  </li>
                  <li>
                    {report.layers.retrieval ? '✓' : '—'} Evidence retrieval —{' '}
                    {report.providers.queried.length > 0
                      ? `queried ${report.providers.queried.join(', ')}`
                      : 'no provider configured'}
                  </li>
                  <li>
                    {report.layers.reference ? '✓' : '—'} Reference sources — Wikipedia and Wikidata current
                    records
                  </li>
                  <li>
                    {report.layers.llm ? '✓' : '—'} Model reasoning — constrained to the retrieved passages
                    only
                  </li>
                </ul>
              </section>

              <section className="stack stack-3">
                <h3 className="title-sm">What this verdict is not</h3>
                <p className="text-sm muted measure">
                  VeritasGuard reports what the available evidence shows at this moment. It cannot prove a
                  claim true, and an absence of coverage is never treated as proof that something is false.
                  For consequential decisions, read the cited sources directly.
                </p>
              </section>

              {report.providers.failed.length > 0 && (
                <Alert tone="warning">
                  Provider(s) unavailable during this check: {report.providers.failed.join(', ')}. Evidence
                  coverage may be incomplete.
                </Alert>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* -------------------------------------------------------- Actions */}
      <div className={`${s.reportActions} no-print`}>
        <Button variant="secondary" onClick={() => downloadReportPdf(report)}>
          Download PDF report
        </Button>
        <Button variant="secondary" onClick={() => downloadReportCsv(report)}>
          Export evidence (CSV)
        </Button>
        <Button variant="ghost" onClick={share}>
          {shareState === 'copied' ? 'Copied to clipboard' : shareState === 'failed' ? 'Copy failed' : 'Share verdict'}
        </Button>
      </div>
    </div>
  );
}
