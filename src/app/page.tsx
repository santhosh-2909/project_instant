import Link from 'next/link';
import { Badge, Button } from '@/components/ui';
import s from './home.module.css';

const STEPS = [
  {
    title: 'You submit the claim',
    body: 'Paste a forwarded message, a headline, or a link. Nothing is stored on our servers unless you are signed in.',
  },
  {
    title: 'We retrieve real sources',
    body: 'The claim is matched against published fact-checks and independent news archives. Every source returned is a real document with a real URL.',
  },
  {
    title: 'Signals are weighed',
    body: 'Professional fact-checks count most, independent corroboration next, writing style least. Each contribution is shown separately.',
  },
  {
    title: 'You see the reasoning',
    body: 'The verdict arrives with its evidence, its confidence, and its limits — including the sources that disagree.',
  },
];

export default function HomePage() {
  return (
    <>
      {/* ------------------------------------------------------------ Hero */}
      <section className={s.hero}>
        <div className="container">
          <div className={s.heroInner}>
            <div>
              <Badge tone="accent">Evidence-based verification</Badge>

              <h1 className={s.heroTitle}>Check what you were sent, before you send it on.</h1>

              <p className="lead">
                VeritasGuard checks a claim against professional fact-checks and independent reporting, then
                shows you every source behind the verdict. No black box, no invented citations.
              </p>

              <div className={s.heroActions}>
                <Link href="/verify">
                  <Button size="lg">Verify a claim</Button>
                </Link>
                <Link href="/about">
                  <Button size="lg" variant="secondary">
                    How it works
                  </Button>
                </Link>
              </div>

              <p className={s.heroNote}>
                Every verdict links to its sources. When the evidence is thin, we say so rather than guessing.
              </p>
            </div>

            {/* Specimen report — a real example of the output shape */}
            <div className={s.specimen} aria-label="Example verification report">
              <div className={s.specimenBar}>
                <span className={s.specimenDot} />
                <span className={s.specimenDot} />
                <span className={s.specimenDot} />
                <span className={s.specimenLabel}>Verification report</span>
              </div>

              <div className={s.specimenBody}>
                <p className={s.specimenClaim}>
                  “Government announces free electricity for all households from next month”
                </p>

                <div className={s.specimenVerdict}>
                  <Badge tone="fake" dot>
                    Fake
                  </Badge>
                  <div style={{ textAlign: 'right' }}>
                    <div className={s.specimenScore}>91%</div>
                    <div className="text-xs faint">confidence contradicted</div>
                  </div>
                </div>

                <div className="stack stack-2">
                  <div className={s.specimenSource}>
                    <span className={s.specimenPublisher}>PIB Fact Check</span>
                    <Badge tone="fake">Rated: False</Badge>
                  </div>
                  <div className={s.specimenSource}>
                    <span className={s.specimenPublisher}>Alt News</span>
                    <Badge tone="fake">Rated: Misleading</Badge>
                  </div>
                  <div className={s.specimenSource}>
                    <span className={s.specimenPublisher}>The Hindu</span>
                    <Badge tone="neutral">Context</Badge>
                  </div>
                </div>

                <p className="text-xs faint">
                  Illustrative example of the report layout. Real verdicts depend on live sources.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Verdicts */}
      <section className="container section">
        <div className={s.sectionHead}>
          <span className="eyebrow">Three outcomes</span>
          <h2 className="title" style={{ marginBlock: 'var(--space-3)' }}>
            Including the honest one
          </h2>
          <p className="text-sm muted">
            Most tools force every claim into true or false. Real evidence is often incomplete, and saying so
            is more useful than a confident guess.
          </p>
        </div>

        <div className={s.verdictLegend}>
          <div className={`${s.legendItem} ${s.legendReal}`}>
            <span className={s.legendTitle}>Real</span>
            <p className={s.legendBody}>
              Independent, reliable sources corroborate the claim. The supporting coverage is listed so you can
              read it yourself.
            </p>
          </div>

          <div className={`${s.legendItem} ${s.legendFake}`}>
            <span className={s.legendTitle}>Fake</span>
            <p className={s.legendBody}>
              Published fact-checks or credible reporting contradict the claim. Each contradicting source is
              cited with its rating.
            </p>
          </div>

          <div className={`${s.legendItem} ${s.legendUncertain}`}>
            <span className={s.legendTitle}>Uncertain</span>
            <p className={s.legendBody}>
              The evidence does not settle it — a breaking story, a local event, or genuinely conflicting
              reports. We show what we found and why it is not enough.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ How it works */}
      <section className="container section">
        <div className={s.sectionHead}>
          <span className="eyebrow">Method</span>
          <h2 className="title" style={{ marginBlock: 'var(--space-3)' }}>
            How a verdict is reached
          </h2>
        </div>

        <div className={s.cardGrid}>
          {STEPS.map((step, index) => (
            <div key={step.title} className={s.step}>
              <span className={s.stepNumber} aria-hidden="true">
                {index + 1}
              </span>
              <h3 className={s.stepTitle}>{step.title}</h3>
              <p className={s.stepBody}>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- CTA */}
      <section className="container">
        <div className={s.cta}>
          <h2 className={s.ctaTitle}>Verify something you were forwarded</h2>
          <p className={s.ctaBody}>
            It takes a few seconds, and the report shows you exactly which sources it relied on.
          </p>
          <Link href="/verify">
            <Button size="lg" variant="secondary">
              Check a claim now
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
