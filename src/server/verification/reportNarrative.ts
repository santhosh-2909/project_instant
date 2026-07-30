/*
 * BACKEND ONLY. The `server-only` import below makes this a build error if any
 * client component ever imports this module, directly or transitively.
 */
import 'server-only';

import { complete } from '@/server/verification/groqClient';
import { mentionsUnretrievedSource } from '@/server/verification/llm';
import type { RetrievedEvidence, SignalContribution, Verdict } from '@/shared/types';

/**
 * AI-written report narrative.
 *
 * This is the right job for a language model: turning a verdict and a set of
 * already-retrieved sources into readable prose. It is *summarisation*, not
 * fact-assertion — the verdict, the confidence and the citations are all
 * decided before this runs and are not up for negotiation.
 *
 * Note the deliberate split of responsibility:
 *   • The verdict comes from the Decision Engine, weighing measured evidence.
 *   • The model only explains that verdict in plain language.
 *
 * Letting the model decide the verdict is exactly the failure this codebase was
 * built to avoid. It stays on the writing side of the line.
 */

const SYSTEM_PROMPT = `You write short explanations for a fact-checking report.

You are given a verdict that has ALREADY been decided by an evidence-weighing system, and the sources it used. Your only job is to explain that verdict in plain language for a general reader.

Hard rules:
- The verdict is final. Never contradict it, never hedge it, never re-decide it.
- Use ONLY the numbered sources given. Never name a source, outlet, study or URL that is not in the list.
- Never invent facts, figures, dates or quotes.
- If the sources are thin, say so plainly instead of padding.
- Write for someone who received a forwarded message and wants to know what to do.
- 3 to 4 sentences. No headings, no bullet points, no preamble like "Here is".
- Plain British English. No jargon, no marketing tone, no exclamation marks.

Respond with ONLY a JSON object:
{"summary": "<your 3-4 sentences>"}`;

function buildPrompt(
  claim: string,
  verdict: Verdict,
  confidence: number,
  signals: SignalContribution[],
  evidence: RetrievedEvidence[]
): string {
  const sources =
    evidence.length > 0
      ? evidence
          .slice(0, 6)
          .map((item, index) => {
            const rating = item.factCheckRating ? ` | rated: ${item.factCheckRating}` : '';
            const date = item.publishedAt ? ` | ${item.publishedAt.slice(0, 10)}` : '';
            return `[${index + 1}] ${item.publisher}${date} | stance: ${item.stance}${rating}\n    "${item.title}"\n    ${item.snippet.slice(0, 200)}`;
          })
          .join('\n')
      : '(no sources matched this claim)';

  const reasoning = signals
    .map((s) => `- ${s.label} (${s.score >= 0 ? 'supports' : 'contradicts'}): ${s.detail}`)
    .join('\n');

  return `CLAIM:
"${claim}"

FINAL VERDICT (already decided — explain it, do not change it):
${verdict}, with ${confidence}% confidence

WHY THE SYSTEM DECIDED THAT:
${reasoning}

SOURCES USED:
${sources}`;
}

export function parseSummary(raw: string): string | null {
  if (!raw) return null;

  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as { summary?: unknown };
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    return summary.length >= 20 ? summary.slice(0, 900) : null;
  } catch {
    return null;
  }
}

/**
 * A narrative that contradicts its own verdict is worse than none — it makes
 * the report self-undermining. Cheap keyword check for the obvious cases.
 */
export function contradictsVerdict(summary: string, verdict: Verdict): boolean {
  const text = summary.toLowerCase();

  if (verdict === 'Fake') {
    return /\b(is (?:true|accurate|correct|confirmed)|claim is verified|turns out to be true)\b/.test(text);
  }
  if (verdict === 'Real') {
    return /\b(is (?:false|fake|untrue|a hoax)|claim is debunked|no evidence supports)\b/.test(text);
  }
  return false;
}

export interface NarrativeResult {
  summary: string;
  model: string;
}

/**
 * Generates the narrative. Returns null whenever Groq is unconfigured, the call
 * fails, the response is unparseable, or the text breaks one of the guards —
 * the report then falls back to the deterministic summary from the Decision
 * Engine, which is always present.
 */
export async function generateNarrative(
  claim: string,
  verdict: Verdict,
  confidence: number,
  signals: SignalContribution[],
  evidence: RetrievedEvidence[],
  timeoutMs = 5000
): Promise<NarrativeResult | null> {
  const result = await complete({
    system: SYSTEM_PROMPT,
    user: buildPrompt(claim, verdict, confidence, signals, evidence),
    json: true,
    maxTokens: 400,
    temperature: 0.2,
    timeoutMs,
  });

  if (!result) return null;

  const summary = parseSummary(result.text);
  if (!summary) return null;

  // Same guard the reasoning layer uses: no outlet may appear that was not retrieved.
  if (mentionsUnretrievedSource(summary, evidence)) {
    console.warn('[narrative] discarded — cited a source that was never retrieved');
    return null;
  }

  if (contradictsVerdict(summary, verdict)) {
    console.warn('[narrative] discarded — contradicted the verdict it was asked to explain');
    return null;
  }

  return { summary, model: result.model };
}
