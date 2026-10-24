import { runSimplify } from '../../../lib/gemma';
import { parseSimplifyRequest } from '../../../lib/validation';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const input = parseSimplifyRequest(body);
  if (!input) {
    return Response.json({ error: 'Invalid simplify request.' }, { status: 400 });
  }

  return Response.json(await runSimplify(input));
}
