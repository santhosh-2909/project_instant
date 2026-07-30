import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VerifyWorkspace } from '@/client/components/verify/VerifyWorkspace';
import { VerdictReport } from '@/client/components/verify/VerdictReport';
import { VerificationProgress, STAGES } from '@/client/components/verify/VerificationProgress';
import type { VerificationReport } from '@/shared/types';

const REPORT: VerificationReport = {
  claim: { title: 'Government announces free electricity for all households', url: null, characters: 140 },
  verdict: 'Fake',
  confidence: 91,
  summary: 'Evidence contradicts this claim.',
  narrative: null,
  narrativeModel: null,
  signals: [
    { label: 'Professional fact-checks', score: -1, weight: 0.5, detail: 'Rated false by PIB Fact Check.' },
    { label: 'Language analysis', score: -0.4, weight: 0.12, detail: 'Sensationalist phrasing detected.' },
  ],
  evidence: [
    {
      title: 'No such scheme has been announced',
      publisher: 'PIB Fact Check',
      author: 'Desk',
      url: 'https://pib.test/1',
      publishedAt: '2026-07-10T00:00:00Z',
      snippet: 'The claim is false; no announcement exists.',
      stance: 'Contradicting',
      similarity: 0.82,
      reliability: 0.88,
      provider: 'factcheck',
      factCheckRating: 'False',
    },
    {
      title: 'Electricity tariff review scheduled for next quarter',
      publisher: 'The Hindu',
      author: null,
      url: 'https://hindu.test/2',
      publishedAt: '2026-07-09T00:00:00Z',
      snippet: 'A routine tariff review is planned.',
      stance: 'Neutral',
      similarity: 0.4,
      reliability: 0.9,
      provider: 'newsapi',
    },
  ],
  caveats: [],
  layers: { linguistic: true, retrieval: true, reference: true, llm: false },
  providers: {
    queried: ['factcheck', 'newsapi'],
    failed: [],
    configured: { googlenews: true, wikipedia: true, wikidata: true, factCheck: true, newsapi: true, tavily: false, groq: false, gemini: false },
  },
  analyzedAt: '2026-07-28T10:00:00.000Z',
  elapsedMs: 2400,
};

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as Response);
}

beforeEach(() => {
  // jsdom implements neither of these; the export path touches both.
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('TC-FLOW-01 VerifyWorkspace input handling', () => {
  it('keeps submission disabled until a claim is entered', async () => {
    render(<VerifyWorkspace />);
    const submit = screen.getByRole('button', { name: /Verify this claim/i });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Claim or headline/), 'Some claim');
    expect(submit).toBeEnabled();
  });

  it('counts words and characters as the user types', async () => {
    render(<VerifyWorkspace />);
    await userEvent.type(screen.getByLabelText(/Full message or article text/), 'one two three');
    expect(screen.getByText('3 words')).toBeInTheDocument();
    expect(screen.getByText(/13 \/ 10,000 characters/)).toBeInTheDocument();
  });

  it('enforces the 10,000 character cap from PRD §10', async () => {
    render(<VerifyWorkspace />);
    const body = screen.getByLabelText(/Full message or article text/);

    // fireEvent-style bulk set: typing 10k characters would be far too slow.
    await userEvent.click(body);
    await userEvent.paste('x'.repeat(10_050));

    expect(await screen.findByText(/Too long by/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Verify this claim/i })).toBeDisabled();
  });

  it('loads a sample claim into the form', async () => {
    render(<VerifyWorkspace />);
    await userEvent.click(screen.getByRole('button', { name: 'Viral health claim' }));
    expect(screen.getByLabelText(/Claim or headline/)).toHaveValue(
      'Drinking hot water with lemon every morning cures cancer, doctors confirm'
    );
  });

  it('reveals the link field only in link mode', async () => {
    render(<VerifyWorkspace />);
    expect(screen.queryByLabelText(/Source link/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Add a link' }));
    expect(screen.getByLabelText(/Source link/)).toBeInTheDocument();
  });

  it('clears every field', async () => {
    render(<VerifyWorkspace />);
    await userEvent.type(screen.getByLabelText(/Claim or headline/), 'Something');
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByLabelText(/Claim or headline/)).toHaveValue('');
  });
});

describe('TC-FLOW-02 VerifyWorkspace submission', () => {
  it('posts the claim and renders the returned report', async () => {
    const fetchSpy = mockFetchOnce(REPORT);
    render(<VerifyWorkspace />);

    await userEvent.type(screen.getByLabelText(/Claim or headline/), 'Free electricity claim');
    await userEvent.click(screen.getByRole('button', { name: /Verify this claim/i }));

    await waitFor(() => expect(screen.getByText(/Contradicted by the available evidence/i)).toBeInTheDocument());

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/news/check',
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.title).toBe('Free electricity claim');
  });

  it('surfaces a server error without rendering a verdict', async () => {
    mockFetchOnce({ error: 'Verification limit reached. Try again in 60 seconds.' }, false, 429);
    render(<VerifyWorkspace />);

    await userEvent.type(screen.getByLabelText(/Claim or headline/), 'Some claim');
    await userEvent.click(screen.getByRole('button', { name: /Verify this claim/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Verification limit reached/);
    expect(screen.queryByText(/Contradicted by the available evidence/i)).toBeNull();
  });

  it('handles a network failure gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    render(<VerifyWorkspace />);

    await userEvent.type(screen.getByLabelText(/Claim or headline/), 'Some claim');
    await userEvent.click(screen.getByRole('button', { name: /Verify this claim/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not reach the verification service/);
  });

  it('records the checked claim in browser-local recents', async () => {
    mockFetchOnce(REPORT);
    render(<VerifyWorkspace />);

    await userEvent.type(screen.getByLabelText(/Claim or headline/), 'Remembered claim');
    await userEvent.click(screen.getByRole('button', { name: /Verify this claim/i }));

    await waitFor(() => expect(localStorage.getItem('vg-recent-claims')).toContain('Remembered claim'));
  });
});

describe('TC-FLOW-03 VerificationProgress (replaces the timer-driven loader)', () => {
  it('renders every pipeline stage', () => {
    const { container } = render(<VerificationProgress current="retrieve" />);
    const listed = [...container.querySelectorAll('li')].map((li) => li.textContent);
    for (const stage of STAGES) {
      expect(listed.some((text) => text?.includes(stage.label))).toBe(true);
    }
  });

  it('announces the current stage politely', () => {
    render(<VerificationProgress current="reason" />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Weighing the retrieved evidence');
  });

  it('marks earlier stages complete and later ones pending', () => {
    const { container } = render(<VerificationProgress current="reason" />);
    const items = container.querySelectorAll('li');
    expect(items[0].className).toContain('stageDone');
    expect(items[2].className).toContain('stageActive');
    expect(items[3].className).not.toContain('stageDone');
  });

  it('REGRESSION: progress never completes on its own without new props', () => {
    // The old loader ran on a 450ms timer and fired its callback twice.
    // This component is purely a function of `current`.
    const { container, rerender } = render(<VerificationProgress current="submit" />);
    const before = container.innerHTML;
    rerender(<VerificationProgress current="submit" />);
    expect(container.innerHTML).toBe(before);
  });
});

describe('TC-FLOW-04 VerdictReport', () => {
  it('states the verdict, confidence and summary', () => {
    render(<VerdictReport report={REPORT} />);
    expect(screen.getByText('Contradicted by the available evidence')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
    expect(screen.getByText('Evidence contradicts this claim.')).toBeInTheDocument();
  });

  it('labels what the confidence figure actually means', () => {
    render(<VerdictReport report={REPORT} />);
    expect(screen.getByText(/confidence this claim is contradicted/i)).toBeInTheDocument();
  });

  it('summarises the source counts', () => {
    const { container } = render(<VerdictReport report={REPORT} />);
    expect(screen.getByText('Sources examined')).toBeInTheDocument();

    const facts = [...container.querySelectorAll('.fact')].map((el) => el.textContent);
    expect(facts.some((text) => text?.startsWith('Sources examined2'))).toBe(true);
    expect(facts.some((text) => text?.startsWith('Contradicting1'))).toBe(true);
    expect(facts.some((text) => text?.startsWith('Supporting0'))).toBe(true);
  });

  it('shows each evidence item with its real publisher and link', () => {
    render(<VerdictReport report={REPORT} />);
    expect(screen.getByText('PIB Fact Check')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: 'No such scheme has been announced' });
    expect(link).toHaveAttribute('href', 'https://pib.test/1');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows the fact-checker’s own rating', () => {
    render(<VerdictReport report={REPORT} />);
    expect(screen.getByText('Rated: False')).toBeInTheDocument();
  });

  it('gives an actionable recommendation', () => {
    render(<VerdictReport report={REPORT} />);
    expect(screen.getByText('Do not share this claim')).toBeInTheDocument();
  });

  it('explains the decision in the reasoning tab', async () => {
    render(<VerdictReport report={REPORT} />);
    await userEvent.click(screen.getByRole('tab', { name: /How this was decided/ }));

    expect(screen.getByText('Professional fact-checks')).toBeInTheDocument();
    expect(screen.getByText('Rated false by PIB Fact Check.')).toBeInTheDocument();
    // Share is this signal's weight relative to the signals that actually ran:
    // 0.5 / (0.5 + 0.12) = 81%.
    expect(screen.getByText('81% of decision')).toBeInTheDocument();
  });

  it('reports which layers ran in the method tab', async () => {
    render(<VerdictReport report={REPORT} />);
    await userEvent.click(screen.getByRole('tab', { name: /Method & limits/ }));
    expect(screen.getByText(/queried factcheck, newsapi/)).toBeInTheDocument();
  });

  it('renders caveats when the assessment is limited', () => {
    render(<VerdictReport report={{ ...REPORT, caveats: ['Coverage may be incomplete.'] }} />);
    expect(screen.getByText('Coverage may be incomplete.')).toBeInTheDocument();
  });

  it('explains an empty evidence set instead of showing a blank panel', () => {
    render(<VerdictReport report={{ ...REPORT, evidence: [] }} />);
    expect(screen.getByText('No matching sources found')).toBeInTheDocument();
    expect(screen.getByText(/not proof either way/i)).toBeInTheDocument();
  });

  it('downloads a real PDF file when asked', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<VerdictReport report={REPORT} />);

    await userEvent.click(screen.getByRole('button', { name: /Download PDF report/i }));

    expect(globalThis.URL.createObjectURL).toHaveBeenCalledOnce();
    const blob = (globalThis.URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1000);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('downloads evidence as CSV', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<VerdictReport report={REPORT} />);

    await userEvent.click(screen.getByRole('button', { name: /Export evidence \(CSV\)/i }));

    const blob = (globalThis.URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    expect(blob.type).toContain('text/csv');
  });

  it('renders an Uncertain verdict with its own framing', () => {
    render(
      <VerdictReport
        report={{ ...REPORT, verdict: 'Uncertain', confidence: 44, evidence: [], caveats: ['Thin coverage.'] }}
      />
    );
    expect(screen.getByText('Not enough evidence to decide')).toBeInTheDocument();
    expect(screen.getByText('Treat as unverified for now')).toBeInTheDocument();
    expect(screen.getByText(/confidence the evidence is genuinely inconclusive/i)).toBeInTheDocument();
  });

  it('flags when no live source was consulted', () => {
    render(
      <VerdictReport
        report={{ ...REPORT, providers: { queried: [], failed: [], configured: { googlenews: true, wikipedia: true, wikidata: true, factCheck: false, newsapi: false, tavily: false, groq: false, gemini: false } } }}
      />
    );
    expect(screen.getByText('No live sources')).toBeInTheDocument();
  });

  it('groups contradicting evidence separately from context', () => {
    render(<VerdictReport report={REPORT} />);
    const heading = screen.getByRole('heading', { name: 'Contradicting this claim' });
    const section = heading.closest('section')!;
    expect(within(section).getByText('PIB Fact Check')).toBeInTheDocument();
    expect(within(section).queryByText('The Hindu')).toBeNull();
  });
});
