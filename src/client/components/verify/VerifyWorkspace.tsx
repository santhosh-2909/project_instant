'use client';

import * as React from 'react';
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Textarea } from '@/client/components/ui';
import type { VerificationReport } from '@/shared/types';
import { VerificationProgress, type StageId } from './VerificationProgress';
import { VerdictReport } from './VerdictReport';
import { addRecentClaim, readRecentClaims, type RecentClaim } from '@/client/lib/recentClaims';
import s from './verify.module.css';

const MAX_CLAIM_LENGTH = 10_000;

type Mode = 'text' | 'link';

const SAMPLES = [
  {
    label: 'Viral health claim',
    title: 'Drinking hot water with lemon every morning cures cancer, doctors confirm',
    body: 'A viral message circulating on WhatsApp claims that drinking hot lemon water on an empty stomach eliminates cancer cells and that hospitals are hiding this cure to protect profits.',
  },
  {
    label: 'Policy announcement',
    title: 'Government announces free electricity for all households from next month',
    body: 'A forwarded message states that the central government has approved unlimited free electricity for every household starting next month, and asks recipients to share before the notice is taken down.',
  },
  {
    label: 'Science reporting',
    title: 'Researchers report a new method for reducing plastic waste in oceans',
    body: 'A study published this month describes an enzyme that breaks down common plastics in seawater within weeks, according to the research team.',
  },
];

export function VerifyWorkspace() {
  const [mode, setMode] = React.useState<Mode>('text');
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [url, setUrl] = React.useState('');

  const [stage, setStage] = React.useState<StageId | null>(null);
  const [report, setReport] = React.useState<VerificationReport | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [recent, setRecent] = React.useState<RecentClaim[]>([]);

  const reportRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setRecent(readRecentClaims());
  }, []);

  const characters = title.length + body.length;
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const overLimit = characters > MAX_CLAIM_LENGTH;
  const canSubmit = (title.trim() || body.trim()) && !overLimit && stage === null;

  const applySample = (sample: (typeof SAMPLES)[number]) => {
    setMode('text');
    setTitle(sample.title);
    setBody(sample.body);
    setReport(null);
    setError(null);
  };

  const applyRecent = (item: RecentClaim) => {
    setMode('text');
    setTitle(item.title);
    setBody(item.body);
    setReport(null);
    setError(null);
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      // A bare URL pasted in goes to the link field; anything else is body text.
      if (/^https?:\/\/\S+$/i.test(text.trim())) {
        setMode('link');
        setUrl(text.trim());
      } else {
        setBody((current) => (current ? `${current}\n\n${text}` : text));
      }
    } catch {
      setError('Clipboard access was blocked by your browser. Paste with Ctrl+V instead.');
    }
  };

  const reset = () => {
    setTitle('');
    setBody('');
    setUrl('');
    setReport(null);
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setReport(null);
    setStage('submit');

    try {
      // Stages reflect the real request lifecycle: we mark retrieval as soon as
      // the request is genuinely in flight, never on a timer.
      setStage('retrieve');

      const response = await fetch('/api/news/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content: body.trim(), url: url.trim() }),
      });

      setStage('fuse');
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? 'Verification failed. Please try again.');
        return;
      }

      setReport(data as VerificationReport);
      addRecentClaim({ title: title.trim() || body.trim().slice(0, 80), body: body.trim() });
      setRecent(readRecentClaims());
    } catch {
      setError('Could not reach the verification service. Check your connection and try again.');
    } finally {
      setStage(null);
    }
  };

  // Move focus to the report when it arrives so screen readers announce it.
  React.useEffect(() => {
    if (report && reportRef.current) {
      reportRef.current.focus();
    }
  }, [report]);

  return (
    <div className="stack stack-8">
      <Card elevated>
        <CardHeader
          title="Check a claim"
          description="Paste a forwarded message, a headline, or a link to an article."
        />

        <CardBody>
          <form onSubmit={submit} className={s.composer}>
            <div className={s.composerHead}>
              <div className={s.modeRow} role="group" aria-label="Input type">
                <button
                  type="button"
                  className={`${s.modeBtn} ${mode === 'text' ? s.modeBtnActive : ''}`}
                  onClick={() => setMode('text')}
                  aria-pressed={mode === 'text'}
                >
                  Paste text
                </button>
                <button
                  type="button"
                  className={`${s.modeBtn} ${mode === 'link' ? s.modeBtnActive : ''}`}
                  onClick={() => setMode('link')}
                  aria-pressed={mode === 'link'}
                >
                  Add a link
                </button>
              </div>

              <div className={s.counters}>
                <span>{words} words</span>
                <span className={overLimit ? s.counterOver : undefined}>
                  {characters.toLocaleString()} / {MAX_CLAIM_LENGTH.toLocaleString()} characters
                </span>
              </div>
            </div>

            <Field label="Claim or headline" required>
              {(props) => (
                <Input
                  {...props}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Government announces free electricity for all households"
                  disabled={stage !== null}
                />
              )}
            </Field>

            {mode === 'link' && (
              <Field label="Source link" hint="Optional. Included in the report for traceability.">
                {(props) => (
                  <Input
                    {...props}
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/article"
                    disabled={stage !== null}
                  />
                )}
              </Field>
            )}

            <Field
              label="Full message or article text"
              hint="More context produces a better-evidenced verdict."
              error={overLimit ? `Too long by ${(characters - MAX_CLAIM_LENGTH).toLocaleString()} characters.` : undefined}
            >
              {(props) => (
                <Textarea
                  {...props}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Paste the full forwarded message or article body here…"
                  invalid={overLimit}
                  disabled={stage !== null}
                />
              )}
            </Field>

            <div className={s.toolRow}>
              <Button type="submit" size="lg" loading={stage !== null} disabled={!canSubmit}>
                Verify this claim
              </Button>
              <Button type="button" variant="ghost" onClick={pasteFromClipboard} disabled={stage !== null}>
                Paste from clipboard
              </Button>
              {(title || body || url) && (
                <Button type="button" variant="ghost" onClick={reset} disabled={stage !== null}>
                  Clear
                </Button>
              )}
            </div>

            <div className={s.sampleRow}>
              <span className={s.sampleLabel}>Try an example:</span>
              {SAMPLES.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  className={s.modeBtn}
                  onClick={() => applySample(sample)}
                  disabled={stage !== null}
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </form>
        </CardBody>
      </Card>

      {error && (
        <Alert tone="error" title="Verification could not be completed" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {stage !== null && (
        <Card>
          <CardHeader title="Verifying" description="Checking this claim against live sources." />
          <CardBody>
            <VerificationProgress current={stage} />
          </CardBody>
        </Card>
      )}

      {report && (
        <div ref={reportRef} tabIndex={-1}>
          <VerdictReport report={report} />
        </div>
      )}

      {!report && stage === null && recent.length > 0 && (
        <Card flat>
          <CardHeader title="Recent checks" description="Stored in this browser only." />
          <CardBody>
            <div className={s.recentRow}>
              {recent.map((item) => (
                <button key={item.id} type="button" className={s.recentItem} onClick={() => applyRecent(item)}>
                  <span className={s.recentText}>{item.title}</span>
                  <span className="text-xs faint">{new Date(item.checkedAt).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
