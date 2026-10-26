import type { ApiErrorBody, ApiErrorCode } from './types';

export class ProviderError extends Error {
  constructor(
    public code: ApiErrorCode,
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export function errorResponse(code: ApiErrorCode, status: number, message: string): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, { status });
}

/** Map an arbitrary SDK/network failure to a safe, stable error. Never includes provider text or keys. */
export function classifyProviderError(err: unknown, timedOut: boolean): ProviderError {
  if (err instanceof ProviderError) return err;
  if (timedOut) return new ProviderError('timeout', 504, 'The language model took too long to respond.');
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status: unknown }).status)
      : NaN;
  if (status === 401 || status === 403)
    return new ProviderError('provider_auth', 502, 'The server could not authenticate with the language model.');
  if (status === 429) return new ProviderError('rate_limited', 429, 'The language model is rate limited. Try again shortly.');
  return new ProviderError('provider_error', 502, 'The language model request failed.');
}
