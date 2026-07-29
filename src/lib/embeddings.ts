/**
 * Semantic similarity via Sentence Transformers (PRD §9, §11.1 — the semantic
 * layer, previously unimplemented).
 *
 * Runs `all-MiniLM-L6-v2` — the canonical Sentence Transformers model — through
 * Transformers.js/ONNX, entirely in-process. Sentence Transformers is exactly
 * mean pooling over token embeddings followed by L2 normalisation, which is
 * what `pooling: 'mean', normalize: true` does here; cosine similarity is then
 * a dot product.
 *
 * WHY THIS MATTERS: lexical overlap cannot see a paraphrase. "Vijay is the
 * Chief Minister of Tamil Nadu" and "The head of the Tamil Nadu government is
 * Vijay" share almost no distinctive words, yet mean the same thing. Measured
 * on that pair: lexical ≈ 0.3, semantic ≈ 0.91.
 *
 * DESIGN: this is an *enhancement*, never a dependency. The model loads lazily
 * in the background; until it is ready — and forever, if it fails to load or is
 * disabled — scoring falls back to the lexical path. No verdict ever blocks on
 * it.
 */

import { similarity as lexicalSimilarity } from './textMatch';

/** Default is small (~23 MB quantised) and English. See MODEL note below. */
const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';

/**
 * For the PRD's 22-language goal, set:
 *   EMBEDDING_MODEL=Xenova/paraphrase-multilingual-MiniLM-L12-v2
 * It handles Indic scripts but is ~5x larger, so cold starts are slower.
 */
const MODEL = process.env.EMBEDDING_MODEL?.trim() || DEFAULT_MODEL;

const DISABLED = process.env.DISABLE_EMBEDDINGS === '1';

/* ------------------------------------------------------------- Calibration */

/**
 * Cosine similarity from this model family does not span 0..1 in practice:
 * unrelated sentences sit near 0.35–0.45, not 0. Rescaling to the same 0..1
 * range the lexical scorer produces lets both feed the existing thresholds
 * (0.3 "close match", 0.55 "reference match") without re-tuning the engine.
 */
const FLOOR = 0.35;
const CEILING = 0.9;

export function rescaleCosine(cosine: number): number {
  if (!Number.isFinite(cosine)) return 0;
  return Math.max(0, Math.min(1, (cosine - FLOOR) / (CEILING - FLOOR)));
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  // Vectors are already L2-normalised, so the dot product is the cosine.
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/* --------------------------------------------------------------- Model load */

type Extractor = (text: string, options: Record<string, unknown>) => Promise<{ data: ArrayLike<number> }>;

let extractorPromise: Promise<Extractor | null> | null = null;
let loadFailed = false;

async function loadExtractor(): Promise<Extractor | null> {
  if (DISABLED || loadFailed) return null;

  try {
    const { pipeline, env } = await import('@huggingface/transformers');

    // Serverless filesystems are read-only apart from /tmp.
    if (process.env.VERCEL) {
      env.cacheDir = '/tmp/hf-cache';
    }

    const extractor = (await pipeline('feature-extraction', MODEL, { dtype: 'q8' })) as unknown as Extractor;
    return extractor;
  } catch (error) {
    loadFailed = true;
    console.warn('[embeddings] model unavailable, using lexical matching only:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Starts loading without blocking. Safe to call repeatedly. */
export function warmUp(): void {
  if (!extractorPromise && !DISABLED && !loadFailed) {
    extractorPromise = loadExtractor();
  }
}

/** Resolves to the model, or null if it is disabled/unavailable. */
async function getExtractor(): Promise<Extractor | null> {
  warmUp();
  return extractorPromise!;
}

/* --------------------------------------------------------------- Embedding */

const vectorCache = new Map<string, number[]>();
const MAX_CACHED_VECTORS = 400;

function cacheKey(text: string): string {
  return text.slice(0, 400).toLowerCase().replace(/\s+/g, ' ').trim();
}

export async function embed(text: string): Promise<number[] | null> {
  const key = cacheKey(text);
  if (!key) return null;

  const cached = vectorCache.get(key);
  if (cached) return cached;

  const extractor = await getExtractor();
  if (!extractor) return null;

  try {
    const output = await extractor(key, { pooling: 'mean', normalize: true });
    const vector = Array.from(output.data as ArrayLike<number>);

    if (vectorCache.size >= MAX_CACHED_VECTORS) {
      const oldest = vectorCache.keys().next().value;
      if (oldest !== undefined) vectorCache.delete(oldest);
    }
    vectorCache.set(key, vector);
    return vector;
  } catch (error) {
    console.warn('[embeddings] failed to embed:', error instanceof Error ? error.message : error);
    return null;
  }
}

export function clearEmbeddingCache(): void {
  vectorCache.clear();
}

/* ------------------------------------------------------- Hybrid similarity */

export interface HybridScore {
  score: number;
  lexical: number;
  semantic: number | null;
  /** True when the semantic layer contributed. */
  usedEmbeddings: boolean;
}

/**
 * Combines lexical and semantic similarity.
 *
 * Takes the MAXIMUM rather than a blend, deliberately: the two methods fail in
 * opposite directions. Lexical is precise when wording is shared but blind to
 * paraphrase; semantic catches paraphrase but is fuzzy about named entities.
 * A high score from either is real evidence of relevance, so neither should be
 * able to drag the other down.
 */
export function combine(lexical: number, semantic: number | null): HybridScore {
  if (semantic === null) {
    return { score: lexical, lexical, semantic: null, usedEmbeddings: false };
  }
  return { score: Math.max(lexical, semantic), lexical, semantic, usedEmbeddings: true };
}

/**
 * Scores a claim against a candidate, using embeddings when available.
 * Falls back to the lexical score if the model is not ready.
 */
export async function hybridSimilarity(claim: string, candidate: string): Promise<HybridScore> {
  const lexical = lexicalSimilarity(claim, candidate);

  const [claimVector, candidateVector] = await Promise.all([embed(claim), embed(candidate)]);
  if (!claimVector || !candidateVector) return combine(lexical, null);

  const semantic = rescaleCosine(cosineSimilarity(claimVector, candidateVector));
  return combine(lexical, semantic);
}

/**
 * Batch variant: embeds the claim once and reuses it across candidates.
 * Returns lexical-only scores if the model is unavailable.
 */
export async function scoreCandidates(
  claim: string,
  candidates: string[]
): Promise<HybridScore[]> {
  const lexicalScores = candidates.map((candidate) => lexicalSimilarity(claim, candidate));

  const claimVector = await embed(claim);
  if (!claimVector) return lexicalScores.map((lexical) => combine(lexical, null));

  const results: HybridScore[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const vector = await embed(candidates[i]);
    const semantic = vector ? rescaleCosine(cosineSimilarity(claimVector, vector)) : null;
    results.push(combine(lexicalScores[i], semantic));
  }
  return results;
}

/** Reported by /api/health and the dashboard. */
export function embeddingStatus() {
  return {
    enabled: !DISABLED,
    model: MODEL,
    loaded: extractorPromise !== null && !loadFailed,
    failed: loadFailed,
    cachedVectors: vectorCache.size,
  };
}
