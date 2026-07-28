/**
 * Report exports.
 *
 * Audit fix P1-9: "Export PDF" / "Export Excel" previously fired a success
 * toast and downloaded nothing. Both functions here produce a real file.
 */

import { PdfDocument } from './pdf';
import { evidenceQuality, recommendationFor, type VerificationReport } from './types';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'claim'
  );
}

export function buildReportPdf(report: VerificationReport): Uint8Array {
  const doc = new PdfDocument();
  const quality = evidenceQuality(report);
  const recommendation = recommendationFor(report.verdict);
  const analysedAt = new Date(report.analyzedAt);

  doc.text('VERITASGUARD', { font: 'bold', size: 9, grey: 0.45, spaceAfter: 2 });
  doc.text('Verification report', { font: 'bold', size: 20, grey: 0.1, spaceAfter: 4 });
  doc.text(analysedAt.toLocaleString(), { size: 9, grey: 0.45 });
  doc.rule();

  doc.label('Claim assessed');
  doc.text(report.claim.title, { size: 11, grey: 0.15, spaceAfter: 4 });
  if (report.claim.url) doc.text(report.claim.url, { size: 8.5, grey: 0.45, font: 'oblique' });
  doc.spacer(4);

  doc.heading(`Verdict: ${report.verdict}`, 15);
  doc.text(report.summary, { size: 10, grey: 0.2 });
  doc.spacer(2);

  doc.label('Assessment summary');
  doc.keyValue('Confidence in verdict', `${report.confidence}%`);
  doc.keyValue('Sources examined', String(report.evidence.length));
  doc.keyValue('Supporting sources', String(report.evidence.filter((e) => e.stance === 'Supporting').length));
  doc.keyValue('Contradicting sources', String(report.evidence.filter((e) => e.stance === 'Contradicting').length));
  doc.keyValue('Evidence quality', `${quality.label} (${quality.score}%)`);
  doc.keyValue('Providers queried', report.providers.queried.join(', ') || 'none');
  doc.keyValue('Processing time', `${(report.elapsedMs / 1000).toFixed(2)}s`);
  doc.rule();

  doc.heading('Recommendation', 13);
  doc.text(recommendation.title, { font: 'bold', size: 10.5, grey: 0.15, spaceAfter: 3 });
  doc.text(recommendation.body, { size: 10, grey: 0.25 });

  if (report.caveats.length > 0) {
    doc.spacer(2);
    doc.heading('Limits of this assessment', 13);
    for (const caveat of report.caveats) {
      doc.text(`•  ${caveat}`, { size: 9.5, grey: 0.3, indent: 6, spaceAfter: 4 });
    }
  }

  doc.rule();
  doc.heading('How this verdict was reached', 13);
  for (const signal of report.signals) {
    const direction = signal.score >= 0 ? 'supports' : 'contradicts';
    doc.text(`${signal.label} — ${direction} (weight ${Math.round(signal.weight * 100)}%)`, {
      font: 'bold',
      size: 10,
      grey: 0.15,
      spaceAfter: 2,
    });
    doc.text(signal.detail, { size: 9.5, grey: 0.32, indent: 6, spaceAfter: 8 });
  }

  doc.rule();
  doc.heading(`Evidence (${report.evidence.length})`, 13);

  if (report.evidence.length === 0) {
    doc.text('No indexed source matched this claim closely enough to be counted as evidence.', {
      size: 9.5,
      grey: 0.35,
      font: 'oblique',
    });
  } else {
    report.evidence.forEach((item, index) => {
      doc.text(`${index + 1}. ${item.title}`, { font: 'bold', size: 10, grey: 0.15, spaceAfter: 2 });
      doc.text(
        `${item.publisher}${item.author ? ` · ${item.author}` : ''}${
          item.publishedAt ? ` · ${item.publishedAt.slice(0, 10)}` : ''
        } · ${item.stance}${item.factCheckRating ? ` · rated "${item.factCheckRating}"` : ''}`,
        { size: 8.5, grey: 0.45, indent: 6, spaceAfter: 2 }
      );
      doc.text(item.snippet, { size: 9.5, grey: 0.3, indent: 6, spaceAfter: 2 });
      doc.text(
        `Match ${Math.round(item.similarity * 100)}% · Source reliability ${Math.round(item.reliability * 100)}% · ${item.url}`,
        { size: 8, grey: 0.5, indent: 6, spaceAfter: 10 }
      );
    });
  }

  doc.rule();
  doc.text(
    'VeritasGuard reports what the available evidence shows at the time of checking. It cannot prove a claim true, and an absence of coverage is not proof that a claim is false. For consequential decisions, consult the cited sources directly.',
    { size: 8.5, grey: 0.45, font: 'oblique' }
  );

  return doc.build();
}

export function downloadReportPdf(report: VerificationReport) {
  const bytes = buildReportPdf(report);
  triggerDownload(
    new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }),
    `veritasguard-${slugify(report.claim.title)}.pdf`
  );
}

/** Escapes a value for CSV, quoting when needed. */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  // Guard against spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildEvidenceCsv(report: VerificationReport): string {
  const header = [
    'Publisher',
    'Author',
    'Title',
    'Stance',
    'Fact-check rating',
    'Published',
    'Match with claim (%)',
    'Source reliability (%)',
    'Provider',
    'URL',
  ];

  const rows = report.evidence.map((item) => [
    item.publisher,
    item.author ?? '',
    item.title,
    item.stance,
    item.factCheckRating ?? '',
    item.publishedAt ?? '',
    Math.round(item.similarity * 100),
    Math.round(item.reliability * 100),
    item.provider,
    item.url,
  ]);

  const preamble = [
    ['VeritasGuard verification report'],
    ['Claim', report.claim.title],
    ['Verdict', report.verdict],
    ['Confidence (%)', report.confidence],
    ['Analysed at', report.analyzedAt],
    [],
  ];

  return [...preamble, header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function downloadReportCsv(report: VerificationReport) {
  // BOM so Excel opens UTF-8 correctly.
  const csv = `﻿${buildEvidenceCsv(report)}`;
  triggerDownload(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    `veritasguard-${slugify(report.claim.title)}-evidence.csv`
  );
}
