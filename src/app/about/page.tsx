import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, Card, CardBody, CardHeader } from '@/client/components/ui';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'The method behind a VeritasGuard verdict: what is retrieved, how signals are weighted, and what the system will not claim.',
};

const LAYERS = [
  {
    name: 'Language analysis',
    weight: '12% of the decision',
    body: 'Looks at how the claim is written — sensationalist phrasing, absolute claims and excessive emphasis on one side; named sources, studies and institutional attribution on the other. Style is a weak signal, so it carries the least weight of any evidence-bearing layer.',
  },
  {
    name: 'Professional fact-checks',
    weight: '50% of the decision',
    body: 'Queries the Google Fact Check Tools API, which indexes rulings published by organisations such as Alt News, BOOM, Factly, Snopes, PolitiFact and Full Fact. A published ruling on the same claim is the strongest evidence available, so it dominates the verdict.',
  },
  {
    name: 'Independent corroboration',
    weight: '30% of the decision',
    body: 'Searches news archives for closely-matching reports and weighs each by how well it matches the claim and how reliable the outlet is. Several independent, high-reliability outlets reporting the same thing is strong support.',
  },
  {
    name: 'Model reasoning',
    weight: '8% of the decision',
    body: 'A language model reads only the passages retrieved above and judges whether they support or contradict the claim. It is structurally prevented from naming any source that was not retrieved, and its answer is discarded if it tries.',
  },
];

export default function AboutPage() {
  return (
    <div className="container-narrow section-sm">
      <header className="stack stack-3" style={{ marginBottom: 'var(--space-12)' }}>
        <span className="eyebrow">Methodology</span>
        <h1 className="title-lg">How a verdict is reached</h1>
        <p className="lead">
          VeritasGuard is built on one rule: a verdict is only as good as the evidence you can check yourself.
        </p>
      </header>

      <section className="stack stack-6" style={{ marginBottom: 'var(--space-16)' }} id="methodology">
        <h2 className="title">The four layers</h2>
        <p className="text-sm muted measure">
          Each layer produces a score between “contradicts” and “supports”. They are combined by weight, and
          every contribution is shown in the report so you can see which one drove the outcome.
        </p>

        <div className="stack stack-4">
          {LAYERS.map((layer) => (
            <Card key={layer.name}>
              <CardHeader title={layer.name} description={layer.weight} />
              <CardBody>
                <p className="text-sm muted measure">{layer.body}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="stack stack-5" style={{ marginBottom: 'var(--space-16)' }}>
        <h2 className="title">What we will not do</h2>

        <div className="stack stack-4 measure">
          <div>
            <h3 className="title-sm">We do not invent sources</h3>
            <p className="text-sm muted">
              Every citation in a report came back from a real request to a real provider and links to the
              original document. The reasoning model is given the retrieved passages and cannot add to them.
            </p>
          </div>

          <div>
            <h3 className="title-sm">We do not treat silence as proof</h3>
            <p className="text-sm muted">
              If nothing has been published about a claim, that is reported as thin evidence — not as proof
              the claim is false. Local, recent and non-English stories are frequently under-indexed.
            </p>
          </div>

          <div>
            <h3 className="title-sm">We do not hide uncertainty</h3>
            <p className="text-sm muted">
              When the evidence does not settle a question, the verdict is <strong>Uncertain</strong> and the
              report explains what was missing. A confident-sounding guess would be less useful and less
              honest.
            </p>
          </div>

          <div>
            <h3 className="title-sm">We do not replace a fact-checker</h3>
            <p className="text-sm muted">
              This is a triage tool. It narrows what deserves human attention and shows its working. For
              consequential decisions, read the cited sources directly.
            </p>
          </div>
        </div>
      </section>

      <section className="stack stack-4">
        <h2 className="title">Confidence, precisely</h2>
        <p className="text-sm muted measure">
          The confidence figure always describes certainty in the verdict actually shown. For a{' '}
          <strong>Fake</strong> verdict, 91% means the system is 91% confident the claim is contradicted — not
          that the claim is 91% true. For <strong>Uncertain</strong>, it describes how confident the system is
          that the evidence is genuinely inconclusive rather than merely absent.
        </p>

        <div className="row" style={{ marginTop: 'var(--space-6)' }}>
          <Link href="/verify">
            <Button>Verify a claim</Button>
          </Link>
          <Link href="/contact">
            <Button variant="secondary">Contact the team</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
