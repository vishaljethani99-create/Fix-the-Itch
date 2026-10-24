import { errorResponse } from '../../../lib/errors';
import { runSimplify } from '../../../lib/gemma';
import { providerErrorResponse, readJsonBody } from '../../../lib/route-helpers';
import { parseSimplifyRequest } from '../../../lib/validation';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const read = await readJsonBody(request);
  if ('response' in read) return read.response;

  const input = parseSimplifyRequest(read.body);
  if (!input) return errorResponse('invalid_request', 400, 'Invalid simplify request.');

  try {
    return Response.json(await runSimplify(input));
  } catch (err) {
    return providerErrorResponse(err);
  }
}
