import test from 'node:test';
import assert from 'node:assert/strict';
import { VisionRecognizer } from '../lib/vision/recognizer';

// Node has no browser animation globals; the recognizer calls them in stop().
(globalThis as any).cancelAnimationFrame ??= () => {};
(globalThis as any).requestAnimationFrame ??= () => 0;

function setNavigator(getUserMedia: () => Promise<unknown>) {
  Object.defineProperty(globalThis, 'navigator', { value: { mediaDevices: { getUserMedia } }, configurable: true });
}
const track = () => { const t = { stopped: false, readyState: 'live', stop() { t.stopped = true; } }; return t; };

test('failure after the camera opens stops every acquired track and clears the video', async () => {
  const t = track();
  const stream = { getTracks: () => [t], getVideoTracks: () => [t] };
  setNavigator(async () => stream);
  const video: any = { srcObject: null, muted: false, playsInline: false, play: async () => { throw new DOMException('no', 'NotAllowedError'); } };
  await assert.rejects(new VisionRecognizer().start(video), /permission was denied/);
  assert.equal(t.stopped, true); assert.equal(video.srcObject, null);
});
test('denied permission is reported readably, no tracks to leak', async () => {
  setNavigator(async () => { throw new DOMException('denied', 'NotAllowedError'); });
  await assert.rejects(new VisionRecognizer().start({} as any), /permission was denied/);
});
test('missing devices / unsupported API', async () => {
  setNavigator(async () => { throw new DOMException('none', 'NotFoundError'); });
  await assert.rejects(new VisionRecognizer().start({} as any), /No usable camera/);
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  await assert.rejects(new VisionRecognizer().start({} as any), /not available/);
});
test('loadPack rejects a legacy-format pack instead of silently accepting it', () => {
  assert.throws(() => new VisionRecognizer().loadPack({ maxDistance: 1, signs: [] } as any), /Unsupported sign pack/);
});
