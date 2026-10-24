import { errorResponse } from '../../../lib/errors';
import { runCompose } from '../../../lib/gemma';
import { providerErrorResponse, readJsonBody } from '../../../lib/route-helpers';
import { parseComposeRequest } from '../../../lib/validation';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const read = await readJsonBody(request);
  if ('response' in read) return read.response;

  const input = parseComposeRequest(read.body);
  if (!input) return errorResponse('invalid_request', 400, 'Invalid compose request.');

  try {
    return Response.json(await runCompose(input));
  } catch (err) {
    return providerErrorResponse(err);
  }
}
