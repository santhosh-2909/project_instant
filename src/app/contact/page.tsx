import type { Metadata } from 'next';
import { Card, CardBody, CardHeader } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Report a mistaken verdict or get in touch with the VeritasGuard team.',
};

export default function ContactPage() {
  return (
    <div className="container-narrow section-sm">
      <header className="stack stack-3" style={{ marginBottom: 'var(--space-10)' }}>
        <span className="eyebrow">Contact</span>
        <h1 className="title-lg">Get in touch</h1>
        <p className="lead">
          Corrections matter more than compliments. If a verdict looks wrong, tell us which claim and why.
        </p>
      </header>

      <div className="stack stack-6">
        <Card>
          <CardHeader
            title="Report a mistaken verdict"
            description="The fastest route to a correction"
          />
          <CardBody>
            <p className="text-sm muted measure">
              Use the feedback control on any verification report. It attaches the claim, the verdict and the
              evidence that was retrieved, which is what a reviewer needs to act. A message sent here without
              that context takes far longer to investigate.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Research and collaboration" />
          <CardBody>
            <div className="stack stack-4">
              <p className="text-sm muted measure">
                VeritasGuard is a research project. We are interested in correspondence from fact-checking
                organisations, newsrooms and researchers working on misinformation.
              </p>
              <dl className="stack stack-3 text-sm">
                <div>
                  <dt className="eyebrow">Email</dt>
                  <dd className="ink">team@veritasguard.example</dd>
                </div>
                <div>
                  <dt className="eyebrow">Response time</dt>
                  <dd className="muted">Typically within five working days.</dd>
                </div>
              </dl>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Data and privacy" />
          <CardBody>
            <p className="text-sm muted measure">
              Claims checked while signed out are never written to our servers — they stay in your browser.
              Signed-in verifications are stored so you can review your own history, and can be deleted on
              request.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
