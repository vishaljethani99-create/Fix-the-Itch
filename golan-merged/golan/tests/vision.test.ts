import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSignPack } from '../lib/vision/pack';
import { CLIP_FRAMES, DIM, normalizeFrame, normalizeHand, resample } from '../lib/vision/normalize';
import { Matcher } from '../lib/vision/matcher';
import fs from 'node:fs';

const frame = (v = 0.1) => new Array(DIM).fill(v);
const clip = (v = 0.1) => Array.from({ length: CLIP_FRAMES }, () => frame(v));
const hand = (n = 21) => Array.from({ length: n }, (_, i) => ({ x: i / 40, y: i / 50, z: 0 }));

test('shipped default pack parses', () => {
  const pack = parseSignPack(JSON.parse(fs.readFileSync('public/packs/default.json', 'utf8')));
  assert.ok(pack.examples.length > 0);
});
test('pack parser rejects malformed packs', () => {
  assert.throws(() => parseSignPack(null), /JSON object/);
  assert.throws(() => parseSignPack({ maxDistance: 1, signs: [] }), /Unsupported sign pack/); // legacy vishal format
  assert.throws(() => parseSignPack({ version: 1, name: 'x' }), /examples/);
  assert.throws(() => parseSignPack({ version: 1, name: 'x', examples: [{ label: 'A', frames: [frame()] }] }), /16 frames/);
  assert.throws(() => parseSignPack({ version: 1, name: 'x', examples: [{ label: '', frames: clip() }] }), /no label/);
  const bad = clip(); bad[3] = frame(NaN);
  assert.throws(() => parseSignPack({ version: 1, name: 'x', examples: [{ label: 'A', frames: bad }] }), /finite/);
});
test('normalizeHand: valid, malformed', () => {
  const v = normalizeHand(hand(), false, 4 / 3);
  assert.equal(v.length, DIM);
  assert.deepEqual(v.slice(0, 3), [0, 0, 0]); // wrist at origin
  assert.throws(() => normalizeHand(hand(5), false, 1));
});
test('normalizeFrame: empty and malformed input yield has=false', () => {
  assert.equal(normalizeFrame([], [], 1).has, false);
  assert.equal(normalizeFrame([hand(3)], ['Right'], 1).has, false);
  assert.equal(normalizeFrame([hand()], ['Right'], NaN).has, true); // bad aspect falls back to 4/3
});
test('resample', () => {
  assert.deepEqual(resample([], 16), []);
  assert.equal(resample([frame(), frame(0.2)], 16).length, 16);
});
test('matcher accepts the nearest example and rejects far / malformed windows', () => {
  const m = new Matcher(0.2);
  m.setExamples([{ label: 'A', frames: clip(0.1) }, { label: 'B', frames: clip(0.9) }, { label: 'bad', frames: [frame()] }]);
  assert.equal(m.examples.length, 2); // malformed example dropped
  assert.equal(m.match(clip(0.11))?.label, 'A');
  assert.equal(m.match(clip(5)), null);
  assert.equal(m.match([frame()]), null);
});
