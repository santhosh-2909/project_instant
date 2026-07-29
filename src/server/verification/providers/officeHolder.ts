/**
 * Current office-holder verification via Wikidata.
 *
 * Solves a failure mode that pure text matching cannot: "X is the Chief
 * Minister of Y" and "X, the former Chief Minister of Y" share almost every
 * word, so lexical similarity scores both as strong support. Without this
 * check, a claim naming a *previous* office holder is confidently marked Real.
 *
 * Here we resolve the office's current holder from Wikidata's structured,
 * dated statements and compare it against the person named in the claim. That
 * yields a decisive Supporting or Contradicting verdict for what is one of the
 * most common forwarded-claim shapes in the PRD's target market
 * ("<name> is the new <office> of <place>").
 */

/*
 * BACKEND ONLY. The `server-only` import above makes this a build error if any
 * client component ever imports this module, directly or transitively. That is
 * not theoretical: the UI previously imported `tokenise` from the retrieval
 * module, which shipped the provider stack and the ONNX import path to the
 * browser.
 */
import 'server-only';
import type { RetrievedEvidence } from '@/shared/types';
import { extractEntities } from '@/shared/textMatch';
import { wikimediaJson, clearWikimediaCache } from '@/server/verification/providers/wikimediaClient';

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

/** Office phrases → the Wikidata property that records the current holder. */
const OFFICE_PROPERTIES: Array<{ patterns: string[]; property: string; label: string }> = [
  { patterns: ['chief minister', 'cm of'], property: 'P6', label: 'head of government' },
  { patterns: ['prime minister', 'pm of'], property: 'P6', label: 'head of government' },
  { patterns: ['mayor'], property: 'P6', label: 'head of government' },
  { patterns: ['president of'], property: 'P35', label: 'head of state' },
  { patterns: ['governor'], property: 'P1308', label: 'officeholder' },
  { patterns: ['chief executive', 'ceo of'], property: 'P169', label: 'chief executive officer' },
  { patterns: ['chairperson', 'chairman'], property: 'P488', label: 'chairperson' },
];

export interface OfficeQuery {
  property: string;
  officeLabel: string;
  /** The place or organisation the office belongs to. */
  subject: string;
  /** The person the claim asserts holds the office. */
  personCandidates: string[];
}

/**
 * Detects an "X is the <office> of <Y>" assertion.
 * Returns null when the claim is not of this shape — the common case.
 */
export function parseOfficeClaim(claim: string): OfficeQuery | null {
  const lower = (claim || '').toLowerCase();

  const match = OFFICE_PROPERTIES.find((entry) => entry.patterns.some((p) => lower.includes(p)));
  if (!match) return null;

  // The subject is what follows "of" after the office phrase — e.g.
  // "chief minister (CM) of tamil nadu" → "tamil nadu".
  const subjectMatch = /\bof\s+([a-z][a-z\s]{2,40}?)(?:$|[,.;!?]|\s+(?:is|was|has|and|since))/i.exec(
    claim.slice(lower.indexOf(match.patterns.find((p) => lower.includes(p))!))
  );

  const subject = subjectMatch?.[1]?.trim();
  if (!subject) return null;

  // Names in the claim, minus the subject itself.
  const personCandidates = extractEntities(claim).filter(
    (entity) => entity.toLowerCase() !== subject.toLowerCase() && !subject.toLowerCase().includes(entity.toLowerCase())
  );

  if (personCandidates.length === 0) return null;

  return { property: match.property, officeLabel: match.label, subject, personCandidates };
}

/** All Wikimedia traffic goes through the shared cached, gated client. */
const getJson = wikimediaJson;

interface SearchPayload {
  search?: Array<{ id?: string; label?: string; description?: string }>;
}

async function resolveEntity(label: string, timeoutMs: number): Promise<string | null> {
  const url =
    `${WIKIDATA_API}?action=wbsearchentities&format=json&language=en&uselang=en&origin=*` +
    `&limit=1&search=${encodeURIComponent(label)}`;
  const payload = (await getJson(url, timeoutMs)) as SearchPayload | null;
  return payload?.search?.[0]?.id ?? null;
}

interface ClaimsPayload {
  claims?: Record<
    string,
    Array<{
      rank?: string;
      mainsnak?: { datavalue?: { value?: { id?: string } } };
      qualifiers?: Record<string, Array<{ datavalue?: { value?: { time?: string } } }>>;
    }>
  >;
}

export interface Incumbent {
  id: string;
  since: string | null;
}

/**
 * Returns the *current* holder: a statement with no end date (P582),
 * preferring the most recent start date (P580) if several qualify.
 */
export async function currentHolder(
  entityId: string,
  property: string,
  timeoutMs: number
): Promise<Incumbent | null> {
  const url = `${WIKIDATA_API}?action=wbgetclaims&format=json&origin=*&entity=${entityId}&property=${property}`;
  const payload = (await getJson(url, timeoutMs)) as ClaimsPayload | null;

  const statements = payload?.claims?.[property] ?? [];
  const open = statements
    .filter((statement) => statement.rank !== 'deprecated')
    .filter((statement) => !statement.qualifiers?.P582) // no end date ⇒ still in office
    .map((statement) => ({
      id: statement.mainsnak?.datavalue?.value?.id ?? null,
      since: statement.qualifiers?.P580?.[0]?.datavalue?.value?.time ?? null,
    }))
    .filter((entry): entry is Incumbent => entry.id !== null);

  if (open.length === 0) return null;

  open.sort((a, b) => (b.since ?? '').localeCompare(a.since ?? ''));
  return open[0];
}

interface EntitiesPayload {
  entities?: Record<string, { labels?: { en?: { value?: string } }; aliases?: { en?: Array<{ value?: string }> } }>;
}

async function entityNames(entityId: string, timeoutMs: number): Promise<string[]> {
  const url =
    `${WIKIDATA_API}?action=wbgetentities&format=json&origin=*&props=labels|aliases&languages=en&ids=${entityId}`;
  const payload = (await getJson(url, timeoutMs)) as EntitiesPayload | null;
  const entity = payload?.entities?.[entityId];
  if (!entity) return [];

  const names = [entity.labels?.en?.value, ...(entity.aliases?.en ?? []).map((alias) => alias.value)];
  return names.filter((name): name is string => Boolean(name));
}

/** Loose personal-name comparison: surname-level overlap is enough. */
export function namesMatch(claimName: string, officialNames: string[]): boolean {
  const normalise = (value: string) =>
    value
      .toLowerCase()
      .replace(/[.'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const claimParts = new Set(normalise(claimName).split(' ').filter((part) => part.length > 2));
  if (claimParts.size === 0) return false;

  for (const official of officialNames) {
    const officialParts = new Set(normalise(official).split(' ').filter((part) => part.length > 2));
    if (officialParts.size === 0) continue;

    let shared = 0;
    for (const part of claimParts) if (officialParts.has(part)) shared += 1;

    // One shared distinctive token (usually the surname) is a match: claims say
    // "CM Vijay" where Wikidata holds "C. Joseph Vijay".
    if (shared >= 1) return true;
  }
  return false;
}

function formatSince(time: string | null): string {
  if (!time) return '';
  const iso = time.replace(/^\+/, '').slice(0, 10);
  return ` since ${iso}`;
}

/**
 * Checks an office claim against Wikidata's current record.
 * Returns a single high-confidence evidence item, or null when the claim is
 * not an office claim or the lookup could not be completed.
 */
export type OfficeCheckOutcome =
  | { status: 'not-an-office-claim' }
  | { status: 'lookup-failed'; stage: string }
  | { status: 'checked'; evidence: RetrievedEvidence };

/**
 * Full result, including *why* no evidence was produced. The orchestrator uses
 * this to record a genuine provider failure rather than silently degrading to
 * lexical matching — which previously made the verdict non-deterministic.
 */
export async function checkOfficeHolder(
  claim: string,
  { timeoutMs = 2500, deadlineMs = 5500 } = {}
): Promise<OfficeCheckOutcome> {
  const deadline = Date.now() + deadlineMs;
  const remaining = () => Math.max(400, Math.min(timeoutMs, deadline - Date.now()));
  const parsed = parseOfficeClaim(claim);
  if (!parsed) return { status: 'not-an-office-claim' };

  const subjectId = await resolveEntity(parsed.subject, remaining());
  if (!subjectId) return { status: 'lookup-failed', stage: 'resolve-subject' };

  const holder = await currentHolder(subjectId, parsed.property, remaining());
  if (!holder) return { status: 'lookup-failed', stage: 'current-holder' };

  const officialNames = await entityNames(holder.id, remaining());
  if (officialNames.length === 0) return { status: 'lookup-failed', stage: 'holder-name' };

  const officialName = officialNames[0];
  const claimed = parsed.personCandidates.find((candidate) => namesMatch(candidate, officialNames));
  const supports = Boolean(claimed);

  const evidence: RetrievedEvidence = {
    title: supports
      ? `Wikidata: ${officialName} is the current ${parsed.officeLabel} of ${parsed.subject}`
      : `Wikidata: the current ${parsed.officeLabel} of ${parsed.subject} is ${officialName}, not ${parsed.personCandidates[0]}`,
    publisher: 'Wikidata',
    author: null,
    url: `https://www.wikidata.org/wiki/${subjectId}#${parsed.property}`,
    publishedAt: null,
    snippet: supports
      ? `Wikidata's current record lists ${officialName} as ${parsed.officeLabel} of ${parsed.subject}${formatSince(holder.since)}, which matches the claim.`
      : `Wikidata's current record lists ${officialName} as ${parsed.officeLabel} of ${parsed.subject}${formatSince(holder.since)}. The claim names ${parsed.personCandidates[0]} instead.`,
    stance: supports ? 'Supporting' : 'Contradicting',
    // Structured, dated and directly on point — the strongest signal available.
    similarity: 0.95,
    reliability: 0.9,
    provider: 'wikidata',
  };

  return { status: 'checked', evidence };
}

/** Convenience wrapper for callers that only want the evidence. */
export async function verifyOfficeHolder(
  claim: string,
  options: { timeoutMs?: number } = {}
): Promise<RetrievedEvidence | null> {
  const result = await checkOfficeHolder(claim, options);
  return result.status === 'checked' ? result.evidence : null;
}

/** Test/maintenance helper — clears the shared Wikimedia cache. */
export const clearOfficeCache = clearWikimediaCache;
