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
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
];

/**
 * A pinned GROQ_MODEL is a *preference*, not an exclusive.
 *
 * It used to be exclusive, and a single typo in .env ("openai/gpt-oss-120"
 * instead of "…-120b") disabled the entire AI layer with one warning in the
 * log. Preferring the pinned id but keeping the chain behind it means a bad
 * value costs you your preferred model, not the feature.
 */
export function configuredModels(): string[] {
  const pinned = process.env.GROQ_MODEL?.trim();
  if (!pinned) return MODEL_CHAIN;
  return [pinned, ...MODEL_CHAIN.filter((m) => m !== pinned)];
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

/**
 * Models that emit an internal `reasoning` field before writing `content`.
 *
 * Those reasoning tokens are billed against max_tokens, so a budget sized for a
 * short answer gets consumed entirely by the thinking and `content` comes back
 * as an empty string with finish_reason "stop" — a success response with no
 * output. Measured on openai/gpt-oss-120b: max_tokens 10 returned '', while
 * max_tokens 400 returned 'ok' after spending 25 tokens reasoning.
 *
 * These models need headroom on top of whatever the caller asked for.
 */
const REASONING_MODEL = /gpt-oss|qwen3|^o[1-9]|deepseek-r/i;
const REASONING_HEADROOM = 700;

function tokenBudget(model: string, requested: number): number {
  return REASONING_MODEL.test(model) ? requested + REASONING_HEADROOM : requested;
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
          max_tokens: tokenBudget(model, maxTokens),
          ...(json ? { response_format: { type: 'json_object' as const } } : {}),
        },
        { signal: controller.signal }
      );

      const choice = response.choices[0];
      const text = choice?.message?.content ?? '';

      if (!text.trim()) {
        const reason = choice?.finish_reason;
        console.warn(
          `[groq] model "${model}" returned empty content` +
            (reason === 'length' ? ' (hit the token limit while reasoning)' : ` (finish_reason: ${reason})`)
        );
        continue;
      }

      workingModel = model;
      return { text, model };
    } catch (error) {
      if (isModelUnavailable(error)) {
        const pinned = process.env.GROQ_MODEL?.trim();
        if (model === pinned) {
          console.warn(
            `[groq] GROQ_MODEL="${model}" is not a valid model id for this key. ` +
              'Check https://api.groq.com/openai/v1/models. Falling back to the built-in chain.'
          );
        } else {
          console.warn(`[groq] model "${model}" unavailable, trying the next in the chain`);
        }
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
      // Generous on purpose: a reasoning model needs room to think before it
      // can produce even a two-character answer.
      maxTokens: 64,
      timeoutMs: 15000,
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
