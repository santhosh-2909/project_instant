/*
 * BACKEND ONLY. The `server-only` import below makes this a build error if any
 * client component ever imports this module, directly or transitively.
 */
import 'server-only';

import { optionalKey } from '@/server/config/env';
import type { CompletionRequest, CompletionResult } from '@/server/verification/groqClient';

/**
 * Google Gemini — the AI fallback.
 *
 * Groq carries the reasoning signal and writes the report. Gemini exists so
 * that one provider being down, rate-limited or misconfigured does not silently
 * remove the AI layer from every verdict — a failure mode this codebase has hit
 * twice already, once from a model id missing a character and once from a key
 * that was not a key at all.
 *
 * Called through the REST API rather than @google/generative-ai: the request is
 * a single POST, and the SDK was already removed from the dependency list once
 * as dead weight.
 *
 * AUTH NOTE: the key goes in the `key` query parameter. Gemini rejects it as a
 * bearer token — verified: `?key=` returns 200, `Authorization: Bearer` returns
 * 401 "Expected OAuth 2 access token".
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Tried in order, first working one is remembered.
 *
 * Google retires Gemini models *while still listing them*: gemini-2.5-flash
 * appears in the models endpoint but returns 404 "no longer available to new
 * users" when called. So the list is not a guide to what a given key can
 * actually use, and only a real request settles it. Measured with a fresh key —
 * 2.5-flash and 2.5-flash-lite both 404, 2.0-flash 429s on quota, while the
 * three below answer normally.
 *
 * `gemini-flash-latest` is last as the durable fallback: it is an alias Google
 * repoints, so it should outlive any specific id here.
 */
const MODEL_CHAIN = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

export function configuredGeminiModels(): string[] {
  const pinned = process.env.GEMINI_MODEL?.trim();
  // A pinned id is a preference, not an exclusive — same rule as Groq, learned
  // the same way.
  if (!pinned) return MODEL_CHAIN;
  return [pinned, ...MODEL_CHAIN.filter((m) => m !== pinned)];
}

export const geminiModel = () => configuredGeminiModels()[0];

/** Remembered across calls so the chain is probed once, not per request. */
let workingModel: string | null = null;

/** A model id that exists in the listing but this key cannot call. */
function isModelUnavailable(status: number, message: string): boolean {
  const text = message.toLowerCase();
  return status === 404 || text.includes('no longer available') || text.includes('not found');
}

interface GeminiPayload {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string; code?: number };
}

/**
 * Runs a completion against Gemini, returning the same shape as the Groq
 * client so the two are interchangeable to callers.
 */
export async function completeWithGemini(request: CompletionRequest): Promise<CompletionResult | null> {
  const apiKey = optionalKey('GEMINI_API_KEY');
  if (!apiKey) return null;

  const { system, user, json = false, maxTokens = 400, temperature = 0, timeoutMs = 8000 } = request;

  const candidates = workingModel
    ? [workingModel, ...configuredGeminiModels().filter((m) => m !== workingModel)]
    : configuredGeminiModels();

  for (const model of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        `${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          signal: controller.signal,
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Gemini has no "system" role; systemInstruction is the equivalent.
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: {
              temperature,
              // Gemini 3 reasons before answering and those tokens count here,
              // so a budget sized for the answer alone comes back empty.
              maxOutputTokens: maxTokens + 1200,
              ...(json ? { responseMimeType: 'application/json' } : {}),
            },
          }),
        }
      );

      const data = (await response.json().catch(() => null)) as GeminiPayload | null;

      if (!response.ok || data?.error) {
        const message = data?.error?.message ?? `HTTP ${response.status}`;
        if (isModelUnavailable(response.status, message)) {
          console.warn(`[gemini] "${model}" unavailable to this key, trying the next`);
          continue;
        }
        console.warn(`[gemini] request failed on "${model}": ${message.slice(0, 160)}`);
        return null; // quota and auth failures are not fixed by another model
      }

      const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
      if (!text.trim()) {
        console.warn(`[gemini] "${model}" returned empty text (finishReason: ${data?.candidates?.[0]?.finishReason ?? 'unknown'})`);
        continue;
      }

      workingModel = model;
      return { text, model };
    } catch (error) {
      console.warn('[gemini] request failed:', error instanceof Error ? error.message : error);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  console.warn('[gemini] no model in the chain was usable');
  return null;
}

/** Diagnostic for /api/health?probe=1. */
export async function probeGemini(): Promise<{
  configured: boolean;
  reachable: boolean;
  model: string | null;
  error?: string;
}> {
  if (!optionalKey('GEMINI_API_KEY')) {
    return { configured: false, reachable: false, model: null };
  }

  const result = await completeWithGemini({
    system: 'Reply with exactly: ok',
    user: 'ping',
    maxTokens: 2000, // Gemini 2.5 reasons before answering; a small budget yields empty text.
    timeoutMs: 15_000,
  });

  return result
    ? { configured: true, reachable: true, model: result.model }
    : { configured: true, reachable: false, model: null, error: `No response from ${geminiModel()}.` };
}
