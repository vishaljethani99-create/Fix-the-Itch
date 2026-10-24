import type {
  ApiErrorBody,
  ComposeRequest,
  ComposeResponse,
  ResponseSource,
  SimplifyRequest,
  SimplifyResponse,
} from './types';

export const CLIENT_TIMEOUT_MS = 12_000; // slightly above the server's 10 s so the server's error arrives first

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isSource = (v: unknown): v is ResponseSource => v === 'live' || v === 'mock' || v === 'fallback';

function isComposeResponse(value: unknown): value is ComposeResponse {
  if (!isRecord(value) || typeof value.sentence !== 'string') return false;
  if (value.fallback !== undefined && typeof value.fallback !== 'boolean') return false;
  if (value.source !== undefined && !isSource(value.source)) return false;
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
    value.keyTerms.every((t) => typeof t === 'string') &&
    Array.isArray(value.quickReplies) &&
    value.quickReplies.every((r) => typeof r === 'string') &&
    (value.fallback === undefined || typeof value.fallback === 'boolean') &&
    (value.source === undefined || isSource(value.source))
  );
}

/** Turn any failed fetch into a short, user-safe reason. Distinguishes validation/auth/rate-limit/network. */
async function describeFailure(res: Response | null, err: unknown): Promise<string> {
  if (!res) {
    return err instanceof DOMException && err.name === 'AbortError'
      ? 'The request timed out.'
      : 'Network error: could not reach the server.';
  }
  let message = '';
  try {
    const body = (await res.json()) as Partial<ApiErrorBody>;
    message = body?.error?.message ?? '';
  } catch {
    /* body was not JSON */
  }
  if (res.status === 400) return message || 'The request was rejected as invalid.';
  if (res.status === 401 || res.status === 403) return message || 'Not authorised.';
  if (res.status === 429) return message || 'Rate limited. Try again shortly.';
  return message || `Server error (${res.status}).`;
}

async function post(path: string, payload: unknown): Promise<{ res: Response | null; err?: unknown }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CLIENT_TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    return { res };
  } catch (err) {
    return { res: null, err };
  } finally {
    clearTimeout(timer);
  }
}

/** Never throws. On failure returns the raw signs with source:'fallback' and a visible `error`. */
export async function composeSigns(req: ComposeRequest): Promise<ComposeResponse> {
  const fallback = (error: string): ComposeResponse => ({
    sentence: req.signs.join(' ').toLowerCase(),
    fallback: true,
    source: 'fallback',
    error,
  });
  const { res, err } = await post('/api/compose', req);
  if (!res || !res.ok) return fallback(await describeFailure(res, err));
  try {
    const body: unknown = await res.json();
    if (!isComposeResponse(body)) return fallback('The server returned an unexpected response.');
    return { ...body, source: body.source ?? (body.fallback ? 'fallback' : 'live') };
  } catch {
    return fallback('The server returned an unreadable response.');
  }
}

export async function simplifySpeech(req: SimplifyRequest): Promise<SimplifyResponse> {
  const fallback = (error: string): SimplifyResponse => ({
    caption: req.speech,
    keyTerms: [],
    quickReplies: ['Yes', 'No', 'Please repeat'],
    fallback: true,
    source: 'fallback',
    error,
  });
  const { res, err } = await post('/api/simplify', req);
  if (!res || !res.ok) return fallback(await describeFailure(res, err));
  try {
    const body: unknown = await res.json();
    return isSimplifyResponse(body) ? body : fallback('The server returned an unexpected response.');
  } catch {
    return fallback('The server returned an unreadable response.');
  }
}
