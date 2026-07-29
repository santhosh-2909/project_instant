/**
 * Google News RSS — real-time news, no API key required.
 *
 * This is the workhorse provider: it indexes thousands of outlets worldwide,
 * updates within minutes of publication, and needs no signup. It is what makes
 * VeritasGuard useful immediately rather than only after a key is obtained.
 *
 * RSS is parsed with scoped regex rather than a DOM parser to avoid pulling in
 * an XML dependency for one well-known, machine-generated feed shape.
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
import { publisherReliability, similarity } from '@/shared/textMatch';

const FEED = 'https://news.google.com/rss/search';

/** Decodes the XML/HTML entities that appear in RSS payloads. */
export function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');
}

function tag(block: string, name: string): string | null {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(block);
  return match ? decodeEntities(match[1]).trim() : null;
}

/** Google News appends " - Publisher" to every headline; strip it. */
export function splitHeadline(title: string, publisher: string | null): string {
  if (!publisher) return title;
  const suffix = ` - ${publisher}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title;
}

/** Strips the HTML Google embeds in RSS descriptions. */
function plainText(html: string | null): string {
  if (!html) return '';
  return decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

export interface RssItem {
  title: string;
  link: string;
  publisher: string;
  publishedAt: string | null;
  description: string;
}

export function parseRss(xml: string, limit = 20): RssItem[] {
  const items: RssItem[] = [];

  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = match[1];
    const rawTitle = tag(block, 'title');
    const link = tag(block, 'link');
    if (!rawTitle || !link) continue;

    const publisher = tag(block, 'source') ?? 'Unknown';

    items.push({
      title: splitHeadline(rawTitle, publisher),
      link,
      publisher,
      publishedAt: parseDate(tag(block, 'pubDate')),
      description: plainText(tag(block, 'description')),
    });

    if (items.length >= limit) break;
  }

  return items;
}

function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Searches Google News.
 *
 * `region` biases results — the default targets India, matching the PRD's
 * primary audience, without excluding global coverage.
 */
export async function searchGoogleNews(
  claim: string,
  query: string,
  { timeoutMs = 4000, region = 'IN', language = 'en' } = {}
): Promise<RetrievedEvidence[] | null> {
  if (!query.trim()) return [];

  const url =
    `${FEED}?q=${encodeURIComponent(query)}` +
    `&hl=${language}-${region}&gl=${region}&ceid=${region}:${language}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      // Google serves an error page to clients with no UA.
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VeritasGuard/1.0)' },
    });
    if (!response.ok) return null;

    const xml = await response.text();

    return parseRss(xml).map((item) => ({
      title: item.title,
      publisher: item.publisher,
      author: null,
      url: item.link,
      publishedAt: item.publishedAt,
      snippet: item.description || item.title,
      stance: 'Neutral' as const,
      similarity: similarity(claim, `${item.title} ${item.description}`),
      reliability: publisherReliability(item.publisher),
      provider: 'googlenews' as const,
    }));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
