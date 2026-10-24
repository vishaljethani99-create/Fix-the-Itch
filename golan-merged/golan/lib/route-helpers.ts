import { ProviderError, errorResponse } from './errors';
import { MAX_BODY_BYTES } from './validation';

/** Read and JSON-parse a request body with a size limit. Returns a Response on failure. */
export async function readJsonBody(request: Request): Promise<{ body: unknown } | { response: Response }> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return { response: errorResponse('payload_too_large', 413, 'Request body is too large.') };
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return { response: errorResponse('payload_too_large', 413, 'Request body is too large.') };
  }
  try {
    return { body: JSON.parse(text) as unknown };
  } catch {
    return { response: errorResponse('invalid_json', 400, 'Request body must be valid JSON.') };
  }
}

export function providerErrorResponse(err: unknown): Response {
  if (err instanceof ProviderError) return errorResponse(err.code, err.status, err.message);
  console.error('[api] unexpected error');
  return errorResponse('provider_error', 500, 'Unexpected server error.');
}
