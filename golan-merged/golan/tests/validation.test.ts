import test from 'node:test';
import assert from 'node:assert/strict';
import { parseComposeRequest, parseSimplifyRequest } from '../lib/validation';

const base = { signs: ['HELP', 'HOSPITAL'], scenario: 'hospital', lang: 'en', history: [] as unknown[] };

test('accepts a valid request, with empty history', () => {
  assert.deepEqual(parseComposeRequest(base), base);
});
test('accepts valid history and strips unexpected keys', () => {
  const r = parseComposeRequest({ ...base, history: [{ who: 'signer', text: 'hi', extra: 1 }, { who: 'staff', text: 'ok' }] });
  assert.deepEqual(r?.history, [{ who: 'signer', text: 'hi' }, { who: 'staff', text: 'ok' }]);
});
test('rejects legacy {signs,sentence} history', () => {
  assert.equal(parseComposeRequest({ ...base, history: [{ signs: ['A'], sentence: 'x' }] }), null);
});
test('rejects missing text, invalid role, oversize turn, non-array history', () => {
  assert.equal(parseComposeRequest({ ...base, history: [{ who: 'signer' }] }), null);
  assert.equal(parseComposeRequest({ ...base, history: [{ who: 'robot', text: 'x' }] }), null);
  assert.equal(parseComposeRequest({ ...base, history: [{ who: 'staff', text: 'x'.repeat(1001) }] }), null);
  assert.equal(parseComposeRequest({ ...base, history: 'nope' }), null);
  assert.equal(parseComposeRequest({ ...base, history: undefined }), null);
});
test('every allowed scenario passes; unsupported (incl. legacy "general") fails', () => {
  for (const s of ['hospital', 'bank', 'office']) assert.ok(parseComposeRequest({ ...base, scenario: s }));
  assert.equal(parseComposeRequest({ ...base, scenario: 'general' }), null);
  assert.equal(parseComposeRequest({ ...base, scenario: undefined }), null);
});
test('language codes', () => {
  for (const l of ['en', 'hi', 'mr']) assert.ok(parseComposeRequest({ ...base, lang: l }));
  assert.equal(parseComposeRequest({ ...base, lang: 'fr' }), null);
});
test('signs validation', () => {
  assert.equal(parseComposeRequest({ ...base, signs: ['  '] }), null);
  assert.equal(parseComposeRequest({ ...base, signs: [1] }), null);
  assert.equal(parseComposeRequest({ ...base, signs: Array(101).fill('A') }), null);
  assert.ok(parseComposeRequest({ ...base, signs: [] })); // empty list is accepted; runCompose returns an empty fallback
});
test('non-object bodies', () => {
  for (const v of [null, 1, 'x', [], undefined]) assert.equal(parseComposeRequest(v), null);
});
test('simplify request', () => {
  assert.ok(parseSimplifyRequest({ speech: 'wait', scenario: 'bank', lang: 'hi' }));
  assert.equal(parseSimplifyRequest({ speech: 'wait', scenario: 'general', lang: 'hi' }), null);
});
