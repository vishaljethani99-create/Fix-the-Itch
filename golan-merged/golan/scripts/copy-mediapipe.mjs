// Copies the MediaPipe WASM runtime from node_modules into public/ so the app never needs a CDN.
// Runs automatically after `npm install` (see "postinstall" in package.json).
import { cpSync, existsSync, mkdirSync } from 'node:fs';

const src = 'node_modules/@mediapipe/tasks-vision/wasm';
if (existsSync(src)) {
  mkdirSync('public/mediapipe', { recursive: true });
  cpSync(src, 'public/mediapipe/wasm', { recursive: true });
  console.log('MediaPipe wasm copied to public/mediapipe/wasm');
} else {
  console.warn('MediaPipe wasm not found in node_modules; the app will fall back to the CDN.');
}
