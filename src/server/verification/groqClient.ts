/*
 * BACKEND ONLY. The `server-only` import below makes this a build error if any
 * client component ever imports this module, directly or transitively.
 */
import 'server-only';

import OpenAI from 'openai';
import { optionalKey } from '@/server/config/env';

/**
 * Shared Groq client.
 *
 * Groq exposes an OpenAI-compatible endpoint, so the `openai` SDK talks to it
 * directly — no extra dependency.
 *
 * MODEL SELECTION: Groq retires model ids on a rolling basis, and a pinned id
 * that disappears turns every AI call into a silent no-op (this codebase
 * deliberately degrades rather than failing loudly, which would hide it). So
 * instead of one hardcoded model there is a fallback chain: the first id that
 * answers is remembered for the process lifetime. Setting GROQ_MODEL overrides
 * the chain entirely.
 */

/** Tried in order. Fast and cheap first — this is a supporting signal, not the verdict. */
const MODEL_CHAIN = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
];

export function configuredModels(): string[] {
  const pinned = process.env.GROQ_MODEL?.trim();
  return pinned ? [pinned] : MODEL_CHAIN;
}

let client: OpenAI | null = null;

export function groqClient(): OpenAI | null {
  const apiKey = optionalKey('GROQ_API_KEY');
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' });
  return client;
}

/** The model id that last answered successfully, if any. */
let workingModel: string | null = null;

export const currentModel = () => workingModel;

export interface CompletionRequest {
  system: string;
  user: string;
  /** Ask Groq to constrain output to a JSON object. */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface CompletionResult {
  text: string;
  model: string;
}

/** A model id that does not exist, or that this key cannot use. */
function isModelUnavailable(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    status === 404 ||
    message.includes('does not exist') ||
    message.includes('model_not_found') ||
    message.includes('decommissioned') ||
    message.includes('has been deprecated')
  );
}

/**
 * Runs a completion, walking the fallback chain past retired models.
 * Returns null when Groq is unconfigured, unreachable, or every model failed —
 * callers treat that as "this layer did not contribute".
 */
export async function complete(request: CompletionRequest): Promise<CompletionResult | null> {
  const groq = groqClient();
  if (!groq) return null;

  const { system, user, json = false, maxTokens = 400, temperature = 0, timeoutMs = 6000 } = request;

  // A model already known to work goes first; no need to re-probe the chain.
  const candidates = workingModel
    ? [workingModel, ...configuredModels().filter((m) => m !== workingModel)]
    : configuredModels();

  for (const model of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await groq.chat.completions.create(
        {
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature,
          max_tokens: maxTokens,
          ...(json ? { response_format: { type: 'json_object' as const } } : {}),
        },
        { signal: controller.signal }
      );

      const text = response.choices[0]?.message?.content ?? '';
      if (!text.trim()) continue;

      workingModel = model;
      return { text, model };
    } catch (error) {
      if (isModelUnavailable(error)) {
        console.warn(`[groq] model "${model}" unavailable, trying the next in the chain`);
        continue; // retired or not permitted for this key — try the next
      }
      // Auth failures, rate limits and timeouts are not fixed by another model.
      console.warn('[groq] request failed:', error instanceof Error ? error.message : error);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  console.warn('[groq] no model in the chain was usable');
  return null;
}

/** Diagnostic for /api/health — verifies the key actually works. */
export async function probeGroq(): Promise<{
  configured: boolean;
  reachable: boolean;
  model: string | null;
  error?: string;
}> {
  if (!groqClient()) return { configured: false, reachable: false, model: null };

  try {
    const result = await complete({
      system: 'Reply with exactly: ok',
      user: 'ping',
      maxTokens: 5,
      timeoutMs: 8000,
    });

    if (!result) {
      return { configured: true, reachable: false, model: null, error: 'No model in the chain responded.' };
    }
    return { configured: true, reachable: true, model: result.model };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      model: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
