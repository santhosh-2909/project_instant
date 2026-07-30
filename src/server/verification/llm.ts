/**
 * Layer 3 — LLM reasoning, constrained.
 *
 * The model is given ONLY the passages that `lib/retrieval.ts` actually fetched
 * and is asked for a judgement, not for sources. It cannot return citations at
 * all, so the fabricated-evidence failure (audit D-1) is structurally
 * impossible rather than merely discouraged.
 *
 * Its output is one bounded number plus a rationale, and it carries the lowest
 * weight in the Decision Engine.
 */

/*
 * BACKEND ONLY. The `server-only` import above makes this a build error if any
 * client component ever imports this module, directly or transitively. That is
 * not theoretical: the UI previously imported `tokenise` from the retrieval
 * module, which shipped the provider stack and the ONNX import path to the
 * browser.
 */
import 'server-only';
import { complete } from '@/server/verification/groqClient';
import type { LlmAssessment } from '@/server/verification/decisionEngine';
import type { RetrievedEvidence } from '@/shared/types';

const SYSTEM_PROMPT = `You are the reasoning layer of a fact-verification pipeline.

You will be given a claim and a numbered list of evidence passages that were retrieved from real sources by a separate system.

Your job is to judge whether the EVIDENCE PROVIDED supports or contradicts the claim.

Hard rules:
- Reason ONLY from the numbered evidence passages given to you. You have no other knowledge of this event.
- NEVER invent, name, cite, or refer to any source, outlet, article, study or URL that is not in the numbered list.
- If the evidence is thin, contradictory or unrelated to the claim, say so and return a score near 0.
- Judge the CLAIM, not the writing style.

Respond with ONLY a JSON object:
{"score": <number between -1 and 1>, "reasoning": "<two sentences, max 300 characters>"}

score = -1 means the evidence clearly contradicts the claim.
score =  0 means the evidence is insufficient or evenly balanced.
score = +1 means the evidence clearly supports the claim.`;

function buildUserPrompt(claim: string, evidence: RetrievedEvidence[]): string {
  const passages =
    evidence.length > 0
      ? evidence
          .slice(0, 6)
          .map((e, i) => {
            const rating = e.factCheckRating ? ` | fact-check rating: ${e.factCheckRating}` : '';
            const date = e.publishedAt ? ` | ${e.publishedAt.slice(0, 10)}` : '';
            return `[${i + 1}] ${e.publisher}${date}${rating}\n"${e.title}"\n${e.snippet}`;
          })
          .join('\n\n')
      : '(no evidence was retrieved)';

  return `CLAIM:\n"${claim}"\n\nEVIDENCE PASSAGES:\n${passages}`;
}

/** Strips code fences and pulls the first JSON object out of a model response. */
export function parseAssessment(raw: string): LlmAssessment | null {
  if (!raw) return null;

  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as { score?: unknown; reasoning?: unknown };
    const score = Number(parsed.score);
    if (!Number.isFinite(score)) return null;

    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning.trim() : '';
    if (!reasoning) return null;

    return {
      score: Math.max(-1, Math.min(1, score)),
      reasoning: reasoning.slice(0, 400),
    };
  } catch {
    return null;
  }
}

/**
 * Rejects any assessment whose rationale names an outlet that was not in the
 * retrieved set. Defence in depth: the prompt forbids it, and this enforces it.
 */
export function mentionsUnretrievedSource(reasoning: string, evidence: RetrievedEvidence[]): boolean {
  const allowed = new Set(evidence.map((e) => e.publisher.toLowerCase()));

  const KNOWN_OUTLETS = [
    'reuters', 'associated press', 'ap news', 'bbc', 'guardian', 'new york times', 'washington post',
    'bloomberg', 'cnn', 'npr', 'al jazeera', 'financial times', 'the economist', 'politifact',
    'snopes', 'factcheck.org', 'alt news', 'boom', 'factly', 'times of india', 'the hindu', 'ndtv',
  ];

  const text = reasoning.toLowerCase();
  return KNOWN_OUTLETS.some((outlet) => {
    if (!text.includes(outlet)) return false;
    // Allowed only if some retrieved publisher actually covers this name.
    for (const publisher of allowed) {
      if (publisher.includes(outlet)) return false;
    }
    return true;
  });
}

/**
 * Runs the reasoning layer. Returns null whenever no provider is configured,
 * the call fails, the response is unparseable, or the model broke the
 * no-new-sources rule — the Decision Engine then simply proceeds without it.
 */
export async function assess(
  claim: string,
  evidence: RetrievedEvidence[],
  timeoutMs = 4000
): Promise<LlmAssessment | null> {
  const result = await complete({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(claim, evidence),
    json: true,
    maxTokens: 300,
    temperature: 0,
    timeoutMs,
  });

  if (!result) return null;

  const assessment = parseAssessment(result.text);
  if (!assessment) return null;

  if (mentionsUnretrievedSource(assessment.reasoning, evidence)) {
    console.warn('[llm] discarded assessment citing an unretrieved source');
    return null;
  }

  return assessment;
}
