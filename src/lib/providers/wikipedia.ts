/**
 * Wikipedia + Wikidata — encyclopaedic and structured reference, no API key.
 *
 * These answer a different question from news: not "is anyone reporting this?"
 * but "what is the recorded state of the world right now?". Wikidata in
 * particular holds current office-holders, dates and relationships as typed
 * statements, which is exactly the shape of many forwarded claims
 * ("X is now the Y of Z").
 */

import type { RetrievedEvidence } from '../retrievalTypes';
import { extractEntities, publisherReliability, similarity } from '../textMatch';
import { wikimediaJson } from './wikimediaClient';

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

/** All Wikimedia traffic goes through the shared cached, gated client. */
const getJson = wikimediaJson;

/* --------------------------------------------------------------- Wikipedia */

interface WikiSearchPayload {
  query?: { search?: Array<{ title?: string; pageid?: number; snippet?: string }> };
}

interface WikiExtractPayload {
  query?: { pages?: Record<string, { title?: string; extract?: string; touched?: string }> };
}

/** Strips the HTML Wikipedia puts in search snippets. */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export async function searchWikipedia(
  claim: string,
  query: string,
  { timeoutMs = 4000, limit = 3 } = {}
): Promise<RetrievedEvidence[] | null> {
  if (!query.trim()) return [];

  const searchUrl =
    `${WIKI_API}?action=query&list=search&format=json&origin=*` +
    `&srsearch=${encodeURIComponent(query)}&srlimit=${limit}`;

  const search = (await getJson(searchUrl, timeoutMs)) as WikiSearchPayload | null;
  if (!search) return null;

  const titles = (search.query?.search ?? []).map((hit) => hit.title).filter(Boolean) as string[];
  if (titles.length === 0) return [];

  // Fetch the lead extract for each hit in one call.
  const extractUrl =
    `${WIKI_API}?action=query&prop=extracts|info&explaintext=1&exintro=1&format=json&origin=*` +
    `&titles=${encodeURIComponent(titles.join('|'))}`;

  const extracts = (await getJson(extractUrl, timeoutMs)) as WikiExtractPayload | null;
  const pages = Object.values(extracts?.query?.pages ?? {});

  const byTitle = new Map(pages.map((page) => [page.title ?? '', page]));

  return (search.query?.search ?? [])
    .filter((hit) => hit.title)
    .map((hit) => {
      const page = byTitle.get(hit.title!);
      const body = page?.extract ?? stripTags(hit.snippet ?? '');

      return {
        title: hit.title!,
        publisher: 'Wikipedia',
        author: null,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title!.replace(/ /g, '_'))}`,
        publishedAt: page?.touched ?? null,
        snippet: body.slice(0, 420),
        stance: 'Neutral' as const,
        similarity: similarity(claim, `${hit.title} ${body}`),
        reliability: publisherReliability('Wikipedia'),
        provider: 'wikipedia' as const,
      };
    });
}

/* ---------------------------------------------------------------- Wikidata */

interface WikidataSearchPayload {
  search?: Array<{ id?: string; label?: string; description?: string; concepturi?: string }>;
}

/**
 * Resolves the claim's named entities against Wikidata and returns their
 * current descriptions.
 *
 * A Wikidata description is short, curated and — crucially — kept current, so
 * "C. Joseph Vijay: Indian actor and politician, Chief Minister of Tamil Nadu"
 * is decisive evidence for a claim about who holds that office, in a way no
 * amount of prose analysis could be.
 */
export async function searchWikidata(
  claim: string,
  { timeoutMs = 4000, maxEntities = 3 } = {}
): Promise<RetrievedEvidence[] | null> {
  const entities = extractEntities(claim).slice(0, maxEntities);
  if (entities.length === 0) return [];

  const results: RetrievedEvidence[] = [];
  let anySucceeded = false;

  await Promise.all(
    entities.map(async (entity) => {
      const url =
        `${WIKIDATA_API}?action=wbsearchentities&format=json&language=en&uselang=en&origin=*` +
        `&limit=1&search=${encodeURIComponent(entity)}`;

      const payload = (await getJson(url, timeoutMs)) as WikidataSearchPayload | null;
      if (!payload) return;

      anySucceeded = true;
      const hit = payload.search?.[0];
      if (!hit?.id || !hit.label) return;

      const description = hit.description ?? '';
      if (!description) return;

      results.push({
        title: `${hit.label} — ${description}`,
        publisher: 'Wikidata',
        author: null,
        url: hit.concepturi ?? `https://www.wikidata.org/wiki/${hit.id}`,
        publishedAt: null,
        snippet: `Wikidata records "${hit.label}" as: ${description}.`,
        stance: 'Neutral' as const,
        similarity: similarity(claim, `${hit.label} ${description}`),
        reliability: publisherReliability('Wikidata'),
        provider: 'wikidata' as const,
      });
    })
  );

  if (!anySucceeded) return null;
  return results;
}
