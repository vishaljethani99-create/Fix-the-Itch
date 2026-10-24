import test from 'node:test';
import assert from 'node:assert/strict';
import { POST as compose } from '../app/api/compose/route';
import { POST as simplify } from '../app/api/simplify/route';
import { classifyProviderError } from '../lib/errors';

const req = (body: unknown, raw = false) =>
  new Request('http://x/api/compose', { method: 'POST', body: raw ? (body as string) : JSON.stringify(body) });
const valid = { signs: ['HELP'], scenario: 'hospital', lang: 'en', history: [] };

test('mock mode returns explicit mock source (never "live")', async () => {
  process.env.MOCK_GEMMA = 'true';
  const res = await compose(req(valid));
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.source, 'mock'); assert.equal(body.fallback, true);
});
test('400 for bad JSON, bad scenario, bad history role', async () => {
  process.env.MOCK_GEMMA = 'true';
  let r = await compose(req('{not json', true)); assert.equal(r.status, 400); assert.equal((await r.json()).error.code, 'invalid_json');
  r = await compose(req({ ...valid, scenario: 'general' })); assert.equal(r.status, 400); assert.equal((await r.json()).error.code, 'invalid_request');
  r = await compose(req({ ...valid, history: [{ who: 'x', text: 'y' }] })); assert.equal(r.status, 400);
});
test('413 for oversized body', async () => {
  const r = await compose(req('x'.repeat(40_000), true)); assert.equal(r.status, 413);
});
test('empty sign list -> explicit empty fallback', async () => {
  process.env.MOCK_GEMMA = 'true';
  const body = await (await compose(req({ ...valid, signs: [] }))).json();
  assert.deepEqual([body.sentence, body.source], ['', 'fallback']);
});
test('live mode without a key -> 503 not_configured (no silent mock)', async () => {
  process.env.MOCK_GEMMA = 'false'; delete process.env.GEMINI_API_KEY;
  const r = await compose(req(valid)); const b = await r.json();
  assert.equal(r.status, 503); assert.equal(b.error.code, 'not_configured');
});
test('simplify route uses the same error contract', async () => {
  process.env.MOCK_GEMMA = 'false'; delete process.env.GEMINI_API_KEY;
  const r = await simplify(new Request('http://x', { method: 'POST', body: JSON.stringify({ speech: 'wait', scenario: 'bank', lang: 'en' }) }));
  assert.equal(r.status, 503);
});
test('provider error classification is safe and stable', () => {
  assert.equal(classifyProviderError({ status: 401, message: 'key=SECRET' }, false).status, 502);
  assert.equal(classifyProviderError({ status: 403 }, false).code, 'provider_auth');
  assert.equal(classifyProviderError({ status: 429 }, false).status, 429);
  assert.equal(classifyProviderError(new Error('x'), true).code, 'timeout');
  assert.ok(!classifyProviderError({ status: 500, message: 'key=SECRET' }, false).message.includes('SECRET'));
});
