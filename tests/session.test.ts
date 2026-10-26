import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../lib/session';
import { composeSigns } from '../lib/api';
import type { ComposeResponse } from '../lib/types';

type Call = { url: string; body: any };
function fakeFetch(handler: (c: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  (globalThis as any).fetch = async (url: string, init: RequestInit) => {
    const c = { url, body: JSON.parse(String(init.body)) };
    calls.push(c);
    return handler(c);
  };
  return calls;
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ok = (b: unknown) => Response.json(b);

test('session sends one validated request after the pause, with {who,text} history', async () => {
  const calls = fakeFetch(() => ok({ sentence: 'I need help.', fallback: false, source: 'live' }));
  const got: ComposeResponse[] = [];
  const s = createSession({ scenario: 'hospital', lang: 'en', pauseMs: 20, onSigns: () => {}, onSentence: (r) => got.push(r) });
  s.push({ label: 'HELP' }); s.push({ label: 'HELP' }); s.push({ label: 'DOCTOR' });
  await wait(80);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body, { signs: ['HELP', 'DOCTOR'], scenario: 'hospital', lang: 'en', history: [] });
  s.push({ label: 'PAIN' });
  await wait(80);
  assert.deepEqual(calls[1].body.history, [{ who: 'signer', text: 'I need help.' }]);
  assert.equal(got.length, 2);
});
test('configure() changes scenario/lang for later requests', async () => {
  const calls = fakeFetch(() => ok({ sentence: 'x', fallback: false, source: 'live' }));
  const s = createSession({ scenario: 'hospital', lang: 'en', pauseMs: 10, onSigns: () => {}, onSentence: () => {} });
  s.configure({ scenario: 'bank', lang: 'mr' });
  s.push({ label: 'A' }); await wait(50);
  assert.equal(calls[0].body.scenario, 'bank'); assert.equal(calls[0].body.lang, 'mr');
});
test('reset clears buffer, history, timer and ignores in-flight responses', async () => {
  const calls = fakeFetch(async () => { await wait(40); return ok({ sentence: 'late', fallback: false, source: 'live' }); });
  const got: ComposeResponse[] = []; let lastSigns: string[] = ['x'];
  const s = createSession({ scenario: 'bank', lang: 'en', pauseMs: 10, onSigns: (x) => (lastSigns = x), onSentence: (r) => got.push(r) });
  s.push({ label: 'A' }); await wait(25); // request now in flight
  s.reset(); await wait(80);
  assert.equal(got.length, 0); assert.deepEqual(lastSigns, []);
  s.push({ label: 'B' }); await wait(120);
  assert.deepEqual(calls[1].body.history, []); // history was cleared
  s.push({ label: 'C' }); s.reset(); await wait(40);
  assert.equal(calls.length, 2); // pending timer cancelled
});
test('fallback responses are not recorded as signer history', async () => {
  const calls = fakeFetch(() => new Response('{}', { status: 502 }));
  const s = createSession({ scenario: 'office', lang: 'en', pauseMs: 10, onSigns: () => {}, onSentence: () => {} });
  s.push({ label: 'A' }); await wait(40); s.push({ label: 'B' }); await wait(40);
  assert.deepEqual(calls[1].body.history, []);
});

test('composeSigns distinguishes failure kinds and never claims fallback is live', async () => {
  const req = { signs: ['HELP'], scenario: 'bank', lang: 'en', history: [] } as const;
  const cases: [Response | Error, RegExp][] = [
    [Response.json({ error: { code: 'invalid_request', message: 'Invalid compose request.' } }, { status: 400 }), /invalid/i],
    [Response.json({ error: { code: 'provider_auth', message: 'The server could not authenticate with the language model.' } }, { status: 502 }), /authenticate/],
    [Response.json({ error: { code: 'rate_limited', message: 'The language model is rate limited. Try again shortly.' } }, { status: 429 }), /rate limited/],
    [new Error('boom'), /Network error/],
    [ok({ nonsense: true }), /unexpected/],
  ];
  for (const [resp, re] of cases) {
    fakeFetch(() => { if (resp instanceof Error) throw resp; return resp; });
    const r = await composeSigns({ ...req, signs: [...req.signs], history: [] });
    assert.equal(r.source, 'fallback'); assert.equal(r.fallback, true);
    assert.equal(r.sentence, 'help'); assert.match(r.error ?? '', re);
  }
  fakeFetch(() => ok({ sentence: 'Hi', fallback: false }));
  assert.equal((await composeSigns({ ...req, signs: ['A'], history: [] })).source, 'live');
});
