// Copies MediaPipe WASM into /public so the app never needs the CDN. Add to package.json:
//   "postinstall": "node scripts/copy-mediapipe.mjs"
import { cpSync, mkdirSync, existsSync } from 'node:fs';
const src = 'node_modules/@mediapipe/tasks-vision/wasm';
if (existsSync(src)) { mkdirSync('public/mediapipe', { recursive: true }); cpSync(src, 'public/mediapipe/wasm', { recursive: true }); console.log('MediaPipe wasm copied'); }
