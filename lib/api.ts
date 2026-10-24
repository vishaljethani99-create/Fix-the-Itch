import type { ComposeRequest, ComposeResponse, SimplifyRequest, SimplifyResponse } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isComposeResponse(value: unknown): value is ComposeResponse {
  if (!isRecord(value) || typeof value.sentence !== 'string') return false;
  if (value.fallback !== undefined && typeof value.fallback !== 'boolean') return false;
  if (value.summary === undefined) return true;
  if (!isRecord(value.summary)) return false;
  return (
    typeof value.summary.needs === 'string' &&
    typeof value.summary.symptoms === 'string' &&
    typeof value.summary.notes === 'string'
  );
}

function isSimplifyResponse(value: unknown): value is SimplifyResponse {
  return (
    isRecord(value) &&
    typeof value.caption === 'string' &&
    Array.isArray(value.keyTerms) &&
    value.keyTerms.every((term) => typeof term === 'string') &&
    Array.isArray(value.quickReplies) &&
    value.quickReplies.every((reply) => typeof reply === 'string') &&
    (value.fallback === undefined || typeof value.fallback === 'boolean')
  );
}

export async function composeSigns(req: ComposeRequest): Promise<ComposeResponse> {
  const fallbackSentence = req.signs.join(' ');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);

  try {
    const res = await fetch('/api/compose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Compose request failed with status ${res.status}`);
    const response: unknown = await res.json();
    if (!isComposeResponse(response)) throw new Error('Compose API returned an invalid response');
    return response;
  } catch {
    return { sentence: fallbackSentence, fallback: true };
  } finally {
    clearTimeout(timer);
  }
}

export async function simplifySpeech(req: SimplifyRequest): Promise<SimplifyResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);

  try {
    const res = await fetch('/api/simplify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Simplify request failed with status ${res.status}`);
    const response: unknown = await res.json();
    if (!isSimplifyResponse(response)) throw new Error('Simplify API returned an invalid response');
    return response;
  } catch {
    return {
      caption: req.speech,
      keyTerms: [],
      quickReplies: ['Yes', 'No', 'Wait'],
      fallback: true,
    };
  } finally {
    clearTimeout(timer);
  }
}