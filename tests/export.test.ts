import { describe, it, expect } from 'vitest';
import { buildEvidenceCsv, buildReportPdf, csvCell } from '@/client/lib/exportReport';
import { PdfDocument, wrapText } from '@/client/lib/pdf';
import { evidenceQuality, recommendationFor, type VerificationReport } from '@/shared/types';

const REPORT: VerificationReport = {
  claim: { title: 'Government announces free electricity for all households', url: 'https://x.test/a', characters: 120 },
  verdict: 'Fake',
  confidence: 91,
  summary: 'Evidence contradicts this claim.',
  signals: [
    { label: 'Professional fact-checks', score: -1, weight: 0.5, detail: 'Rated false by two fact-checkers.' },
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
  ],
  caveats: ['Coverage may be incomplete.'],
  layers: { linguistic: true, retrieval: true, reference: true, llm: false },
  providers: { queried: ['factcheck'], failed: [], configured: { googlenews: true, wikipedia: true, wikidata: true, factCheck: true, newsapi: false, groq: false, gemini: false } },
  analyzedAt: '2026-07-28T10:00:00.000Z',
  elapsedMs: 2400,
};

describe('TC-EXP-01 csvCell()', () => {
  it('leaves simple values untouched', () => {
    expect(csvCell('Reuters')).toBe('Reuters');
    expect(csvCell(42)).toBe('42');
  });

  it('quotes values containing commas, quotes or newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('renders null and undefined as empty', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('neutralises spreadsheet formula injection', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvCell('+1234')).toBe("'+1234");
    expect(csvCell('@import')).toBe("'@import");
    expect(csvCell('-1+1')).toBe("'-1+1");
  });
});

describe('TC-EXP-02 buildEvidenceCsv()', () => {
  const csv = buildEvidenceCsv(REPORT);

  it('includes the report header block', () => {
    expect(csv).toContain('VeritasGuard verification report');
    expect(csv).toContain('Fake');
    expect(csv).toContain('91');
  });

  it('includes a column header row', () => {
    expect(csv).toContain('Publisher,Author,Title,Stance');
  });

  it('writes one row per evidence item with its real URL', () => {
    expect(csv).toContain('PIB Fact Check');
    expect(csv).toContain('https://pib.test/1');
    expect(csv).toContain('82'); // similarity as a percentage
  });

  it('uses CRLF line endings for spreadsheet compatibility', () => {
    expect(csv).toContain('\r\n');
  });

  it('handles a report with no evidence', () => {
    const empty = buildEvidenceCsv({ ...REPORT, evidence: [] });
    expect(empty).toContain('VeritasGuard verification report');
    expect(empty.split('\r\n').length).toBeGreaterThan(3);
  });
});

describe('TC-EXP-03 wrapText()', () => {
  it('breaks a long paragraph into multiple lines', () => {
    const lines = wrapText('word '.repeat(200).trim(), 'regular', 10, 480);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('preserves explicit newlines', () => {
    expect(wrapText('a\n\nb', 'regular', 10, 480)).toEqual(['a', '', 'b']);
  });

  it('hard-splits a word longer than the line', () => {
    const lines = wrapText('x'.repeat(400), 'regular', 10, 200);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('returns an empty-ish result for empty input', () => {
    expect(wrapText('', 'regular', 10, 480)).toEqual(['']);
  });
});

describe('TC-EXP-04 PDF generation (fixes P1-9 — the fake export)', () => {
  it('emits a real PDF byte stream', () => {
    const bytes = buildReportPdf(REPORT);
    const text = new TextDecoder('latin1').decode(bytes);

    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/Type /Catalog');
    expect(text).toContain('xref');
    expect(text).toContain('trailer');
  });

  it('produces a non-trivial document', () => {
    expect(buildReportPdf(REPORT).length).toBeGreaterThan(1500);
  });

  it('embeds the verdict, claim and evidence publisher', () => {
    const text = new TextDecoder('latin1').decode(buildReportPdf(REPORT));
    expect(text).toContain('Verdict: Fake');
    expect(text).toContain('electricity');
    expect(text).toContain('PIB Fact Check');
  });

  it('paginates long reports rather than overflowing one page', () => {
    const many = {
      ...REPORT,
      evidence: Array.from({ length: 30 }, (_, i) => ({ ...REPORT.evidence[0], title: `Evidence item number ${i}` })),
    };
    const text = new TextDecoder('latin1').decode(buildReportPdf(many));
    const pageCount = (text.match(/\/Type \/Page[^s]/g) ?? []).length;
    expect(pageCount).toBeGreaterThan(1);
  });

  it('survives a report with no evidence and no caveats', () => {
    const bytes = buildReportPdf({ ...REPORT, evidence: [], caveats: [] });
    expect(new TextDecoder('latin1').decode(bytes).startsWith('%PDF')).toBe(true);
  });

  it('escapes characters that would corrupt the PDF syntax', () => {
    const tricky = { ...REPORT, claim: { ...REPORT.claim, title: 'Claim with (parens) and \\ backslash' } };
    const text = new TextDecoder('latin1').decode(buildReportPdf(tricky));
    expect(text).toContain('\\(parens\\)');
  });

  it('builds an empty document without throwing', () => {
    expect(new PdfDocument().build().length).toBeGreaterThan(100);
  });
});

describe('TC-EXP-05 derived report values', () => {
  it('rates a strong evidence set highly', () => {
    const strong = {
      ...REPORT,
      evidence: Array.from({ length: 5 }, () => ({ ...REPORT.evidence[0], similarity: 0.9, reliability: 0.95 })),
    };
    const quality = evidenceQuality(strong);
    expect(quality.label).toBe('Strong');
    expect(quality.score).toBeGreaterThanOrEqual(70);
  });

  it('reports "None" when nothing was retrieved', () => {
    expect(evidenceQuality({ evidence: [] })).toEqual({ label: 'None', score: 0 });
  });

  it('gives a distinct, actionable recommendation per verdict', () => {
    const fake = recommendationFor('Fake');
    const real = recommendationFor('Real');
    const uncertain = recommendationFor('Uncertain');

    expect(fake.title).toMatch(/not share/i);
    expect(real.title).toMatch(/supported/i);
    expect(uncertain.title).toMatch(/unverified/i);
    expect(new Set([fake.body, real.body, uncertain.body]).size).toBe(3);
  });
});
